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
uniform vec4 u_leaf;      // x, y, rx, ry (normalised view space); zw unused when alpha 0
uniform float u_leafShadow;
uniform float u_vignette;

vec3 sample_plate(sampler2D tex, vec2 uv, float lod) {
  return textureLod(tex, uv, lod).rgb;
}

void main() {
  vec2 pv = v_uv;
  vec2 uv = u_plateCenter + (pv - 0.5) * u_plateSpan + u_parallax;
  float lod = u_haze * 2.4 + u_algae * 0.9;
  vec3 col = sample_plate(u_plateA, uv, lod);
  if (u_hasB > 0.5) col = mix(col, sample_plate(u_plateB, uv, lod), u_mix);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float t = u_time;
  vec2 sp = vec2(pv.x * u_aspect, pv.y); // aspect-corrected scene coords

  // Caustics sit on lit surfaces: plate luminance is the mask, and they fade toward the floor.
  float litMask = smoothstep(0.12, 0.5, lum);
  float depthFall = 1.0 - smoothstep(0.5, 1.0, pv.y);
  float surfaceBoost = 0.55 + 0.45 * (1.0 - smoothstep(0.0, 0.7, pv.y));
  float shadow = 0.0;
  if (u_leafShadow > 0.001) {
    vec2 lp = u_leaf.xy + u_sunDir * 0.22 * vec2(1.0, 1.0);
    vec2 d = (pv - lp) * vec2(u_aspect, 1.0) / max(u_leaf.zw, vec2(0.001));
    shadow = u_leafShadow * (1.0 - smoothstep(0.55, 1.15, length(d)));
  }
  float c = caustic(sp, t);
  vec2 lo = vec2(0.5 * u_aspect, 0.5) - normalize(u_sunDir) * 1.15;
  float lightCone = 1.0 - smoothstep(0.35, 1.7, length(sp - lo));
  float lumBlur = dot(textureLod(u_plateA, uv, 3.5).rgb, vec3(0.299, 0.587, 0.114));
  float detail = smoothstep(0.015, 0.09, abs(lum - lumBlur));
  float cMask = litMask * depthFall * surfaceBoost * mix(0.18, 1.0, detail) * (0.25 + 0.75 * lightCone) * (1.0 - 0.75 * shadow);
  vec3 causticLight = u_causticTint * c * u_causticGain * cMask;
  col *= 1.0 + causticLight * 1.35;
  col += causticLight * 0.05;

  // Grade.
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, u_saturation);
  col *= u_tint * u_exposure * (1.0 - 0.18 * shadow);

  // Algae: the water loses clarity in the middle distance.
  col = mix(col, col * vec3(0.92, 1.0, 0.8) + vec3(0.01, 0.03, 0.0), u_algae * 0.35);

  // Milky haze: fog grows with distance (higher up the frame), contrast drops.
  float hz = u_haze * mix(1.0, 0.72, pv.y);
  vec3 veil = u_hazeColor * u_exposure * (0.85 + 0.35 * dot(u_tint, vec3(0.333)));
  float gl = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(gl) * 0.7 + col * 0.3, hz * 0.5);
  col = mix(col, veil, hz * 0.62);

  // God rays, screen-blended so they never clip.
  float sh = shaftAt(sp, normalize(u_sunDir), t, u_aspect);
  vec3 shaftLight = u_shaftTint * sh * u_shaftGain * (1.0 - 0.6 * shadow);
  col = 1.0 - (1.0 - col) * (1.0 - shaftLight * 0.45);

  // Slight vignette, like a lens.
  vec2 vq = pv - 0.5;
  col *= 1.0 - u_vignette * dot(vq, vq) * 1.6;

  o_color = vec4(col, 1.0);
}
`
