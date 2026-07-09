/* Isolated Command — interactive data-grid field (vanilla canvas port of the
 * Launch WebGL shader). Enable per-site with `particle_grid = true` in params.
 *
 * The math mirrors the GLSL original:
 *   ambient   : crossed sine fields give the grid a slow breathing drift
 *   repulsion : Gaussian falloff from the cursor — F(d) = force · e^(−d²/2σ²)
 *   springs   : the cursor point and force are critically damped on the CPU
 *               (x += (target−x)(1−e^(−λ·dt))) with asymmetric lambdas —
 *               attack λ=10 (violent), release λ=3.2 (graceful) — so nodes
 *               scatter hard and glide home.
 *   discipline: scroll depth calms the field (1 → 0.15) as the visitor moves
 *               from the hype drop into the working content.
 *   bloodline : #FF0033 illuminates ONLY as a function of displacement energy.
 *
 * Perf: ~1.2k nodes, one rAF loop, no allocations per frame, DPR-capped at 2,
 * paused when the tab is hidden. Reduced-motion renders a static grid.
 */
(function () {
  "use strict";
  var canvas = document.getElementById("ic-particle-grid");
  if (!canvas) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ctx = canvas.getContext("2d");
  var dpr, W, H, cols, rows, nodes;

  var SPACING = 46;          // px between nodes
  var SIGMA = 130;           // blast radius (px)
  var BASE = { r: 138, g: 138, b: 144 };   // architectural grey
  var ACID = { r: 255, g: 0, b: 51 };      // Bloodline Red — node illumination

  var mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999, lastX: 0, lastY: 0, has: false };
  var force = 0, forceTarget = 0;
  var discipline = 1, disciplineTarget = 1;
  var lastT = 0, running = true;

  function damp(cur, target, lambda, dt) {
    return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
  }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.ceil(W / SPACING) + 1;
    rows = Math.ceil(H / SPACING) + 1;
    nodes = new Float32Array(cols * rows * 3); // x, y, phase
    var i = 0;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        nodes[i++] = x * SPACING;
        nodes[i++] = y * SPACING;
        nodes[i++] = Math.random() * Math.PI * 2;
      }
    }
  }

  function frame(t) {
    if (!running) return;
    var dt = Math.min((t - lastT) / 1000 || 0.016, 1 / 30);
    lastT = t;

    // springs (asymmetric: instant violence, graceful recovery)
    var lambda = forceTarget > force ? 10 : 3.2;
    force = damp(force, forceTarget, lambda, dt);
    discipline = damp(discipline, disciplineTarget, 4, dt);
    mouse.sx = damp(mouse.sx, mouse.x, 14, dt);
    mouse.sy = damp(mouse.sy, mouse.y, 14, dt);
    forceTarget = damp(forceTarget, mouse.has ? 0.5 : 0, 2.5, dt); // idle decay toward hover floor / rest

    ctx.clearRect(0, 0, W, H);
    var time = t * 0.00035;
    var breathe = reduced ? 0 : discipline * 7;
    var twoSigma2 = 2 * SIGMA * SIGMA;

    for (var i = 0; i < nodes.length; i += 3) {
      var bx = nodes[i], by = nodes[i + 1], ph = nodes[i + 2];

      // ambient drift
      var x = bx + Math.sin(by * 0.012 + time * 1.4 + ph) * breathe * 0.5;
      var y = by + Math.sin(bx * 0.012 + time + ph) * breathe;

      // Gaussian repulsion
      var dx = x - mouse.sx, dy = y - mouse.sy;
      var d2 = dx * dx + dy * dy;
      var energy = 0;
      if (!reduced && d2 < twoSigma2 * 4) {
        var f = force * Math.exp(-d2 / twoSigma2);
        var d = Math.sqrt(d2) || 1;
        x += (dx / d) * f * 52;
        y += (dy / d) * f * 52;
        energy = Math.min(f * 1.5, 1);
      }

      // draw: grey at rest, acid when energised
      var r = BASE.r + (ACID.r - BASE.r) * energy;
      var g = BASE.g + (ACID.g - BASE.g) * energy;
      var b = BASE.b + (ACID.b - BASE.b) * energy;
      var alpha = 0.22 + energy * 0.7;
      var size = 1.1 + energy * 1.8;
      ctx.fillStyle = "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + "," + alpha + ")";
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }

    requestAnimationFrame(frame);
  }

  // pointer → position + velocity-boosted detonation force
  window.addEventListener("pointermove", function (e) {
    var vx = e.clientX - mouse.lastX, vy = e.clientY - mouse.lastY;
    var speed = Math.sqrt(vx * vx + vy * vy);
    mouse.lastX = e.clientX; mouse.lastY = e.clientY;
    if (!mouse.has) { mouse.sx = e.clientX; mouse.sy = e.clientY; }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.has = true;
    forceTarget = Math.min(0.5 + speed * 0.045, 3.0);
  }, { passive: true });

  window.addEventListener("pointerleave", function () {
    mouse.has = false;
    forceTarget = 0;
  });

  // scroll → discipline (hype at top, precision below)
  window.addEventListener("scroll", function () {
    var depth = window.scrollY / (window.innerHeight * 2.5);
    disciplineTarget = 1 - Math.min(depth, 0.85);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running) { lastT = performance.now(); requestAnimationFrame(frame); }
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });

  build();
  if (reduced) { frame(16); running = false; } // draw one static frame
  else requestAnimationFrame(frame);
})();
