-- ============================================================================
-- RUHIT OUTREACH SOLUTIONS (ROS) — REAL-TIME CHAT V1 DATABASE MIGRATION
-- Safe, idempotent migration script for Supabase SQL Editor
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
CREATE INDEX IF NOT EXISTS idx_chat_conversations_participants ON public.chat_conversations USING GIN (participant_ids);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Set RLS Policies (Idempotent: drop if exists and recreate)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow select chat_conversations" ON public.chat_conversations;
    DROP POLICY IF EXISTS "Allow insert/update chat_conversations" ON public.chat_conversations;
    DROP POLICY IF EXISTS "Allow select chat_messages" ON public.chat_messages;
    DROP POLICY IF EXISTS "Allow insert chat_messages" ON public.chat_messages;
    DROP POLICY IF EXISTS "Allow update chat_messages" ON public.chat_messages;
END $$;

CREATE POLICY "Allow select chat_conversations" 
ON public.chat_conversations FOR SELECT 
USING (true);

CREATE POLICY "Allow insert/update chat_conversations" 
ON public.chat_conversations FOR ALL 
USING (true);

CREATE POLICY "Allow select chat_messages" 
ON public.chat_messages FOR SELECT 
USING (true);

CREATE POLICY "Allow insert chat_messages" 
ON public.chat_messages FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update chat_messages" 
ON public.chat_messages FOR UPDATE 
USING (true);

-- 6. Enable Realtime Replication for chat tables (if not already enabled)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
EXCEPTION WHEN OTHERS THEN
    -- already added or not supported in this publication
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN OTHERS THEN
    -- already added or not supported in this publication
END $$;
