// Author: gre
// License: MIT
uniform float amplitude; // = 100.0
#ifndef amplitude
  #define amplitude  100.0
#endif
uniform float speed; // = 50.0
#ifndef speed
  #define speed  50.0
#endif

vec4 transition (vec2 uv) {
  vec2 dir = uv - vec2(.5);
  float dist = length(dir);
  vec2 offset = dir * (sin(progress * dist * amplitude - progress * speed) + .5) / 30.;
  return mix(
    getFromColor(uv + offset),
    getToColor(uv),
    smoothstep(0.2, 1.0, progress)
  );
}
