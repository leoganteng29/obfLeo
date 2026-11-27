/* Lenis-lite: smooth scroll ringan dengan API ala Lenis (new Lenis({lerp}), .on("scroll"), .raf(ms), .scrollTo, .stop/.start, .destroy).
   Ganti file ini dengan build resmi lenis.min.js (https://github.com/darkroomengineering/lenis) kalau mau fitur penuh; pemanggilan di fx.js tetap sama. */
(function (root) {
  "use strict";
  function Lenis(opt) {
    opt = opt || {};
    var self = this, lerp = opt.lerp == null ? 0.1 : opt.lerp, mult = opt.wheelMultiplier || 1;
    var cur = window.scrollY, target = cur, last = cur, stopped = false, cbs = [];
    var de = document.documentElement;
    de.classList.add("lenis");

    function limit() { return Math.max(0, de.scrollHeight - window.innerHeight); }
    function clamp(v) { return Math.min(Math.max(v, 0), limit()); }
    function innerScroller(el) {
      for (; el && el !== document.body && el !== de; el = el.parentElement) {
        if (el.hasAttribute && el.hasAttribute("data-lenis-prevent")) return true;
        var s = getComputedStyle(el), oy = s.overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return true;
      }
      return false;
    }
    function onWheel(e) {
      if (e.ctrlKey || e.defaultPrevented || stopped) return;
      if (limit() <= 0 || innerScroller(e.target)) return;
      var dy = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1) * mult;
      if (!dy) return;
      e.preventDefault();
      target = clamp(target + dy);
    }
    function onNative() {
      // scroll dari keyboard / drag scrollbar / anchor: ikuti posisi asli
      var y = window.scrollY;
      if (Math.abs(y - last) > 1.5) { cur = target = last = y; emit(); }
    }
    function emit() { for (var i = 0; i < cbs.length; i++) cbs[i](self); }

    this.on = function (ev, fn) { if (ev === "scroll") cbs.push(fn); return function () { cbs = cbs.filter(function (f) { return f !== fn; }); }; };
    this.raf = function (ms) {
      var now = ms, dt = Math.min((now - (this._t || now)) / 1000, 0.1); this._t = now;
      if (Math.abs(target - cur) < 0.05) { if (cur !== target) { cur = target; } else { return; } }
      else cur += (target - cur) * (1 - Math.pow(1 - lerp, dt * 60));
      last = Math.round(cur * 100) / 100;
      window.scrollTo(0, cur);
      emit();
    };
    this.scrollTo = function (v, o) {
      if (typeof v === "string") { var el = document.querySelector(v); if (!el) return; v = el.getBoundingClientRect().top + window.scrollY; }
      else if (v && v.getBoundingClientRect) v = v.getBoundingClientRect().top + window.scrollY;
      v = clamp(v + ((o && o.offset) || 0));
      if (o && o.immediate) { cur = target = last = v; window.scrollTo(0, v); emit(); } else target = v;
    };
    this.stop = function () { stopped = true; target = cur; };
    this.start = function () { stopped = false; };
    this.resize = function () { target = clamp(target); };
    this.destroy = function () {
      window.removeEventListener("wheel", onWheel, { passive: false });
      window.removeEventListener("scroll", onNative);
      de.classList.remove("lenis"); cbs = [];
    };
    Object.defineProperty(this, "scroll", { get: function () { return cur; } });
    Object.defineProperty(this, "limit", { get: limit });

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onNative, { passive: true });
  }
  root.Lenis = Lenis;
})(window);
