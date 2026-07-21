import { kv } from '@vercel/kv';
// resend is imported lazily inside sendConfirmation() so this function never crashes on
// load if the package can't be traced — a signup must never fail because of email.

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

// Real confirmation email — keeps the "we'll email you" promise the UI makes.
// No-op if RESEND_API_KEY is unset, so a signup NEVER fails because of email.
// Minimal black/white, Helvetica, no template chrome.
async function sendConfirmation(record) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY not set' };
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const from = process.env.RESEND_FROM || 'AUTOGRAFF <onboarding@resend.dev>';
    const first = String(record.name || '').trim().split(/\s+/)[0];
    const hi = first ? `${first},` : '';
    const text =
      (hi ? `${hi}\n\n` : '') +
      `You're on the list.\n\n` +
      `AUTOGRAFF is invitation-only. We'll email you when it opens — nothing before, nothing after.\n\n` +
      `No spam, ever.\n\n— AUTOGRAFF`;
    const html =
      `<div style="background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif;padding:48px 28px;line-height:1.6;max-width:520px">` +
      (hi ? `<p style="margin:0 0 20px">${hi}</p>` : '') +
      `<p style="margin:0 0 20px;font-family:Impact,Helvetica,sans-serif;font-size:22px;letter-spacing:1px">YOU'RE ON THE LIST.</p>` +
      `<p style="margin:0 0 20px;color:#b3b3b3">AUTOGRAFF is invitation-only. We'll email you when it opens — nothing before, nothing after.</p>` +
      `<p style="margin:0 0 28px;color:#b3b3b3">No spam, ever.</p>` +
      `<p style="margin:0;color:#666;letter-spacing:2px;font-size:12px">— AUTOGRAFF</p>` +
      `</div>`;
    const { data, error } = await resend.emails.send({
      from, to: record.email, subject: "You're on the AUTOGRAFF list", text, html,
    });
    if (error) return { sent: false, reason: error.message || String(error) };
    return { sent: true, id: data?.id };
  } catch (e) {
    console.error('sendConfirmation failed', e);
    return { sent: false, reason: String(e?.message || e) };
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
  const email = await sendConfirmation(record);
  return res.status(200).json({ ok: true, count, email });
}
