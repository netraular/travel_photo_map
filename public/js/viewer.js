// Visor: sustituye el area del mapa por la foto/video, con mini-mapa en overlay.
import { originalUrl, videoUrl } from './api.js';
import { MiniMap } from './map.js';

function fmtDate(d) {
  if (!d) return '';
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export class Viewer {
  /**
   * @param {object} cb  { onPrev, onNext, onClose, onOpen }
   */
  constructor(cb = {}) {
    this.cb = cb;
    this.open = false;
    this.current = null;

    this.mapArea = document.getElementById('map-area');
    this.area = document.getElementById('viewer-area');
    this.content = document.getElementById('viewer-content');
    this.caption = document.getElementById('viewer-caption');
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

    const place = [asset.city, asset.country].filter(Boolean).join(', ');
    const gpsNote = asset.inferred ? ' (ubicacion aproximada)' : asset.onMap ? '' : ' (sin GPS)';
    this.caption.textContent = `${fmtDate(asset.date)}${place ? ' \u00b7 ' + place : ''}${gpsNote}`;

    this.miniMap.show(asset);

    if (!this.open) {
      this.open = true;
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
    // Parar cualquier video.
    const video = this.content.querySelector('video');
    if (video) video.pause();
    this.content.innerHTML = '';
    this.miniMap.hide();
    this.area.classList.add('hidden');
    this.mapArea.classList.remove('hidden');
    this.cb.onClose && this.cb.onClose();
  }
}
