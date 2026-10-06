// Film finish for the hero: reads the live gradient canvas each frame, blurs it (standing in for its
// CSS blur), then adds halation, a faint bloom, chromatic fringe towards the edges, a warm grade, a
// vignette and a slow ~24fps gate weave. Without WebGL2, or with reduced motion, the plain CSS-blurred
// gradient stays.
(function () {
  const hero = document.getElementById('top');
  const src = document.getElementById('gradient-canvas');
  const cv = document.getElementById('film-canvas');
  if (!hero || !src || !cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const gl = cv.getContext('webgl2', { antialias: false });
  if (!gl) return;

  // fullscreen triangle, no buffers
  const VS = `#version 300 es
  out vec2 uv;
  void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); uv = p; gl_Position = vec4(p * 2. - 1., 0, 1); }`;

  function prog(fs) {
    const p = gl.createProgram();
    [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\nin vec2 uv;\nout vec4 o;\n' + fs]].forEach(([type, s]) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      gl.attachShader(p, sh);
    });
    gl.linkProgram(p);
    p.u = {};
    return p;
  }

  function tex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function target(w, h) {
    const t = tex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }

  function pass(p, dst, uniforms) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
    gl.viewport(0, 0, dst ? dst.w : cv.width, dst ? dst.h : cv.height);
    gl.useProgram(p);
    let unit = 0;
    for (const k in uniforms) {
      const loc = k in p.u ? p.u[k] : (p.u[k] = gl.getUniformLocation(p, k));
      const v = uniforms[k];
      if (v instanceof WebGLTexture) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v); gl.uniform1i(loc, unit++); }
      else if (typeof v === 'number') gl.uniform1f(loc, v);
      else gl.uniform2fv(loc, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const copy = prog(`uniform sampler2D src; void main() { o = texture(src, uv); }`);

  const blur = prog(`
  uniform sampler2D src;
  uniform vec2 dir;
  void main() {
    float w[5] = float[](.227027, .1945946, .1216216, .054054, .016216);
    vec3 c = texture(src, uv).rgb * w[0];
    for (int i = 1; i < 5; i++) {
      c += texture(src, uv + dir * float(i)).rgb * w[i];
      c += texture(src, uv - dir * float(i)).rgb * w[i];
    }
    o = vec4(c, 1.);
  }`);

  // highlights only, box-downsampled
  const prefilter = prog(`
  uniform sampler2D src;
  uniform vec2 off;
  void main() {
    vec3 c = .25 * (texture(src, uv + off * vec2(-1, -1)).rgb + texture(src, uv + off * vec2(1, -1)).rgb
                  + texture(src, uv + off * vec2(-1, 1)).rgb + texture(src, uv + off * vec2(1, 1)).rgb);
    o = vec4(vec3(smoothstep(.5, 1., dot(c, vec3(.2126, .7152, .0722)))), 1.);
  }`);

  // halation is a red bleed from bright into darker neighbours, so flat bright areas don't turn pink
  const composite = prog(`
  uniform sampler2D scene, glow;
  uniform vec2 res, weave;
  void main() {
    vec2 u = uv + weave / res;
    vec2 cc = u - .5;
    vec2 ca = cc * dot(cc, cc) * .006;
    vec3 col = vec3(texture(scene, u + ca).r, texture(scene, u).g, texture(scene, u - ca).b);
    float l = dot(col, vec3(.2126, .7152, .0722));
    float g = texture(glow, u).r;
    vec3 h = vec3(1., .3, .1) * sqrt(max(g - smoothstep(.5, 1., l), 0.)) * .3;
    col = 1. - (1. - col) * (1. - clamp(h, 0., 1.));
    col += vec3(1., .9, .8) * g * .04;
    col = mix(vec3(l), col, .9);
    col = col * .95 + vec3(.035, .032, .03);
    col *= vec3(1.01, 1., .985);
    col *= 1. - .22 * smoothstep(.4, 1.1, length(cc * vec2(res.x / res.y, 1.)));
    o = vec4(col, 1.);
  }`);

  const srcTex = tex();
  let G1, G2, Q1, Q2;
  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    cv.width = w;
    cv.height = h;
    G1 = target(Math.ceil(w / 8), Math.ceil(h / 8));
    G2 = target(G1.w, G1.h);
    Q1 = target(Math.ceil(w / 2), Math.ceil(h / 2));
    Q2 = target(Q1.w, Q1.h);
  }
  resize();
  addEventListener('resize', resize);

  let raf, weave = [0, 0], lastWeave = 0;
  function frame(now) {
    const t = now / 1000;
    // gate weave: slow drift plus a small jitter, stepped at ~24fps like a projector
    if (now - lastWeave > 41) {
      weave = [Math.sin(t * .7) * .5 + (Math.random() - .5) * .5, Math.cos(t * .53) * .4 + (Math.random() - .5) * .4];
      lastWeave = now;
    }
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    // the gradient's own blur(50px), redone at 1/8 resolution
    pass(copy, G1, { src: srcTex });
    for (let i = 0; i < 2; i++) {
      pass(blur, G2, { src: G1.t, dir: [2.4 / G1.w, 0] });
      pass(blur, G1, { src: G2.t, dir: [0, 2.4 / G1.h] });
    }
    pass(prefilter, Q1, { src: G1.t, off: [.5 / cv.width, .5 / cv.height] });
    for (let i = 0; i < 2; i++) {
      pass(blur, Q2, { src: Q1.t, dir: [1.5 / Q1.w, 0] });
      pass(blur, Q1, { src: Q2.t, dir: [0, 1.5 / Q1.h] });
    }
    pass(composite, null, { scene: G1.t, glow: Q1.t, res: [cv.width, cv.height], weave });
    hero.classList.add('film');
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(function (entries) {
    cancelAnimationFrame(raf);
    if (entries[0].isIntersecting) raf = requestAnimationFrame(frame);
  }).observe(hero);
})();
