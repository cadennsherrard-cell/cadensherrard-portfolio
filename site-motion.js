/* Shared scroll-driven motion for every page. No dependencies.
   Tags elements with .reveal / splits headlines into masked words, then
   uses IntersectionObserver to play them as they enter the viewport. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    /* ---------- 1. Scroll progress bar ---------- */
    var bar = document.createElement('div');
    bar.className = 'motion-progress';
    document.body.appendChild(bar);

    /* ---------- 2. Headline word-mask split ---------- */
    var headingSel = [
      '.hero-name', '.section-head h2', '.case-study-title', '.detail-hero h1',
      '.contact h2', '.adset-head h4'
    ].join(',');

    function splitHeading(el) {
      var label = el.textContent.replace(/\s+/g, ' ').trim();
      var nodes = Array.prototype.slice.call(el.childNodes);
      var i = 0;
      el.textContent = '';
      nodes.forEach(function (node) {
        if (node.nodeType === 3) {
          var parts = node.textContent.split(/(\s+)/);
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(' ')); return; }
            var mask = document.createElement('span');
            mask.className = 'mw';
            mask.setAttribute('aria-hidden', 'true');
            var inner = document.createElement('span');
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            mask.appendChild(inner);
            el.appendChild(mask);
          });
        } else {
          el.appendChild(node); // <br> etc.
        }
      });
      el.setAttribute('aria-label', label);
    }

    var headings = $$(headingSel);
    headings.forEach(splitHeading);

    /* ---------- 3. Tag elements for reveal ---------- */
    function tag(el, delay, variant) {
      if (!el || el.classList.contains('reveal')) return;
      el.classList.add('reveal');
      if (variant) el.classList.add(variant);
      if (delay) el.style.setProperty('--d', delay + 'ms');
    }

    // Single elements
    [
      '.intro-photo', '.case-study-copy', '.bavr', '.case-study-media'
    ].forEach(function (sel) {
      $$(sel).forEach(function (el) {
        // Eyebrows sit right above headlines: tiny lead so the pair reads in order.
        tag(el, 0);
      });
    });

    // Staggered groups: children enter one after another.
    var groups = {
      '.work-row': { variant: 'reveal-scale', step: 110 },
      '.index-list': { step: 110 },
      '.stat-grid': { variant: 'reveal-scale', step: 90 },
      '.skills-grid': { variant: 'reveal-scale', step: 120 },
      '.intro-facts': { step: 110 },
      '.detail-gallery': { variant: 'reveal-scale', step: 130 },
      '.detail-list': { step: 100 },
      '.cs-col': { variant: 'reveal-scale', step: 120 },
      '.adset-grid': { variant: 'reveal-scale', step: 100 }
    };
    Object.keys(groups).forEach(function (sel) {
      var cfg = groups[sel];
      $$(sel).forEach(function (group) {
        Array.prototype.slice.call(group.children).forEach(function (child, i) {
          tag(child, Math.min(i, 6) * cfg.step, cfg.variant);
        });
      });
    });

    // Case study columns slide in from their own side.
    $$('.case-study-grid').forEach(function (grid) {
      var reverse = grid.parentElement.parentElement.classList.contains('reverse');
      var mediaGrid = grid.querySelector('.case-study-media-grid');
      if (mediaGrid) {
        mediaGrid.classList.add('reveal', reverse ? 'reveal-right' : 'reveal-left');
      }
    });

    /* ---------- 3b. Keyboard access for video tiles ---------- */
    var tileSel = '.work-card, .cs-tile, .adset-tile, .gallery-tile';
    $$(tileSel).forEach(function (tile) {
      var isVideoTile = tile.querySelector('video') || tile.classList.contains('adset-tile');
      if (!isVideoTile || tile.classList.contains('cs-carousel')) return;
      tile.setAttribute('tabindex', '0');
      tile.setAttribute('role', 'button');
      tile.setAttribute('aria-label', 'Play or pause video');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tile = e.target.closest && e.target.closest(tileSel);
      if (!tile || e.target !== tile) return;
      var video = tile.querySelector('video');
      if (!video) return;
      e.preventDefault();
      if (video.paused) {
        $$('video').forEach(function (v) { if (v !== video && !v.classList.contains('hero-media') && !v.autoplay) v.pause(); });
        video.muted = false;
        video.play().catch(function () { video.muted = true; video.play().catch(function () {}); });
        tile.classList.add('is-playing');
      } else {
        video.pause();
        video.muted = true;
        tile.classList.remove('is-playing');
      }
    });

    /* ---------- 4. Observers ---------- */
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px 0px 0px' });

    var headingObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        headingObserver.unobserve(entry.target);
      });
    }, { threshold: 0.35, rootMargin: '0px 0px -4% 0px' });

    // Wait two frames so the hidden start state is painted before we observe;
    // that is what makes above-the-fold items animate on load too.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        $$('.reveal').forEach(function (el) { revealObserver.observe(el); });
        headings.forEach(function (el) { headingObserver.observe(el); });
      });
    });

    /* ---------- 5. Number count-up ---------- */
    function parseStat(text) {
      var m = text.trim().match(/^([^0-9]*)([0-9][0-9,]*\.?[0-9]*)(.*)$/);
      if (!m) return null;
      var raw = m[2];
      var decimals = raw.indexOf('.') >= 0 ? raw.split('.')[1].length : 0;
      return {
        prefix: m[1], suffix: m[3],
        value: parseFloat(raw.replace(/,/g, '')),
        decimals: decimals,
        commas: raw.indexOf(',') >= 0
      };
    }
    function format(n, s) {
      var str = n.toFixed(s.decimals);
      if (s.commas) {
        var parts = str.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        str = parts.join('.');
      }
      return s.prefix + str + s.suffix;
    }
    function countUp(el) {
      var s = parseStat(el.textContent);
      if (!s || !isFinite(s.value)) return;
      var duration = 1600, start = null;
      function frame(t) {
        if (start === null) start = t;
        var p = Math.min((t - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 4);
        el.textContent = format(s.value * eased, s);
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = format(s.value, s);
      }
      el.textContent = format(0, s);
      requestAnimationFrame(frame);
    }
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.8 });
    $$('.stat-num, .intro-fact-num').forEach(function (el) { countObserver.observe(el); });

    /* ---------- 6. Scroll-linked: progress bar + hero parallax ---------- */
    var hero = document.querySelector('.hero');
    var heroMedia = hero && hero.querySelector('.hero-media');
    var heroContent = hero && hero.querySelector('.hero-content');
    var ticking = false;

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';

      if (hero && window.innerWidth > 640) {
        var h = hero.offsetHeight;
        if (y < h * 1.2) {
          var shift = Math.min(y * 0.18, h * 0.055);
          if (heroMedia) heroMedia.style.translate = '0 ' + shift.toFixed(1) + 'px';
          if (heroContent) {
            heroContent.style.translate = '0 ' + (-y * 0.1).toFixed(1) + 'px';
            heroContent.style.opacity = Math.max(1 - y / (h * 0.75), 0).toFixed(3);
          }
        }
      }
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  });
})();
