// Timeline inferior: tira de miniaturas ordenadas por fecha + slideshow.
import { thumbUrl } from './api.js';

function fmtDate(d) {
  if (!d) return '';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export class Timeline {
  /**
   * @param {(asset, index)=>void} onSelect
   */
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.assets = [];
    this.activeIndex = -1;
    this.playing = false;
    this.timer = null;
    this.intervalMs = 3000;

    this.track = document.getElementById('timeline-track');
    this.dateLabel = document.getElementById('tl-date');
    this.playBtn = document.getElementById('tl-play');

    document.getElementById('tl-prev').addEventListener('click', () => this.step(-1));
    document.getElementById('tl-next').addEventListener('click', () => this.step(1));
    this.playBtn.addEventListener('click', () => this.togglePlay());
  }

  setAssets(assets) {
    this.assets = assets;
    this.track.innerHTML = '';
    assets.forEach((a, i) => {
      const item = document.createElement('div');
      item.className = 'tl-item' + (a.onMap ? '' : ' no-gps');
      item.dataset.index = String(i);

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = thumbUrl(a.id, 'thumbnail');
      img.alt = a.fileName || '';
      item.appendChild(img);

      if (a.type === 'VIDEO') {
        const badge = document.createElement('span');
        badge.className = 'video-badge';
        badge.textContent = '\u25B6';
        item.appendChild(badge);
      }

      item.addEventListener('click', () => {
        this.setActive(i, false);
        this.onSelect && this.onSelect(a, i);
      });
      this.track.appendChild(item);
    });
  }

  setActive(index, fromExternal = true) {
    if (index < 0 || index >= this.assets.length) return;
    const items = this.track.children;
    if (this.activeIndex >= 0 && items[this.activeIndex]) {
      items[this.activeIndex].classList.remove('active');
    }
    this.activeIndex = index;
    const el = items[index];
    if (el) {
      el.classList.add('active');
      el.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
    const a = this.assets[index];
    this.dateLabel.textContent = a ? `${fmtDate(a.date)}${a.city ? ' \u00b7 ' + a.city : ''}` : '';
  }

  step(dir) {
    let next = this.activeIndex + dir;
    if (next < 0) next = this.assets.length - 1;
    if (next >= this.assets.length) next = 0;
    this.setActive(next, false);
    const a = this.assets[next];
    this.onSelect && this.onSelect(a, next);
  }

  togglePlay() {
    this.playing ? this.stop() : this.play();
  }

  play() {
    if (!this.assets.length) return;
    this.playing = true;
    this.playBtn.classList.add('active');
    this.playBtn.innerHTML = '&#10073;&#10073;'; // pausa
    this.timer = setInterval(() => this.step(1), this.intervalMs);
    if (this.activeIndex < 0) this.step(1);
  }

  stop() {
    this.playing = false;
    this.playBtn.classList.remove('active');
    this.playBtn.innerHTML = '&#9658;';
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
