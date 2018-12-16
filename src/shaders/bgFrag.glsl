precision mediump float;

uniform sampler2D uBackgroundTextureOne;
uniform sampler2D uBackgroundTextureTwo;
uniform float radio;

varying vec2 vTexCd;
void main() {
    vec4 c1 = texture2D(uBackgroundTextureOne, vTexCd);
    vec4 c2 = texture2D(uBackgroundTextureTwo, vTexCd);
    gl_FragColor = c1 * radio + c2 * (1.0 - radio);
}