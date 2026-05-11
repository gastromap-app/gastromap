import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.20.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature || !endpointSecret) {
    return new Response("Webhook secret or signature missing", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;

      if (userId) {
        // Initialize supabase client with service role key to bypass RLS
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Record the payment in the 'payments' table
        await supabase.from('payments').insert({
          user_id: userId,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent as string || null,
          product_id: 'donation', 
          product_name: 'Support GastroMap',
          amount: session.amount_total || 0,
          currency: (session.currency || 'USD').toUpperCase(),
          status: 'succeeded',
          paid_at: new Date().toISOString()
        });

        // 2. Update user's role to 'contributor' (which represents supporter)
        // Check current role first so we don't downgrade an 'admin'
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .single();
            
        if (!roleData) {
            await supabase.from('user_roles').insert({
                user_id: userId,
                role: 'contributor'
            });
        } else if (roleData.role === 'user') {
            await supabase.from('user_roles')
                .update({ role: 'contributor' })
                .eq('user_id', userId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      `Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      { status: 400 }
    );
  }
});
