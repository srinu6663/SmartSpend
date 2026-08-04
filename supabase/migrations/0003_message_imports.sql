-- ============================================================================
-- Message imports (SMS / email ingestion)
--
-- Every parsed message is recorded here BEFORE a transaction is created, keyed
-- by a fingerprint. This is what stops duplicates, and duplicates are the
-- default outcome without it:
--
--   * Android delivers SMS_RECEIVED to the app, and a later inbox scan sees the
--     same message again.
--   * Banks re-send alerts.
--   * Reinstalling the app or switching devices replays the whole inbox.
--   * The Gmail poller re-reads a thread whenever a label changes.
--
-- The UNIQUE (user_id, fingerprint) constraint makes re-import a no-op at the
-- database level, so correctness does not depend on the client remembering
-- anything. Client-side memory would be lost on reinstall — exactly when the
-- risk of a duplicate flood is highest.
-- ============================================================================

create table if not exists public.message_imports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  -- 'sms' | 'email'
  source       text not null,
  -- Deterministic key from the parser: bank reference when available, else a
  -- hash of amount/date/account/body.
  fingerprint  text not null,

  -- What the parser extracted, kept for the review UI and for auditing a
  -- mis-parse after the fact.
  sender       text,
  body         text,
  amount       numeric(14,2),
  direction    text check (direction in ('expense', 'income')),
  merchant     text,
  account_tail text,
  occurred_on  date,
  confidence   numeric(4,3),

  -- 'pending'  — awaiting user review (low confidence)
  -- 'imported' — a transaction was created
  -- 'ignored'  — user dismissed it
  status       text not null default 'pending'
                 check (status in ('pending', 'imported', 'ignored')),

  -- Set when status = 'imported'. ON DELETE SET NULL so deleting a transaction
  -- doesn't delete the import record — otherwise the message would look unseen
  -- and get re-imported on the next scan.
  transaction_id uuid references public.transactions(id) on delete set null,

  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,

  constraint message_imports_source_check check (source in ('sms', 'email')),
  constraint message_imports_unique_per_user unique (user_id, fingerprint)
);

create index if not exists message_imports_pending_idx
  on public.message_imports (user_id, status, created_at desc);

alter table public.message_imports enable row level security;

-- Each user sees and writes only their own rows.
drop policy if exists "message_imports_select_own" on public.message_imports;
create policy "message_imports_select_own" on public.message_imports
  for select using (auth.uid() = user_id);

drop policy if exists "message_imports_insert_own" on public.message_imports;
create policy "message_imports_insert_own" on public.message_imports
  for insert with check (auth.uid() = user_id);

drop policy if exists "message_imports_update_own" on public.message_imports;
create policy "message_imports_update_own" on public.message_imports
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "message_imports_delete_own" on public.message_imports;
create policy "message_imports_delete_own" on public.message_imports
  for delete using (auth.uid() = user_id);


-- ── Claim a fingerprint ─────────────────────────────────────────────────────
-- Returns the row id when this message is new, or NULL when already seen.
--
-- ON CONFLICT DO NOTHING makes the check-and-insert atomic. A plain
-- "SELECT then INSERT" from the client would race: the SMS receiver and a
-- concurrent inbox scan can process the same message at the same moment, both
-- see nothing, and both insert.
create or replace function public.claim_message_import(
  p_source       text,
  p_fingerprint  text,
  p_sender       text,
  p_body         text,
  p_amount       numeric,
  p_direction    text,
  p_merchant     text,
  p_account_tail text,
  p_occurred_on  date,
  p_confidence   numeric,
  p_status       text default 'pending'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.message_imports (
    user_id, source, fingerprint, sender, body, amount, direction,
    merchant, account_tail, occurred_on, confidence, status
  )
  values (
    auth.uid(), p_source, p_fingerprint, p_sender, p_body, p_amount, p_direction,
    p_merchant, p_account_tail, p_occurred_on, p_confidence, p_status
  )
  on conflict (user_id, fingerprint) do nothing
  returning id into v_id;

  return v_id; -- NULL means "already imported", so the caller should skip
end;
$$;

comment on function public.claim_message_import is
  'Atomically records a parsed message. Returns NULL if the fingerprint was already seen.';
