// Main map (Leaflet + markercluster) and the viewer mini-map.
import { thumbUrl } from './api.js';

// Dark, low-detail basemap so photo points stand out.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

// If a cluster has fewer photos than this, clicking it spreads the
// thumbnails (spiderfy) instead of zooming in.
const SPIDERFY_THRESHOLD = 20;

const MARKER_SIZE = 58;

function markerIcon(asset) {
  const cls = asset.type === 'VIDEO' ? 'photo-marker video' : 'photo-marker';
  const html = `<img class="${cls}" src="${thumbUrl(asset.id, 'thumbnail')}" alt="" loading="lazy" />`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
  });
}

export class MapView {
  /**
   * @param {string} elId  map container id
   * @param {(asset)=>void} onSelect callback when a marker is clicked
   */
  constructor(elId, onSelect) {
    this.onSelect = onSelect;
    this.markers = new Map(); // assetId -> marker

    this.map = L.map(elId, { zoomControl: true });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(this.map);

    this.cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: true,
      // Spread spiderfied thumbnails further apart so they are easy to see.
      spiderfyDistanceMultiplier: 2.6,
    });

    // When a cluster is clicked: few photos OR a cluster that does not actually
    // split into several sub-clusters when zoomed -> spread the thumbnails;
    // otherwise zoom in (the photos are spread out and will separate).
    this.cluster.on('clusterclick', (e) => {
      const cluster = e.layer;
      const count = cluster.getAllChildMarkers().length;

      // Immediate children at the next zoom level: sub-clusters + loose markers.
      // If there is only one, zooming keeps a single node, so spreading is better.
      const subClusters = cluster._childClusters ? cluster._childClusters.length : 0;
      const looseMarkers = cluster._markers ? cluster._markers.length : 0;
      const splitsWhenZoomed = subClusters + looseMarkers > 1;

      if (count < SPIDERFY_THRESHOLD || !splitsWhenZoomed) {
        cluster.spiderfy();
      } else {
        cluster.zoomToBounds({ padding: [40, 40] });
      }
    });

    this.map.addLayer(this.cluster);

    this.map.setView([36.2, 138.2], 5); // Japan by default
  }

  setAssets(assets) {
    this.cluster.clearLayers();
    this.markers.clear();
    const bounds = [];

    for (const a of assets) {
      if (!a.onMap || a.mapLat == null || a.mapLng == null) continue;
      const marker = L.marker([a.mapLat, a.mapLng], { icon: markerIcon(a) });
      marker.on('click', () => this.onSelect && this.onSelect(a));
      this.cluster.addLayer(marker);
      this.markers.set(a.id, marker);
      bounds.push([a.mapLat, a.mapLng]);
    }

    if (bounds.length) {
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }

  /** Centers and opens the marker for the given asset. */
  focus(asset) {
    if (!asset || asset.mapLat == null) return;
    this.map.setView([asset.mapLat, asset.mapLng], Math.max(this.map.getZoom(), 12), {
      animate: true,
    });
    const marker = this.markers.get(asset.id);
    if (marker) this.cluster.zoomToShowLayer(marker, () => {});
  }

  invalidate() {
    setTimeout(() => this.map.invalidateSize(), 50);
  }
}

/** Static mini-map for the viewer overlay. */
export class MiniMap {
  constructor(elId) {
    this.elId = elId;
    this.map = null;
    this.marker = null;
  }

  ensure() {
    if (this.map) return;
    this.map = L.map(this.elId, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });
    L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(this.map);
  }

  show(asset) {
    const el = document.getElementById(this.elId);
    if (!asset || asset.mapLat == null) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    this.ensure();
    this.map.setView([asset.mapLat, asset.mapLng], 11);
    if (this.marker) this.marker.remove();
    this.marker = L.circleMarker([asset.mapLat, asset.mapLng], {
      radius: 7,
      color: '#e8534e',
      fillColor: '#e8534e',
      fillOpacity: 0.9,
    }).addTo(this.map);
    setTimeout(() => this.map.invalidateSize(), 60);
  }

  hide() {
    const el = document.getElementById(this.elId);
    if (el) el.classList.add('hidden');
  }
}
