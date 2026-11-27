/* NEXUS TOOLBOX — motion layer: Lenis (smooth scroll) + GSAP/ScrollTrigger/SplitText.
   Dimuat sebelum app.js. Semua animasi dimatikan jika reduce-motion aktif. */
(function () {
  "use strict";
  if (!window.gsap || !window.ScrollTrigger) return;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const SplitText = window.SplitText;
  if (SplitText) gsap.registerPlugin(ScrollTrigger, SplitText);
  else gsap.registerPlugin(ScrollTrigger);

  const reduced = () =>
    document.documentElement.dataset.reduceMotion === "true" ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- Smooth scroll (Lenis) ---------- */
  let lenis = null;
  function startSmoothScroll() {
    if (reduced() || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.NexusLenis = lenis;
  }
  startSmoothScroll();

  /* ---------- Judul dengan efek per huruf / kata ---------- */
  function splitTitles(root, body) {
    if (!SplitText || reduced()) return;
    if (body.classList.contains("landing-active")) {
      landingIntro(root);
      return;
    }
    root.querySelectorAll(".page-title:not([data-fx])").forEach((el) => {
      el.dataset.fx = "1";
      document.fonts.ready.then(() => {
        const s = new SplitText(el, { type: "words" });
        gsap.from(s.words, { yPercent: 60, opacity: 0, stagger: 0.06, duration: 0.7, ease: "power3.out" });
      });
    });
  }

  /* ---------- Intro landing: aurora, garis penerbangan, logo, lalu CTA ---------- */
  function landingIntro(root) {
    const logo = root.querySelector(".landing-logo:not([data-fx])");
    if (!logo) return;
    logo.dataset.fx = "1";
    const sub = root.querySelector(".landing-sub");
    const cta = root.querySelector(".landing-cta");
    const arc = root.querySelector(".flight-arc");
    const sparks = root.querySelectorAll(".landing-sparks i");
    const orbs = root.querySelectorAll(".landing-aurora i");
    if (arc) arc.setAttribute("pathLength", "1");
    document.fonts.ready.then(() => {
      if (!logo.isConnected) return;
      const chars = SplitText ? new SplitText(logo, { type: "chars" }).chars : [];
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (orbs.length) {
        tl.from(orbs, { scale: 0.3, opacity: 0, duration: 1.8, stagger: 0.25, ease: "power2.out" }, 0);
        gsap.to(orbs, { x: 36, y: -24, duration: 7, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: { each: 0.8, repeat: -1 } });
      }
      if (sparks.length) tl.from(sparks, { scale: 0, opacity: 0, duration: 0.8, stagger: 0.12, ease: "back.out(2)" }, 0.2);
      if (arc) tl.fromTo(arc, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.4, ease: "power2.inOut" }, 0.1);
      if (chars.length) tl.from(chars, { yPercent: 120, rotateX: -80, opacity: 0, filter: "blur(8px)", transformOrigin: "50% 100%", stagger: 0.045, duration: 1, ease: "back.out(1.7)" }, 1.1);
      if (sub) tl.from(sub, { opacity: 0, y: 14, letterSpacing: "0.3em", filter: "blur(6px)", duration: 1, ease: "power2.out" }, 2.1);
      if (cta) tl.from(cta, { opacity: 0, y: 18, scale: 0.92, duration: 0.8, ease: "back.out(1.8)" }, 2.5);
    });
  }

  /* ---------- Reveal kartu saat di-scroll ---------- */
  function revealOnScroll(view) {
    if (reduced()) return;
    const els = view.querySelectorAll(".card:not([data-fx]), .stat:not([data-fx]), .tool-card:not([data-fx])");
    if (!els.length) return;
    els.forEach((el) => (el.dataset.fx = "1"));
    gsap.set(els, { autoAlpha: 0, y: 26 });
    ScrollTrigger.batch(els, {
      start: "top 92%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", clearProps: "transform,opacity,visibility" }),
    });
  }

  /* ---------- Spotlight kecil yang mengikuti kursor di kartu ---------- */
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest && e.target.closest(".card");
    if (!card || reduced() || e.pointerType === "touch") return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
    card.classList.add("fx-spot");
  }, { passive: true });

  /* ---------- Animasi setiap kali halaman tampil ---------- */
  let pending = new Set();
  let frame = 0;
  function flush() {
    frame = 0;
    const nodes = [...pending].filter((n) => n.isConnected);
    pending = new Set();
    if (!nodes.length || reduced()) return;
    const view = document.getElementById("view");
    if (!view) return;
    const body = document.body;
    ScrollTrigger.getAll().forEach((t) => t.kill());
    if (!body.classList.contains("landing-active")) {
      gsap.fromTo(nodes, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out", clearProps: "transform,opacity" });
    }
    splitTitles(view, body);
    revealOnScroll(view);
    ScrollTrigger.refresh();
  }

  const observer = new MutationObserver((records) => {
    let got = false;
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n.nodeType === 1 && n.parentElement && n.parentElement.id === "view") { pending.add(n); got = true; }
      });
    }
    if (got && !frame) frame = requestAnimationFrame(() => setTimeout(flush, 0));
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
