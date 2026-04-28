#version 300 es

precision highp float;

uniform sampler2D color;

#ifdef ALPHA
  uniform sampler2D alpha;
#endif

in vec2 vUv;
out vec4 fragColor;

void main() {
  fragColor = texture(color, vUv);

  #ifdef ALPHA
    fragColor.a = texture(alpha, vUv).r;

    #ifdef PREMULTIPLY_ALPHA
      fragColor.rgb *= fragColor.a;
    #endif
  #endif
}
