precision highp float;

uniform sampler2D uShadowMap;

struct baseColor {
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

struct directLight {
    vec3 direction;
    vec3 color;
};

uniform baseColor mysObjBaseColor;
uniform directLight warmLight;
uniform directLight coldLight;
uniform vec3 ambientLightColor;

uniform vec3 eyeCd;
uniform float shininess;

uniform float pcfOffsets[4]; //assuming shadow map width and height are the same

varying vec4 vPos;
varying vec3 vNormal;
varying vec4 vShadowPositionFromLight;

float compareDepth(const in vec3 loc, const in vec2 offset){
    float recordedDepth = texture2D(uShadowMap, loc.xy + offset).r;
    return (loc.z > recordedDepth + 0.05) ? 0.0 : 1.0;
}

float calVisibility() {
    vec3 shadowCoord = (vShadowPositionFromLight.xyz/vShadowPositionFromLight.w)/2.0 + 0.5;
    float shadowCoeff = 0.0;
    for(int i = 0; i < 4; i++) {
        for(int j = 0; j < 4; j++) {
            shadowCoeff += compareDepth(shadowCoord, vec2(pcfOffsets[i], pcfOffsets[j]));
        }
    }
    return shadowCoeff / 16.0; //16 tap kernal
}

vec3 calSpecularLight(const in directLight light){
    vec3 posToEye = normalize(eyeCd - vPos.xyz);
    vec3 reflectionVector = normalize(reflect(light.direction, normalize(vNormal)));
    float rdotv = max(dot(reflectionVector, posToEye), 0.0);
    float specularLightWeight = pow(rdotv, shininess);
    //base color * light color * weight;
    return vec3(mysObjBaseColor.specular * light.color * specularLightWeight);
}

vec3 calAmbientLight(){
    return ambientLightColor * mysObjBaseColor.ambient;
}

vec3 calDiffuseLight(const in directLight light){
    vec3 inverseLightDir = light.direction * -1.0;
    float dot = max(dot(inverseLightDir, normalize(vNormal)), 0.0);
    return light.color * mysObjBaseColor.diffuse * dot;
}

void main() {
    vec3 ambientLight = calAmbientLight();
    vec3 coldDiffuseLight = calDiffuseLight(coldLight);
    vec3 coldSpecularLight = calSpecularLight(coldLight);
    //the following two lights are subject to shadow
    float visibility = calVisibility();
    vec3 warmDiffuseLight = calDiffuseLight(warmLight) * visibility;
    vec3 warmSpecularLight = calSpecularLight(warmLight) * visibility;
    vec3 fragColor = vec3(warmDiffuseLight + warmSpecularLight + coldDiffuseLight + coldSpecularLight + ambientLight);
    gl_FragColor = vec4(fragColor, 1.0);
}