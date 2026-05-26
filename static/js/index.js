/* ===================================================================
   GeRaF — project page interactivity
   - results marquee (right-to-left infinite scroll)
   - legacy carousel (no-op if #results-carousel is absent)
   - copy-to-clipboard for the BibTeX block
   =================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  initTeaserMarquee();
  initCarousel();
  initBibtexCopy();
  initVideoModal();
  initThumbHoverPreview();
});

/* ---------- result-card thumb hover preview -----------------------
   On hover over a top-right thumbnail in a result card, show a larger
   floating copy (260×260) near the mouse. Hide on leave. Position is
   fixed in viewport coordinates so the preview escapes any
   overflow:hidden parents.
   ------------------------------------------------------------------ */
function initThumbHoverPreview() {
  const preview = document.getElementById('thumb-preview');
  if (!preview) return;
  const previewImg = preview.querySelector('img');
  const SIZE = 260, GAP = 14;

  function show(thumb) {
    if (!thumb || !thumb.src) return;
    previewImg.src = thumb.src;
    position(thumb);
    preview.classList.add('is-visible');
    preview.setAttribute('aria-hidden', 'false');
  }
  function hide() {
    preview.classList.remove('is-visible');
    preview.setAttribute('aria-hidden', 'true');
  }
  function position(thumb) {
    const r = thumb.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    // Prefer to the LEFT of the thumb (it sits in the card's top-right).
    let left = r.left - SIZE - GAP;
    if (left < 8) left = r.right + GAP;           // fall back to right side
    let top = r.top + r.height / 2 - SIZE / 2;
    if (top < 8)         top = 8;
    if (top + SIZE > vh - 8) top = vh - SIZE - 8;
    if (left + SIZE > vw - 8) left = vw - SIZE - 8;
    preview.style.left = left + 'px';
    preview.style.top  = top  + 'px';
  }

  // Delegated so cards added later (or marquee clones, etc.) are covered.
  document.addEventListener('mouseover', e => {
    const thumb = e.target.closest('.result-card-thumbs img');
    if (thumb) show(thumb);
  });
  document.addEventListener('mouseout', e => {
    const thumb = e.target.closest('.result-card-thumbs img');
    if (!thumb) return;
    // Only hide when leaving toward something OUTSIDE the thumb
    if (e.relatedTarget && thumb.contains(e.relatedTarget)) return;
    hide();
  });
  // Hide on scroll — positions go stale
  window.addEventListener('scroll', hide, { passive: true });
}

/* ---------- video modal -------------------------------------------
   Any element with `data-open-video-modal` opens a floating video
   player when clicked, reading the source from `data-video` and the
   title from `data-video-title`. Close: backdrop click, X button,
   or Escape. The player is paused and the src is cleared on close so
   audio stops and the next open starts fresh.
   ------------------------------------------------------------------ */
function initVideoModal() {
  const modal  = document.getElementById('video-modal');
  const player = document.getElementById('video-modal-player');
  const titleEl = document.getElementById('video-modal-title');
  if (!modal || !player) return;

  function open(trigger) {
    const src   = trigger.dataset.video;
    const title = trigger.dataset.videoTitle || 'Video';
    if (!src) return;
    titleEl.textContent = title;
    player.src = src;
    player.currentTime = 0;
    player.play().catch(function () {});
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal-open');
  }
  function close() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-modal-open');
    player.pause();
    player.removeAttribute('src');
    player.load();
  }

  // delegated open
  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('[data-open-video-modal]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger);
  });
  // close on backdrop / X / Escape
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-video-modal]')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
}

/* ---------- teaser marquee ----------------------------------------
   Clones the originals until the track is at least one viewport wider
   than one originals-set, then animates by exactly one set-width
   (items + trailing gap, in pixels). This keeps the loop seamless even
   when there are few items or a wide viewport — the duplicate-then-
   translateX(-50%) trick fails when the cloned track is narrower than
   `viewport + setWidth`, which is what was causing the visible gap.
   ------------------------------------------------------------------ */
function initTeaserMarquee() {
  const SPEED_PX_PER_SEC = 60;          // tweak to taste

  document.querySelectorAll('.teaser-marquee-track').forEach(function (track) {
    if (track.dataset.cloned === 'true') return;
    const originals = Array.from(track.children);
    if (originals.length === 0) return;
    track.dataset.cloned = 'true';

    // Wait one frame so offsetWidth is meaningful (layout has happened).
    const setup = function () {
      const firstW = originals[0].offsetWidth;
      if (!firstW) { requestAnimationFrame(setup); return; }

      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      // One originals-set = N items + N gaps (the trailing gap is the one
      // sitting between the last original and the first clone). Animating
      // by exactly this lands each clone where its original was — no jump.
      const setShift = originals.reduce(function (sum, el) {
        return sum + el.offsetWidth + gap;
      }, 0);

      // For the viewport to stay fully covered throughout the cycle, the
      // track needs to be at least one viewport wider than one set:
      //   W_track >= viewport + setShift
      const marquee = track.parentElement;
      const viewport = marquee ? marquee.clientWidth : window.innerWidth;
      const targetW  = viewport + setShift + 4;  // small safety pad

      let safety = 64;
      while (track.scrollWidth < targetW && safety-- > 0) {
        originals.forEach(function (item) {
          const clone = item.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          clone.classList.add('is-clone');
          const video = clone.tagName === 'VIDEO'
            ? clone
            : clone.querySelector('video');
          if (video) { video.play().catch(function () {}); }
          track.appendChild(clone);
        });
      }

      track.style.setProperty('--marquee-shift',
        setShift.toFixed(2) + 'px');
      const duration = Math.max(8, setShift / SPEED_PX_PER_SEC);
      track.style.setProperty('--marquee-duration',
        duration.toFixed(2) + 's');
    };
    requestAnimationFrame(setup);
  });
}

/* ---------- results carousel --------------------------------------- */
function initCarousel() {
  const carousel = document.getElementById('results-carousel');
  if (!carousel) return;

  const track  = carousel.querySelector('.carousel-track');
  const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
  const prev   = carousel.querySelector('.carousel-prev');
  const next   = carousel.querySelector('.carousel-next');
  const dotBox = carousel.querySelector('.carousel-dots');
  if (slides.length === 0) return;

  let index = 0;

  // build navigation dots
  slides.forEach(function (_, i) {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' is-active' : '');
    dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
    dot.addEventListener('click', function () { go(i); });
    dotBox.appendChild(dot);
  });

  function go(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = 'translateX(' + (-index * 100) + '%)';
    dotBox.querySelectorAll('.carousel-dot').forEach(function (d, di) {
      d.classList.toggle('is-active', di === index);
    });
    // only play the visible slide's video
    slides.forEach(function (s, si) {
      const v = s.querySelector('video');
      if (!v) return;
      if (si === index) { v.play().catch(function () {}); }
      else { v.pause(); }
    });
  }

  prev.addEventListener('click', function () { go(index - 1); });
  next.addEventListener('click', function () { go(index + 1); });

  // keyboard navigation
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft')  go(index - 1);
    if (e.key === 'ArrowRight') go(index + 1);
  });

  go(0);
}

/* ---------- copy BibTeX -------------------------------------------- */
function initBibtexCopy() {
  document.querySelectorAll('.copy-button').forEach(function (button) {
    const targetId = button.dataset.target;
    if (!targetId) return;
    const block = document.getElementById(targetId);
    if (!block) return;

    button.addEventListener('click', function () {
      navigator.clipboard.writeText(block.innerText.trim()).then(function () {
        const original = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied';
        setTimeout(function () { button.innerHTML = original; }, 1800);
      });
    });
  });
}
