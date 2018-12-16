attribute vec4 aVertexPosition;
uniform mat4 uObjMVP;
uniform mat4 uShadowMVP;

varying vec4 vShadowPositionFromLight;

void main() {
    gl_Position = uObjMVP * aVertexPosition;
    vShadowPositionFromLight = uShadowMVP * aVertexPosition;
}