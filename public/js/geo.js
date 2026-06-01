// Inferencia de coordenadas para assets sin GPS:
// se asignan las del asset con fecha mas cercana que SI tenga GPS.
// Devuelve coordenadas "inferidas" sin sobrescribir hasGps (para poder marcarlas).

/**
 * @param {Array} assets - lista normalizada y ordenada por fecha (api.normalizeAssets)
 * @returns assets con campos extra: inferredLat, inferredLng, mapLat, mapLng, inferred(boolean), onMap(boolean)
 */
export function inferCoordinates(assets) {
  const withGps = assets.filter((a) => a.hasGps && a.date);

  for (const a of assets) {
    if (a.hasGps) {
      a.mapLat = a.lat;
      a.mapLng = a.lng;
      a.inferred = false;
      a.onMap = true;
      continue;
    }

    // Sin GPS: buscar el asset con GPS de fecha mas cercana.
    let best = null;
    let bestDiff = Infinity;
    if (a.date) {
      const t = a.date.getTime();
      for (const g of withGps) {
        const diff = Math.abs(g.date.getTime() - t);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = g;
        }
      }
    } else if (withGps.length) {
      best = withGps[0];
    }

    if (best) {
      a.mapLat = best.lat;
      a.mapLng = best.lng;
      a.inferred = true;
      a.onMap = true;
    } else {
      // Ningun asset del album tiene GPS -> solo timeline.
      a.mapLat = null;
      a.mapLng = null;
      a.inferred = false;
      a.onMap = false;
    }
  }

  return assets;
}
