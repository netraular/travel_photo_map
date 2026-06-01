// Small shared UI helpers.

/**
 * Detects horizontal swipes on an element and calls the matching handler.
 * Swiping right runs `onRight` (previous), swiping left runs `onLeft` (next).
 * Vertical gestures and short taps are ignored so video controls keep working.
 *
 * @param {HTMLElement} el
 * @param {()=>void} onRight
 * @param {()=>void} onLeft
 */
export function addSwipe(el, onRight, onLeft) {
  let x0 = null;
  let y0 = null;

  el.addEventListener(
    'touchstart',
    (e) => {
      const t = e.changedTouches[0];
      x0 = t.clientX;
      y0 = t.clientY;
    },
    { passive: true }
  );

  el.addEventListener(
    'touchend',
    (e) => {
      if (x0 === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - x0;
      const dy = t.clientY - y0;
      x0 = null;
      y0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) onRight();
        else onLeft();
      }
    },
    { passive: true }
  );
}
