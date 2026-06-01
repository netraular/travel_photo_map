// Orquestacion: carga el album, conecta mapa, timeline y visor.
import { loadAlbum, normalizeAssets } from './api.js';
import { inferCoordinates } from './geo.js';
import { MapView } from './map.js';
import { Timeline } from './timeline.js';
import { Viewer } from './viewer.js';

const state = {
  assets: [],
  activeIndex: -1,
};

const statusEl = document.getElementById('status');
const headerInfo = document.getElementById('header-info');

function setStatus(msg, isError = false) {
  if (!msg) {
    statusEl.classList.add('hidden');
    return;
  }
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
  statusEl.classList.remove('hidden');
}

function selectIndex(index, { focusMap = true, openViewer = true } = {}) {
  if (index < 0 || index >= state.assets.length) return;
  state.activeIndex = index;
  const asset = state.assets[index];

  timeline.setActive(index, false);
  if (focusMap && asset.onMap) map.focus(asset);
  if (openViewer) viewer.show(asset);
  else if (viewer.open) viewer.show(asset);
}

// --- Instancias ---
const map = new MapView('map', (asset) => {
  const idx = state.assets.indexOf(asset);
  selectIndex(idx, { focusMap: false, openViewer: true });
});

const timeline = new Timeline((asset, idx) => {
  selectIndex(idx, { focusMap: true, openViewer: true });
});

const viewer = new Viewer({
  onPrev: () => step(-1),
  onNext: () => step(1),
  onClose: () => {
    timeline.stop();
    viewer.setPlaying(false);
    map.invalidate();
  },
  onOpen: () => {},
  onTogglePlay: () => {
    timeline.togglePlay();
    viewer.setPlaying(timeline.playing);
  },
});

function step(dir) {
  let next = state.activeIndex + dir;
  if (next < 0) next = state.assets.length - 1;
  if (next >= state.assets.length) next = 0;
  selectIndex(next, { focusMap: true, openViewer: true });
}

async function init() {
  try {
    setStatus('Cargando album...');
    const album = await loadAlbum();
    let assets = normalizeAssets(album);
    assets = inferCoordinates(assets);
    state.assets = assets;

    if (!assets.length) {
      setStatus('El album no tiene elementos o no se pudo leer.', true);
      return;
    }

    map.setAssets(assets);
    timeline.setAssets(assets);

    const onMap = assets.filter((a) => a.onMap).length;
    const noGps = assets.length - onMap;
    headerInfo.textContent =
      `${assets.length} elementos \u00b7 ${onMap} en el mapa` +
      (noGps ? ` \u00b7 ${noGps} solo en timeline` : '');

    setStatus(null);
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Error cargando el album.', true);
  }
}

init();
