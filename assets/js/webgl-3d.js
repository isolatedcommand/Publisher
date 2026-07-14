/* Isolated Command — 3D WebGL scene (Three.js).
 * A morphing Bloodline-Red wireframe object floating in a parallax depth-field
 * of particles. Cursor tilts the camera and energises the object; scroll spins
 * and dollies it. Youth-energetic, but dark and premium so content stays legible.
 *
 * Robustness: if Three.js is unavailable (blocked/CDN down) or init throws, we
 * fall back to the dependency-free raw-WebGL flow-field (canvas.dataset.fallback).
 * Perf: ~2.6k points + one shader-displaced icosahedron, DPR capped at 2, rAF
 * paused on hidden tabs, reduced-motion renders a single still frame.
 */
(function () {
  "use strict";
  var canvas = document.getElementById("ic-webgl-field");
  if (!canvas) return;

  function fallback() {
    var url = canvas.getAttribute("data-fallback");
    if (!url) return;
    var s = document.createElement("script");
    s.src = url; s.defer = true;
    document.head.appendChild(s);
  }

  if (!window.THREE) { fallback(); return; }
  var THREE = window.THREE;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  try {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setClearColor(0x0b0e14, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.11);

    var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    // ---- community constellation (the hero geometry) -------------------------
    // Youth + non-profit: a network of people. ~110 soft-white nodes on a loose
    // sphere, thin lines linking near neighbours (community), a handful of red
    // nodes (the movement's spark). Gentle, airy — no big colour mass.
    var NODES = 110, RADIUS = 2.3, LINK_DIST = 1.15;
    var nodeBase = new Float32Array(NODES * 3);
    var nodePhase = new Float32Array(NODES);
    for (var n = 0; n < NODES; n++) {
      var th0 = Math.random() * Math.PI * 2;
      var ph0 = Math.acos(2 * Math.random() - 1);
      var rr = RADIUS * (0.75 + Math.random() * 0.45); // fuzzy shell
      nodeBase[n * 3] = rr * Math.sin(ph0) * Math.cos(th0);
      nodeBase[n * 3 + 1] = rr * Math.sin(ph0) * Math.sin(th0);
      nodeBase[n * 3 + 2] = rr * Math.cos(ph0);
      nodePhase[n] = Math.random() * Math.PI * 2;
    }

    var blob = new THREE.Group(); // keeps the name the animation loop uses
    scene.add(blob);

    // white community nodes
    var nGeo = new THREE.BufferGeometry();
    var nodePos = new Float32Array(nodeBase); // live copy, floats each frame
    nGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
    var nMat = new THREE.PointsMaterial({ size: 0.07, color: 0xf5f5f4, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending });
    blob.add(new THREE.Points(nGeo, nMat));

    // sparse red spark nodes (brand accent, small — not a mass)
    var sparkIdx = [];
    for (var s = 0; s < 14; s++) sparkIdx.push(Math.floor(Math.random() * NODES));
    var sGeo = new THREE.BufferGeometry();
    var sparkPos = new Float32Array(sparkIdx.length * 3);
    sGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    var sMat = new THREE.PointsMaterial({ size: 0.11, color: 0x7be43c, transparent: true, opacity: 0.85, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending });
    blob.add(new THREE.Points(sGeo, sMat));

    // connection lines between near neighbours
    var pairs = [];
    for (var a = 0; a < NODES; a++) {
      for (var b = a + 1; b < NODES; b++) {
        var dx = nodeBase[a * 3] - nodeBase[b * 3];
        var dy = nodeBase[a * 3 + 1] - nodeBase[b * 3 + 1];
        var dz = nodeBase[a * 3 + 2] - nodeBase[b * 3 + 2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < LINK_DIST) pairs.push([a, b]);
      }
    }
    var lGeo = new THREE.BufferGeometry();
    var linePos = new Float32Array(pairs.length * 6);
    lGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    var lMat = new THREE.LineBasicMaterial({ color: 0xbfc3cc, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
    blob.add(new THREE.LineSegments(lGeo, lMat));

    // per-frame: gentle float per node, lines + sparks follow
    function updateNetwork(t, energy) {
      for (var i2 = 0; i2 < NODES; i2++) {
        var f = 0.06 + energy * 0.06;
        nodePos[i2 * 3] = nodeBase[i2 * 3] + Math.sin(t * 0.7 + nodePhase[i2]) * f;
        nodePos[i2 * 3 + 1] = nodeBase[i2 * 3 + 1] + Math.cos(t * 0.6 + nodePhase[i2] * 1.3) * f;
        nodePos[i2 * 3 + 2] = nodeBase[i2 * 3 + 2] + Math.sin(t * 0.5 + nodePhase[i2] * 0.7) * f;
      }
      for (var p2 = 0; p2 < pairs.length; p2++) {
        var A = pairs[p2][0], B = pairs[p2][1];
        linePos[p2 * 6] = nodePos[A * 3]; linePos[p2 * 6 + 1] = nodePos[A * 3 + 1]; linePos[p2 * 6 + 2] = nodePos[A * 3 + 2];
        linePos[p2 * 6 + 3] = nodePos[B * 3]; linePos[p2 * 6 + 4] = nodePos[B * 3 + 1]; linePos[p2 * 6 + 5] = nodePos[B * 3 + 2];
      }
      for (var s2 = 0; s2 < sparkIdx.length; s2++) {
        var S = sparkIdx[s2];
        sparkPos[s2 * 3] = nodePos[S * 3]; sparkPos[s2 * 3 + 1] = nodePos[S * 3 + 1]; sparkPos[s2 * 3 + 2] = nodePos[S * 3 + 2];
      }
      nGeo.attributes.position.needsUpdate = true;
      lGeo.attributes.position.needsUpdate = true;
      sGeo.attributes.position.needsUpdate = true;
      lMat.opacity = 0.14 + energy * 0.22; // cursor energy lights the connections
    }
    updateNetwork(0, 0);

    // ---- parallax particle depth-field --------------------------------------
    var COUNT = 2200;
    var pos = new Float32Array(COUNT * 3);
    for (var i = 0; i < COUNT; i++) {
      // spherical shell around the scene for depth on all sides
      var r = 6 + Math.random() * 16;
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph) - 6;
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var pMat = new THREE.PointsMaterial({
      size: 0.04, color: 0x8a8a90, transparent: true, opacity: 0.55,
      sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    var points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // a second, sparse red point layer near the object for accent depth
    var rCount = 120;
    var rPos = new Float32Array(rCount * 3);
    for (var j = 0; j < rCount; j++) {
      rPos[j * 3] = (Math.random() - 0.5) * 8;
      rPos[j * 3 + 1] = (Math.random() - 0.5) * 8;
      rPos[j * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    var rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
    var rMat = new THREE.PointsMaterial({ size: 0.05, color: 0x7be43c, transparent: true, opacity: 0.3, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending });
    var redPoints = new THREE.Points(rGeo, rMat);
    scene.add(redPoints);

    // ---- interaction state --------------------------------------------------
    var mouse = { x: 0, y: 0, sx: 0, sy: 0, lastX: 0, lastY: 0 };
    var energy = 0, energyTarget = 0;
    var scroll = 0, scrollTarget = 0;
    var t0 = performance.now(), last = t0, running = true;

    function damp(c, t, l, dt) { return c + (t - c) * (1 - Math.exp(-l * dt)); }

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.min((now - last) / 1000 || 0.016, 1 / 30);
      last = now;
      var t = (now - t0) / 1000;

      energy = damp(energy, energyTarget, energyTarget > energy ? 8 : 2.4, dt);
      energyTarget = damp(energyTarget, 0, 1.8, dt);
      scroll = damp(scroll, scrollTarget, 4, dt);
      mouse.sx = damp(mouse.sx, mouse.x, 5, dt);
      mouse.sy = damp(mouse.sy, mouse.y, 5, dt);

      if (!reduce) {
        updateNetwork(t, energy);
        blob.rotation.y = t * 0.1 + scroll * Math.PI * 2.0;    // scroll turns the constellation
        blob.rotation.x = t * 0.05 + mouse.sy * 0.2 + scroll * 0.8;
        points.rotation.y = t * 0.015 + scroll * 0.6;
        redPoints.rotation.y = -t * 0.03 - scroll * 0.8;
        redPoints.rotation.x = t * 0.02;
      }

      // The object rides BESIDE the content column and weaves sides as you
      // scroll (right at the hero, left mid-page, right again) — inline with
      // the words instead of floating behind them. Camera stays anchored;
      // only gentle cursor parallax, so the scene never flies away.
      var weave = scroll * Math.PI * 2.0;
      blob.position.x = damp(blob.position.x, Math.cos(weave) * 3.1, 3, dt);
      blob.position.y = damp(blob.position.y, Math.sin(weave) * 1.1, 3, dt);
      blob.position.z = damp(blob.position.z, -Math.abs(Math.sin(weave)) * 1.2, 3, dt);
      camera.position.x = damp(camera.position.x, mouse.sx * 0.7, 3, dt);
      camera.position.y = damp(camera.position.y, -mouse.sy * 0.5, 3, dt);
      camera.position.z = 6.4;
      camera.lookAt(blob.position.x * 0.5, blob.position.y * 0.5, 0);

      renderer.render(scene, camera);
      if (!reduce) requestAnimationFrame(frame);
    }

    window.addEventListener("pointermove", function (e) {
      var vx = e.clientX - mouse.lastX, vy = e.clientY - mouse.lastY;
      mouse.lastX = e.clientX; mouse.lastY = e.clientY;
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
      energyTarget = Math.min(energyTarget + Math.sqrt(vx * vx + vy * vy) * 0.006, 1.2);
    }, { passive: true });

    window.addEventListener("scroll", function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      scrollTarget = max > 0 ? Math.min(window.scrollY / max, 1) : 0; // 0..1 over whole page
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running && !reduce) { last = performance.now(); requestAnimationFrame(frame); }
    });

    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); });

    resize();
    requestAnimationFrame(frame);
  } catch (err) {
    console.warn("[ic-webgl-3d] init failed, falling back:", err);
    try { canvas.getContext("webgl"); } catch (e) {}
    fallback();
  }
})();
