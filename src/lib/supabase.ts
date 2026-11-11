import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nfdsntorwjxafnagumje.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZHNudG9yd2p4YWZuYWd1bWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNjkzNjMsImV4cCI6MjEwOTk0NTM2M30.yYiq8va_OPtVqiR8fGu6_jQQhWQ99MFT-9hAuqrBU58';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
