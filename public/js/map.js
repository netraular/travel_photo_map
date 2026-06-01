// Mapa principal (Leaflet + markercluster) y mini-mapa del visor.
import { thumbUrl } from './api.js';

// Mapa oscuro y con poco detalle para que destaquen los puntos con fotos.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

// Si un cluster tiene menos fotos que esto, al pulsarlo se despliegan
// las miniaturas (spiderfy) en vez de hacer zoom.
const SPIDERFY_THRESHOLD = 20;

function markerIcon(asset) {
  const cls = asset.type === 'VIDEO' ? 'photo-marker video' : 'photo-marker';
  const html = `<img class="${cls}" src="${thumbUrl(asset.id, 'thumbnail')}" alt="" loading="lazy" />`;
  return L.divIcon({ html, className: '', iconSize: [46, 46], iconAnchor: [23, 23] });
}

export class MapView {
  /**
   * @param {string} elId  id del contenedor del mapa
   * @param {(asset)=>void} onSelect callback al pulsar un marcador
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
    });

    // Al pulsar un cluster: pocas fotos -> desplegar previews; muchas -> zoom.
    this.cluster.on('clusterclick', (e) => {
      const cluster = e.layer;
      if (cluster.getAllChildMarkers().length < SPIDERFY_THRESHOLD) {
        cluster.spiderfy();
      } else {
        cluster.zoomToBounds({ padding: [40, 40] });
      }
    });

    this.map.addLayer(this.cluster);

    this.map.setView([36.2, 138.2], 5); // Japon por defecto
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

  /** Centra y abre el marcador del asset indicado. */
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

/** Mini-mapa estatico para el overlay del visor. */
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
