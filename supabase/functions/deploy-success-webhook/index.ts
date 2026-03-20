// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { initializeApp, cert } from "npm:firebase-admin@11.11.0/app";
import { getMessaging } from "npm:firebase-admin@11.11.0/messaging";

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getFirebaseApp = async () => {
  try {
    const serviceAccountKey = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY');

    // Check if it's base64 encoded or a raw JSON string
    let parsedKey;
    try {
      parsedKey = JSON.parse(serviceAccountKey);
    } catch {
      const decodedInfo = atob(serviceAccountKey);
      parsedKey = JSON.parse(decodedInfo);
    }

    return initializeApp({
      credential: cert(parsedKey),
    }, 'deploy-webhook-app'); // custom name to avoid conflicts if lazy loaded
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      // Return the existing one if for some reason Deno keeps it warm
      // (in Edge functions, global variables are usually lost, but just in case)
      const fireadmin = await import("npm:firebase-admin@11.11.0/app");
      return fireadmin.getApp('deploy-webhook-app');
    }
    throw error;
  }
};

serve(async (req: Request) => {
  // Handle CORS preflight requests perfectly
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    // Parse Vercel Webhook payload
    const body = await req.json();
    console.log("Vercel Webhook Payload:", JSON.stringify(body));

    // Vercel sends "deployment" payload event type, but we might want to check for "ready" or "success" status
    const deploymentStatus = body?.payload?.deployment?.state || body?.payload?.state;

    // Even if we skip the strict state check to allow testing, we should try to extract the commit message
    const commitMessage = body?.payload?.deployment?.meta?.githubCommitMessage || "We've just released some awesome new updates.";

    // Initialize Supabase Admin
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get all FCM tokens from profiles
    const { data: profiles, error: dbError } = await supabaseClient
      .from('profiles')
      .select('fcm_token')
      .not('fcm_token', 'is', null);

    if (dbError) throw dbError;

    const tokens = profiles?.map((p: { fcm_token: string }) => p.fcm_token).filter(Boolean) || [];

    if (tokens.length === 0) {
      console.log("No FCM tokens found. Exiting gracefully.");
      return new Response(JSON.stringify({ success: true, message: "No subscribers" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Initialize Firebase Admin
    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    // 3. Send Multicast Message
    const message = {
      notification: {
        title: "New Update Available! 🚀",
        body: commitMessage,
      },
      tokens: tokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} messages; failed ${response.failureCount}.`);

    return new Response(JSON.stringify({
      success: true,
      sent: response.successCount,
      failed: response.failureCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
