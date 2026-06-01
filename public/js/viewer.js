// Viewer: replaces the map area with the photo/video, with a mini-map overlay.
import { originalUrl, videoUrl } from './api.js';
import { MiniMap } from './map.js';

export class Viewer {
  /**
   * @param {object} cb  { onPrev, onNext, onClose, onOpen, onTogglePlay }
   */
  constructor(cb = {}) {
    this.cb = cb;
    this.open = false;
    this.current = null;

    this.mapArea = document.getElementById('map-area');
    this.area = document.getElementById('viewer-area');
    this.content = document.getElementById('viewer-content');
    this.miniMap = new MiniMap('mini-map');

    document.getElementById('viewer-close').addEventListener('click', () => this.close());
    document.getElementById('viewer-prev').addEventListener('click', () => cb.onPrev && cb.onPrev());
    document.getElementById('viewer-next').addEventListener('click', () => cb.onNext && cb.onNext());

    this.playBtn = document.getElementById('viewer-play');
    this.playBtn.addEventListener('click', () => cb.onTogglePlay && cb.onTogglePlay());

    document.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowLeft') cb.onPrev && cb.onPrev();
      else if (e.key === 'ArrowRight') cb.onNext && cb.onNext();
    });
  }

  /** Provide the full asset list so the mini-map can draw the trajectory. */
  setAssets(assets) {
    this.miniMap.setRoute(assets);
  }

  show(asset) {
    this.current = asset;
    this.content.innerHTML = '';

    if (asset.type === 'VIDEO') {
      const video = document.createElement('video');
      video.src = videoUrl(asset.id);
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      this.content.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = originalUrl(asset.id);
      img.alt = asset.fileName || '';
      this.content.appendChild(img);
    }

    this.miniMap.show(asset);

    if (!this.open) {
      this.open = true;
      document.body.classList.add('viewer-open');
      this.mapArea.classList.add('hidden');
      this.area.classList.remove('hidden');
      this.cb.onOpen && this.cb.onOpen();
    }
  }

  setPlaying(playing) {
    this.playBtn.classList.toggle('active', playing);
    this.playBtn.innerHTML = playing ? '&#10073;&#10073;' : '&#9658;';
  }

  close() {
    if (!this.open) return;
    this.open = false;
    document.body.classList.remove('viewer-open');
    // Stop any playing video.
    const video = this.content.querySelector('video');
    if (video) video.pause();
    this.content.innerHTML = '';
    this.miniMap.hide();
    this.area.classList.add('hidden');
    this.mapArea.classList.remove('hidden');
    this.cb.onClose && this.cb.onClose();
  }
}
