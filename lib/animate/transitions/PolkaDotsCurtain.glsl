// author: bobylito
// license: MIT
const float SQRT_2 = 1.414213562373;
uniform float dots;// = 20.0;
#ifndef dots
  #define dots  20.0
#endif
uniform vec2 center;// = vec2(0, 0);
#ifndef center
  #define center  vec2(0, 0)
#endif

vec4 transition(vec2 uv) {
  bool nextImage = distance(fract(uv * dots), vec2(0.5, 0.5)) < ( progress / distance(uv, center));
  return nextImage ? getToColor(uv) : getFromColor(uv);
}
