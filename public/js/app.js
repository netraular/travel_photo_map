// Orchestration: loads the album, wires up map, timeline and viewer.
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

  // A manual change should restart the slideshow countdown.
  timeline.resetTimer();
}

// --- Instances ---
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

// In map view the timeline arrows page the strip; while viewing they step.
timeline.isViewerOpen = () => viewer.open;

// Spacebar toggles the slideshow (ignored while typing in the interval field).
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'Space') {
    e.preventDefault();
    timeline.togglePlay();
    viewer.setPlaying(timeline.playing);
    return;
  }

  // In map view, left/right move to the previous/next photo and up/down
  // jump several photos at a time (the viewer has its own arrow handling).
  if (!viewer.open) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-pageStep());
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(pageStep());
    }
  }
});

// How many photos an up/down "page" jump should move.
function pageStep() {
  const visible = timeline.visibleCount ? timeline.visibleCount() : 1;
  return Math.max(2, visible - 1);
}

// Moves the timeline selection without opening the viewer.
function moveSelection(dir) {
  if (!state.assets.length) return;
  const base = state.activeIndex < 0 ? 0 : state.activeIndex;
  let next = base + dir;
  next = Math.max(0, Math.min(state.assets.length - 1, next));
  state.activeIndex = next;
  timeline.setActive(next, false);
}

async function init() {
  try {
    setStatus('Loading album...');
    const album = await loadAlbum();
    let assets = normalizeAssets(album);
    assets = inferCoordinates(assets);
    state.assets = assets;

    if (!assets.length) {
      setStatus('The album has no items or could not be read.', true);
      return;
    }

    map.setAssets(assets);
    timeline.setAssets(assets);
    viewer.setAssets(assets);

    const onMap = assets.filter((a) => a.onMap).length;
    const noGps = assets.length - onMap;
    headerInfo.textContent =
      `${assets.length} items \u00b7 ${onMap} on the map` +
      (noGps ? ` \u00b7 ${noGps} timeline only` : '');

    setStatus(null);
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Error loading the album.', true);
  }
}

init();
