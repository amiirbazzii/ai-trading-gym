-- Migration: User-specific AI Strategies
-- This migration adds a user_id column to ai_strategies and updates RLS policies.

-- 1. Add user_id column to ai_strategies
ALTER TABLE public.ai_strategies 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users DEFAULT auth.uid();

-- 2. Update existing strategies to be assigned to the first user found (if any)
-- This is a fallback for existing data.
DO $$
DECLARE
  first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM auth.users LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    UPDATE public.ai_strategies SET user_id = first_user_id WHERE user_id IS NULL;
  END IF;
END $$;

-- 3. Make user_id not null after assigning existing ones
ALTER TABLE public.ai_strategies 
ALTER COLUMN user_id SET NOT NULL;

-- 4. Update RLS policies for ai_strategies
DROP POLICY IF EXISTS "Strategies are viewable by everyone" ON public.ai_strategies;
DROP POLICY IF EXISTS "Authenticated users can create strategies" ON public.ai_strategies;
DROP POLICY IF EXISTS "Allow strategy balance updates" ON public.ai_strategies;

-- Users can only view their own strategies
CREATE POLICY "Users can view own strategies" ON public.ai_strategies
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own strategies
CREATE POLICY "Users can create own strategies" ON public.ai_strategies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own strategies
CREATE POLICY "Users can update own strategies" ON public.ai_strategies
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own strategies
CREATE POLICY "Users can delete own strategies" ON public.ai_strategies
  FOR DELETE USING (auth.uid() = user_id);
