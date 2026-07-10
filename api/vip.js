import { kv } from '@vercel/kv';

/*
 * VIP waiting list enrollment.
 *  POST  -> store a signup { name, email, phone, social, bio }
 *  GET   -> admin-only list (requires ?key=ADMIN_KEY or x-admin-key header)
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    const key = req.query?.key || req.headers['x-admin-key'];
    if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const signups = (await kv.lrange('vip_signups', 0, -1)) || [];
    return res.status(200).json({ count: signups.length, signups });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = req.body || {};
  const email = String(body.email || '').trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) return res.status(400).json({ error: 'A valid email is required.' });

  const record = {
    name: String(body.name || '').trim().slice(0, 120),
    email: email.slice(0, 200),
    phone: String(body.phone || '').trim().slice(0, 40),
    social: String(body.social || '').trim().slice(0, 120),
    bio: String(body.bio || '').trim().slice(0, 1000),
    ts: Date.now(),
  };

  await kv.lpush('vip_signups', record);
  const count = await kv.llen('vip_signups');
  return res.status(200).json({ ok: true, count });
}
