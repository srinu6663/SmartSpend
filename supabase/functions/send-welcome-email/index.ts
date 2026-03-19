// @ts-nocheck
// Supabase Edge Function — runs on Deno runtime, not Node.js
// Deploy: supabase functions deploy send-welcome-email

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { email, name } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const displayName = name || "there";

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 40px 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 26px; font-weight: 800; }
    .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .greeting { color: #111827; font-size: 16px; margin-bottom: 8px; }
    .subtext { color: #6B7280; font-size: 14px; margin-bottom: 24px; line-height: 1.6; }
    .tip { background: #F5F3FF; border-left: 3px solid #7C3AED; padding: 12px 16px; border-radius: 8px; margin: 10px 0; }
    .tip p { margin: 0; font-size: 14px; color: #374151; line-height: 1.5; }
    .cta { display: block; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white !important; text-decoration: none; padding: 14px 24px; border-radius: 12px; text-align: center; font-weight: 700; font-size: 15px; margin-top: 24px; }
    .footer { padding: 16px 32px 24px; text-align: center; color: #9CA3AF; font-size: 12px; border-top: 1px solid #F3F4F6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Welcome to SmartSpend!</h1>
      <p>Your personal finance journey starts now.</p>
    </div>
    <div class="body">
      <p class="greeting">Hey ${displayName} 👋</p>
      <p class="subtext">You've just joined SmartSpend — the smartest way to track your money in India. Here's how to get started in 3 simple steps:</p>

      <div class="tip"><p>💼 <strong>Create your wallets</strong> — Add Bank, Cash, or Credit Card accounts from the Home screen.</p></div>
      <div class="tip"><p>➕ <strong>Log your first transaction</strong> — Tap the blue <strong>+</strong> button to record income or an expense.</p></div>
      <div class="tip"><p>🎯 <strong>Set a budget</strong> — Head to Finances → Budgets to cap monthly spending by category.</p></div>

      <a href="https://smartspend.vercel.app" class="cta">Open SmartSpend →</a>
    </div>
    <div class="footer">
      <p>You received this because you signed up for SmartSpend.<br>© 2025 SmartSpend. Made with ❤️ for India.</p>
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
        subject: `Welcome to SmartSpend ${displayName !== "there" ? displayName + "!" : "—"} Let's build better money habits 💰`,
        html,
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: response.ok ? 200 : 400,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
