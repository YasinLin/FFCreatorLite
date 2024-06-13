// Author: gre
// License: MIT

uniform float count; // = 10.0
#ifndef count
  #define count  10.0
#endif
uniform float smoothness; // = 0.5
#ifndef smoothness
  #define smoothness  0.5
#endif

vec4 transition (vec2 p) {
  float pr = smoothstep(-smoothness, 0.0, p.x - progress * (1.0 + smoothness));
  float s = step(pr, fract(count * p.x));
  return mix(getFromColor(p), getToColor(p), s);
}
