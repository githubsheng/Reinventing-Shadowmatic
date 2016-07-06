attribute vec4 aVertexPosition;
uniform mat4 uObjMVP;

void main() {
    gl_Position = uObjMVP * aVertexPosition;
}