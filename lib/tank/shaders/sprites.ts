import { GLSL_HEADER, GLSL_NOISE, GLSL_SHAFTS } from './common'

// Textured quad on a small grid, placed in view space, with optional gentle warp (shrimp antennae).
export const SPRITE_VERT = `${GLSL_HEADER}
layout(location = 0) in vec2 a_pos; // 0..1 grid
uniform vec2 u_center;
uniform vec2 u_size;   // width, height in view widths
uniform float u_aspect;
uniform float u_rot;
uniform float u_flip;
uniform float u_time;
uniform float u_warp;
uniform vec2 u_shift;
out vec2 v_uv;
void main() {
  v_uv = a_pos;
  vec2 p = a_pos - 0.5;
  // Antennae sway in the left third when warp > 0 (sprites face left).
  float aw = u_warp * smoothstep(0.32, 0.0, a_pos.x) * (1.0 - smoothstep(0.0, 0.75, a_pos.y));
  p.y += aw * 0.05 * sin(u_time * 2.3 + a_pos.x * 9.0);
  p.x *= u_flip;
  p *= u_size;
  float cs = cos(u_rot); float sn = sin(u_rot);
  p = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
  vec2 pos = u_center + u_shift + vec2(p.x, p.y * u_aspect);
  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
}
`

export const SPRITE_FRAG = `${GLSL_HEADER}
in vec2 v_uv;
out vec4 o_color;
uniform sampler2D u_tex;
uniform vec3 u_light;
uniform float u_alpha;
uniform float u_bias;
void main() {
  vec4 s = texture(u_tex, v_uv, u_bias);
  vec3 rgb = s.a > 0.001 ? s.rgb / s.a : vec3(0.0);
  rgb *= u_light;
  float a = s.a * u_alpha;
  o_color = vec4(rgb * a, a);
}
`

// Full-screen layer that samples a cover-fitted texture (fg stems, algae).
export const COVER_FRAG = `${GLSL_HEADER}
${GLSL_NOISE}
in vec2 v_uv;
out vec4 o_color;
uniform sampler2D u_tex;
uniform vec2 u_center;
uniform vec2 u_span;
uniform vec2 u_shift;
uniform vec3 u_light;
uniform float u_alpha;
uniform float u_haze;
uniform vec3 u_hazeColor;
uniform float u_bias;
void main() {
  vec2 uv = u_center + (v_uv - 0.5) * u_span + u_shift;
  vec4 s = texture(u_tex, uv, u_bias);
  if (s.a < 0.002) discard;
  vec3 rgb = s.rgb / s.a;
  rgb *= u_light;
  rgb = mix(rgb, u_hazeColor * (u_light * 0.9 + 0.1), u_haze * 0.5);
  float a = s.a * u_alpha;
  o_color = vec4(rgb * a, a);
}
`

// Round sprites: pellets (shaded disc) and blob shadows (gaussian).
export const DISC_VERT = `${GLSL_HEADER}
layout(location = 0) in vec2 a_pos; // -1..1
uniform vec2 u_center;
uniform vec2 u_radius; // view units per axis
out vec2 v_q;
void main() {
  v_q = a_pos;
  vec2 pos = u_center + a_pos * u_radius;
  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
}
`

export const DISC_FRAG = `${GLSL_HEADER}
in vec2 v_q;
out vec4 o_color;
uniform vec3 u_color;
uniform float u_alpha;
uniform float u_mode; // 0 pellet, 1 gaussian shadow
void main() {
  float d = length(v_q);
  if (u_mode > 0.5) {
    float g = exp(-d * d * 3.2) * (1.0 - smoothstep(0.85, 1.0, d));
    float a = g * u_alpha;
    o_color = vec4(u_color * a, a);
    return;
  }
  if (d > 1.0) discard;
  float edge = 1.0 - smoothstep(0.82, 1.0, d);
  float shade = 0.6 + 0.55 * (1.0 - length(v_q - vec2(-0.3, -0.35)));
  vec3 rgb = u_color * clamp(shade, 0.3, 1.15) * (1.0 - 0.35 * smoothstep(0.6, 1.0, d));
  vec2 h = v_q - vec2(-0.32, -0.38);
  rgb += vec3(0.95, 0.85, 0.7) * exp(-dot(h, h) * 16.0) * 0.55;
  float a = edge * u_alpha;
  o_color = vec4(rgb * a, a);
}
`

// Motes with depth of field. z < 0.5: far, tiny and sharp. z > 0.5: near, big soft bokeh.
export const PARTICLE_VERT = `${GLSL_HEADER}
${GLSL_NOISE}
${GLSL_SHAFTS}
layout(location = 0) in vec2 a_corner;  // -1..1
layout(location = 1) in vec4 a_seed;    // x0, y0, z, phase
layout(location = 2) in float a_index;  // 0..1
uniform float u_time;
uniform float u_aspect;
uniform float u_px;          // one css pixel in view widths
uniform vec2 u_zRange;
uniform vec2 u_sunDir;
uniform float u_shaftGain;
uniform float u_sparkle;
uniform float u_count;       // fraction of instances shown
uniform vec2 u_parallax;
uniform vec2 u_pointer;      // normalised push from tap ripples
uniform float u_ripple;
out vec2 v_q;
out float v_alpha;
out float v_near;
void main() {
  float z = a_seed.z;
  v_q = a_corner;
  v_alpha = 0.0;
  v_near = 0.0;
  if (z < u_zRange.x || z >= u_zRange.y || a_index > u_count) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    return;
  }
  float ph = a_seed.w;
  float t = u_time;
  float rate = (ph - 0.5) * 0.006;
  float y = fract(a_seed.y + t * rate);
  float x = a_seed.x
    + 0.020 * sin(t * (0.08 + ph * 0.1) + ph * 40.0)
    + 0.007 * sin(t * (0.31 + ph * 0.2) + ph * 13.0);
  y += 0.012 * sin(t * (0.09 + ph * 0.12) + ph * 21.0);
  vec2 p = vec2(x, y);
  // Tap ripple: motes near the tap get nudged outwards for a moment.
  vec2 dp = (p - u_pointer) * vec2(u_aspect, 1.0);
  float dl = length(dp) + 0.001;
  p += (dp / dl) * u_ripple * 0.035 * exp(-dl * 7.0) / vec2(u_aspect, 1.0);
  p += u_parallax * (0.4 + z * 2.4);

  float far = 1.0 - smoothstep(0.35, 0.5, z);
  float nearT = clamp((z - 0.5) * 2.0, 0.0, 1.0);
  float radiusPx = z < 0.5 ? mix(0.7, 1.5, z * 2.0) : mix(2.0, 30.0, pow(nearT, 1.7));
  v_near = z < 0.5 ? 0.0 : nearT;

  vec2 sp = vec2(p.x * u_aspect, p.y);
  float sh = shaftAt(sp, normalize(u_sunDir), t, u_aspect);
  float twinkle = 0.5 + 0.5 * sin(t * (1.1 + ph * 2.6) + ph * 50.0);
  float base = 0.05 + 0.05 * (1.0 - float(z >= 0.5) * 0.6);
  float glint = sh * (0.45 + 0.9 * twinkle) * u_shaftGain * (1.2 + 1.6 * u_sparkle) * 3.0;
  float fadeEdge = smoothstep(0.0, 0.06, p.y) * (1.0 - smoothstep(0.94, 1.0, p.y));
  float area = z < 0.5 ? 1.0 : 1.0 / (1.0 + radiusPx * radiusPx * 0.03);
  v_alpha = (base * (0.7 + 0.6 * ph) + glint) * fadeEdge * mix(1.0, area, step(0.5, z)) * (z < 0.5 ? 1.0 : 0.85);
  v_alpha = min(v_alpha, 0.9);

  vec2 pos = p + a_corner * radiusPx * u_px * vec2(1.0, u_aspect);
  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
}
`

export const PARTICLE_FRAG = `${GLSL_HEADER}
in vec2 v_q;
in float v_alpha;
in float v_near;
out vec4 o_color;
uniform vec3 u_tint;
uniform float u_exposure;
void main() {
  float d = length(v_q);
  if (d > 1.0 || v_alpha <= 0.001) discard;
  float shape;
  if (v_near > 0.0) {
    // Bokeh disc: soft body with a slightly brighter rim.
    shape = (1.0 - smoothstep(0.7, 1.0, d)) * (0.72 + 0.28 * smoothstep(0.35, 0.9, d));
  } else {
    shape = pow(1.0 - d, 1.6);
  }
  float a = shape * v_alpha;
  vec3 rgb = u_tint * (0.55 + 0.6 * u_exposure);
  // Part additive: alpha is lower than the colour weight so glints glow.
  o_color = vec4(rgb * a, a * 0.35);
}
`

// Bubbles: stateless. Instance k emits at a fixed offset inside a repeating burst window.
export const BUBBLE_VERT = `${GLSL_HEADER}
${GLSL_NOISE}
layout(location = 0) in vec2 a_corner;
layout(location = 1) in float a_k; // 0..N-1
uniform float u_time;
uniform float u_aspect;
uniform float u_px;
uniform vec2 u_origin;  // where the stream starts, normalised
uniform float u_period;
uniform float u_count;  // number of bubbles per burst
uniform float u_rise;   // seconds to reach the surface
uniform float u_stagger; // seconds between emissions
uniform float u_spread;  // half-width of the emitter, view widths
uniform float u_size;    // radius multiplier
uniform vec2 u_parallax;
out vec2 v_q;
out float v_alpha;
void main() {
  v_q = a_corner;
  float emitOffset = a_k * u_stagger;
  float age = mod(u_time - emitOffset, u_period);
  float alive = step(a_k, u_count - 0.5) * step(age, u_rise);
  if (alive < 0.5) { v_alpha = 0.0; gl_Position = vec4(2.0, 2.0, 0.0, 1.0); return; }
  float burst = floor((u_time - emitOffset) / u_period);
  float seed = hash11(a_k * 7.13 + burst * 3.7);
  float f = age / u_rise;
  float y = u_origin.y - f * (u_origin.y + 0.02) * (0.9 + 0.1 * f);
  float wobble = 0.006 * sin(age * (3.0 + seed * 2.0) + seed * 20.0) * (0.4 + f);
  float x = u_origin.x + (seed - 0.5) * u_spread + wobble + f * 0.006;
  float radiusPx = (2.4 + seed * 3.2) * (0.7 + 0.5 * f) * u_size;
  v_alpha = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.93, 1.0, f));
  vec2 p = vec2(x, y) + u_parallax * 1.2;
  vec2 pos = p + a_corner * radiusPx * u_px * vec2(1.0, u_aspect);
  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
}
`

export const BUBBLE_FRAG = `${GLSL_HEADER}
in vec2 v_q;
in float v_alpha;
out vec4 o_color;
uniform vec3 u_tint;
uniform float u_exposure;
void main() {
  float d = length(v_q);
  if (d > 1.0) discard;
  float rim = smoothstep(0.62, 0.93, d) * (1.0 - smoothstep(0.93, 1.0, d));
  vec2 h1 = v_q - vec2(-0.38, -0.42);
  float spec = exp(-dot(h1, h1) * 34.0);
  vec2 h2 = v_q - vec2(0.42, 0.48);
  float spec2 = exp(-dot(h2, h2) * 26.0) * 0.32;
  float body = 0.045 * (1.0 - d);
  float light = rim * 0.42 + spec * 1.0 + spec2 + body;
  vec3 rgb = u_tint * (0.5 + 0.7 * u_exposure) * light;
  float a = min(1.0, (rim * 0.5 + spec + spec2 * 0.6 + body * 0.6) * v_alpha);
  o_color = vec4(rgb * v_alpha, a * 0.85);
}
`

// Glass dust: fine specks, a few smudges and wipe arcs. Procedural, alpha follows u_dust.
export const DUST_FRAG = `${GLSL_HEADER}
${GLSL_NOISE}
in vec2 v_uv;
out vec4 o_color;
uniform float u_dust;
uniform float u_aspect;
uniform float u_time;
uniform vec3 u_light;
void main() {
  vec2 p = vec2(v_uv.x * u_aspect, v_uv.y);
  float specks = 0.0;
  vec2 g = floor(p * 90.0);
  float h = hash21(g);
  vec2 c = fract(p * 90.0) - 0.5;
  specks = step(0.955, h) * (1.0 - smoothstep(0.0, 0.3, length(c + (hash22(g) - 0.5) * 0.6))) * (0.4 + 0.6 * hash21(g + 9.0));
  float film = fbm2(p * 5.0 + 3.0);
  float smudge = smoothstep(0.52, 0.78, film);
  float wipe = smoothstep(0.02, 0.0, abs(length(p - vec2(0.2 * u_aspect, 1.15)) - 0.75 + 0.05 * sin(p.x * 9.0))) * 0.6;
  wipe += smoothstep(0.015, 0.0, abs(length(p - vec2(0.85 * u_aspect, 1.3)) - 0.9)) * 0.4;
  float grain = vnoise2(p * 260.0);
  float a = (0.05 + 0.24 * smudge * (0.6 + 0.4 * grain) + 0.22 * specks + 0.12 * wipe) * u_dust;
  a = min(a, 0.5);
  vec3 rgb = u_light * vec3(0.7, 0.7, 0.66);
  o_color = vec4(rgb * a, a);
}
`
