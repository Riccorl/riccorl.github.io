/* v1-polish: hero typing, reveals, glow triggers, scroll feel, line drawing.
   No dependencies except Lenis (optional; only used when "scroll feel" is on). */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("fx-ready");
  var motion = root.classList.contains("motion");
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- 1. hero: pick a language, then type it -------------------- */
  var variants = ["python", "java"];
  var pick = variants[Math.floor(Math.random() * variants.length)];
  $$("[data-variant]").forEach(function (el) { el.hidden = el.getAttribute("data-variant") !== pick; });
  var code = $('.code[data-variant="' + pick + '"]');
  var out = $(".hero-out");
  var lines = code ? $$(".line", code) : [];

  function runHero() {
    if (!motion) { if (out) out.classList.add("is-in"); return; }
    var typing = root.classList.contains("can-type");
    var i = 0;
    function next() {
      if (i >= lines.length) {
        lines[lines.length - 1].classList.add("caret");
        setTimeout(function () { out && out.classList.add("is-in"); }, 120);
        return;
      }
      var line = lines[i++];
      var n = line.textContent.length;
      line.style.setProperty("--ch", n);
      if (typing && n > 0) {
        line.classList.add("typing");
        setTimeout(function () { line.classList.remove("typing"); line.classList.add("done"); next(); }, n * 26 + 160);
      } else {
        line.classList.add("done");
        setTimeout(next, 160);
      }
    }
    setTimeout(next, 250);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(runHero);

  /* ---------- 2. headings rise from a mask (one piece, text stays as-is for AT) */
  $$(".reveal-words").forEach(function (el) {
    el.innerHTML = '<span class="w"><span>' + el.innerHTML.trim() + "</span></span>";
  });

  /* ---------- 3. wrap logos for drawn rings ----------------------------- */
  var RING = '<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49" pathLength="100"/></svg>';
  $$("img.work-pic, img.pub-pic").forEach(function (img) {
    var wrap = document.createElement("span");
    wrap.className = "logo " + (img.classList.contains("work-pic") ? "is-work" : "is-pub");
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
    wrap.insertAdjacentHTML("beforeend", RING);
  });

  /* ---------- 4. reveal on scroll --------------------------------------- */
  var revealTargets = $$("#description, .follow, .work-row, .info > h4.getPro, .project .col");
  revealTargets.forEach(function (el) { el.classList.add("reveal"); });
  // headings, dividers and the glance panel only need .is-in, not the fade

  var watch = revealTargets.concat($$(".reveal-words, hr, .glance"));
  if (!("IntersectionObserver" in window) || !motion) {
    watch.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty("--d", (k++ * 80) + "ms");
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    watch.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 5. scroll feel: Lenis, hide-on-scroll bar, section tint --- */
  var bar = $(".topbar");
  var hero = $(".open");
  var lenis = null;

  var lenisLoading = false;
  function startLenis() {
    if (lenis || !motion) return;
    if (typeof window.Lenis !== "function") {          // load on demand, only when scroll feel is on
      if (lenisLoading) return;
      lenisLoading = true;
      var sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js";
      sc.onload = function () { lenisLoading = false; if (root.classList.contains("fx-scroll")) startLenis(); };
      sc.onerror = function () { lenisLoading = false; };
      document.head.appendChild(sc);
      return;
    }
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    (function raf(t) { if (!lenis) return; lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }
  function stopLenis() { if (lenis) { lenis.destroy(); lenis = null; } }

  // anchor links: smooth with Lenis when on, native otherwise
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    var target = id === "#top" ? document.body : $(id);
    if (!target) return;
    ev.preventDefault();
    if (lenis) lenis.scrollTo(id === "#top" ? 0 : target, { offset: -76, duration: 1.4 });
    else window.scrollTo({ top: id === "#top" ? 0 : target.getBoundingClientRect().top + window.scrollY - 76, behavior: motion ? "smooth" : "auto" });
    if (history.replaceState) history.replaceState(null, "", id);
  });

  var lastY = window.scrollY;
  // Top bar: hidden over the hero; past it, shown. With "scroll feel" on it also hides while you
  // read downwards and returns when you scroll back up. Hysteresis (80px down / 40px up) stops it
  // flickering on small or smoothed scroll steps; nav clicks and the page end always show it.
  var dir = 0, turnY = window.scrollY, holdUntil = 0;
  function setBar(on) { bar.classList.toggle("is-visible", on); }
  function onScroll() {
    var y = window.scrollY;
    var pastHero = y > (hero ? hero.offsetHeight * 0.8 : 400);
    var atEnd = y + window.innerHeight >= document.documentElement.scrollHeight - 4;
    if (!pastHero) { setBar(false); dir = 0; turnY = y; lastY = y; return; }
    if (!root.classList.contains("fx-scroll") || atEnd || performance.now() < holdUntil) { setBar(true); lastY = y; return; }
    if (y > lastY) { if (dir !== 1) { dir = 1; turnY = lastY; } if (y - turnY > 80) setBar(false); }
    else if (y < lastY) { if (dir !== -1) { dir = -1; turnY = lastY; } if (turnY - y > 40) setBar(true); }
    lastY = y;
  }
  bar.addEventListener("click", function () { holdUntil = performance.now() + 1600; });
  window.addEventListener("scroll", onScroll, { passive: true });

  // current section: nav state always; background tint only with scroll feel
  var NAV = { now: "now", news: "news", publications: "publications", past: "past", projects: "projects" };
  // Background follows the scroll position itself: each section has a tint, and the colour
  // is blended continuously across a band before each heading. Smooth with or without Lenis,
  // and it never lags behind a fast scroll because nothing is time-based.
  var TVAR = { about: "--tint-a", now: "--tint-b", news: "--tint-b", publications: "--bg", past: "--tint-a", projects: "--tint-c" };
  var heads = Object.keys(TVAR).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  function hexRGB(v) {
    v = (v || "").trim();
    var m = /^#?([0-9a-f]{6})$/i.exec(v);
    if (!m) return null;
    var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  var cols = {}, base = [14, 14, 17];
  function readColours() {
    var cs = getComputedStyle(root);
    base = hexRGB(cs.getPropertyValue("--bg")) || base;
    heads.forEach(function (h) { cols[h.id] = hexRGB(cs.getPropertyValue(TVAR[h.id])) || hexRGB(cs.getPropertyValue("--tint")) || base; });
  }
  readColours();
  var current = null;
  function setNav(id) {
    if (id === current) return; current = id;
    $$(".topbar-nav a").forEach(function (a) {
      if (id && a.getAttribute("href") === "#" + NAV[id]) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }
  var ticking = false;
  function trackSection() {
    ticking = false;
    var vh = window.innerHeight, line = vh * 0.45, band = vh * 0.4;
    var prev = base, next = null, dist = Infinity, id = null;
    for (var k = 0; k < heads.length; k++) {
      var top = heads[k].getBoundingClientRect().top;
      if (top < line) { prev = cols[heads[k].id]; id = heads[k].id; }
      else { next = cols[heads[k].id]; dist = top - line; break; }
    }
    var t = next && dist < band ? 1 - dist / band : 0;
    t = t * t * (3 - 2 * t);                                          // smoothstep
    var c = prev.map(function (v, i) { return Math.round(v + ((next ? next[i] : v) - v) * t); });
    root.style.setProperty("--page-bg", "rgb(" + c.join(",") + ")");
    setNav(id);
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(trackSection); } }, { passive: true });
  window.addEventListener("resize", trackSection);
  trackSection();

  if (root.classList.contains("fx-scroll")) startLenis();
  onScroll();
})();
