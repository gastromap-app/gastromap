-- ═══════════════════════════════════════════════════════════════════════════════
-- Notifications table — stores admin and user notifications
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user-specific queries (ordered by date)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
    ON public.notifications(user_id, created_at DESC);

-- Index for unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON public.notifications(user_id, read) WHERE read = false;

-- ─── RLS Policies ──────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users update own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admin/service_role can insert notifications for any user
CREATE POLICY "Service role insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

-- Admin can manage all notifications
CREATE POLICY "Admin manage all notifications"
    ON public.notifications FOR ALL
    USING (public.get_my_role() = 'admin');

-- ─── Grants ────────────────────────────────────────────────────────────────

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Enable Realtime for notifications (instant push to admin panel)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
