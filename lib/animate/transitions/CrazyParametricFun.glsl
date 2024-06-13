// Author: mandubian
// License: MIT

uniform float a; // = 4
#ifndef a
  #define a  4.
#endif
uniform float b; // = 1
#ifndef b
  #define b  1.
#endif
uniform float amplitude; // = 120
#ifndef amplitude
  #define amplitude  120.
#endif
uniform float smoothness; // = 0.1
#ifndef smoothness
  #define smoothness  0.1
#endif

vec4 transition(vec2 uv) {
  vec2 p = uv.xy / vec2(1.0).xy;
  vec2 dir = p - vec2(.5);
  float dist = length(dir);
  float x = (a - b) * cos(progress) + b * cos(progress * ((a / b) - 1.) );
  float y = (a - b) * sin(progress) - b * sin(progress * ((a / b) - 1.));
  vec2 offset = dir * vec2(sin(progress  * dist * amplitude * x), sin(progress * dist * amplitude * y)) / smoothness;
  return mix(getFromColor(p + offset), getToColor(p), smoothstep(0.2, 1.0, progress));
}
