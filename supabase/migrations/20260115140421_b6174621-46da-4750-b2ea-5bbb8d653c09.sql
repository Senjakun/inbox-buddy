-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Service role only for bot_settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Service role only for processed_emails" ON public.processed_emails;
DROP POLICY IF EXISTS "Service role only for sent_messages" ON public.sent_messages;

-- Create proper PERMISSIVE policies that allow only service_role access
CREATE POLICY "Service role access for bot_settings" ON public.bot_settings
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role access for processed_emails" ON public.processed_emails
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role access for sent_messages" ON public.sent_messages
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Block all other access (anon and authenticated users)
CREATE POLICY "Block public access to bot_settings" ON public.bot_settings
  FOR ALL 
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block public access to processed_emails" ON public.processed_emails
  FOR ALL 
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Block public access to sent_messages" ON public.sent_messages
  FOR ALL 
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);