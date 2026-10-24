/* prism.js: hero background for the "prism" palette.
   A procedural take on light passing a curved porcelain edge: black field, a sharp
   white sweep, spectral fringes (cobalt -> cyan -> sand -> amber -> rose) and warm
   diffuse light behind it, with film grain. One fragment shader, no libraries. */
(function () {
  "use strict";
  // start after the page script and first paint, so compiling the shader never delays the page
  function start() {
  var canvas = document.getElementById("prism-canvas");
  var PAL = document.documentElement.getAttribute("data-palette");
  if (!canvas || (PAL !== "prism" && PAL !== "liquid")) return;
  var gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  if (!gl) { canvas.classList.add("prism-fallback"); return; }

  var VS = "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }";
  var FS = [
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform float uMotion; uniform vec2 uC; uniform float uR;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);",
    "  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }",
    "vec3 spectrum(float t){",
    "  vec3 c0=vec3(0.02,0.24,0.62), c1=vec3(0.05,0.55,0.80), c2=vec3(0.50,0.78,0.80),",
    "       c3=vec3(0.92,0.80,0.62), c4=vec3(0.98,0.56,0.22), c5=vec3(0.92,0.30,0.18);",
    "  t=clamp(t,0.0,1.0)*5.0;",
    "  if(t<1.0) return mix(c0,c1,t); if(t<2.0) return mix(c1,c2,t-1.0);",
    "  if(t<3.0) return mix(c2,c3,t-2.0); if(t<4.0) return mix(c3,c4,t-3.0); return mix(c4,c5,t-4.0); }",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;",
    "  float s = max(asp, 1.0);",
    "  vec2 p = vec2(uv.x * asp, uv.y);",
    "  float t = uTime * 0.05 * uMotion;",
    "  p += (vec2(noise(p * 1.4 + vec2(t, 0.0)), noise(p * 1.4 + vec2(5.0, -t))) - 0.5) * 0.16;",   // bend the sweep
    "  vec2 c = uC + vec2(0.03*sin(t*2.0), 0.02*cos(t*1.7));",
    "  float R = uR;",
    "  float r = length(p - c);",
    "  float ang0 = atan(p.y - c.y, p.x - c.x);",
    "  float d = r - R + 0.05 * sin(ang0 * 5.0 + t * 2.2) + 0.03 * sin(ang0 * 11.0 - t * 1.4);",   // not a perfect circle            // d<0 = lit side (bottom-right)
    "  float ang = atan(p.y - c.y, p.x - c.x);",
    "  float inside = smoothstep(0.003, -0.003, d);",
    // warm diffuse light deep inside, brighter towards the top right
    "  float depth = clamp(-d / 0.9, 0.0, 1.0);",
    "  vec3 sand = vec3(0.80, 0.67, 0.52) * (0.55 + 0.45 * smoothstep(0.0, 1.0, uv.y + uv.x*0.4));",
    "  vec3 col = mix(vec3(0.18,0.20,0.21), sand, smoothstep(0.08, 0.7, depth));",
    // shadow trough behind the white edge
    "  col *= 1.0 - 0.75 * exp(-pow((d + 0.20) / 0.10, 2.0));",
    // blue pockets where light leaks round the edge
    "  float pocket = noise(vec2(ang * 6.0 + t, 1.3)) * exp(-pow((d + 0.32) / 0.14, 2.0));",
    "  col += vec3(0.02, 0.33, 0.62) * pocket * 1.1;",
    // a splash of orange-red: a hot spot of dispersed light low on the sweep
    "  float hot = exp(-pow((d + 0.24) / 0.09, 2.0)) * exp(-pow((uv.y - 0.30) / 0.16, 2.0));",
    "  hot *= 0.75 + 0.25 * sin(t * 3.0 + ang * 4.0);",
    "  col += vec3(0.95, 0.36, 0.14) * hot * 0.95;",
    // spectral fringes: the same band displaced per wavelength
    "  vec3 fr = vec3(0.0);",
    "  float patch = 0.45 + 0.55 * noise(vec2(ang * 7.0 - t * 6.0, 4.0 + t));",
    "  for (int i = 0; i < 9; i++) { float w = float(i) / 8.0;",
    "    float dd = d + 0.085 + w * 0.15;",
    "    fr += spectrum(w) * exp(-pow(dd / 0.045, 2.0)); }",
    "  col += fr * 0.42 * patch * inside;",
    // the porcelain sweep: sharp outer edge, soft inner falloff
    "  float core = smoothstep(0.003, -0.003, d) * exp(-pow((d + 0.03) / 0.034, 2.0));",
    "  core *= 0.7 + 0.3 * noise(vec2(ang * 5.0 - t * 4.0, 1.0));",          // light slides along the edge
    "  col = mix(col, vec3(0.93, 0.94, 0.93), clamp(core * 1.05, 0.0, 1.0));",
    // a second, thinner stroke lower down
    "  float d2 = r - (R - 0.16);",
    "  float lower = smoothstep(0.55, 0.05, uv.y);",
    "  float stroke2 = exp(-pow((d2 + 0.02) / 0.022, 2.0)) * lower;",
    "  col = mix(col, vec3(0.90, 0.92, 0.92), clamp(stroke2, 0.0, 1.0) * inside);",
    // black field outside, with a faint bloom off the edge
    "  float d3 = d - 0.075;",
    "  float outer = exp(-pow(d3 / 0.012, 2.0)) * smoothstep(0.65, 0.15, uv.y) * smoothstep(0.0, 0.08, uv.y);",
    "  vec3 bg = vec3(0.059, 0.067, 0.059);",
    "  float bloom = exp(-pow(max(d, 0.0) / 0.06, 1.2)) * 0.18;",
    "  col = mix(bg + bloom * vec3(0.55, 0.62, 0.70), col, inside);",
    "  col = mix(col, vec3(0.86, 0.88, 0.90), clamp(outer, 0.0, 1.0) * (1.0 - inside) * 0.85);",
    // fade the bottom into the page and add grain
    "  col = mix(vec3(0.059,0.067,0.059), col, smoothstep(0.0, 0.18, uv.y));",
    "  float g = hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5;",
    "  col += g * 0.055;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");


  /* "liquid": dark flowing glass. A slowly domain-warped height field; light catches only
     where the surface folds (thin specular ribbons), and each colour channel samples the
     field slightly offset, which gives the fine rainbow edges of glass caustics. */
  var FS_LIQUID = [
    "precision highp float;",
    "uniform vec2 uRes; uniform float uTime; uniform float uMotion; uniform vec2 uC; uniform float uR;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);",
    "  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }",
    "float fbm(vec2 p){ float v=0.0, a=0.55; for(int i=0;i<3;i++){ v+=a*noise(p); p=p*1.9+vec2(1.7,9.2); a*=0.45; } return v; }",
    "float field(vec2 p, float t){",
    "  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t*0.8)));",
    "  vec2 r = vec2(fbm(p + 2.4*q + vec2(1.7, 9.2) + t*0.5), fbm(p + 2.4*q + vec2(8.3, 2.8) - t*0.4));",
    "  return fbm(p + 1.6*r); }",
    // treat the field as a glossy surface: specular from two lights + a fresnel rim on steep folds
    // shade from one height sample + gradient; dispersion = each channel bends the normal a little more
    "float shade(vec3 n){",
    "  vec3 V = vec3(0.0, 0.0, 1.0);",
    "  vec3 L1 = normalize(vec3(-0.55, -0.35, 0.75)), L2 = normalize(vec3(0.7, 0.45, 0.55));",
    "  vec3 rf = reflect(-V, n);",
    "  float env = pow(smoothstep(-0.1, 0.95, dot(rf, normalize(vec3(-0.45, 0.55, 0.6)))), 3.0);",
    "  float s1 = pow(max(dot(reflect(-L1, n), V), 0.0), 18.0);",
    "  float s2 = pow(max(dot(reflect(-L2, n), V), 0.0), 40.0);",
    "  float rim = pow(1.0 - n.z, 1.6);",
    "  return env * 0.85 + s1 * 1.1 + s2 * 0.8 + rim * 0.35; }",
    "void main(){",
    "  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;",
    "  vec2 p = vec2(uv.x * asp, uv.y) * 1.15;",
    "  float t = uTime * 0.025 * uMotion;",
    "  float h = field(p, t); float e = 0.01;",
    "  vec2 g = vec2(field(p + vec2(e, 0.0), t) - h, field(p + vec2(0.0, e), t) - h) / e;",
    "  vec3 col = vec3(shade(normalize(vec3(-g * 2.05, 1.0))), shade(normalize(vec3(-g * 2.2, 1.0))), shade(normalize(vec3(-g * 2.38, 1.0))));",
    "  col *= vec3(0.92, 0.95, 1.05);",                                  // glass is a touch cool
    // light lives bottom-left and along the right; the text area stays deep black
    "  float l1 = exp(-pow(length((uv - vec2(0.12, 0.05)) * vec2(1.0, 1.3)) / 0.42, 2.0));",
    "  float l2 = exp(-pow((uv.x - 0.92) / 0.22, 2.0)) * smoothstep(0.0, 0.6, uv.y) * 0.9;",
    "  float l3 = exp(-pow(length(uv - vec2(0.62, 0.95)) / 0.35, 2.0)) * 0.5;",
    "  float textZone = smoothstep(0.62, 0.30, uv.x) * smoothstep(0.18, 0.40, uv.y) * smoothstep(0.98, 0.80, uv.y);",
    "  float light = clamp(l1 + l2 + l3, 0.0, 1.2) * (1.0 - 0.85 * textZone);",
    "  col *= light;",
    "  col = pow(col, vec3(1.7)) * 1.35;",
    "  vec3 bg = vec3(0.012, 0.012, 0.016);",
    "  col = bg + col;",
    "  col = mix(vec3(0.02,0.02,0.024), col, smoothstep(0.0, 0.12, uv.y));",
    "  col += (hash(gl_FragCoord.xy + fract(uTime) * 77.0) - 0.5) * 0.04;",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, PAL === "liquid" ? FS_LIQUID : FS);
  if (!vs || !fs) { canvas.classList.add("prism-fallback"); return; }
  var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uC = gl.getUniformLocation(prog, "uC"), uRr = gl.getUniformLocation(prog, "uR");
  var uRes = gl.getUniformLocation(prog, "uRes"), uTime = gl.getUniformLocation(prog, "uTime"), uMotion = gl.getUniformLocation(prog, "uMotion");

  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scale = PAL === "liquid" ? (window.innerWidth < 700 ? 0.45 : 0.5) : 0.6;   // render below CSS size; the image is soft anyway
  function resize() {
    var w = Math.max(1, Math.round(canvas.clientWidth * scale)), h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    gl.uniform2f(uRes, w, h);
    // the sweep runs from A (bottom) to B; it stays to the right of / below the hero text
    var asp = w / h, A, B, Rad;
    if (asp >= 0.9) { A = [0.56 * asp, 0.0]; B = [0.99 * asp, 1.0]; Rad = 2.4; }
    else { A = [0.18 * asp, 0.0]; B = [1.10 * asp, 0.30]; Rad = 1.6; }
    var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1];
    var half = Math.sqrt(dx * dx + dy * dy) / 2, nx = dy / (2 * half), ny = -dx / (2 * half);   // normal pointing right/down
    var hh = Math.sqrt(Math.max(Rad * Rad - half * half, 0));
    gl.uniform2f(uC, mx + nx * hh, my + ny * hh); gl.uniform1f(uRr, Rad);
  }
  var visible = true;
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(canvas);
  var t0 = performance.now(), last = 0;
  function frame(now) {
    if (visible && now - last > 1000 / 24) {       // 24 fps is plenty for a slow drift + grain
      last = now; resize();
      gl.uniform1f(uTime, (now - t0) / 1000); gl.uniform1f(uMotion, still ? 0.0 : 1.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (!still) requestAnimationFrame(frame);
  }
  window.addEventListener("resize", function () { last = 0; });
  requestAnimationFrame(frame);
  }
  if (document.readyState === "complete") setTimeout(start, 0); else window.addEventListener("load", function () { setTimeout(start, 0); });
})();
