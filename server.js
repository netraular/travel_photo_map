import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IMMICH_URL = (process.env.IMMICH_URL || '').replace(/\/+$/, '');
const IMMICH_API_KEY = process.env.IMMICH_API_KEY || '';
const ALBUM_ID = process.env.ALBUM_ID || '';
const PORT = Number(process.env.PORT) || 3000;

if (!IMMICH_URL || !IMMICH_API_KEY || !ALBUM_ID) {
  console.error(
    '\n[ERROR] Faltan variables de entorno. Revisa el archivo .env:\n' +
      `  IMMICH_URL=${IMMICH_URL ? 'ok' : 'FALTA'}\n` +
      `  IMMICH_API_KEY=${IMMICH_API_KEY ? 'ok' : 'FALTA'}\n` +
      `  ALBUM_ID=${ALBUM_ID ? 'ok' : 'FALTA'}\n`
  );
  process.exit(1);
}

const app = express();

/**
 * Reenvia una peticion a Immich con la API key y devuelve la respuesta
 * (incluyendo binarios e info de Range para video).
 */
async function proxy(res, immichPath, { headers = {} } = {}) {
  const url = `${IMMICH_URL}${immichPath}`;
  let upstream;
  try {
    upstream = await fetch(url, {
      headers: { 'x-api-key': IMMICH_API_KEY, accept: 'application/octet-stream', ...headers },
    });
  } catch (err) {
    console.error('[proxy] error de red:', err.message);
    res.status(502).json({ error: 'No se pudo contactar con Immich', detail: err.message });
    return;
  }

  res.status(upstream.status);
  // Copiar cabeceras relevantes para imagenes/video
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }

  if (!upstream.body) {
    res.end();
    return;
  }

  try {
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    console.error('[proxy] error leyendo respuesta:', err.message);
    if (!res.headersSent) res.status(502);
    res.end();
  }
}

// Info del album (JSON con assets y exifInfo)
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
    res.status(502).json({ error: 'No se pudo obtener el album', detail: err.message });
  }
});

// Miniatura: size = thumbnail (pequena) | preview (mediana)
app.get('/api/thumb/:id', (req, res) => {
  const size = req.query.size === 'preview' ? 'preview' : 'thumbnail';
  return proxy(res, `/api/assets/${req.params.id}/thumbnail?size=${size}`);
});

// Imagen original (a tamano completo)
app.get('/api/original/:id', (req, res) => {
  return proxy(res, `/api/assets/${req.params.id}/original`);
});

// Reproduccion de video (soporta Range para streaming)
app.get('/api/video/:id', (req, res) => {
  const headers = {};
  if (req.headers.range) headers.range = req.headers.range;
  return proxy(res, `/api/assets/${req.params.id}/video/playback`, { headers });
});

// Estaticos
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\nTravel Photo Map en marcha:  http://localhost:${PORT}\n`);
});
