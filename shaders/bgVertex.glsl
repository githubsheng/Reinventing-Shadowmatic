attribute vec4 aVertexPosition;
//textue coordinate
attribute vec2 aTexCd;

varying vec2 vTexCd;
void main() {
    gl_Position = aVertexPosition;
    vTexCd = aTexCd;
}