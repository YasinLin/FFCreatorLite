// author: gre
// License: MIT
uniform vec3 color;// = vec3(0.0)
#ifndef color
  #define color  vec3(0.0)
#endif
uniform float colorPhase; // = 0.4 ; // if 0.0, there is no black phase, if 0.9, the black phase is very important
#ifndef colorPhase
  #define colorPhase  0.4
#endif
vec4 transition (vec2 uv) {
  return mix(
    mix(vec4(color, 1.0), getFromColor(uv), smoothstep(1.0-colorPhase, 0.0, progress)),
    mix(vec4(color, 1.0), getToColor(uv), smoothstep(    colorPhase, 1.0, progress)),
    progress);
}
