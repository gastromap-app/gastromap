import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    initializeStripe,
    createPaymentIntent,
    confirmPayment,
    createCheckoutSession,
    getProducts,
    getProduct,
    handleWebhook,
    isStripeEnabled,
    getStripeConfig,
} from './stripe.api'

// ─── Mock Supabase client ──────────────────────────────────────────────────
const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({ insert: mockInsert }))
mockInsert.mockResolvedValue({ data: null, error: null })

vi.mock('./client', () => ({
    supabase: {
        from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) })),
    },
}))

// ─── Tests ────────────────────────────────────────────────────────────────

describe('stripe.api', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    // ─── initializeStripe ────────────────────────────────────────────────

    describe('initializeStripe', () => {
        it('returns enabled=true and mode=test in stub', async () => {
            const result = await initializeStripe()
            expect(result.enabled).toBe(true)
            expect(result.mode).toBe('test')
            expect(result.publishableKey).toMatch(/^pk_test_/)
        })
    })

    // ─── getProducts / getProduct ────────────────────────────────────────

    describe('getProducts', () => {
        it('returns a non-empty array of products', () => {
            const products = getProducts()
            expect(Array.isArray(products)).toBe(true)
            expect(products.length).toBeGreaterThan(0)
        })

        it('returns products with required fields', () => {
            const products = getProducts()
            products.forEach(p => {
                expect(p).toHaveProperty('id')
                expect(p).toHaveProperty('name')
                expect(p).toHaveProperty('price')
                expect(p).toHaveProperty('currency')
            })
        })

        it('includes monthly and yearly subscription products', () => {
            const products = getProducts()
            const ids = products.map(p => p.id)
            expect(ids).toContain('prod_subscription_monthly')
            expect(ids).toContain('prod_subscription_yearly')
        })
    })

    describe('getProduct', () => {
        it('returns the correct product by id', () => {
            const product = getProduct('prod_subscription_monthly')
            expect(product).not.toBeNull()
            expect(product.id).toBe('prod_subscription_monthly')
            expect(product.currency).toBe('PLN')
        })

        it('returns null for unknown product id', () => {
            const product = getProduct('prod_nonexistent')
            expect(product).toBeNull()
        })
    })

    // ─── createPaymentIntent ─────────────────────────────────────────────

    describe('createPaymentIntent', () => {
        it('creates a payment intent for a valid product', async () => {
            const result = await createPaymentIntent({
                productId: 'prod_subscription_monthly',
                userId: 'user1',
                email: 'test@example.com',
            })

            expect(result.id).toMatch(/^pi_mock_/)
            expect(result.client_secret).toMatch(/^secret_mock_/)
            expect(result.amount).toBe(2999)
            expect(result.currency).toBe('PLN')
            expect(result.status).toBe('requires_payment_method')
            expect(result.metadata.userId).toBe('user1')
            expect(result.metadata.email).toBe('test@example.com')
        })

        it('creates intent for yearly subscription', async () => {
            const result = await createPaymentIntent({
                productId: 'prod_subscription_yearly',
                userId: 'u2',
                email: 'yearly@test.com',
            })

            expect(result.amount).toBe(28790)
            expect(result.product.interval).toBe('year')
        })

        it('throws when product not found', async () => {
            await expect(createPaymentIntent({
                productId: 'prod_nonexistent',
                userId: 'u1',
                email: 'e@e.com',
            })).rejects.toThrow('Product not found')
        })

        it('includes product details in the intent', async () => {
            const result = await createPaymentIntent({
                productId: 'prod_subscription_monthly',
                userId: 'u3',
                email: 'e@e.com',
            })

            expect(result.product.name).toBe('GastroMap Pro')
            expect(Array.isArray(result.product.features)).toBe(true)
        })

        it('throws when productId is missing', async () => {
            await expect(createPaymentIntent({
                userId: 'u1',
                email: 'e@e.com',
            })).rejects.toThrow('Product not found')
        })
    })

    // ─── confirmPayment ──────────────────────────────────────────────────

    describe('confirmPayment', () => {
        it('confirms payment with success card number', async () => {
            const confirmPromise = confirmPayment('pi_mock_123', {
                card: { number: '4242424242424242' }
            })
            // Advance timers to skip 1000ms delay
            vi.advanceTimersByTime(1500)
            const result = await confirmPromise

            expect(result.status).toBe('succeeded')
            expect(result.paid).toBe(true)
            expect(result.payment_intent).toBe('pi_mock_123')
            expect(result.receipt_url).toContain('pi_mock_123')
        })

        it('confirms payment with BLIK code', async () => {
            const confirmPromise = confirmPayment('pi_mock_456', {
                blik: '123456'
            })
            vi.advanceTimersByTime(1500)
            const result = await confirmPromise

            expect(result.status).toBe('succeeded')
            expect(result.paid).toBe(true)
        })

        it('throws when using decline card number', async () => {
            const confirmPromise = confirmPayment('pi_mock_789', {
                card: { number: '4000000000000002' }
            })
            vi.advanceTimersByTime(1500)

            await expect(confirmPromise).rejects.toThrow('Payment declined')
        })

        it('throws when payment method is missing', async () => {
            const confirmPromise = confirmPayment('pi_mock_bad', null)
            vi.advanceTimersByTime(1500)
            await expect(confirmPromise).rejects.toThrow()
        })

        it('throws when wrong BLIK code provided', async () => {
            const confirmPromise = confirmPayment('pi_mock_blik', { blik: '999999' })
            vi.advanceTimersByTime(1500)
            await expect(confirmPromise).rejects.toThrow('Payment declined')
        })
    })

    // ─── createCheckoutSession ───────────────────────────────────────────

    describe('createCheckoutSession', () => {
        it('creates a checkout session for valid product', async () => {
            const result = await createCheckoutSession({
                productId: 'prod_subscription_monthly',
                userId: 'u1',
                email: 'test@example.com',
                successUrl: 'https://app.com/success',
                cancelUrl: 'https://app.com/cancel',
            })

            expect(result.id).toMatch(/^cs_mock_/)
            expect(result.url).toMatch(/^https:\/\/mock\.stripe\.com\/checkout\//)
            expect(result.status).toBe('open')
            expect(result.success_url).toBe('https://app.com/success')
            expect(result.cancel_url).toBe('https://app.com/cancel')
            expect(result.metadata.userId).toBe('u1')
            expect(result.expires_at).toBeGreaterThan(Date.now() - 1000)
        })

        it('includes product info in session', async () => {
            const result = await createCheckoutSession({
                productId: 'prod_subscription_yearly',
                userId: 'u2',
                email: 'e@e.com',
                successUrl: '/',
                cancelUrl: '/',
            })

            expect(result.product.interval).toBe('year')
            expect(result.amount).toBe(28790)
        })

        it('throws when product not found', async () => {
            await expect(createCheckoutSession({
                productId: 'prod_bad',
                userId: 'u',
                email: 'e@e.com',
            })).rejects.toThrow('Product not found')
        })
    })

    // ─── handleWebhook ───────────────────────────────────────────────────

    describe('handleWebhook', () => {
        it('acknowledges webhook event', async () => {
            const result = await handleWebhook('sig_123', { type: 'payment_intent.succeeded' })
            expect(result.received).toBe(true)
            expect(result.processed).toBe(true)
            expect(result.type).toBe('payment_intent.succeeded')
        })

        it('uses mock.event type when event is null', async () => {
            const result = await handleWebhook('sig', null)
            expect(result.type).toBe('mock.event')
        })
    })

    // ─── isStripeEnabled / getStripeConfig ───────────────────────────────

    describe('isStripeEnabled', () => {
        it('returns true', () => {
            expect(isStripeEnabled()).toBe(true)
        })
    })

    describe('getStripeConfig', () => {
        it('returns config with mode, currency, and supportedMethods', () => {
            const cfg = getStripeConfig()
            expect(cfg.mode).toBe('test')
            expect(cfg.currency).toBe('PLN')
            expect(cfg.supportedMethods).toContain('card')
            expect(cfg.supportedMethods).toContain('blik')
        })

        it('returns a copy so original config cannot be mutated', () => {
            const cfg1 = getStripeConfig()
            cfg1.currency = 'USD'
            const cfg2 = getStripeConfig()
            expect(cfg2.currency).toBe('PLN')
        })
    })
})
