/* Isolated Command — motion engine.
 * Scroll-reveals every page's content into view (the same kinetic feel as the
 * hero) and cooperates with the browser's cross-document View Transitions for
 * smooth page-to-page changes.
 *
 * Contract with the CSS (custom.scss):
 *   - `html.js .reveal-up`      is hidden (opacity 0, offset).
 *   - `html.js .reveal-up.in`   is revealed.
 *   - Without `html.js` (JS off/blocked) content is fully visible — so nothing
 *     can ever be stranded. `html.js` is set by an inline head script pre-paint.
 *
 * This module (1) auto-tags sub-page content blocks as `.reveal-up` so markdown
 * stays clean, (2) reveals them via IntersectionObserver, (3) reveals anything
 * already on-screen immediately, and (4) force-reveals everything shortly after
 * load as a safety net. Reduced-motion is respected by the CSS.
 */
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("js")) root.classList.add("js");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Content blocks that should animate in on sub-pages (markdown stays clean).
  // Hero elements already carry .reveal-up and are skipped by :not().
  var AUTO = [
    ".post-content > h2",
    ".post-content > h3",
    ".post-content > p",
    ".post-content > ul",
    ".post-content > ol",
    ".post-content > table",
    ".post-content > blockquote",
    ".post-content > pre",
    ".section .title",
    ".card",
    ".team-card",
    ".go-step",
    ".file-step",
    ".ic-stage",
    ".project-card",
  ].join(",");

  function tag() {
    var seen = new Map(); // parent -> running index, for gentle stagger
    document.querySelectorAll(AUTO).forEach(function (el) {
      if (el.classList.contains("reveal-up")) return;
      el.classList.add("reveal-up");
      var key = el.parentNode;
      var i = seen.get(key) || 0;
      seen.set(key, i + 1);
      if (i > 0) el.style.transitionDelay = Math.min(i, 6) * 0.06 + "s";
    });
  }

  function run() {
    tag();
    var items = document.querySelectorAll(".reveal-up");

    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    items.forEach(function (el) {
      // reveal immediately if already in the initial viewport (e.g. the hero)
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
        el.classList.add("in");
      } else {
        io.observe(el);
      }
    });

    // Safety net: nothing stays hidden more than ~1.4s after load.
    window.addEventListener("load", function () {
      setTimeout(function () {
        document.querySelectorAll(".reveal-up:not(.in)").forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight) el.classList.add("in");
        });
      }, 1400);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
