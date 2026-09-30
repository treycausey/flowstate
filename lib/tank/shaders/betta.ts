import { GLSL_CAUSTICS, GLSL_HEADER, GLSL_NOISE } from './common'

// Eye position of the cruise sprite in sprite-width units from the sprite centre. Every pose is
// aligned to it, so poses crossfade with the eye staying put.
export const EYE_LOCAL: [number, number] = [0.433, -0.0264]
/** Where the body axis runs, in the same units. */
export const AXIS_Y = -0.035

export const BETTA_VERT = `${GLSL_HEADER}
${GLSL_NOISE}
layout(location = 0) in vec2 a_local;

uniform vec2 u_center;     // normalised view position of the sprite centre
uniform vec2 u_shift;      // parallax, normalised view units
uniform float u_aspect;
uniform float u_spriteW;   // sprite width, in view widths (before perspective scale)
uniform float u_scale;
uniform float u_facing;
uniform float u_widthScale;
uniform float u_rot;
uniform float u_bend;
uniform float u_time;
uniform float u_tailPhase;
uniform float u_pecPhase;
uniform float u_breathPhase;
uniform float u_speedN;    // 0..1 of cruise speed
uniform vec2 u_accel;      // fish-local forward / up
uniform float u_fin;       // 0..1 fin spread
uniform float u_amp;       // motion amplitude scale
uniform sampler2D u_plate;
uniform vec2 u_plateCenter;
uniform vec2 u_plateSpan;
uniform vec2 u_parallax;

out vec2 v_local;
out vec2 v_scene;
out vec3 v_ambient;

void main() {
  vec2 L = a_local;
  float uu = L.x + 0.5;
  float tt = clamp((0.935 - uu) / 0.9, 0.0, 1.0);
  float axisY = ${AXIS_Y.toFixed(4)};

  // Breathing: a gentle pulse at the gill cover.
  vec2 G = vec2(0.38, -0.03);
  float gm = exp(-(pow((uu - 0.88) / 0.075, 2.0) + pow((L.y + 0.03) / 0.075, 2.0)));
  L = G + (L - G) * (1.0 + 0.014 * sin(u_breathPhase) * gm);

  vec2 P = L - vec2(0.0, axisY);
  float fFin = smoothstep(0.07, 0.24, abs(P.y)) * (1.0 - smoothstep(0.78, 0.9, uu));
  float ft = 1.0 - smoothstep(0.30, 0.48, uu);
  float flow = max(fFin, ft);
  float rootD = max(smoothstep(0.06, 0.34, abs(P.y)) * fFin, ft * smoothstep(0.0, 0.34, length(L - vec2(-0.1, axisY))));

  // Fins fold in when the fish is relaxed or stressed.
  float closed = 1.0 - u_fin;
  L.y = axisY + (L.y - axisY) * (1.0 - closed * 0.2 * fFin);
  L.x = mix(L.x, -0.1 + (L.x + 0.1) * (1.0 - closed * 0.14), ft);

  float ph = u_tailPhase;
  float A = u_amp * (0.3 + 0.7 * u_speedN);
  vec2 D = vec2(0.0);

  // Body wave, head rigid.
  float bodyAmp = pow(smoothstep(0.16, 1.0, tt), 1.5);
  D.y += 0.011 * A * bodyAmp * sin(ph - 5.2 * tt);

  // Fins and tail: lagging ripple that grows away from the root, plus billow and edge waves.
  float rip = sin(ph - 4.2 * tt - 1.0) + 0.35 * sin(2.2 * ph - 7.0 * tt + 1.7);
  float fr = flow * rootD;
  D.y += 0.034 * A * fr * rip;
  D.x -= 0.028 * u_amp * fr * (0.5 + 0.5 * sin(ph - 4.2 * tt - 0.2)) * (0.35 + 0.65 * u_speedN);
  D.x += 0.007 * u_amp * fr * sin(L.y * 16.0 + u_time * 1.9 + L.x * 7.0);
  D.y += 0.005 * u_amp * fr * sin(L.x * 21.0 - u_time * 2.4 + L.y * 6.0);
  // Drag: fins trail opposite to acceleration and stream back with speed.
  D.x -= u_accel.x * 0.9 * fr;
  D.y += u_accel.y * 1.2 * fr;
  D.x -= u_speedN * 0.02 * fr;

  // Pectoral flutter behind the gill.
  float pm = exp(-(pow((uu - 0.765) / 0.05, 2.0) + pow((L.y - 0.055) / 0.055, 2.0)));
  D += vec2(0.0055 * sin(u_pecPhase), 0.0045 * sin(u_pecPhase + 1.2)) * pm;

  vec2 X = L + D;
  v_local = a_local;

  X.x *= u_facing;
  X.x *= u_widthScale;
  X.y += u_bend * X.x;
  float cs = cos(u_rot); float sn = sin(u_rot);
  X = vec2(cs * X.x - sn * X.y, sn * X.x + cs * X.y);
  X *= u_scale;

  vec2 pos = u_center + u_shift + vec2(X.x, X.y * u_aspect) * u_spriteW;
  v_scene = vec2(pos.x * u_aspect, pos.y);

  vec2 auv = u_plateCenter + (u_center - 0.5) * u_plateSpan + u_parallax;
  v_ambient = textureLod(u_plate, auv, 6.5).rgb;

  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);
}
`

export const BETTA_FRAG = `${GLSL_HEADER}
${GLSL_NOISE}
${GLSL_CAUSTICS}
in vec2 v_local;
in vec2 v_scene;
in vec3 v_ambient;
out vec4 o_color;

uniform sampler2D u_texCruise;
uniform sampler2D u_texFlare;
uniform sampler2D u_texClamped;
uniform vec3 u_poseW;
uniform vec4 u_pose[3]; // eyeU, eyeV, H/W, scale
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

const vec2 EYE_L = vec2(${EYE_LOCAL[0]}, ${EYE_LOCAL[1]});

vec4 samplePose(sampler2D tex, vec4 pk, float w, vec2 L, float bias) {
  if (w < 0.002) return vec4(0.0);
  vec2 uv = pk.xy + (L - EYE_L) / (pk.w * vec2(1.0, pk.z));
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  return texture(tex, uv, bias) * (inside * w);
}

vec4 fishAt(vec2 L, float bias) {
  return samplePose(u_texCruise, u_pose[0], u_poseW.x, L, bias)
       + samplePose(u_texFlare, u_pose[1], u_poseW.y, L, bias)
       + samplePose(u_texClamped, u_pose[2], u_poseW.z, L, bias);
}

void main() {
  vec4 s = fishAt(v_local, u_bias);
  if (s.a < 0.003) discard;
  vec3 rgb = s.rgb / s.a;

  // Studio-lit photo into water: tone down, shift toward the scene's own light.
  float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
  rgb = mix(vec3(lum), rgb, u_saturation * (1.0 - 0.4 * u_stress));
  rgb = pow(rgb, vec3(1.08));
  float al = dot(v_ambient, vec3(0.299, 0.587, 0.114));
  vec3 ambDir = v_ambient / max(al, 0.03);
  vec3 fishTint = mix(vec3(1.0), ambDir, 0.28);
  float brightness = clamp(0.16 + al * 3.1, 0.2, 1.0);
  vec3 light = fishTint * brightness * u_tint * u_exposure;
  rgb *= light * 0.9;
  rgb *= mix(vec3(1.0), vec3(0.72, 0.92, 1.18), u_darkness);
  // Water in front of the fish: a little of the surrounding colour scatters into it.
  rgb = mix(rgb, v_ambient * u_tint * u_exposure * 1.25, 0.14);

  // Caustics play across the body.
  float vFall = 1.0 - smoothstep(0.5, 1.0, v_scene.y);
  float c = caustic(v_scene, u_time);
  vec3 cl = u_causticTint * c * u_causticGain * vFall;
  rgb *= 1.0 + cl * 0.55;

  // Soft rim light on the edge that faces the light.
  float aToward = fishAt(v_local - u_lightLocal * 0.014, u_bias + 1.5).a;
  float rim = clamp(s.a - aToward, 0.0, 1.0);
  rgb += u_shaftTint * rim * u_rimGain * (0.6 + lum) * (1.0 - u_darkness * 0.5);

  // In fog the fish greys and sinks into the veil.
  vec3 veil = u_hazeColor * u_exposure;
  rgb = mix(rgb, veil, u_fishHaze);

  float a = s.a * u_opacity;
  o_color = vec4(rgb * a, a);
}
`
