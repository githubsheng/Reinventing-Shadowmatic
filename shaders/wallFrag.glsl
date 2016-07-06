precision highp float;

uniform sampler2D uShadowMap;
uniform float pcfOffsets[4]; //assuming shadow map width and height are the same

varying vec4 vShadowPositionFromLight;

float compareDepth(const in vec3 loc, const in vec2 offset){
    float recordedDepth = texture2D(uShadowMap, loc.xy + offset).r;
    return (loc.z > recordedDepth + 0.05) ? 0.2 : 1.0;
}

float calVisibility() {
    vec3 shadowCoord = (vShadowPositionFromLight.xyz/vShadowPositionFromLight.w)/2.0 + 0.5;
    float shadowCoeff = 0.0;
    for(int i = 0; i < 4; i++) {
        for(int j = 0; j < 4; j++) {
            shadowCoeff += compareDepth(shadowCoord, vec2(pcfOffsets[i], pcfOffsets[j]));
        }
    }
    return shadowCoeff / 16.0;
}

void main() {
    float visibility = calVisibility();
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - visibility);
}
