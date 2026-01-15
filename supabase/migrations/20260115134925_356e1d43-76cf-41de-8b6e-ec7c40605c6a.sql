-- Table for bot settings (owner only)
CREATE TABLE public.bot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_bot_token TEXT,
  telegram_owner_id TEXT,
  outlook_email TEXT,
  outlook_password TEXT,
  polling_interval_minutes INTEGER DEFAULT 1,
  email_filter TEXT DEFAULT 'OTP',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for tracking processed emails
CREATE TABLE public.processed_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  subject TEXT,
  sender TEXT,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for tracking sent Telegram messages (for auto-delete)
CREATE TABLE public.sent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_processed_emails_message_id ON public.processed_emails(message_id);
CREATE INDEX idx_sent_messages_sent_at ON public.sent_messages(sent_at);

-- Enable RLS
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only service role can access (edge functions)
CREATE POLICY "Service role only for bot_settings" ON public.bot_settings
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Service role only for processed_emails" ON public.processed_emails
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Service role only for sent_messages" ON public.sent_messages
  FOR ALL USING (false) WITH CHECK (false);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bot_settings_updated_at
  BEFORE UPDATE ON public.bot_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row for settings
INSERT INTO public.bot_settings (id) VALUES (gen_random_uuid());