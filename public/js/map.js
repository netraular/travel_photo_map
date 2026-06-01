// Main map (Leaflet + markercluster) and the viewer mini-map.
import { thumbUrl } from './api.js';

// Dark, low-detail basemap so photo points stand out.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

// If a cluster has fewer photos than this, clicking it spreads the
// thumbnails (spiderfy) instead of zooming in. A higher value means less
// zooming is needed before a node opens into the spread (spider) view.
const SPIDERFY_THRESHOLD = 60;

// Once the map is at least this zoomed in, clicking a cluster spreads it
// (spider) instead of zooming further, so images stop subdividing so much.
const SPIDERFY_AT_ZOOM = 13;
// Safety cap so we never try to spread an enormous cluster.
const MAX_SPIDER_COUNT = 140;

// Do not let the map zoom in too far (keeps photos grouped / spidered).
const MAX_MAP_ZOOM = 16;

const MARKER_SIZE = 58;
// Thumbnails are enlarged while a cluster is spread open (spider view).
const SPIDER_MARKER_SIZE = 104;

function markerIcon(asset, size = MARKER_SIZE) {
  const cls = asset.type === 'VIDEO' ? 'photo-marker video' : 'photo-marker';
  const html = `<img class="${cls}" style="width:${size}px;height:${size}px" src="${thumbUrl(asset.id, 'thumbnail')}" alt="" loading="lazy" />`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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
    this.selectedId = null;
    this._selectedMarker = null;

    this.map = L.map(elId, { zoomControl: true, keyboard: false, maxZoom: MAX_MAP_ZOOM });
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
      const zoomedIn = this.map.getZoom() >= SPIDERFY_AT_ZOOM && count <= MAX_SPIDER_COUNT;

      if (count < SPIDERFY_THRESHOLD || !splitsWhenZoomed || zoomedIn) {
        cluster.spiderfy();
      } else {
        cluster.zoomToBounds({ padding: [40, 40] });
      }
    });

    // Enlarge thumbnails while spread open, restore their size afterwards.
    this.cluster.on('spiderfied', (e) => {
      for (const m of e.markers) {
        if (m._asset) m.setIcon(markerIcon(m._asset, SPIDER_MARKER_SIZE));
        if (m._asset && m._asset.id === this.selectedId && m._icon) {
          m._icon.classList.add('is-selected');
        }
      }
    });
    this.cluster.on('unspiderfied', (e) => {
      for (const m of e.markers) {
        if (m._asset) m.setIcon(markerIcon(m._asset, MARKER_SIZE));
        if (m._asset && m._asset.id === this.selectedId && m._icon) {
          m._icon.classList.add('is-selected');
        }
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
      marker._asset = a;
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
    this.setSelected(asset);
  }

  /**
   * Highlights the marker of the given asset and reveals it on the map
   * (un-clustering / spiderfying if needed) without forcing a deep zoom.
   */
  setSelected(asset) {
    // Clear any previous highlight (a marker may have been re-rendered, so
    // remove the class from every currently shown marker to be safe).
    document
      .querySelectorAll('.leaflet-marker-icon.is-selected')
      .forEach((el) => el.classList.remove('is-selected'));
    if (this._selectedMarker) this._selectedMarker.setZIndexOffset(0);
    this._selectedMarker = null;
    this.selectedId = asset ? asset.id : null;
    if (!asset) return;

    const marker = this.markers.get(asset.id);
    if (!marker) return;
    this._selectedMarker = marker;
    // Raise it above its neighbours so it sits on top in the spider view.
    marker.setZIndexOffset(1000);

    const targetId = asset.id;
    const highlight = () => {
      // Selection may have changed while the cluster was revealing (async).
      if (this.selectedId !== targetId) return;
      document
        .querySelectorAll('.leaflet-marker-icon.is-selected')
        .forEach((el) => el.classList.remove('is-selected'));
      if (marker._icon) marker._icon.classList.add('is-selected');
    };
    // zoomToShowLayer reveals the marker if it is hidden inside a cluster
    // (zooming / spiderfying as needed) and calls back once it is visible.
    this.cluster.zoomToShowLayer(marker, highlight);
  }

  invalidate() {
    setTimeout(() => this.map.invalidateSize(), 50);
  }
}

/** Static mini-map for the viewer overlay, showing the trip trajectory. */
export class MiniMap {
  constructor(elId) {
    this.elId = elId;
    this.map = null;
    this.marker = null;
    this.routeLine = null;
    this.windowLayer = null;
    this.route = []; // on-map assets in chronological order
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

  /** Provide all on-map assets so the trajectory can be drawn. */
  setRoute(assets) {
    this.route = (assets || []).filter((a) => a.onMap && a.mapLat != null);
  }

  /** Draws the full trip path once as a faint base line for context. */
  drawRoute() {
    if (this.routeLine || this.route.length < 2) return;
    const latlngs = this.route.map((a) => [a.mapLat, a.mapLng]);
    this.routeLine = L.polyline(latlngs, {
      color: '#9aa0ad',
      weight: 1.5,
      opacity: 0.3,
    }).addTo(this.map);
  }

  show(asset) {
    const el = document.getElementById(this.elId);
    if (!asset || asset.mapLat == null) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    this.ensure();
    this.drawRoute();

    // Highlight the local path: where you came from (grey) and where you go next
    // (yellow), with the current photo as a red dot.
    if (this.windowLayer) this.windowLayer.remove();
    const idx = this.route.indexOf(asset);
    const layers = [];
    const pts = [];

    if (idx >= 0) {
      const from = Math.max(0, idx - 3);
      const to = Math.min(this.route.length - 1, idx + 12);
      const pastPts = [];
      const futurePts = [];
      for (let i = from; i <= to; i++) {
        const a = this.route[i];
        const ll = [a.mapLat, a.mapLng];
        pts.push(ll);
        if (i <= idx) pastPts.push(ll);
        if (i >= idx) futurePts.push(ll);
      }
      if (pastPts.length > 1) {
        layers.push(L.polyline(pastPts, { color: '#9aa0ad', weight: 3, opacity: 0.85 }));
      }
      if (futurePts.length > 1) {
        layers.push(L.polyline(futurePts, { color: '#f2b705', weight: 3, opacity: 0.95 }));
      }
    }

    // Current position on top.
    layers.push(
      L.circleMarker([asset.mapLat, asset.mapLng], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: '#e8534e',
        fillOpacity: 1,
      })
    );

    this.windowLayer = L.layerGroup(layers).addTo(this.map);

    if (pts.length === 0) pts.push([asset.mapLat, asset.mapLng]);
    if (pts.length > 1) {
      this.map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 12, animate: false });
    } else {
      this.map.setView([asset.mapLat, asset.mapLng], 11);
    }
    setTimeout(() => this.map.invalidateSize(), 60);
  }

  hide() {
    const el = document.getElementById(this.elId);
    if (el) el.classList.add('hidden');
  }
}
