import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IMMICH_URL = (process.env.IMMICH_URL || '').replace(/\/+$/, '');
const IMMICH_API_KEY = process.env.IMMICH_API_KEY || '';
const ALBUM_ID = process.env.ALBUM_ID || '';
const PORT = Number(process.env.PORT) || 3000;

if (!IMMICH_URL || !IMMICH_API_KEY || !ALBUM_ID) {
  console.error(
    '\n[ERROR] Missing environment variables. Check the .env file:\n' +
      `  IMMICH_URL=${IMMICH_URL ? 'ok' : 'MISSING'}\n` +
      `  IMMICH_API_KEY=${IMMICH_API_KEY ? 'ok' : 'MISSING'}\n` +
      `  ALBUM_ID=${ALBUM_ID ? 'ok' : 'MISSING'}\n`
  );
  process.exit(1);
}

const app = express();

/**
 * Forwards a request to Immich with the API key and streams the response back
 * (including binaries and Range info for video). When `cache` is true a
 * long-lived immutable cache header is added (asset IDs never change).
 */
async function proxy(res, immichPath, { headers = {}, cache = false } = {}) {
  const url = `${IMMICH_URL}${immichPath}`;
  let upstream;
  try {
    upstream = await fetch(url, {
      headers: { 'x-api-key': IMMICH_API_KEY, accept: 'application/octet-stream', ...headers },
    });
  } catch (err) {
    console.error('[proxy] network error:', err.message);
    res.status(502).json({ error: 'Could not reach Immich', detail: err.message });
    return;
  }

  res.status(upstream.status);
  // Copy relevant headers for images/video
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (cache && upstream.ok) {
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  } else {
    const v = upstream.headers.get('cache-control');
    if (v) res.setHeader('cache-control', v);
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  // Stream the body straight through instead of buffering it in memory.
  const nodeStream = Readable.fromWeb(upstream.body);
  nodeStream.on('error', (err) => {
    console.error('[proxy] stream error:', err.message);
    if (!res.headersSent) res.status(502);
    res.end();
  });
  res.on('close', () => nodeStream.destroy());
  nodeStream.pipe(res);
}

// Album info (JSON with assets and exifInfo)
app.get('/api/album', async (_req, res) => {
  const url = `${IMMICH_URL}/api/albums/${ALBUM_ID}`;
  try {
    const upstream = await fetch(url, {
      headers: { 'x-api-key': IMMICH_API_KEY, accept: 'application/json' },
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('content-type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error('[album] error:', err.message);
    res.status(502).json({ error: 'Could not fetch the album', detail: err.message });
  }
});

// Thumbnail: size = thumbnail (small) | preview (medium)
app.get('/api/thumb/:id', (req, res) => {
  const size = req.query.size === 'preview' ? 'preview' : 'thumbnail';
  return proxy(res, `/api/assets/${req.params.id}/thumbnail?size=${size}`, { cache: true });
});

// Original image (full size)
app.get('/api/original/:id', (req, res) => {
  return proxy(res, `/api/assets/${req.params.id}/original`, { cache: true });
});

// Video playback (supports Range for streaming)
app.get('/api/video/:id', (req, res) => {
  const headers = {};
  if (req.headers.range) headers.range = req.headers.range;
  return proxy(res, `/api/assets/${req.params.id}/video/playback`, { headers });
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\nTravel Photo Map running:  http://localhost:${PORT}\n`);
});
