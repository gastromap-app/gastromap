import Stripe from 'stripe'

// Disable Vercel body parsing to get raw body for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
}

async function getRawBody(req) {
    const chunks = []
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    return Buffer.concat(chunks).toString('utf8')
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    const stripeKey = process.env.STRIPE_SECRET_KEY

    if (!webhookSecret || !stripeKey) {
        console.error('[stripe/webhook] Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY')
        return res.status(500).json({ error: 'Webhook not configured' })
    }

    const stripe = new Stripe(stripeKey)
    const sig = req.headers['stripe-signature']

    let event
    try {
        const rawBody = await getRawBody(req)
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err) {
        console.error('[stripe/webhook] Signature verification failed:', err.message)
        return res.status(400).json({ error: 'Invalid signature' })
    }

    // Handle events
    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object
                console.log('[stripe/webhook] Payment succeeded:', paymentIntent.id)
                // TODO: Update user subscription status in Supabase
                break
            }
            case 'invoice.paid': {
                const invoice = event.data.object
                console.log('[stripe/webhook] Invoice paid:', invoice.id)
                // TODO: Extend subscription period
                break
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object
                console.log('[stripe/webhook] Subscription cancelled:', subscription.id)
                // TODO: Revoke premium access
                break
            }
            default:
                console.log('[stripe/webhook] Unhandled event type:', event.type)
        }

        return res.status(200).json({ received: true })
    } catch (err) {
        console.error('[stripe/webhook] Event handling error:', err.message)
        return res.status(500).json({ error: 'Webhook handler failed' })
    }
}
