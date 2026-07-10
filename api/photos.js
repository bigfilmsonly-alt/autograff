import { kv } from '@vercel/kv';

/* Returns uploaded photos (newest first). */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  const photos = (await kv.lrange('photos', 0, 199)) || [];
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=59');
  return res.status(200).json({ photos });
}
