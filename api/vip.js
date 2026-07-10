import { kv } from '@vercel/kv';

/*
 * VIP waiting list enrollment.
 *  POST  -> store a signup { name, email, phone, social, bio }
 *  GET   -> admin-only list (requires ?key=ADMIN_KEY or x-admin-key header)
 *
 * Optional: set SIGNUP_WEBHOOK_URL to receive a notification (Slack/Discord
 * incoming webhook) on each new signup. Unset = no-op.
 */
async function notifySignup(record, count) {
  try {
    const url = process.env.SIGNUP_WEBHOOK_URL;
    if (!url) return;
    const message =
      `🎉 New AUTOGRAFF VIP signup (#${count})\n` +
      `Name: ${record.name || '—'}\n` +
      `Email: ${record.email}\n` +
      `Phone: ${record.phone || '—'}\n` +
      `Social: ${record.social || '—'}\n` +
      `Bio: ${record.bio || '—'}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message }),
    });
  } catch (e) {
    console.error('notifySignup failed', e);
  }
}

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

  const normalized = email.toLowerCase().trim();
  const existing = (await kv.lrange('vip_signups', 0, -1)) || [];
  const duplicate = existing.some((entry) => {
    let obj = entry;
    if (typeof entry === 'string') {
      try {
        obj = JSON.parse(entry);
      } catch (e) {
        return false;
      }
    }
    return String(obj?.email || '').toLowerCase().trim() === normalized;
  });
  if (duplicate) {
    return res.status(200).json({ ok: true, already: true, count: existing.length });
  }

  const record = {
    name: String(body.name || '').trim().slice(0, 120),
    email: email.slice(0, 200),
    phone: String(body.phone || '').trim().slice(0, 40),
    social: String(body.social || '').trim().slice(0, 120),
    bio: String(body.bio || '').trim().slice(0, 1000),
    ref: String(body.ref || '').trim().slice(0, 40),
    ts: Date.now(),
  };

  await kv.lpush('vip_signups', record);
  const count = await kv.llen('vip_signups');
  notifySignup(record, count).catch(() => {});
  return res.status(200).json({ ok: true, count });
}
