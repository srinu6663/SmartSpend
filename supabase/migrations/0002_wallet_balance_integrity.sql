-- ============================================================================
-- Wallet balance integrity
--
-- Before this, wallet balances were maintained by the CLIENT: it inserted a
-- transaction, then issued separate UPDATE statements computing
-- `balance = <value read from local store> ± amount`. That had four defects:
--
--   1. NOT ATOMIC — insert and balance update were separate requests. A dropped
--      connection between them left a transaction with no balance change.
--   2. LOST UPDATES — the new balance was computed from a value the client had
--      read earlier. Two transactions in flight (or a second device) meant one
--      overwrote the other's result.
--   3. DELETE NEVER REVERSED — deleting a transaction removed the row but left
--      the balance permanently adjusted. Money silently vanished from the books.
--   4. UPDATE NEVER ADJUSTED — editing an amount drifted the balance by the
--      difference, forever.
--
-- Balances are now derived in the database by trigger, inside the same
-- transaction as the row change. Reads are `balance = balance ± amount`, so
-- concurrent writers serialise on the row lock instead of clobbering.
--
-- The client no longer touches wallet balances at all.
-- ============================================================================

-- Applies (p_sign = 1) or reverses (p_sign = -1) a transaction's effect.
--
-- SECURITY DEFINER so the trigger can update `wallets` regardless of the
-- caller's RLS policy — but every UPDATE is additionally constrained by
-- user_id, so a transaction can only ever move ITS OWN owner's wallets. Without
-- that guard, a forged wallet_id could alter another user's balance.
create or replace function public.apply_transaction_balance(
  p_user_id   uuid,
  p_type      text,
  p_amount    numeric,
  p_wallet_id uuid,
  p_to_wallet_id uuid,
  p_sign      int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric;
begin
  if p_amount is null or p_amount = 0 or p_user_id is null then
    return;
  end if;

  -- Guard against a negative amount sneaking in and inverting the maths.
  v_delta := round(abs(p_amount)::numeric, 2) * p_sign;

  if p_type = 'transfer' then
    if p_wallet_id is not null then
      update public.wallets
         set balance = round(balance - v_delta, 2)
       where id = p_wallet_id and user_id = p_user_id;
    end if;

    if p_to_wallet_id is not null then
      update public.wallets
         set balance = round(balance + v_delta, 2)
       where id = p_to_wallet_id and user_id = p_user_id;
    end if;

  elsif p_type = 'expense' then
    if p_wallet_id is not null then
      update public.wallets
         set balance = round(balance - v_delta, 2)
       where id = p_wallet_id and user_id = p_user_id;
    end if;

  elsif p_type = 'income' then
    if p_wallet_id is not null then
      update public.wallets
         set balance = round(balance + v_delta, 2)
       where id = p_wallet_id and user_id = p_user_id;
    end if;
  end if;
end;
$$;

comment on function public.apply_transaction_balance is
  'Adjusts wallet balance(s) for a transaction. p_sign = 1 applies, -1 reverses.';


create or replace function public.transactions_balance_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.apply_transaction_balance(
      new.user_id, new.type::text, new.amount, new.wallet_id, new.to_wallet_id, 1
    );
    return new;

  elsif (tg_op = 'DELETE') then
    perform public.apply_transaction_balance(
      old.user_id, old.type::text, old.amount, old.wallet_id, old.to_wallet_id, -1
    );
    return old;

  elsif (tg_op = 'UPDATE') then
    -- Reverse the old shape, then apply the new one. This handles a change to
    -- amount, type, or either wallet in one path, including moving a
    -- transaction between wallets.
    perform public.apply_transaction_balance(
      old.user_id, old.type::text, old.amount, old.wallet_id, old.to_wallet_id, -1
    );
    perform public.apply_transaction_balance(
      new.user_id, new.type::text, new.amount, new.wallet_id, new.to_wallet_id, 1
    );
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_transactions_balance_sync on public.transactions;

create trigger trg_transactions_balance_sync
after insert or update or delete on public.transactions
for each row execute function public.transactions_balance_sync();


-- ── Atomic goal contributions ───────────────────────────────────────────────
-- Was `current_amount: goal.current_amount + delta` read from client state:
-- the same lost-update race as wallet balances.
--
-- SECURITY INVOKER (the default) so the caller's RLS still applies, plus an
-- explicit auth.uid() check so one user can never fund another's goal.
create or replace function public.increment_goal_amount(
  p_goal_id uuid,
  p_delta   numeric
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_new numeric;
begin
  update public.goals
     set current_amount = greatest(0, round(current_amount + p_delta, 2))
   where id = p_goal_id
     and user_id = auth.uid()
  returning current_amount into v_new;

  if v_new is null then
    raise exception 'Goal not found or not owned by the current user';
  end if;

  return v_new;
end;
$$;

comment on function public.increment_goal_amount is
  'Atomically adds p_delta to a goal''s current_amount. Floors at 0.';


-- ============================================================================
-- IMPORTANT — existing data
--
-- This trigger fires only on future changes. Any balance drift already caused
-- by defects 3 and 4 above (deleted or edited transactions) is still baked into
-- your current `wallets.balance` values.
--
-- Balances cannot be recomputed from transactions alone, because `wallets` has
-- no opening-balance column — the stored balance conflates the starting amount
-- with every subsequent movement. So verify each wallet by hand once, and
-- correct it with:
--
--   update public.wallets set balance = <true value> where id = '<wallet-id>';
--
-- If you want this to be self-healing in future, add an `opening_balance`
-- column and derive `balance` as a view. Worth doing, but it is a schema change
-- with app-wide effects, so it is deliberately not bundled here.
-- ============================================================================
