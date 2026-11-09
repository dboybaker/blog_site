/* Image lightbox.
 *
 * Review posts pack two or three screenshots into a single HTML table row, so a
 * 2000px-wide dashboard capture renders about 110px across on a phone. This
 * opens any article image in a near-fullscreen viewer instead. It runs off one
 * delegated listener on the document, so it picks up every way an image can
 * reach an article - <img> inside a raw table, a markdown image, the figure
 * shortcode, a model-report SVG - and no post needs per-image markup.
 *
 * Opt out with data-no-lightbox on the img (or an ancestor) or the class
 * "no-lightbox". Images inside a link are skipped so the link wins, as are
 * anything under 64px intrinsic - an icon is not worth a modal.
 */
(function () {
  var SCOPE = '.post-content';
  var ELIGIBLE = 'lightbox-eligible';
  var MIN_PX = 64;
  var HIDE_MS = 200;

  var overlay = null;
  var stage = null;
  var bigImg = null;
  var captionEl = null;
  var counterEl = null;
  var closeBtn = null;
  var items = [];
  var index = 0;
  var lastFocused = null;
  var hideTimer = null;

  function closestEl(target, selector) {
    return target && target.closest ? target.closest(selector) : null;
  }

  function isOpen() {
    return !!overlay && !overlay.hidden;
  }

  // An image not yet decoded reports naturalWidth 0; treat that as eligible
  // rather than mistaking a lazy screenshot for an icon.
  function eligible(img) {
    if (img.classList.contains('no-lightbox')) return false;
    if (img.closest('[data-no-lightbox]')) return false;
    if (img.closest('a[href]')) return false;
    if (img.naturalWidth > 0 &&
        (img.naturalWidth < MIN_PX || img.naturalHeight < MIN_PX)) {
      return false;
    }
    return true;
  }

  function init() {
    var imgs = document.querySelectorAll(SCOPE + ' img');
    Array.prototype.forEach.call(imgs, function (img) {
      if (!eligible(img)) return;
      img.classList.add(ELIGIBLE);
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label',
        img.alt ? 'Open image: ' + img.alt : 'Open image full size');
    });
  }

  // The gallery is whatever is currently laid out on the page, so images in a
  // closed tab panel stay out of the count until that panel is opened.
  function group() {
    return Array.prototype.slice.call(
      document.querySelectorAll(SCOPE + ' img.' + ELIGIBLE)
    ).filter(function (img) {
      return img.getBoundingClientRect().width > 0;
    });
  }

  function build() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Image viewer');
    overlay.hidden = true;
    overlay.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Close image viewer">&times;</button>' +
      '<button type="button" class="lightbox-nav lightbox-prev" aria-label="Previous image">&#8249;</button>' +
      '<button type="button" class="lightbox-nav lightbox-next" aria-label="Next image">&#8250;</button>' +
      '<figure class="lightbox-figure">' +
        '<div class="lightbox-stage"><img class="lightbox-img" alt="" decoding="async"></div>' +
        '<figcaption class="lightbox-caption"></figcaption>' +
      '</figure>' +
      '<p class="lightbox-counter" aria-live="polite"></p>';
    document.body.appendChild(overlay);
    stage = overlay.querySelector('.lightbox-stage');
    bigImg = overlay.querySelector('.lightbox-img');
    captionEl = overlay.querySelector('.lightbox-caption');
    counterEl = overlay.querySelector('.lightbox-counter');
    closeBtn = overlay.querySelector('.lightbox-close');
  }

  function setZoom(on, evt) {
    if (!bigImg) return;
    if (!on) {
      bigImg.classList.remove('is-zoomed');
      bigImg.style.width = '';
      return;
    }
    var box = bigImg.getBoundingClientRect();
    var ratioX = evt ? (evt.clientX - box.left) / Math.max(box.width, 1) : 0.5;
    var ratioY = evt ? (evt.clientY - box.top) / Math.max(box.height, 1) : 0.5;
    bigImg.classList.add('is-zoomed');
    // Aim for native pixels, but never so far out that a huge capture floats
    // away from its own scroll container.
    var natural = bigImg.naturalWidth || bigImg.clientWidth * 2;
    var target = Math.round(Math.min(
      Math.max(natural, bigImg.clientWidth * 1.5),
      stage.clientWidth * 4
    ));
    bigImg.style.width = target + 'px';
    requestAnimationFrame(function () {
      stage.scrollLeft = Math.max(0,
        Math.round(ratioX * bigImg.offsetWidth - stage.clientWidth / 2));
      stage.scrollTop = Math.max(0,
        Math.round(ratioY * bigImg.offsetHeight - stage.clientHeight / 2));
    });
  }

  function show(i) {
    index = (i + items.length) % items.length;
    var img = items[index];
    var src = img.currentSrc || img.src;
    if (!src) return;
    setZoom(false);
    bigImg.src = src;
    bigImg.alt = img.alt || '';
    captionEl.textContent = img.alt || '';
    captionEl.hidden = !img.alt;
    counterEl.textContent =
      items.length > 1 ? (index + 1) + ' / ' + items.length : '';
    Array.prototype.forEach.call(
      overlay.querySelectorAll('.lightbox-nav'),
      function (btn) { btn.hidden = items.length < 2; }
    );
    var next = items[(index + 1) % items.length];
    if (next) {
      var pre = new Image();
      pre.src = next.currentSrc || next.src;
    }
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
  }

  function open(img) {
    items = group();
    var pos = items.indexOf(img);
    if (pos < 0) {
      items = [img];
      pos = 0;
    }
    build();
    show(pos);
    lastFocused = img;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    overlay.hidden = false;
    document.body.classList.add('lightbox-open');
    requestAnimationFrame(function () {
      overlay.classList.add('is-open');
    });
    closeBtn.focus();
  }

  function close() {
    if (!isOpen()) return;
    overlay.classList.remove('is-open');
    document.body.classList.remove('lightbox-open');
    hideTimer = setTimeout(function () {
      overlay.hidden = true;
      hideTimer = null;
    }, HIDE_MS);
    if (lastFocused && lastFocused.isConnected) {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  function step(delta) {
    if (items.length < 2) return;
    show(index + delta);
  }

  // Keep Tab inside the viewer: there are only three controls in it.
  function trapFocus(evt) {
    var focusable = [closeBtn].concat(Array.prototype.filter.call(
      overlay.querySelectorAll('.lightbox-nav'),
      function (btn) { return !btn.hidden; }
    ));
    if (focusable.length < 2) return;
    var at = focusable.indexOf(document.activeElement);
    if (at < 0) at = evt.shiftKey ? 0 : focusable.length - 1;
    else at = (at + (evt.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
    evt.preventDefault();
    focusable[at].focus();
  }

  document.addEventListener('click', function (evt) {
    if (isOpen()) {
      if (closestEl(evt.target, '.lightbox-close')) {
        close();
      } else if (closestEl(evt.target, '.lightbox-prev')) {
        step(-1);
      } else if (closestEl(evt.target, '.lightbox-next')) {
        step(1);
      } else if (evt.target === bigImg) {
        setZoom(!bigImg.classList.contains('is-zoomed'), evt);
      } else if (!closestEl(evt.target, '.lightbox-figure')) {
        close();
      }
      return;
    }
    var img = closestEl(evt.target, 'img.' + ELIGIBLE);
    if (!img || !img.closest(SCOPE)) return;
    open(img);
  });

  document.addEventListener('keydown', function (evt) {
    if (isOpen()) {
      if (evt.key === 'Escape') {
        evt.preventDefault();
        close();
      } else if (evt.key === 'ArrowLeft') {
        evt.preventDefault();
        step(-1);
      } else if (evt.key === 'ArrowRight') {
        evt.preventDefault();
        step(1);
      } else if (evt.key === 'Tab') {
        trapFocus(evt);
      }
      return;
    }
    if (evt.key === 'Enter' || evt.key === ' ' || evt.key === 'Spacebar') {
      var img = closestEl(evt.target, 'img.' + ELIGIBLE);
      if (!img) return;
      evt.preventDefault();
      open(img);
    }
  });

  // A rotated phone or a resized window invalidates the zoom math.
  window.addEventListener('resize', function () {
    if (isOpen()) setZoom(false);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
