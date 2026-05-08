import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Function triggered by Supabase Database Webhook (INSERT on auth.users or public.profiles)
serve(async (req) => {
  try {
    const body = await req.json();
    console.log("Webhook payload:", body);

    // Get the email from the payload (auth.users inserts usually have record.email)
    const email = body?.record?.email;
    const name = body?.record?.raw_user_meta_data?.full_name || "there";

    if (!email) {
      return new Response(JSON.stringify({ error: "No email provided in payload" }), { status: 400 });
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
    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Signup Webhook Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
