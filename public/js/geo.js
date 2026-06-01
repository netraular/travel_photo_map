// Coordinate inference for assets without GPS:
// they get the coordinates of the closest-in-time asset that does have GPS.
// Returns "inferred" coordinates without overwriting hasGps (so they can be flagged).

/**
 * @param {Array} assets - normalized list sorted by date (api.normalizeAssets)
 * @returns assets with extra fields: mapLat, mapLng, inferred (boolean), onMap (boolean)
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

    // No GPS: find the GPS asset with the closest date.
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
      // No asset in the album has GPS -> timeline only.
      a.mapLat = null;
      a.mapLng = null;
      a.inferred = false;
      a.onMap = false;
    }
  }

  return assets;
}
