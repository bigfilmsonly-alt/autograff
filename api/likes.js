import { kv } from '@vercel/kv';

/*
 * Ledger of engagement.
 *  photo_likes   hash: photoId  -> like count (delta on top of in-file baseline)
 *  liker_scores  hash: visitorId -> total likes GIVEN (0 = present but stagnant)
 *  liker_names   hash: visitorId -> display handle
 *
 * POST { id, uid, name, count? } -> like(s) (bumps photo + the liker's score by count)
 * POST { action:'seen', uid,name}-> register presence at 0 (so lurkers surface)
 * GET  -> { likes, likers, names }
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [likes, likers, names, shares] = await Promise.all([
        kv.hgetall('photo_likes'),
        kv.hgetall('liker_scores'),
        kv.hgetall('liker_names'),
        kv.hgetall('photo_shares'),
      ]);
      // Always fresh — the leaderboard must reflect a like/share the instant it lands.
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ likes: likes || {}, likers: likers || {}, names: names || {}, shares: shares || {} });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const uid = String(body.uid ?? '').trim().slice(0, 40);
      const name = String(body.name ?? '').trim().slice(0, 40);

      if (body.action === 'seen') {
        if (uid) {
          await kv.hsetnx('liker_scores', uid, 0);
          if (name) await kv.hset('liker_names', { [uid]: name });
        }
        return res.status(200).json({ ok: true });
      }

      if (body.action === 'share') {
        const sid = String(body.id ?? '').trim().slice(0, 100);
        if (!sid) return res.status(400).json({ error: 'id required' });
        const shares = await kv.hincrby('photo_shares', sid, 1);
        return res.status(200).json({ id: sid, shares });
      }

      const id = String(body.id ?? '').trim().slice(0, 100);
      if (!id) {
        return res.status(400).json({ error: 'id required' });
      }
      // A tap = a heart. Rapid taps arrive batched as `count` (capped to bound abuse).
      const count = Math.min(50, Math.max(1, parseInt(body.count, 10) || 1));
      const likes = await kv.hincrby('photo_likes', id, count);
      let likerScore;
      if (uid) {
        likerScore = await kv.hincrby('liker_scores', uid, count);
        if (name) await kv.hset('liker_names', { [uid]: name });
      }
      return res.status(200).json({ id, likes, likerScore });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'failed' });
  }
}
