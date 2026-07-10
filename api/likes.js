import { kv } from '@vercel/kv';

/*
 * Ledger of engagement.
 *  photo_likes   hash: photoId  -> like count (delta on top of in-file baseline)
 *  liker_scores  hash: visitorId -> total likes GIVEN (0 = present but stagnant)
 *  liker_names   hash: visitorId -> display handle
 *
 * POST { id, uid, name }         -> a like (bumps photo + the liker's score)
 * POST { action:'seen', uid,name}-> register presence at 0 (so lurkers surface)
 * GET  -> { likes, likers, names }
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const [likes, likers, names] = await Promise.all([
        kv.hgetall('photo_likes'),
        kv.hgetall('liker_scores'),
        kv.hgetall('liker_names'),
      ]);
      res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=30');
      return res.status(200).json({ likes: likes || {}, likers: likers || {}, names: names || {} });
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

      const id = String(body.id ?? '').trim().slice(0, 100);
      if (!id) {
        return res.status(400).json({ error: 'id required' });
      }
      const likes = await kv.hincrby('photo_likes', id, 1);
      let likerScore;
      if (uid) {
        likerScore = await kv.hincrby('liker_scores', uid, 1);
        if (name) await kv.hset('liker_names', { [uid]: name });
      }
      return res.status(200).json({ id, likes, likerScore });
    }
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'failed' });
  }
}
