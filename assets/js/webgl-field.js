/* Isolated Command — WebGL flow-field background.
 * A living, domain-warped FBM "smoke" rendered on the GPU as a single
 * full-screen fragment shader. Mostly true black, with faint Bloodline-Red
 * filaments that drift ambiently and *ignite* around the cursor. Opt in per
 * site with `particle_grid = true`.
 *
 * Why raw WebGL (no Three.js): one full-screen triangle, one shader, zero
 * dependencies (~4 KB) and no build step — it drops straight into a static
 * Hugo theme and can't bloat any child site's bundle.
 *
 * Interaction model (all on the GPU, four uniforms updated per frame on the CPU):
 *   uMouse      : cursor in 0..1, critically damped so the light glides.
 *   uMouseForce : spring-damped ignition strength — a flick detonates the red,
 *                 a still cursor lets it fade; asymmetric lambdas (attack 9,
 *                 release 2.6) give instant heat and a slow cool-down.
 *   uScroll     : scroll depth calms the field (1 -> 0.25) so the hero is the
 *                 most alive and long-form reading stays legible.
 *   uTime       : slow global drift so the smoke breathes without a cursor.
 *
 * Performance: the internal buffer is capped to a 1600px longest edge and
 * CSS-upscaled (the softness flatters the smoke), 5 FBM octaves, rAF paused on
 * hidden tabs, context-loss safe, and reduced-motion renders a single frame.
 */
(function () {
  "use strict";
  var canvas = document.getElementById("ic-webgl-field");
  if (!canvas) return;

  var gl =
    canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" }) ||
    canvas.getContext("experimental-webgl");
  if (!gl) { canvas.remove(); return; } // no WebGL → leave the black stage

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var VERT = "attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}";

  var FRAG = [
    "precision highp float;",
    "uniform vec2  uRes;",
    "uniform float uTime;",
    "uniform vec2  uMouse;",     // 0..1
    "uniform float uForce;",     // ignition
    "uniform float uScroll;",    // 1 hero .. 0.25 deep
    "",
    "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.0-2.0*f);",
    "  float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));",
    "  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}",
    "float fbm(vec2 p){float v=0.0,a=0.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);",
    "  for(int i=0;i<5;i++){v+=a*noise(p);p=m*p;a*=0.5;}return v;}",
    "",
    "void main(){",
    "  vec2 uv=gl_FragCoord.xy/uRes.xy;",
    "  float aspect=uRes.x/uRes.y;",
    "  vec2 p=(gl_FragCoord.xy-0.5*uRes.xy)/uRes.y;",   // centred, aspect-correct
    "  float t=uTime*0.045;",
    "",
    "  // two-step domain warp -> flowing organic structure",
    "  vec2 q=vec2(fbm(p*1.5+vec2(0.0,t)),fbm(p*1.5+vec2(5.2,1.3)-t));",
    "  vec2 r=vec2(fbm(p*1.5+2.0*q+vec2(1.7,9.2)+0.16*t),",
    "             fbm(p*1.5+2.0*q+vec2(8.3,2.8)-0.13*t));",
    "  float f=fbm(p*1.5+2.4*r);",
    "",
    "  // cursor light (aspect-correct distance)",
    "  vec2 m=(uMouse-0.5)*vec2(aspect,1.0);",
    "  float md=length(p-m);",
    "  float glow=uForce*exp(-md*md*3.2);",
    "",
    "  // compose: near-black base + red filaments in the ridges",
    "  vec3 base=vec3(0.015,0.015,0.02);",
    "  vec3 blood=vec3(1.0,0.0,0.2);",
    "  float ambient=smoothstep(0.58,0.92,f)*0.22*uScroll;",       // faint always-on veins
    "  float ignite=glow*smoothstep(0.30,0.95,f)*0.9;",            // ridges light up near cursor
    "  vec3 col=base;",
    "  col+=blood*(ambient+ignite);",
    "  col+=blood*glow*0.14;",                                     // soft core halo
    "",
    "  float vig=smoothstep(1.25,0.25,length(uv-0.5));",           // vignette keeps copy legible",
    "  col*=vig;",
    "  col=max(col,0.0);",
    "  gl_FragColor=vec4(col,1.0);",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[ic-webgl] shader compile failed:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.remove(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);

  // full-screen triangle (covers clip space with 3 verts)
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "uRes");
  var uTime = gl.getUniformLocation(prog, "uTime");
  var uMouse = gl.getUniformLocation(prog, "uMouse");
  var uForce = gl.getUniformLocation(prog, "uForce");
  var uScroll = gl.getUniformLocation(prog, "uScroll");

  var mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5, lastX: 0, lastY: 0, has: false };
  var force = 0, forceTarget = 0;
  var scroll = 1, scrollTarget = 1;
  var t0 = performance.now(), last = t0, running = true;

  function damp(cur, target, lambda, dt) {
    return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
  }

  function resize() {
    var cssW = window.innerWidth, cssH = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = cssW * dpr, h = cssH * dpr;
    var s = Math.min(1, 1600 / Math.max(w, h)); // cap longest edge
    w = Math.round(w * s); h = Math.round(h * s);
    canvas.width = w; canvas.height = h;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    gl.viewport(0, 0, w, h);
  }

  function render(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 1000 || 0.016, 1 / 30);
    last = now;

    var lambda = forceTarget > force ? 9 : 2.6; // fast ignite, slow cool
    force = damp(force, forceTarget, lambda, dt);
    scroll = damp(scroll, scrollTarget, 4, dt);
    mouse.sx = damp(mouse.sx, mouse.x, 12, dt);
    mouse.sy = damp(mouse.sy, mouse.y, 12, dt);
    forceTarget = damp(forceTarget, mouse.has ? 0.35 : 0, 2.2, dt);

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, reduced ? 0 : (now - t0) / 1000);
    gl.uniform2f(uMouse, mouse.sx, 1 - mouse.sy); // flip Y to GL space
    gl.uniform1f(uForce, force);
    gl.uniform1f(uScroll, scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!reduced) requestAnimationFrame(render);
  }

  window.addEventListener("pointermove", function (e) {
    var vx = e.clientX - mouse.lastX, vy = e.clientY - mouse.lastY;
    var speed = Math.sqrt(vx * vx + vy * vy);
    mouse.lastX = e.clientX; mouse.lastY = e.clientY;
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = e.clientY / window.innerHeight;
    if (!mouse.has) { mouse.sx = mouse.x; mouse.sy = mouse.y; }
    mouse.has = true;
    forceTarget = Math.min(0.35 + speed * 0.004, 1.1); // flick → detonate
  }, { passive: true });

  window.addEventListener("pointerleave", function () { mouse.has = false; forceTarget = 0; });

  window.addEventListener("scroll", function () {
    var depth = window.scrollY / (window.innerHeight * 2.5);
    scrollTarget = 1 - Math.min(depth, 0.75);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    running = !document.hidden;
    if (running && !reduced) { last = performance.now(); requestAnimationFrame(render); }
  });

  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; });
  canvas.addEventListener("webglcontextrestored", function () { running = true; requestAnimationFrame(render); });

  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); });

  resize();
  requestAnimationFrame(render);
})();
