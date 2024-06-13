// Author: gre
// License: MIT
uniform float size; // = 0.04
#ifndef size
  #define size  0.04
#endif
uniform float zoom; // = 50.0
#ifndef zoom
  #define zoom  50.0
#endif
uniform float colorSeparation; // = 0.3
#ifndef colorSeparation
  #define colorSeparation  0.3
#endif

vec4 transition(vec2 p) {
  float inv = 1. - progress;
  vec2 disp = size*vec2(cos(zoom*p.x), sin(zoom*p.y));
  vec4 texTo = getToColor(p + inv*disp);
  vec4 texFrom = vec4(
    getFromColor(p + progress*disp*(1.0 - colorSeparation)).r,
    getFromColor(p + progress*disp).g,
    getFromColor(p + progress*disp*(1.0 + colorSeparation)).b,
    1.0);
  return texTo*progress + texFrom*inv;
}
