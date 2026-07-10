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
    renderer.setClearColor(0x000000, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.11);

    var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    // ---- morphing wireframe object (the hero geometry) ----------------------
    var uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },                     // cursor-driven wobble amplitude
      uColor: { value: new THREE.Color(0xff0033) },
    };

    // Smooth displaced orb with a fresnel rim: dark glassy body, glowing red
    // edge — elegant, not a busy wireframe.
    var vert = [
      "uniform float uTime; uniform float uEnergy;",
      "varying vec3 vNormal; varying vec3 vView; varying float vDisp;",
      "void main(){",
      "  vec3 p = position;",
      "  float t = uTime * 0.45;",
      "  float n = sin(p.x*1.7 + t) * sin(p.y*1.5 + t*1.2) * sin(p.z*1.9 + t*0.7);",
      "  n += 0.35 * sin(p.y*3.0 - t*1.4);",
      "  float amp = 0.16 + uEnergy * 0.28;",
      "  vDisp = n * 0.5 + 0.5;",
      "  vec3 d = p + normal * n * amp;",
      "  vec4 mv = modelViewMatrix * vec4(d, 1.0);",
      "  vNormal = normalize(normalMatrix * normal);",
      "  vView = normalize(-mv.xyz);",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n");

    var frag = [
      "precision highp float;",
      "uniform vec3 uColor; varying vec3 vNormal; varying vec3 vView; varying float vDisp;",
      "void main(){",
      "  float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.4);",
      "  vec3 body = vec3(0.03, 0.0, 0.015);",
      "  vec3 c = body + uColor * fres * 1.7;",
      "  c += uColor * smoothstep(0.62, 1.0, vDisp) * 0.12;",   // faint inner veins
      "  gl_FragColor = vec4(c, 0.94);",
      "}"
    ].join("\n");

    var geo = new THREE.IcosahedronGeometry(2.4, 5);
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: true,
    });
    var blob = new THREE.Mesh(geo, mat);
    scene.add(blob);

    // clean low-poly geometric halo (20 faces) — a crisp wire outline, not noise
    var shellMat = new THREE.MeshBasicMaterial({ color: 0xff0033, wireframe: true, transparent: true, opacity: 0.14, depthWrite: false });
    var shell = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5, 1), shellMat);
    scene.add(shell);

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
    var rCount = 400;
    var rPos = new Float32Array(rCount * 3);
    for (var j = 0; j < rCount; j++) {
      rPos[j * 3] = (Math.random() - 0.5) * 8;
      rPos[j * 3 + 1] = (Math.random() - 0.5) * 8;
      rPos[j * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    var rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
    var rMat = new THREE.PointsMaterial({ size: 0.06, color: 0xff0033, transparent: true, opacity: 0.5, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending });
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
        uniforms.uTime.value = t;
        uniforms.uEnergy.value = energy;
        blob.rotation.y = t * 0.12 + scroll * Math.PI * 3.0;   // scroll spins it ~1.5 turns
        blob.rotation.x = t * 0.08 + mouse.sy * 0.3 + scroll * 1.2;
        shell.rotation.y = -t * 0.09 - scroll * 1.6;
        shell.rotation.x = t * 0.05;
        points.rotation.y = t * 0.015 + scroll * 0.6;
        redPoints.rotation.y = -t * 0.03 - scroll * 0.8;
        redPoints.rotation.x = t * 0.02;
      }

      // The whole scene travels WITH the scroll: object drifts up + camera pans
      // down through the depth-field, so scrolling visibly moves the 3D.
      blob.position.y = damp(blob.position.y, scroll * 4.5, 3, dt);
      shell.position.y = blob.position.y;
      camera.position.x = damp(camera.position.x, mouse.sx * 1.1, 3, dt);
      camera.position.y = damp(camera.position.y, -mouse.sy * 0.8 + scroll * 6.0, 3, dt);
      camera.position.z = 6.4;
      camera.lookAt(0, scroll * 5.2, 0);

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
