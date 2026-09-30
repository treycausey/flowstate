import { GLSL_CAUSTICS, GLSL_HEADER, GLSL_NOISE } from './common'

// One shader for every species other than the betta's three-pose mesh. The cut-out is a grid mesh in
// sprite-width units (x -0.56..0.56, y -0.62..0.62 of the sprite height); per-species uniforms set the
// body wave, whether the fins flow, pectoral flutter and leg flicker. The fragment stage gives each
// creature the same integration treatment as the betta: ambient from the plate, caustics, rim light,
// haze and depth-of-field, plus an edge feather.

export const CREATURE_VERT = `${GLSL_HEADER}
layout(location = 0) in vec2 a_local;

uniform vec2 u_center;     // normalised view position of the sprite centre
uniform vec2 u_shift;      // parallax, normalised view units
uniform float u_aspect;
uniform float u_spriteW;   // sprite width in view widths, perspective included
uniform float u_ratio;     // sprite height / width
uniform float u_facing;
uniform float u_widthScale;
uniform float u_rot;
uniform float u_tailPhase;
uniform float u_pecPhase;
uniform float u_wave;      // 0..1.4 body-wave strength now
uniform float u_waveAmp;   // peak amplitude at the tail, sprite widths
uniform float u_waveLag;   // phase lag nose to tail
uniform float u_headRigid;
uniform float u_flow;      // fins and tail flow
uniform float u_pec;       // pectoral flutter
uniform float u_legs;      // leg flicker
uniform float u_time;
uniform sampler2D u_plate;
uniform vec2 u_plateCenter;
uniform vec2 u_plateSpan;
uniform vec2 u_parallax;

out vec2 v_uv;
out vec2 v_scene;
out vec3 v_ambient;

void main() {
  vec2 L = vec2(a_local.x, a_local.y * u_ratio);
  float uu = L.x + 0.5;
  float yN = L.y / u_ratio;
  float tt = clamp(1.0 - uu, 0.0, 1.0);          // 0 at the nose, 1 at the tail
  float ph = u_tailPhase;
  vec2 D = vec2(0.0);

  // Body wave: the head stays put, the tail swings.
  float bodyAmp = pow(smoothstep(u_headRigid, 1.0, tt), 1.5);
  D.y += u_waveAmp * u_wave * bodyAmp * sin(ph - u_waveLag * tt);

  // Flowing fins and tail (betta-like, for guppies and gouramis).
  float fFin = smoothstep(0.12, 0.38, abs(yN)) * (1.0 - smoothstep(0.55, 0.85, uu));
  float ft = 1.0 - smoothstep(0.1, 0.3, uu);
  float flow = max(fFin, ft) * u_flow * smoothstep(0.0, 0.25, tt);
  D.y += 0.03 * u_wave * flow * (sin(ph - 4.2 * tt - 1.0) + 0.35 * sin(2.2 * ph - 7.0 * tt + 1.7));
  D.x -= 0.02 * flow * (0.5 + 0.5 * sin(ph - 4.2 * tt)) * (0.3 + 0.5 * u_wave);
  D.x += 0.005 * flow * sin(L.y * 16.0 + u_time * 1.9 + L.x * 7.0);

  // Pectoral fin flutter behind the gill.
  float pm = exp(-(pow((uu - 0.66) / 0.06, 2.0) + pow((yN - 0.1) / 0.09, 2.0))) * u_pec;
  D += vec2(0.004 * sin(u_pecPhase), 0.0035 * sin(u_pecPhase + 1.2)) * pm;

  // Legs and feelers flick along the lower edge.
  float lg = smoothstep(0.0, 0.35, yN) * u_legs;
  D.x += 0.006 * lg * sin(u_pecPhase + L.x * 38.0);
  D.y += 0.003 * lg * sin(u_pecPhase * 1.3 + L.x * 29.0);

  vec2 X = L + D;
  v_uv = a_local + 0.5;

  X.x *= u_facing;
  X.x *= u_widthScale;
  float cs = cos(u_rot); float sn = sin(u_rot);
  X = vec2(cs * X.x - sn * X.y, sn * X.x + cs * X.y);

  vec2 pos = u_center + u_shift + vec2(X.x, X.y * u_aspect) * u_spriteW;
  v_scene = vec2(pos.x * u_aspect, pos.y);

  vec2 auv = u_plateCenter + (u_center - 0.5) * u_plateSpan + u_parallax;
  v_ambient = textureLod(u_plate, auv, 6.5).rgb;

  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
}
`

export const CREATURE_FRAG = `${GLSL_HEADER}
${GLSL_NOISE}
${GLSL_CAUSTICS}
in vec2 v_uv;
in vec2 v_scene;
in vec3 v_ambient;
out vec4 o_color;

uniform sampler2D u_tex;
uniform float u_time;
uniform float u_bias;
uniform float u_exposure;
uniform vec3 u_tint;
uniform float u_darkness;
uniform float u_saturation;
uniform float u_causticGain;
uniform vec3 u_causticTint;
uniform vec3 u_shaftTint;
uniform vec2 u_lightLocal;
uniform float u_rimGain;
uniform float u_fishHaze;
uniform vec3 u_hazeColor;
uniform float u_stress;
uniform float u_opacity;
uniform float u_far;
uniform float u_debugAlpha; // dev: output coverage as white
uniform float u_soft;      // plate-space creatures: fine detail softened to the plate
uniform float u_gamma;     // tone curve: higher darkens pale bodies
uniform float u_scatter;   // how much of the surrounding colour veils the body
uniform float u_bright;    // overall brightness
uniform vec2 u_pxLocal;    // one screen pixel in uv units

vec4 fishAt(vec2 uv, float bias) {
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  return texture(u_tex, uv, bias) * inside;
}

// The edge is never crisper than the photograph behind it: a few taps about a pixel wide
// (wider when out of focus or softened) feather the alpha.
vec4 softFish(vec2 uv) {
  float k = 1.25 + 0.9 * u_bias + 0.4 * u_soft;
  vec2 o = u_pxLocal * k;
  float b = u_bias + 0.3 * u_soft;
  return 0.36 * fishAt(uv, b)
       + 0.16 * (fishAt(uv + vec2(o.x, o.y), b) + fishAt(uv + vec2(-o.x, o.y), b)
               + fishAt(uv + vec2(o.x, -o.y), b) + fishAt(uv + vec2(-o.x, -o.y), b));
}

void main() {
  vec4 s = softFish(v_uv);
  if (s.a < 0.003) discard;
  vec3 rgb = s.rgb / s.a;
  // The body is opaque: only the rim (about a pixel) feathers. Defocus blurs colour, not coverage.
  float cover = smoothstep(0.03, 0.55, s.a);
  float sat0 = max(rgb.r, max(rgb.g, rgb.b)) - min(rgb.r, min(rgb.g, rgb.b));

  // Studio-lit photo into water: tone down, shift toward the scene's own light.
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = mix(vec3(lum), rgb, u_saturation * (1.0 - 0.4 * u_stress));
  rgb = pow(rgb, vec3(mix(u_gamma, 1.12, u_darkness)));
  float al = dot(v_ambient, vec3(0.299, 0.587, 0.114));
  vec3 ambDir = v_ambient / max(al, 0.03);
  vec3 fishTint = mix(vec3(1.0), ambDir, 0.3);
  float brightness = clamp(0.16 + al * 3.1, 0.2, 1.0);
  vec3 light = fishTint * brightness * u_tint * u_exposure;
  rgb *= light * 0.9 * u_bright;
  rgb *= mix(vec3(1.0), vec3(0.72, 0.92, 1.18), u_darkness);
  // Night: pale bodies go dim blue-grey; saturated stripes keep a faint glint, nothing glows.
  float nlum = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = mix(rgb, vec3(nlum), 0.35 * u_darkness);
  rgb *= 1.0 - 0.4 * u_darkness;
  rgb *= 1.0 + 0.45 * u_darkness * smoothstep(0.3, 0.65, sat0);
  // Moonlight: a cool silver cast and a lighter belly keep the pattern readable.
  rgb *= mix(vec3(1.0), vec3(0.9, 1.0, 1.12), u_darkness);
  rgb *= 1.0 + 0.3 * u_darkness * smoothstep(0.5, 0.9, v_uv.y);
  // Water in front: some of the surrounding colour scatters into the animal.
  rgb = mix(rgb, v_ambient * u_tint * u_exposure * 1.25, mix(u_scatter, 0.06, u_darkness) + 0.16 * u_far);

  // Caustics play across the body.
  float vFall = 1.0 - smoothstep(0.5, 1.0, v_scene.y);
  float c = caustic(v_scene, u_time);
  vec3 cl = u_causticTint * c * u_causticGain * vFall;
  rgb *= 1.0 + cl * 0.5;

  // Soft rim light on the edge that faces the light.
  float aToward = fishAt(v_uv - u_lightLocal * 0.018, u_bias + 1.5).a;
  float rim = clamp(s.a - aToward, 0.0, 1.0);
  rgb += u_shaftTint * rim * u_rimGain * (0.6 + lum) * (1.0 - u_darkness * 0.5);

  // In fog the animal greys and sinks into the veil.
  vec3 veil = u_hazeColor * u_exposure;
  rgb = mix(rgb, veil, u_fishHaze);

  float a = cover * u_opacity;
  if (u_debugAlpha > 0.5) { o_color = vec4(a, a, a, a); return; }
  o_color = vec4(rgb * a, a);
}
`
