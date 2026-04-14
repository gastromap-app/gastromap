-- Migration: notifications + push_subscriptions tables
-- Date: 2026-04-14
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/myyzguendoruefiiufop/sql

-- ── Notifications history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        text NOT NULL,
    title       text NOT NULL,
    body        text,
    data        jsonb DEFAULT '{}',
    read        boolean DEFAULT false,
    created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
    ON public.notifications(user_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_own_notifications" ON public.notifications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "service_role_notifications" ON public.notifications
    FOR ALL USING (auth.role() = 'service_role');

-- ── Push subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint    text NOT NULL,
    keys        jsonb NOT NULL DEFAULT '{}',
    user_agent  text,
    updated_at  timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users_own_push_sub" ON public.push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "service_role_push_sub" ON public.push_subscriptions
    FOR ALL USING (auth.role() = 'service_role');
