// @ts-nocheck — Deno runtime file: Node TS server cannot resolve deno.land/std imports
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
  // Protect via Authorization header (only cron can hit this via service role)
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1. Get all users
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;

    // We get last month's date range
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
    const monthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('default', { month: 'long' });

    let sentCount = 0;

    // 2. Loop users and gather their stats
    for (const user of users.users) {
      if (!user.email) continue;

      // Fetch last month's transactions for this user
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', user.id)
        .gte('date', firstDayLastMonth)
        .lte('date', lastDayLastMonth);

      if (txError || !transactions || transactions.length === 0) continue; // Skip if no activity

      const totalSpent = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h1 style="color: #4F46E5;">Your ${monthName} Spend Report 📊</h1>
          <p>Hi ${user.user_metadata?.full_name || 'there'}, here's a quick look at your finances from last month.</p>
          
          <div style="display: flex; gap: 20px; margin: 30px 0;">
            <div style="flex: 1; background-color: #FEE2E2; padding: 20px; border-radius: 12px; text-align: center;">
              <h4 style="margin: 0; color: #DC2626; text-transform: uppercase; font-size: 12px;">Total Spent</h4>
              <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #991B1B;">₹${totalSpent.toLocaleString()}</p>
            </div>
            <div style="flex: 1; background-color: #DCFCE7; padding: 20px; border-radius: 12px; text-align: center;">
              <h4 style="margin: 0; color: #16A34A; text-transform: uppercase; font-size: 12px;">Total Earned</h4>
              <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #166534;">₹${totalIncome.toLocaleString()}</p>
            </div>
          </div>

          <p>Open the SmartSpend app to see full insights and categorization.</p>
          <a href="https://smartspend.vercel.app" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">View Full Dashboard</a>
        </div>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "SmartSpend <reports@resend.dev>",
          to: [user.email],
          subject: `Your ${monthName} SmartSpend Report`,
          html: htmlContent,
        }),
      });

      sentCount++;
    }

    return new Response(JSON.stringify({ success: true, emailsSent: sentCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Cron Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500 });
  }
});
