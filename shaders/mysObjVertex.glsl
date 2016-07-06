//position of a vertex.
attribute vec4 aVertexPosition;
//vertex normal.
attribute vec3 aNormal;

uniform mat4 uObjMVP;
uniform mat3 uNormalM;
uniform mat4 uShadowMVP;
uniform mat4 uObjM;

//interplate normals
varying vec3 vNormal;
varying vec4 vPos;
varying vec4 vShadowPositionFromLight;

void main() {
    gl_Position = uObjMVP * aVertexPosition;

    vPos = uObjM * aVertexPosition;
    vNormal = uNormalM * aNormal;

    vShadowPositionFromLight = uShadowMVP * aVertexPosition;
}