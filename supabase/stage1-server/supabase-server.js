// DESTINATION when provisioning: /lib/supabase-server.js
// Server-only Supabase clients. The SERVICE ROLE key must NEVER reach the browser
// (it bypasses RLS). Only the Vite VITE_-prefixed anon vars are safe client-side.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const isConfigured = () => Boolean(URL && SERVICE_KEY && ANON_KEY);

// Full-privilege client (bypasses RLS). Server-only. Used by the daily-reset cron.
export function serviceClient() {
  return createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client bound to an end-user's access token, so RLS + auth.uid() resolve as THAT
// user inside give_heart(). This is how a heart is attributed to its real sender.
export function userClient(accessToken) {
  return createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
