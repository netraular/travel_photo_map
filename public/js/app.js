// Orchestration: loads the album, wires up map, timeline and viewer.
import { loadAlbum, normalizeAssets, originalUrl, videoUrl } from './api.js';
import { inferCoordinates } from './geo.js';
import { MapView } from './map.js';
import { Timeline } from './timeline.js';
import { Viewer } from './viewer.js';
import { addSwipe } from './util.js';

const state = {
  assets: [],
  activeIndex: -1,
};

const statusEl = document.getElementById('status');
const headerInfo = document.getElementById('header-info');
const stageEl = document.getElementById('stage');
const previewContent = document.getElementById('preview-content');

function setStatus(msg, { error = false, loading = false, retry = false } = {}) {
  if (!msg) {
    statusEl.classList.add('hidden');
    return;
  }
  statusEl.classList.toggle('error', error);
  statusEl.classList.remove('hidden');
  statusEl.innerHTML = '';

  if (loading) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    statusEl.appendChild(spinner);
  }
  const text = document.createElement('span');
  text.textContent = msg;
  statusEl.appendChild(text);

  if (retry) {
    const btn = document.createElement('button');
    btn.className = 'status-retry';
    btn.textContent = 'Retry';
    btn.addEventListener('click', () => init());
    statusEl.appendChild(btn);
  }
}

function selectIndex(index, { focusMap = true, openViewer = false } = {}) {
  if (index < 0 || index >= state.assets.length) return;
  state.activeIndex = index;
  const asset = state.assets[index];

  timeline.setActive(index, false);
  if (focusMap && asset.onMap) map.focus(asset);
  else if (asset.onMap) map.setSelected(asset);
  showPreview(asset);
  if (openViewer || viewer.open) viewer.show(asset);

  // A manual change should restart the slideshow countdown.
  timeline.resetTimer();
}

// Renders the selected photo/video in the split-view preview pane and makes
// the map share the screen with it.
function showPreview(asset) {
  if (!asset) return;
  if (!stageEl.classList.contains('split')) {
    stageEl.classList.add('split');
    map.invalidate();
  }
  previewContent.innerHTML = '';
  if (asset.type === 'VIDEO') {
    const video = document.createElement('video');
    video.src = videoUrl(asset.id);
    video.controls = true;
    video.playsInline = true;
    video.muted = true;
    previewContent.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = originalUrl(asset.id);
    img.alt = asset.fileName || '';
    previewContent.appendChild(img);
  }
}

function pausePreviewVideo() {
  const v = previewContent.querySelector('video');
  if (v) v.pause();
}

// --- Instances ---
const map = new MapView('map', (asset) => {
  const idx = state.assets.indexOf(asset);
  selectIndex(idx, { focusMap: false, openViewer: false });
});

const timeline = new Timeline((asset, idx) => {
  selectIndex(idx, { focusMap: true, openViewer: false });
});

const viewer = new Viewer({
  onPrev: () => step(-1),
  onNext: () => step(1),
  onClose: () => {
    timeline.stop();
    viewer.setPlaying(false);
    map.invalidate();
    // The timeline grows back to full height; re-center the active thumbnail.
    setTimeout(() => timeline.recenter(), 80);
  },
  onOpen: () => {
    pausePreviewVideo();
    // The timeline shrinks; re-center the active thumbnail after the reflow.
    setTimeout(() => timeline.recenter(), 80);
  },
  onTogglePlay: () => {
    timeline.togglePlay();
    viewer.setPlaying(timeline.playing);
  },
});

// Expand button on the preview pane opens the full-screen viewer.
document.getElementById('preview-expand').addEventListener('click', () => {
  if (state.activeIndex >= 0) viewer.show(state.assets[state.activeIndex]);
});

// Close button on the preview pane collapses the split back to a full map.
document.getElementById('preview-close').addEventListener('click', () => {
  pausePreviewVideo();
  previewContent.innerHTML = '';
  stageEl.classList.remove('split');
  map.invalidate();
});

// Touch: swipe the split-view preview to move between photos.
addSwipe(
  previewContent,
  () => moveSelection(-1),
  () => moveSelection(1)
);

// Controls help overlay.
const helpOverlay = document.getElementById('help-overlay');
function toggleHelp(show) {
  const open = show ?? helpOverlay.classList.contains('hidden');
  helpOverlay.classList.toggle('hidden', !open);
}
document.getElementById('help-btn').addEventListener('click', () => toggleHelp(true));
document.getElementById('help-close').addEventListener('click', () => toggleHelp(false));
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) toggleHelp(false);
});

function step(dir) {
  let next = state.activeIndex + dir;
  if (next < 0) next = state.assets.length - 1;
  if (next >= state.assets.length) next = 0;
  selectIndex(next, { focusMap: true, openViewer: true });
}

// In map view the timeline arrows page the strip; while viewing they step.
timeline.isViewerOpen = () => viewer.open;

// Scrolling the timeline (wheel or dragging the scrollbar) selects the photo
// scrolled into the centre of the strip.
timeline.onScrub = (index) => moveTo(index);

// Spacebar toggles the slideshow (ignored while typing in the interval field).
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.key === '?') {
    e.preventDefault();
    toggleHelp();
    return;
  }
  if (e.key === 'Escape' && !helpOverlay.classList.contains('hidden')) {
    toggleHelp(false);
    return;
  }

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
      moveSelection(pageStep());
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(-pageStep());
    } else if (e.key === 'Enter') {
      // Open the currently selected photo "large" in the full-screen viewer.
      e.preventDefault();
      if (state.activeIndex >= 0) {
        selectIndex(state.activeIndex, { focusMap: false, openViewer: true });
      }
    }
  }
});

// How many photos an up/down "page" jump should move.
function pageStep() {
  const visible = timeline.visibleCount ? timeline.visibleCount() : 1;
  return Math.max(2, visible - 1);
}

// Moves the timeline selection without opening the viewer, and shows the
// selected photo on the map (highlighting / revealing its marker) and in the
// split-view preview pane.
function moveSelection(dir) {
  if (!state.assets.length) return;
  const base = state.activeIndex < 0 ? 0 : state.activeIndex;
  moveTo(base + dir);
}

// Selects a specific photo by index (clamped) without opening the viewer.
function moveTo(index) {
  if (!state.assets.length) return;
  const next = Math.max(0, Math.min(state.assets.length - 1, index));
  state.activeIndex = next;
  timeline.setActive(next, false);
  const asset = state.assets[next];
  if (asset && asset.onMap) map.setSelected(asset);
  showPreview(asset);
  if (viewer.open) viewer.show(asset);
  timeline.resetTimer();
}

async function init() {
  try {
    setStatus('Loading album...', { loading: true });
    const album = await loadAlbum();
    let assets = normalizeAssets(album);
    assets = inferCoordinates(assets);
    state.assets = assets;

    if (!assets.length) {
      setStatus('The album has no items or could not be read.', { error: true, retry: true });
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
    setStatus(err.message || 'Error loading the album.', { error: true, retry: true });
  }
}

init();
