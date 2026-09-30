import { GLSL_CAUSTICS, GLSL_HEADER, GLSL_NOISE, GLSL_SHAFTS } from './common'

export const FULLSCREEN_VERT = `${GLSL_HEADER}
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y; // y down
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

export const BACKGROUND_FRAG = `${GLSL_HEADER}
${GLSL_NOISE}
${GLSL_CAUSTICS}
${GLSL_SHAFTS}
in vec2 v_uv;
out vec4 o_color;

uniform sampler2D u_plateA;
uniform sampler2D u_plateB;
uniform float u_mix;
uniform float u_hasB;
uniform vec2 u_plateCenter; // plate uv at view centre
uniform vec2 u_plateSpan;   // plate uv covered by the view
uniform vec2 u_parallax;    // plate uv shift
uniform float u_aspect;
uniform float u_time;

uniform float u_exposure;
uniform vec3 u_tint;
uniform float u_saturation;
uniform float u_haze;
uniform float u_algae;
uniform vec3 u_hazeColor;
uniform float u_causticGain;
uniform vec3 u_causticTint;
uniform float u_shaftGain;
uniform vec3 u_shaftTint;
uniform vec2 u_sunDir;
uniform float u_algaeCover; // 0..1 how much of the plate is already the algae variant
// Baked prop patches: slot = side * 4 + prop (shrimp, nest, leaf, algae); side 0 sits on plate A, side 1 on B.
uniform sampler2D u_pt0;
uniform sampler2D u_pt1;
uniform sampler2D u_pt2;
uniform sampler2D u_pt3;
uniform sampler2D u_pt4;
uniform sampler2D u_pt5;
uniform sampler2D u_pt6;
uniform sampler2D u_pt7;
uniform vec4 u_prect[8];   // plate uv rectangle x0, y0, x1, y1
uniform float u_pa[8];     // opacity over the plate; 0 skips the slot
uniform vec2 u_pshift[8];  // plate uv offset (surface bob)
uniform float u_vignette;
uniform float u_shimmer; // 0..1 progress of the golden shimmer, negative when off
uniform float u_glow;    // halloween glow, 0..1

vec3 sample_plate(sampler2D tex, vec2 uv, float lod) {
  return textureLod(tex, uv, lod).rgb;
}

// Premultiplied patch over the plate colour, in plate space and at the plate's own blur.
vec3 patch_over(vec3 col, sampler2D t, int k, vec2 uv, float lod) {
  float a = u_pa[k];
  if (a <= 0.001) return col;
  vec4 r = u_prect[k];
  vec2 q = (uv - u_pshift[k] - r.xy) / (r.zw - r.xy);
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return col;
  vec4 s = textureLod(t, q, lod);
  return col * (1.0 - s.a * a) + s.rgb * a;
}

// Algae variant first (it replaces the plate), then nest, leaf and shrimp on top.
vec3 plate_side(sampler2D plate, int side, vec2 uv, float lod) {
  vec3 col = sample_plate(plate, uv, lod);
  if (side == 0) {
    col = patch_over(col, u_pt3, 3, uv, lod);
    col = patch_over(col, u_pt1, 1, uv, lod);
    col = patch_over(col, u_pt2, 2, uv, lod);
    col = patch_over(col, u_pt0, 0, uv, lod);
  } else {
    col = patch_over(col, u_pt7, 7, uv, lod);
    col = patch_over(col, u_pt5, 5, uv, lod);
    col = patch_over(col, u_pt6, 6, uv, lod);
    col = patch_over(col, u_pt4, 4, uv, lod);
  }
  return col;
}

void main() {
  vec2 pv = v_uv;
  vec2 uv = u_plateCenter + (pv - 0.5) * u_plateSpan + u_parallax;
  float lod = u_haze * 2.4 + u_algae * 0.9 * (1.0 - u_algaeCover);
  vec3 col = plate_side(u_plateA, 0, uv, lod);
  if (u_hasB > 0.5) col = mix(col, plate_side(u_plateB, 1, uv, lod), u_mix);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float t = u_time;
  vec2 sp = vec2(pv.x * u_aspect, pv.y); // aspect-corrected scene coords

  // Caustics sit on lit surfaces: plate luminance is the mask, and they fade toward the floor.
  float litMask = smoothstep(0.03, 0.32, lum);
  float depthFall = 1.0 - smoothstep(0.68, 1.0, pv.y);
  float surfaceBoost = 0.55 + 0.45 * (1.0 - smoothstep(0.0, 0.7, pv.y));
  float c = caustic(sp, t);
  vec2 lo = vec2(0.5 * u_aspect, 0.5) - normalize(u_sunDir) * 1.15;
  float lightCone = 1.0 - smoothstep(0.8, 2.7, length(sp - lo));
  // Blur the composite (patches included), so a painted-in algae plate does not read as fine detail.
  float lumBlur = dot(plate_side(u_plateA, 0, uv, 3.5), vec3(0.299, 0.587, 0.114));
  float detail = smoothstep(0.015, 0.09, abs(lum - lumBlur));
  float cMask = litMask * depthFall * surfaceBoost * mix(0.16, 1.0, detail) * (0.5 + 0.5 * lightCone);
  vec3 causticLight = u_causticTint * c * u_causticGain * cMask;
  col *= 1.0 + causticLight * 2.6;
  col += causticLight * 0.22 * (0.3 + 0.7 * (1.0 - lum));

  // Grade.
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, u_saturation);
  col *= u_tint * u_exposure;

  // Algae: the water loses clarity in the middle distance.
  col = mix(col, col * vec3(0.92, 1.0, 0.8) + vec3(0.01, 0.03, 0.0), u_algae * 0.35 * (1.0 - u_algaeCover));

  // Milky haze: fog grows with distance (higher up the frame), contrast drops.
  float hz = u_haze * mix(1.0, 0.72, pv.y);
  vec3 veil = u_hazeColor * u_exposure * (0.85 + 0.35 * dot(u_tint, vec3(0.333)));
  float gl = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(gl) * 0.7 + col * 0.3, hz * 0.5);
  col = mix(col, veil, hz * 0.62);

  // God rays, screen-blended so they never clip.
  float sh = shaftAt(sp, normalize(u_sunDir), t, u_aspect);
  vec3 shaftLight = u_shaftTint * sh * u_shaftGain;
  col = 1.0 - (1.0 - col) * (1.0 - shaftLight * 0.45);

  // Golden shimmer (100th reading): a soft diagonal band sweeps through the water once.
  if (u_shimmer >= 0.0) {
    float sd = pv.x * 0.75 + (1.0 - pv.y) * 0.6 - mix(-0.35, 1.7, u_shimmer);
    float band = exp(-sd * sd * 16.0);
    float sparkle = 0.65 + 0.35 * vnoise2(sp * 55.0 + t * 2.0);
    float env = smoothstep(0.0, 0.1, u_shimmer) * (1.0 - smoothstep(0.9, 1.0, u_shimmer));
    col += vec3(1.0, 0.76, 0.3) * band * sparkle * env * (0.4 + 0.5 * lum);
  }
  // Halloween: a faint orange glow low in the tank.
  if (u_glow > 0.001) {
    float flick = 0.85 + 0.15 * sin(t * 1.7 + pv.x * 5.0) * sin(t * 0.9 + 2.0);
    col += vec3(1.0, 0.42, 0.08) * u_glow * flick * 0.42 * smoothstep(0.35, 1.0, pv.y) * (0.7 + 0.5 * lum);
  }

  // Slight vignette, like a lens.
  vec2 vq = pv - 0.5;
  col *= 1.0 - u_vignette * dot(vq, vq) * 1.6;

  o_color = vec4(col, 1.0);
}
`
