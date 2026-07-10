import { handleUpload } from '@vercel/blob/client';
import { kv } from '@vercel/kv';

/*
 * Photo/video upload handler for @vercel/blob client uploads.
 * The browser calls upload() which hits this route to get a token, uploads
 * directly to Blob, then Blob calls onUploadCompleted here to persist metadata.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'],
        maximumSizeInBytes: 25 * 1024 * 1024,
        tokenPayload: clientPayload || '',
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        let meta = {};
        try { meta = tokenPayload ? JSON.parse(tokenPayload) : {}; } catch (_) {}
        const record = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          src: blob.url,
          type: (blob.contentType || '').startsWith('video') ? 'video' : 'image',
          title: String(meta.title || 'Untitled').slice(0, 120),
          user: String(meta.user || 'anon').slice(0, 60),
          likes: 0,
          isUpload: true,
          ts: Date.now(),
        };
        await kv.lpush('photos', record);
        await kv.ltrim('photos', 0, 499);
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    return res.status(400).json({ error: err?.message || 'upload failed' });
  }
}
