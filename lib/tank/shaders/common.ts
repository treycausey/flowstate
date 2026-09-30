// GLSL chunks shared by several programs.

export const GLSL_HEADER = `#version 300 es
precision highp float;
precision highp int;
`

export const GLSL_NOISE = `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise1(float x) {
  float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), f);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) {
  float a = 0.5; float s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise2(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
`

// Caustics: animated, domain-warped Voronoi ridges in two octaves. Cheap and free of tiling seams.
export const GLSL_CAUSTICS = `
float voroEdge(vec2 x, float t) {
  vec2 n = floor(x); vec2 f = fract(x);
  float d1 = 8.0; float d2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g);
      o = 0.5 + 0.5 * sin(t + 6.2831853 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
float causticLayer(vec2 p, float t, float w) {
  p += 0.32 * vec2(sin(p.y * 1.7 + t * 0.55), cos(p.x * 1.4 - t * 0.45));
  float e = voroEdge(p, t);
  float k = e / w;
  return exp(-k * k);
}
// p: aspect-corrected scene coordinates (x in 0..aspect, y in 0..1).
float caustic(vec2 p, float t) {
  float persp = mix(1.25, 0.8, clamp(p.y, 0.0, 1.0));
  vec2 q = p * 13.0 * persp;
  float a = causticLayer(q, t * 0.65, 0.16);
  float b = causticLayer(q * 1.9 + 7.3, t * 0.85 + 2.0, 0.13);
  float broad = 0.35 + 0.65 * smoothstep(0.25, 0.75, vnoise2(p * 2.6 + vec2(t * 0.025, -t * 0.018)));
  return (a * 0.6 + b * 0.4) * broad;
}
`

// Light shafts: soft rays radiating along u_sunDir from an off-screen source at the upper right.
export const GLSL_SHAFTS = `
float shaftAt(vec2 p, vec2 dir, float t, float aspect) {
  vec2 origin = vec2(0.5 * aspect, 0.5) - dir * 1.15;
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 rel = p - origin;
  float along = dot(rel, dir);
  float s = dot(rel, perp) / max(along, 0.15);
  float sway = 0.05 * sin(t * 0.09) + 0.03 * sin(t * 0.21 + 1.3);
  float n = vnoise1((s + sway) * 7.5 + 3.0) * 0.6 + vnoise1((s - sway * 0.7) * 19.0 - t * 0.02) * 0.4;
  float ray = smoothstep(0.42, 0.9, n);
  ray *= 0.85 + 0.15 * sin(t * 0.55 + s * 41.0);
  float fall = exp(-along * 1.25) * smoothstep(0.0, 0.25, along);
  float side = smoothstep(1.35, 0.0, abs(s));
  return ray * fall * side;
}
`
