import { kv } from '@vercel/kv';

/* Returns uploaded photos (newest first). */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  const photos = (await kv.lrange('photos', 0, 199)) || [];
  // Short cache so a new upload appears within ~2s everywhere it's read.
  res.setHeader('Cache-Control', 'public, s-maxage=2, stale-while-revalidate=10');
  return res.status(200).json({ photos });
}
