// @ts-nocheck — Deno runtime file: Node TS server cannot resolve deno.land/std imports
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    const body = await req.json();
    console.log("Webhook full payload:", JSON.stringify(body));

    // Supabase Database Webhooks wrap data in { record: {...} }
    // Direct calls may send { email, full_name } flat
    const record = body?.record ?? body;

    // Try to find email from multiple possible locations
    const email =
      record?.email ??
      record?.raw_user_meta_data?.email ??
      body?.email ??
      null;

    // Try to find name
    const name =
      record?.raw_user_meta_data?.full_name ??
      record?.full_name ??
      body?.full_name ??
      "there";

    if (!email) {
      console.warn("No email found in payload, skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "no email" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h1 style="color: #4F46E5;">Welcome to SmartSpend, ${name}! 🎉</h1>
        <p>We're thrilled to have you on board. Managing your personal finances is about to get a whole lot easier.</p>

        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #111;">3 Quick Tips to Get Started:</h3>
          <ol style="margin-bottom: 0;">
            <li style="margin-bottom: 10px;"><strong>Add your first Wallet:</strong> Tap the "+" button on the Dashboard.</li>
            <li style="margin-bottom: 10px;"><strong>Scan a Receipt:</strong> Use our AI Receipt Scanner to instantly log an expense.</li>
            <li><strong>Set a Budget:</strong> Go to the Budgets tab to prevent overspending.</li>
          </ol>
        </div>

        <p>If you have any questions, simply reply to this email!</p>
        <p>Best regards,<br/>The SmartSpend Team</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SmartSpend <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to SmartSpend! 🎉",
        html: htmlContent,
      }),
    });

    const data = await res.json();
    console.log("Resend response:", JSON.stringify(data));

    // Always return 200 — even if Resend fails, we don't want Supabase to retry
    return new Response(JSON.stringify({ success: res.ok, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unhandled error:", err);
    // Still return 200 to prevent Supabase webhook retry loops
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
