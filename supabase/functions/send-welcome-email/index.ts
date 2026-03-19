// Supabase Edge Function: send-welcome-email
// Deploy with: supabase functions deploy send-welcome-email

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  try {
    const { email, name } = await req.json();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 40px 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; }
    .body { padding: 32px; }
    .tip { background: #F5F3FF; border-left: 3px solid #7C3AED; padding: 12px 16px; border-radius: 8px; margin: 12px 0; }
    .tip p { margin: 0; font-size: 14px; color: #374151; }
    .cta { display: block; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white !important; text-decoration: none; padding: 14px 24px; border-radius: 12px; text-align: center; font-weight: 700; margin-top: 24px; }
    .footer { padding: 16px 32px; text-align: center; color: #9CA3AF; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Welcome to SmartSpend!</h1>
      <p>Your personal finance journey starts now, ${name || "there"}.</p>
    </div>
    <div class="body">
      <p style="color:#374151; font-size:15px;">Hey ${name || "there"} 👋,</p>
      <p style="color:#6B7280; font-size:14px;">You've just joined thousands of smart savers tracking their money better. Here's how to get started in 3 steps:</p>

      <div class="tip"><p>💼 <strong>Create your wallets</strong> — Add your Bank, Cash, or Credit Card accounts on the Home screen.</p></div>
      <div class="tip"><p>➕ <strong>Log your first transaction</strong> — Tap the blue + button to record income or an expense.</p></div>
      <div class="tip"><p>🎯 <strong>Set a budget</strong> — Head to Finances → Budgets and cap your monthly Food or Entertainment spend.</p></div>

      <a href="https://smartspend.vercel.app" class="cta">Open SmartSpend →</a>
    </div>
    <div class="footer">
      <p>You're getting this because you signed up for SmartSpend. © 2025 SmartSpend</p>
    </div>
  </div>
</body>
</html>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SmartSpend <onboarding@resend.dev>",
        to: [email],
        subject: "Welcome to SmartSpend 💰 — Let's build better money habits!",
        html,
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
      status: response.ok ? 200 : 400,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
