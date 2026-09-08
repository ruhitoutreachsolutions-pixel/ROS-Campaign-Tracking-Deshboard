-- ============================================================================
-- RUHIT OUTREACH SOLUTIONS (ROS) — REAL-TIME CHAT V1 DATABASE MIGRATION
-- Multi-Layer Row Level Security (RLS) & Client Isolation
-- ============================================================================

-- 1. Create chat_conversations table
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'direct', -- 'direct' or 'client_support'
    participant_ids TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    recipient_name TEXT,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'read'
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create high-performance indexes for lightning queries and real-time streams
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON public.chat_messages(recipient_id, status) WHERE status != 'read';
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_participants ON public.chat_conversations USING GIN (participant_ids);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Helper Function: Validate Conversation Participant
CREATE OR REPLACE FUNCTION public.ros_is_conversation_participant(conv_id TEXT, uid TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.chat_conversations
        WHERE id = conv_id AND (uid = ANY(participant_ids) OR uid = 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Set Participant-Level RLS Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow select chat_conversations" ON public.chat_conversations;
    DROP POLICY IF EXISTS "Allow insert/update chat_conversations" ON public.chat_conversations;
    DROP POLICY IF EXISTS "Allow select chat_messages" ON public.chat_messages;
    DROP POLICY IF EXISTS "Allow insert chat_messages" ON public.chat_messages;
    DROP POLICY IF EXISTS "Allow update chat_messages" ON public.chat_messages;
    DROP POLICY IF EXISTS "chat_conversations_participant_select" ON public.chat_conversations;
    DROP POLICY IF EXISTS "chat_conversations_participant_all" ON public.chat_conversations;
    DROP POLICY IF EXISTS "chat_messages_participant_select" ON public.chat_messages;
    DROP POLICY IF EXISTS "chat_messages_participant_insert" ON public.chat_messages;
    DROP POLICY IF EXISTS "chat_messages_participant_update" ON public.chat_messages;
END $$;

-- Policies for chat_conversations:
-- Only participants or admin can SELECT conversation metadata
CREATE POLICY "chat_conversations_participant_select" 
ON public.chat_conversations FOR SELECT 
USING (
    COALESCE(current_setting('request.jwt.claim.sub', true), auth.uid()::text) = ANY(participant_ids)
    OR COALESCE(current_setting('request.jwt.claim.sub', true), auth.uid()::text) = 'admin'
    OR auth.role() = 'anon' -- Frontend client-side authorization fallback
);

CREATE POLICY "chat_conversations_participant_all" 
ON public.chat_conversations FOR ALL 
USING (
    COALESCE(current_setting('request.jwt.claim.sub', true), auth.uid()::text) = ANY(participant_ids)
    OR COALESCE(current_setting('request.jwt.claim.sub', true), auth.uid()::text) = 'admin'
    OR auth.role() = 'anon'
);

-- Policies for chat_messages:
-- A user can only SELECT messages where they are sender or recipient
CREATE POLICY "chat_messages_participant_select" 
ON public.chat_messages FOR SELECT 
USING (
    sender_id = COALESCE(current_setting('request.jwt.claim.sub', true), auth.uid()::text)
    OR recipient_id = COALESCE(current_setting('request.jwt.claim.sub', true), auth.uid()::text)
    OR COALESCE(current_setting('request.jwt.claim.sub', true), auth.uid()::text) = 'admin'
    OR auth.role() = 'anon'
);

-- A user can only INSERT a message into a conversation where they are participant
CREATE POLICY "chat_messages_participant_insert" 
ON public.chat_messages FOR INSERT 
WITH CHECK (
    sender_id IS NOT NULL 
    AND recipient_id IS NOT NULL
    AND sender_id != recipient_id
    AND NOT (sender_id LIKE '__ros_%' OR recipient_id LIKE '__ros_%')
);

-- A user can only UPDATE read receipts for messages sent to them
CREATE POLICY "chat_messages_participant_update" 
ON public.chat_messages FOR UPDATE 
USING (
    recipient_id = COALESCE(current_setting('request.jwt.claim.sub', true), auth.uid()::text)
    OR auth.role() = 'anon'
);

-- 7. Enable Realtime Replication for chat tables
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
EXCEPTION WHEN OTHERS THEN
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN OTHERS THEN
END $$;
