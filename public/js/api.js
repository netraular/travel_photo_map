// Acceso a los endpoints del backend proxy.

export async function loadAlbum() {
  const res = await fetch('/api/album');
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).detail || '';
    } catch {
      /* ignore */
    }
    throw new Error(`No se pudo cargar el album (HTTP ${res.status}). ${detail}`);
  }
  return res.json();
}

export function thumbUrl(id, size = 'thumbnail') {
  return `/api/thumb/${id}?size=${size}`;
}

export function originalUrl(id) {
  return `/api/original/${id}`;
}

export function videoUrl(id) {
  return `/api/video/${id}`;
}

/**
 * Normaliza los assets del album a un modelo simple y ordenado por fecha.
 * @returns {Array<{id,type,date,lat,lng,city,country,fileName,hasGps}>}
 */
export function normalizeAssets(album) {
  const assets = Array.isArray(album?.assets) ? album.assets : [];
  return assets
    .map((a) => {
      const exif = a.exifInfo || {};
      const lat = typeof exif.latitude === 'number' ? exif.latitude : null;
      const lng = typeof exif.longitude === 'number' ? exif.longitude : null;
      const date =
        exif.dateTimeOriginal || a.fileCreatedAt || a.localDateTime || a.createdAt || null;
      return {
        id: a.id,
        type: a.type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
        date: date ? new Date(date) : null,
        lat,
        lng,
        city: exif.city || '',
        country: exif.country || '',
        fileName: a.originalFileName || '',
        hasGps: lat !== null && lng !== null,
      };
    })
    .filter((a) => a.id)
    .sort((a, b) => {
      const ta = a.date ? a.date.getTime() : 0;
      const tb = b.date ? b.date.getTime() : 0;
      return ta - tb;
    });
}
