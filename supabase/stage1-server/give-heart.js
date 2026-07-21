// DESTINATION when provisioning: /api/give-heart.js
// The server checkpoint for giving a heart. The real authority is the give_heart()
// Postgres function (SECURITY DEFINER, one atomic transaction). The client may only
// request { photoId, heartType }; the database decides and cannot be bypassed.
import { isConfigured, userClient } from '../lib/supabase-server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!isConfigured()) return res.status(503).json({ error: 'hearts backend not configured yet' });

  const authz = req.headers.authorization || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing access token' });

  const { photoId, heartType = 'standard' } = req.body || {};
  if (!photoId) return res.status(400).json({ error: 'photoId required' });
  if (!['standard', 'infinity'].includes(heartType)) return res.status(400).json({ error: 'invalid heartType' });

  const { data, error } = await userClient(token).rpc('give_heart', {
    p_photo_id: photoId,
    p_heart_type: heartType,
  });

  if (error) {
    // Business-rule violations (self-heart, insufficient credits, tier gate, rate
    // limit) come back as Postgres exceptions -> 409. Everything else -> 400.
    const msg = error.message || 'give_heart failed';
    const businessRule = /own photo|insufficient credits|not available for your tier|rate limit|not authenticated/i.test(msg);
    return res.status(businessRule ? 409 : 400).json({ error: msg });
  }
  return res.status(200).json(data);
}
