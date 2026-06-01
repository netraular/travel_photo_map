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

    // Called when the user scrolls the strip (wheel or scrollbar) so the app
    // can select the photo scrolled into the centre.
    this.onScrub = () => {};
    this._suppressScroll = false;
    this._suppressTimer = null;
    this._scrollTimer = null;
    this._io = null;

    document.getElementById('tl-prev').addEventListener('click', () => this.nav(-1));
    document.getElementById('tl-next').addEventListener('click', () => this.nav(1));
    this.playBtn.addEventListener('click', () => this.togglePlay());

    // Mouse wheel over the strip scrolls it horizontally.
    this.track.addEventListener(
      'wheel',
      (e) => {
        if (!this.assets.length) return;
        const delta = e.deltaY || e.deltaX;
        if (!delta) return;
        e.preventDefault();
        this.track.scrollLeft += delta;
      },
      { passive: false }
    );

    // Scrolling the strip (wheel or dragging the scrollbar) selects the photo
    // that ends up centred, once the scrolling settles.
    this.track.addEventListener('scroll', () => {
      if (this._suppressScroll) return;
      if (this._scrollTimer) clearTimeout(this._scrollTimer);
      this._scrollTimer = setTimeout(() => this.selectCentered(), 90);
    });

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
    if (this._io) this._io.disconnect();

    // Virtualize the strip: thumbnails only load while they are near the
    // viewport and are released again once far away, so scrolling through
    // thousands of photos stays light on memory. The square item size comes
    // from CSS (aspect-ratio), so layout/scroll math is stable even before an
    // image has loaded.
    this._io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const img = entry.target.querySelector('img');
          if (!img) continue;
          if (entry.isIntersecting) {
            if (!img.src) img.src = img.dataset.src;
          } else if (img.src) {
            img.removeAttribute('src');
          }
        }
      },
      { root: this.track, rootMargin: '0px 600px', threshold: 0 }
    );

    assets.forEach((a, i) => {
      const item = document.createElement('div');
      item.className = 'tl-item' + (a.onMap ? '' : ' no-gps');
      item.dataset.index = String(i);

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.dataset.src = thumbUrl(a.id, 'thumbnail');
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
      this._io.observe(item);
    });
  }

  setActive(index, fromExternal = true, align = 'center') {
    if (index < 0 || index >= this.assets.length) return;
    const items = this.track.children;
    if (this.activeIndex >= 0 && items[this.activeIndex]) {
      items[this.activeIndex].classList.remove('active');
    }
    this.activeIndex = index;
    const el = items[index];
    if (el) {
      el.classList.add('active');
      this._scrollTo(el, align);
    }
    const a = this.assets[index];
    this.dateLabel.textContent = caption(a);
  }

  /** Scrolls an item into view while suppressing the scroll-driven selection. */
  _scrollTo(el, align = 'center') {
    this._suppressScroll = true;
    el.scrollIntoView({ inline: align, block: 'nearest' });
    if (this._suppressTimer) clearTimeout(this._suppressTimer);
    this._suppressTimer = setTimeout(() => {
      this._suppressScroll = false;
    }, 160);
  }

  /** Selects the photo currently closest to the centre of the visible strip. */
  selectCentered() {
    if (!this.assets.length) return;
    const track = this.track;
    const center = track.scrollLeft + track.clientWidth / 2;
    const items = track.children;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
      const el = items[i];
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(elCenter - center);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestIdx !== this.activeIndex) {
      this.onScrub(bestIdx);
    }
  }

  /** How many thumbnails fit across the visible track. */
  visibleCount() {
    const item = this.track.querySelector('.tl-item');
    if (!item) return 1;
    const w = item.getBoundingClientRect().width + 6; // include gap
    return Math.max(1, Math.floor(this.track.clientWidth / w));
  }

  /**
   * Re-scrolls the active thumbnail into view. Needed after the timeline
   * height changes (entering / leaving the full-screen viewer) since the item
   * sizes change and the previous scroll position no longer centers it.
   */
  recenter() {
    if (this.activeIndex < 0) return;
    const el = this.track.children[this.activeIndex];
    if (el) this._scrollTo(el, 'center');
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

  /** Moves by almost a full screen of thumbnails (keeps 1 for overlap). */
  page(dir) {
    if (!this.assets.length) return;
    const count = Math.max(1, this.visibleCount() - 1);
    const base = this.activeIndex < 0 ? 0 : this.activeIndex;
    let next = base + dir * count;
    next = Math.max(0, Math.min(this.assets.length - 1, next));
    // Align to the left edge so exactly one photo overlaps between pages.
    this.setActive(next, false, 'start');
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

  /** Restarts the countdown so manual navigation gets a full interval. */
  resetTimer() {
    if (!this.playing) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.step(1), this.intervalMs);
  }
}
