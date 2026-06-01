// Bottom timeline: strip of thumbnails sorted by date + slideshow.
import { thumbUrl } from './api.js';

function fmtDate(d) {
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function caption(a) {
  if (!a) return '';
  const place = [a.city, a.country].filter(Boolean).join(', ');
  const gps = a.inferred ? ' (approximate location)' : a.onMap ? '' : ' (no GPS)';
  return `${fmtDate(a.date)}${place ? ' \u00b7 ' + place : ''}${gps}`;
}

export class Timeline {
  /**
   * @param {(asset, index)=>void} onSelect
   */
  constructor(onSelect) {
    this.onSelect = onSelect;
    // Set by the app so navigation knows whether the big viewer is open.
    this.isViewerOpen = () => false;
    this.assets = [];
    this.activeIndex = -1;
    this.playing = false;
    this.timer = null;
    this.intervalMs = 3000;

    this.track = document.getElementById('timeline-track');
    this.dateLabel = document.getElementById('tl-date');
    this.playBtn = document.getElementById('tl-play');
    this.intervalInput = document.getElementById('tl-interval');

    document.getElementById('tl-prev').addEventListener('click', () => this.nav(-1));
    document.getElementById('tl-next').addEventListener('click', () => this.nav(1));
    this.playBtn.addEventListener('click', () => this.togglePlay());

    this.intervalInput.addEventListener('change', () => {
      const secs = parseFloat(this.intervalInput.value);
      if (secs >= 1 && secs <= 60) {
        this.intervalMs = secs * 1000;
        if (this.playing) {
          this.stop();
          this.play();
        }
      }
    });
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
    this.dateLabel.textContent = caption(a);
  }

  /** How many thumbnails fit across the visible track. */
  visibleCount() {
    const item = this.track.querySelector('.tl-item');
    if (!item) return 1;
    const w = item.getBoundingClientRect().width + 6; // include gap
    return Math.max(1, Math.floor(this.track.clientWidth / w));
  }

  /**
   * Arrow navigation. In map view it pages the strip (no viewer); while the
   * viewer is open it steps one item at a time and keeps the viewer in sync.
   */
  nav(dir) {
    if (this.isViewerOpen()) {
      this.step(dir);
    } else {
      this.page(dir);
    }
  }

  /** Moves by a full screen of thumbnails without opening the viewer. */
  page(dir) {
    if (!this.assets.length) return;
    const count = this.visibleCount();
    const base = this.activeIndex < 0 ? 0 : this.activeIndex;
    let next = base + dir * count;
    next = Math.max(0, Math.min(this.assets.length - 1, next));
    this.setActive(next, false);
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
    this.playBtn.innerHTML = '&#10073;&#10073;'; // pause
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
