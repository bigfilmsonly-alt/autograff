// DESTINATION when provisioning: /api/hearts-daily-reset.js
// Vercel Cron target — refills every profile's free daily hearts to its per-tier
// allowance. (The give_heart() lazy refill also covers active users; this catches
// everyone, including the inactive.) Service-role only, guarded by CRON_SECRET.
import { isConfigured, serviceClient } from '../lib/supabase-server.js';

export default async function handler(req, res) {
  if (!isConfigured()) return res.status(503).json({ error: 'not configured' });

  const secret = process.env.CRON_SECRET;
  const authz = req.headers.authorization || '';
  if (secret && authz !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' });

  const { data, error } = await serviceClient().rpc('reset_daily_hearts');
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, profiles_reset: data });
}
