// Author: Adrian Purser
// License: MIT

uniform vec4 shadow_colour; // = vec4(0.,0.,0.,.6)
#ifndef shadow_colour
  #define shadow_colour  vec4(0.,0.,0.,.6)
#endif
uniform float shadow_height; // = 0.075
#ifndef shadow_height
  #define shadow_height  0.075
#endif
uniform float bounces; // = 3.0
#ifndef bounces
  #define bounces  3.0
#endif

const float PI = 3.14159265358;

vec4 transition (vec2 uv) {
  float time = progress;
  float stime = sin(time * PI / 2.);
  float phase = time * PI * bounces;
  float y = (abs(cos(phase))) * (1.0 - stime);
  float d = uv.y - y;
  return mix(
    mix(
      getToColor(uv),
      shadow_colour,
      step(d, shadow_height) * (1. - mix(
        ((d / shadow_height) * shadow_colour.a) + (1.0 - shadow_colour.a),
        1.0,
        smoothstep(0.95, 1., progress) // fade-out the shadow at the end
      ))
    ),
    getFromColor(vec2(uv.x, uv.y + (1.0 - y))),
    step(d, 0.0)
  );
}
