//context
var canvas = document.querySelector("#canvas", {stencil: true});

var gl = WebGLDebugUtils.makeDebugContext(canvas.getContext("webgl"));
var viewportWidth = canvas.width;
var viewportHeight = canvas.height;
var shadowViewPortWidth = 1024;
var shadowViewPortHeight = 1024;

//-------------------------------------------------------------------------------------------------------------
//  matrices used by normal rendering
//-------------------------------------------------------------------------------------------------------------
//static
var projectionMatrix = mat4.create();
var viewMatrix = mat4.create();
var VPMatrix = mat4.create();

// main camera
var eyeCoord = vec3.fromValues(-45.086, -10.548, 131.721);
var eyeLookAtCoord = vec3.fromValues(-29.134, -6.732, -24.9);
var eyeUpDir = vec3.fromValues(0, 1, 0);
mat4.perspective(projectionMatrix, 0.5556, viewportWidth / viewportHeight, 41.145, 394.625);
// eye coordinate is also coded in shader to calculate specular, update this values in both places if needed.
mat4.lookAt(viewMatrix, eyeCoord, eyeLookAtCoord, eyeUpDir);
mat4.multiply(VPMatrix, projectionMatrix, viewMatrix);

var objBaseColor_ambient = vec3.fromValues(0.7, 0.7, 0.7);
var objBaseColor_diffuse = vec3.fromValues(0.7, 0.7, 0.7);
var objBaseColor_specular = vec3.fromValues(0.9, 0.9, 0.9);
var warmLightDir = vec3.fromValues(-83.064, -1.99, -173.467);
vec3.normalize(warmLightDir, warmLightDir);
var warmLightColor = vec3.fromValues(1.0, 1.0, 0.6);
var coldLightDir = vec3.fromValues(0.0, 1.0, 0.0);
vec3.normalize(coldLightDir, coldLightDir);
var coldLightColor = vec3.fromValues(0.196, 0.361, 0.608);
var ambientLightColor = vec3.fromValues(0.3, 0.3, 0.3);

//change in each frame
var m_modelMatrix = mat4.create();

function randomizeRotation(){
    mat4.identity(m_modelMatrix);
    mat4.rotateX(m_modelMatrix, m_modelMatrix, 1.0);
    mat4.rotateY(m_modelMatrix, m_modelMatrix, 1.0);
    mat4.rotateZ(m_modelMatrix, m_modelMatrix, 1.0);
}

var w_modelMatrix = mat4.create();
var wallMVPMatrix = mat4.create();
mat4.multiply(wallMVPMatrix, VPMatrix, w_modelMatrix);

var MVPMatrix = mat4.create();
var normalMatrix = mat3.create();

//-------------------------------------------------------------------------------------------------------------
//  matrices used by shadow rendering
//-------------------------------------------------------------------------------------------------------------
var shadowProjectionMatrix = mat4.create();
var shadowViewMatrix = mat4.create();
var shadowVPMatrix = mat4.create();

var wallShadowMVPMatrix = mat4.create();
var texUnit = 1.0 / shadowViewPortWidth; //assuming shadow map width and height are the same
var pcfOffsets = new Float32Array([-1.5 * texUnit, -0.5 * texUnit, 0.5 * texUnit, 1.5 * texUnit]);

// 用来投射阴影的暖光
// 83.064 / 1.99 / 173.467 -> 0 0 0
// 用来绘制投影的镜头的位置也是同上
// fov 18.3833
// near clip 152.723
// far clip 351.216

//static
var shadowEyeCoord = vec3.fromValues(83.064, 1.99, 173.467);
var shadowEyeLookAt = vec3.fromValues(0, 0, 0);
var shadowEyeUpDir = vec3.fromValues(0, 1, 0);
mat4.perspective(shadowProjectionMatrix, 0.3287, shadowViewPortWidth / shadowViewPortHeight, 152.723, 351.216);
//this is the same as diffuse light source direction.
mat4.lookAt(shadowViewMatrix, shadowEyeCoord, shadowEyeLookAt, shadowEyeUpDir);
mat4.multiply(shadowVPMatrix, shadowProjectionMatrix, shadowViewMatrix);
mat4.multiply(wallShadowMVPMatrix, shadowVPMatrix, w_modelMatrix);
//change in every frame
var shadowMVPMatrix = mat4.create();

function createProgram(vertexShaderId, fragmentShaderId, vertexShaderSrc, fragmentShaderSrc) {
    var program = gl.createProgram();
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    var vertexShaderSource = vertexShaderSrc || document.querySelector(vertexShaderId).text;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    var vertexShaderCompiled = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
    if (!vertexShaderCompiled) {
        console.log("Failed to compile vertex shader: " + vertexShaderId);
        var compilationLog = gl.getShaderInfoLog(vertexShader);
        console.log('Shader compiler log: ' + compilationLog);
    }

    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    var fragmentShaderSource = fragmentShaderSrc || document.querySelector(fragmentShaderId).text;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    var backgroundFragmentShaderCompiled = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
    if (!backgroundFragmentShaderCompiled) {
        console.log("Failed to compile fragment shader: " + fragmentShaderId);
        var compilationLog = gl.getShaderInfoLog(fragmentShader);
        console.log('Shader compiler log: ' + compilationLog);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        console.log("program validation failed: " + vertexShaderId + " " + fragmentShaderId);
    }
    return program;
}

//-------------------------------------------------------------------------------------------------------------
//  set up program to render the mysterious object.
//-------------------------------------------------------------------------------------------------------------
//create normal program
var normalProgram;
var n_aVertexPosition, n_aNormal, n_uObjMPV, n_uObjM, n_uNormalM;
var n_baseColorAmbient, n_baseColorDiffuse, n_baseColorSpecular,
    n_warmLightDir, n_warmLightColor, n_coldLightDir, n_coldLightColor, n_ambientLightColor;
var n_shininess, n_eyeCd;
var n_uShadowMVP, n_uShadowMap, n_pcfOffsets;

function createNormalProgram(vertexShaderSrc, fragmentShaderSrc){
    normalProgram = createProgram("#shader-vertex", "#shader-fragment", vertexShaderSrc, fragmentShaderSrc);
    //get attribute locations of normal program
    //vertice positions and normal positions
    n_aVertexPosition = gl.getAttribLocation(normalProgram, "aVertexPosition");
    n_aNormal = gl.getAttribLocation(normalProgram, "aNormal");
    //MVP matrix and normal matrix
    n_uObjMPV = gl.getUniformLocation(normalProgram, "uObjMVP");
    n_uObjM = gl.getUniformLocation(normalProgram, "uObjM");
    n_uNormalM = gl.getUniformLocation(normalProgram, "uNormalM");
    //colors & lights
    n_baseColorAmbient = gl.getUniformLocation(normalProgram, "mysObjBaseColor.ambient");
    n_baseColorDiffuse = gl.getUniformLocation(normalProgram, "mysObjBaseColor.diffuse");
    n_baseColorSpecular = gl.getUniformLocation(normalProgram, "mysObjBaseColor.specular");
    n_warmLightDir = gl.getUniformLocation(normalProgram, "warmLight.direction");
    n_warmLightColor = gl.getUniformLocation(normalProgram, "warmLight.color");
    n_coldLightDir = gl.getUniformLocation(normalProgram, "coldLight.direction");
    n_coldLightColor = gl.getUniformLocation(normalProgram, "coldLight.color");
    n_ambientLightColor = gl.getUniformLocation(normalProgram, "ambientLightColor");
    n_eyeCd = gl.getUniformLocation(normalProgram, "eyeCd");
    n_shininess = gl.getUniformLocation(normalProgram, "shininess");

    //shadow MVP matrix and shadow map
    n_uShadowMVP = gl.getUniformLocation(normalProgram, "uShadowMVP");
    n_uShadowMap = gl.getUniformLocation(normalProgram, "uShadowMap");
    n_pcfOffsets = gl.getUniformLocation(normalProgram, "pcfOffsets");
}

//var sp_aVertexPosition = gl.getAttribLocation(specularProgram, "aVertexPosition");
//var sp_aNormal = gl.getAttribLocation(specularProgram, "aNormal");

//-------------------------------------------------------------------------------------------------------------
//  set up program to draw shadow maps that store information about shadows casted by the mysterious object
//-------------------------------------------------------------------------------------------------------------
//create shadow program
var shadowProgram;
var s_aVertexPosition, s_uObjMVP;

function createShadowProgram(vertexShaderSrc, fragmentShaderSrc){
    shadowProgram = createProgram("#shadow-shader-vertex", "#shadow-shader-fragment", vertexShaderSrc, fragmentShaderSrc);
    //get attribute location of shadow program
    s_aVertexPosition = gl.getAttribLocation(shadowProgram, "aVertexPosition");
    s_uObjMVP = gl.getUniformLocation(shadowProgram, "uObjMVP");
}

//-------------------------------------------------------------------------------------------------------------
// set up program to render the wall
//-------------------------------------------------------------------------------------------------------------
var wallProgram;
var w_aVertexPosition, w_uObjMVP, w_uShadowMVP, w_uShadowMap, w_pcfOffsets;

function createWallProgram(vertexShaderSrc, fragmentShaderSrc){
    wallProgram = createProgram("#wall-shader-vertex", "#wall-shader-fragment", vertexShaderSrc, fragmentShaderSrc);
    w_aVertexPosition = gl.getAttribLocation(wallProgram, "aVertexPosition");
    w_uObjMVP = gl.getUniformLocation(wallProgram, "uObjMVP");
    w_uShadowMVP = gl.getUniformLocation(wallProgram, "uShadowMVP");
    w_uShadowMap = gl.getUniformLocation(wallProgram, "uShadowMap");
    w_pcfOffsets = gl.getUniformLocation(wallProgram, "pcfOffsets");
}

//-------------------------------------------------------------------------------------------------------------
//  set up program to draw the background
//-------------------------------------------------------------------------------------------------------------
var backgroundProgram;
var b_aVertexPosition, b_vTextureCoordinate, b_uBgTexture1, b_uBgTexture2, b_radio;

function createBackgroundProgram(vertexShaderSrc, fragmentShaderSrc){
    backgroundProgram = createProgram("#background-shader-vertex", "#background-shader-fragment", vertexShaderSrc, fragmentShaderSrc);
    b_aVertexPosition = gl.getAttribLocation(backgroundProgram, "aVertexPosition");
    b_vTextureCoordinate = gl.getAttribLocation(backgroundProgram, "aTexCd");
    b_uBgTexture1 = gl.getUniformLocation(backgroundProgram, "uBackgroundTextureOne");
    b_uBgTexture2 = gl.getUniformLocation(backgroundProgram, "uBackgroundTextureTwo");
    b_radio = gl.getUniformLocation(backgroundProgram, "radio");
}

//-------------------------------------------------------------------------------------------------------------
//  model data set up
//-------------------------------------------------------------------------------------------------------------
//introduce the vertices, normals and indices of the model, in this case its a cube.
var m_vertexBuffer = gl.createBuffer();
var m_normalsBuffer = gl.createBuffer();
var m_elementBuffer = gl.createBuffer();

var w_vertexBuffer = gl.createBuffer();
var w_normalBuffer = gl.createBuffer();
var w_elementBuffer = gl.createBuffer();

var m_indices_number;
var w_indices_number;

var b_vtBuffer = gl.createBuffer();
var g_quadBuffer = gl.createBuffer();

var b_vtSize;
var b_vertices_number;

var g_quadSize;
var g_quad_vertices_number;

var scale = 2.5;
function setupMysteriousObjectBuffer(dataStr){
    var loader = new OBJDoc();
    loader.parse(dataStr, scale); //scale should be 2.5
    var data = loader.getDrawingInfo();

    //mysterious object related
    //Float32 corresponds to gl.FLOAT
    var mysteriousObjectVertices = data["MysteriousObject"].vertices;

    //Float32 corresponds to gl.FLOAT
    var mysteriousObjectNormals = data["MysteriousObject"].normals;

    //Uint16Array correspond to gl.UNSIGNED_SHORT
    var mysteriousObjectIndices = data["MysteriousObject"].indices;

    //var mysteriousObjectVertices = new Float32Array([
    //    10.0, 10.0, 10.0, -10.0, 10.0, 10.0, -10.0, -10.0, 10.0, 10.0, -10.0, 10.0,
    //    10.0, 10.0, 10.0, 10.0, -10.0, 10.0, 10.0, -10.0, -10.0, 10.0, 10.0, -10.0,
    //    10.0, 10.0, 10.0, 10.0, 10.0, -10.0, -10.0, 10.0, -10.0, -10.0, 10.0, 10.0,
    //    -10.0, 10.0, 10.0, -10.0, 10.0, -10.0, -10.0, -10.0, -10.0, -10.0, -10.0, 10.0,
    //    -10.0, -10.0, -10.0, 10.0, -10.0, -10.0, 10.0, -10.0, 10.0, -10.0, -10.0, 10.0,
    //    10.0, -10.0, -10.0, -10.0, -10.0, -10.0, -10.0, 10.0, -10.0, 10.0, 10.0, -10.0]);
    //
    //var mysteriousObjectNormals = new Float32Array([
    //    0.0, 0.0, 10.0, 0.0, 0.0, 10.0, 0.0, 0.0, 10.0, 0.0, 0.0, 10.0,
    //    10.0, 0.0, 0.0, 10.0, 0.0, 0.0, 10.0, 0.0, 0.0, 10.0, 0.0, 0.0,
    //    0.0, 10.0, 0.0, 0.0, 10.0, 0.0, 0.0, 10.0, 0.0, 0.0, 10.0, 0.0,
    //    -10.0, 0.0, 0.0, -10.0, 0.0, 0.0, -10.0, 0.0, 0.0, -10.0, 0.0, 0.0,
    //    0.0, -10.0, 0.0, 0.0, -10.0, 0.0, 0.0, -10.0, 0.0, 0.0, -10.0, 0.0,
    //    0.0, 0.0, -10.0, 0.0, 0.0, -10.0, 0.0, 0.0, -10.0, 0.0, 0.0, -10.0]);
    //
    //var mysteriousObjectIndices = new Uint16Array([
    //    0, 1, 2, 0, 2, 3,
    //    4, 5, 6, 4, 6, 7,
    //    8, 9, 10, 8, 10, 11,
    //    12, 13, 14, 12, 14, 15,
    //    16, 17, 18, 16, 18, 19,
    //    20, 21, 22, 20, 22, 23]);

    gl.bindBuffer(gl.ARRAY_BUFFER, m_vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mysteriousObjectVertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, m_normalsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mysteriousObjectNormals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m_elementBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mysteriousObjectIndices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    m_indices_number = mysteriousObjectIndices.length;

    //reset all binding to clean up.
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function setupSceneBuffers(dataStr){
    var loader = new OBJDoc();
    loader.parse(dataStr, scale); //scale should be 2.5
    var data = loader.getDrawingInfo();

    //wall related
    var wallVertices = data["Wall"].vertices;
    var wallNormals = data["Wall"].normals;
    var wallIndices = data["Wall"].indices;


    gl.bindBuffer(gl.ARRAY_BUFFER, w_vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wallVertices, gl.STATIC_DRAW);


    gl.bindBuffer(gl.ARRAY_BUFFER, w_normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, wallNormals, gl.STATIC_DRAW);


    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w_elementBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wallIndices, gl.STATIC_DRAW);

    w_indices_number = wallIndices.length;

    //rectangular as background
    var verticesTexCoords = new Float32Array([
        //for each line, the two on the left are vertices coordinates,
        //and the two on the right are textures coordinates
        -1.0,  1.0, 0.0, 1.0,
        -1.0, -1.0, 0.0, 0.0,
        1.0,  1.0, 1.0, 1.0,
        1.0, -1.0, 1.0, 0.0
    ]);


    gl.bindBuffer(gl.ARRAY_BUFFER, b_vtBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verticesTexCoords, gl.STATIC_DRAW);
    b_vtSize = verticesTexCoords.BYTES_PER_ELEMENT;
    b_vertices_number = 4;

    //general quad
    var generalQuadCoords = new Float32Array([-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]);//use strap

    gl.bindBuffer(gl.ARRAY_BUFFER, g_quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, generalQuadCoords, gl.STATIC_DRAW);
    g_quadSize = generalQuadCoords.BYTES_PER_ELEMENT;
    g_quad_vertices_number = 4;

    //reset all binding to clean up.
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

}

//-------------------------------------------------------------------------------------------------------------
//  shadow frame buffer
//-------------------------------------------------------------------------------------------------------------
/*
 by default, the webgl system draws using a color buffer and, when using the hidden surface removal function, a depth buffer.
 The final image is kept in the color buffer. The frame buffer object is an alternative mechanism that I can use instead of a color
 buffer or a depth buffer. Unlike a color buffer, the content drawn in a frame buffer object is not directly displayed on the <canvas>.
 And I get a chance to perform various processing.
 */
//create frame buffer.
var shadowFrameBuffer;
function setupShadowMapFrameBuffer(){
    shadowFrameBuffer = gl.createFramebuffer();
    //bind
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFrameBuffer);

    //set up the texture of this frame buffer, its used as a replacement of default color buffer.
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    /*
     the 1st parameter: indicates we are configuring gl.TEXTURE_2D, which now points to our texture.

     the 2nd parameter: says the mipmap level, since we are not useing mipmapping for this texture we will make it 0, which
     means base level.

     the 3rd parameter: the internal format of the image, we will use rgba here, as it works with our pack and unpack function
     in the shader.

     the 4th parameter & 5 th parameters: the width and height of the texture.

     the 5th parameter: border width, 0. not sure what this is for.

     the 6th parameter: in webgl this must be the same as 3rd parameter, the internal format of the texture.

     the 7th parameter: the data type of a texel, these types are used to compress image. I use unsigned byte here (the largest type),
     because image compression and size is not a concern in here, and this seems to work with the pack and unpack function in the shader.

     the 8th parameter: the image data. in this case its null, because i am not loading an external image into this texture.
     */
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowViewPortWidth, shadowViewPortHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    //specify how we do min / max filtering.
    //the default value for gl.TEXTURE_MIN_FILTER is gl.NEAREST_MIPMAP_LINEAR. Since I am not using mipmap here i will just change it to gl.NEAREST
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    /*
     a render is a texture with a hint - that you won't expect some functionality from them. You only use it when you will never use it
     as a texture. Because the graphic card knows you won't use some certain functionalities, it can do some optimizations. However,
     there is no much difference nowdays. This render buffer is used as a replacement of the default render buffer.
     */
    var depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    //second parameter says that this render buffer is used as a depth buffer, and the buffer storage will be configured accordingly.
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadowViewPortWidth, shadowViewPortHeight);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    /*
     finally i will bind this texture to my shadow frame buffer.

     gl.COLOR_ATTACHMENT0 says I will bind the texture to the attachment point "gl.COLOR_ATTACHMENT0". a frame buffer in webgl has three
     attachment points: COLOR_ATTACHMENT0, DEPTH_ATTACHMENT, and STENCIL_ATTACHMENT. You sort of know which attachment is for what by reading
     their names.

     The last argument is mipmapping level, I am not using mipmapping so its 0 (base level)
     */
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    //bind the render buffer to attachment point "gl.DEPTH_ATTACHMENT"
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    //check if everything is ok with this frame buffer.
    var shadowFrameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (gl.FRAMEBUFFER_COMPLETE !== shadowFrameBufferStatus)
        console.log("shadow frame buffer is incomplete: " + shadowFrameBufferStatus.toString());

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
setupShadowMapFrameBuffer();

//-------------------------------------------------------------------------------------------------------------
//  configure background texture
//-------------------------------------------------------------------------------------------------------------
function setupBackgroundTexture(image1, image2){
    var bgTexture1 = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    configureBgTexture(bgTexture1, image1);

    var bgTexture2 = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    configureBgTexture(bgTexture2, image2);

    function configureBgTexture(texture, image){
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
}

//-------------------------------------------------------------------------------------------------------------
//  render shadow map
//-------------------------------------------------------------------------------------------------------------
function renderShadowMapf() {
    //switch to shadow shaders
    gl.useProgram(shadowProgram);
    //the second argument is transpose, which is always false in webgl
    gl.uniformMatrix4fv(s_uObjMVP, false, shadowMVPMatrix);

    // draw the mysterious object
    // upload vertex buffer to shadow vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, m_vertexBuffer);
    //the arguments for gl.vertexAttribPointer are: uint index, int size, enum type, bool normalized, long stride, and long offset
    gl.vertexAttribPointer(s_aVertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(s_aVertexPosition);

    //bind element buffer, draw shadow (store depth information in texture)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m_elementBuffer);
    //gl.UNSIGNED_SHORT corresponds to Uint16Array
    gl.drawElements(gl.TRIANGLES, m_indices_number, gl.UNSIGNED_SHORT, 0);

    // draw the wall
    gl.uniformMatrix4fv(s_uObjMVP, false, wallShadowMVPMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, w_vertexBuffer);
    gl.vertexAttribPointer(s_aVertexPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w_elementBuffer);
    gl.drawElements(gl.TRIANGLES, w_indices_number, gl.UNSIGNED_SHORT, 0);
}

function renderShadowMapr(){
    //switch to shadow shaders
    gl.useProgram(shadowProgram);
    //the second argument is transpose, which is always false in webgl
    gl.uniformMatrix4fv(s_uObjMVP, false, shadowMVPMatrix);

    // draw the mysterious object
    // upload vertex buffer to shadow vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, m_vertexBuffer);
    //the arguments for gl.vertexAttribPointer are: uint index, int size, enum type, bool normalized, long stride, and long offset
    gl.vertexAttribPointer(s_aVertexPosition, 3, gl.FLOAT, false, 0, 0);

    //bind element buffer, draw shadow (store depth information in texture)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m_elementBuffer);
    //gl.UNSIGNED_SHORT corresponds to Uint16Array
    gl.drawElements(gl.TRIANGLES, m_indices_number, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, w_vertexBuffer);
    gl.vertexAttribPointer(s_aVertexPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w_elementBuffer);
    gl.drawElements(gl.TRIANGLES, w_indices_number, gl.UNSIGNED_SHORT, 0);
}


//-------------------------------------------------------------------------------------------------------------
//  background rendering
//-------------------------------------------------------------------------------------------------------------
function renderBackgroundf(){
    gl.useProgram(backgroundProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, b_vtBuffer);
    gl.vertexAttribPointer(b_aVertexPosition, 2, gl.FLOAT, false, b_vtSize * 4, 0);
    gl.enableVertexAttribArray(b_aVertexPosition);
    gl.vertexAttribPointer(b_vTextureCoordinate, 2, gl.FLOAT, false, b_vtSize * 4, b_vtSize * 2);
    gl.enableVertexAttribArray(b_vTextureCoordinate);
    gl.uniform1i(b_uBgTexture1, 1);
    gl.uniform1i(b_uBgTexture2, 2);
    gl.uniform1f(b_radio, 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, b_vertices_number);
}

function renderBackgroundr(radio){
    gl.useProgram(backgroundProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, b_vtBuffer);
    gl.vertexAttribPointer(b_aVertexPosition, 2, gl.FLOAT, false, b_vtSize * 4, 0);
    gl.vertexAttribPointer(b_vTextureCoordinate, 2, gl.FLOAT, false, b_vtSize * 4, b_vtSize * 2);
    gl.uniform1f(b_radio, radio);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, b_vertices_number);
}

//-------------------------------------------------------------------------------------------------------------
//  normal rendering
//-------------------------------------------------------------------------------------------------------------
function renderMysteriousObjectf(){
    //switch to shaders used for normal rendering
    gl.useProgram(normalProgram);

    gl.uniform3fv(n_baseColorAmbient, objBaseColor_ambient);
    gl.uniform3fv(n_baseColorDiffuse, objBaseColor_diffuse);
    gl.uniform3fv(n_baseColorSpecular, objBaseColor_specular);
    gl.uniform3fv(n_warmLightDir, warmLightDir);
    gl.uniform3fv(n_warmLightColor, warmLightColor);
    gl.uniform3fv(n_coldLightDir, coldLightDir);
    gl.uniform3fv(n_coldLightColor, coldLightColor);
    gl.uniform3fv(n_ambientLightColor, ambientLightColor);

    gl.uniform1f(n_shininess, 8.0);
    gl.uniform3fv(n_eyeCd, eyeCoord);

    //upload shadow mvp matrix
    gl.uniformMatrix4fv(n_uShadowMVP, false, shadowMVPMatrix);
    //upload shadow map
    //link the texture2D of gl.TEXTURE0 (by specifying 0 as the second argument) to n_uShadowMap
    gl.uniform1i(n_uShadowMap, 0);
    gl.uniform1fv(n_pcfOffsets, pcfOffsets);


    gl.uniformMatrix4fv(n_uObjMPV, false, MVPMatrix);
    gl.uniformMatrix3fv(n_uNormalM, false, normalMatrix);

    // draw the mysterious object
    // upload vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, m_vertexBuffer);
    gl.vertexAttribPointer(n_aVertexPosition, 3, gl.FLOAT, false, 0, 0);
    //will need to manually enable a attribute array
    gl.enableVertexAttribArray(n_aVertexPosition);

    //upload normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, m_normalsBuffer);
    gl.vertexAttribPointer(n_aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(n_aNormal);

    //bind the element buffer and draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m_elementBuffer);
    gl.drawElements(gl.TRIANGLES, m_indices_number, gl.UNSIGNED_SHORT, 0);
}

function renderMysteriousObjectr(){
    gl.useProgram(normalProgram);

    gl.uniformMatrix4fv(n_uShadowMVP, false, shadowMVPMatrix);
    gl.uniformMatrix4fv(n_uObjMPV, false, MVPMatrix);

    gl.uniformMatrix3fv(n_uNormalM, false, normalMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, m_vertexBuffer);
    gl.vertexAttribPointer(n_aVertexPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, m_normalsBuffer);
    gl.vertexAttribPointer(n_aNormal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m_elementBuffer);
    gl.drawElements(gl.TRIANGLES, m_indices_number, gl.UNSIGNED_SHORT, 0);
}

//-------------------------------------------------------------------------------------------------------------
//  wall rendering
//-------------------------------------------------------------------------------------------------------------
function renderWallf(){
    gl.useProgram(wallProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, w_vertexBuffer);

    gl.vertexAttribPointer(w_aVertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(w_aVertexPosition);

    gl.uniformMatrix4fv(w_uObjMVP, false, wallMVPMatrix);
    gl.uniformMatrix4fv(w_uShadowMVP, false, wallShadowMVPMatrix);

    gl.uniform1i(w_uShadowMap, 0);
    gl.uniform1fv(w_pcfOffsets, pcfOffsets);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w_elementBuffer);
    gl.drawElements(gl.TRIANGLES, w_indices_number, gl.UNSIGNED_SHORT, 0);
}

function renderWallr(){
    gl.useProgram(wallProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, w_vertexBuffer);

    gl.vertexAttribPointer(w_aVertexPosition, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, w_elementBuffer);
    gl.drawElements(gl.TRIANGLES, w_indices_number, gl.UNSIGNED_SHORT, 0);
}

function initStats(){
    var stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    $("#Stats-output").append(stats.domElement);
    return stats;
}

// var stats = initStats();

//axis and matrices for static rotation
var staticRotateAxisInWorldSpace = vec3.create();
vec3.subtract(staticRotateAxisInWorldSpace, shadowEyeCoord, shadowEyeLookAt);

var m_modelMatrixInverse = mat4.create();
var staticRotateAxisInModelSpace = vec3.create();

//pointers used to tell whether player has passed the current level
// var expectedPointerOneColor = vec4.fromValues(0, 1, 0, 1);
// var expectedPointerTwoColor = vec4.fromValues(1, 1, 0, 1);
// var currentPointerOneColor = vec4.fromValues(1, 0, 0, 1);
// var currentPointerTwoColor = vec4.fromValues(0, 1, 1, 1);
// var epMVPMatrix = mat4.create(); //mvp matrix for expected pointer
// mat4.multiply(epMVPMatrix, VPMatrix, mat4.create());
//
// var originalPointerDirOne = vec3.fromValues(0, 1, 0);
// var originalPointerDirTwo = vec3.fromValues(1, 0, 0);
// var currentPointerDirOne = vec3.create();
// var currentPointerDirTwo = vec3.create();
// var expectedPointerDirOne = vec3.create();
// var expectedPointerDirTwo = vec3.create();
// vec3.copy(expectedPointerDirOne, originalPointerDirOne);
// vec3.copy(expectedPointerDirTwo, originalPointerDirTwo);

function updateUniformsf(){
    //calculate mvp matrix
    mat4.multiply(MVPMatrix, VPMatrix, m_modelMatrix);

    //calculate normal matrix
    mat3.normalFromMat4(normalMatrix, m_modelMatrix);

    //calculate the shadow mvp matrix and upload it
    mat4.multiply(shadowMVPMatrix, shadowVPMatrix, m_modelMatrix);
}

var bgTransition = new Transition(1000, 0.0, 0.0, 0.317, 1.256, 1.23, 1.332, 3.0, 0.0);
var bgRadio = 0.0;
function updateUniformsr(){
    if(deltaVerticalAngle !== 0 || deltaHorizontalAngle !==0) {
        if(!isStaticRotation) {
            mat4.rotateX(m_modelMatrix, m_modelMatrix, deltaVerticalAngle);
            mat4.rotateY(m_modelMatrix, m_modelMatrix, deltaHorizontalAngle);
        } else {
            mat4.invert(m_modelMatrixInverse, m_modelMatrix);
            vec3.transformMat4(staticRotateAxisInModelSpace, staticRotateAxisInWorldSpace, m_modelMatrixInverse);
            mat4.rotate(m_modelMatrix, m_modelMatrix, deltaVerticalAngle, staticRotateAxisInModelSpace);
        }

        //calculate mvp matrix
        mat4.multiply(MVPMatrix, VPMatrix, m_modelMatrix);

        //calculate normal matrix
        mat3.normalFromMat4(normalMatrix, m_modelMatrix);

        //calculate the shadow mvp matrix and upload it
        mat4.multiply(shadowMVPMatrix, shadowVPMatrix, m_modelMatrix);
    }

    if(bgTransition.isRunning){
        bgRadio = bgTransition.getValue(false, true).y;
    }
}

var deltaVerticalAngle = 0, deltaHorizontalAngle = 0; //delta angle x, delta angle y
var mouseStartX = 0, mouseStartY = 0;
var mouseX = 0, mouseY = 0;
var maxAngelPerDrag = Math.PI * 2;

var mouseControl = (function (){

    var dragging = false;

    function mouseMoveEventHandler(event){
        if(dragging) {
            mouseX = event.clientX;
            mouseY = event.clientY;
        }
    }

    function mouseDownEventHandler(event){
        dragging = true;

        mouseStartX = event.clientX;
        mouseStartY = event.clientY;
        mouseX = event.clientX;
        mouseY = event.clientY;
    }

    function mouseUpEventHandler() {
        dragging = false;
    }

    function enableControl(){
        dragging = false;
        gui.addEventListener("mousemove", mouseMoveEventHandler);
        gui.addEventListener("mousedown", mouseDownEventHandler);
        window.addEventListener("mouseup", mouseUpEventHandler);
    }

    function disableControl(){
        gui.removeEventListener("mousemove", mouseMoveEventHandler);
        gui.removeEventListener("mousedown", mouseDownEventHandler);
        window.removeEventListener("mouseup", mouseUpEventHandler);
    }

    return {
        enableControl: enableControl,
        disableControl: disableControl
    };
})();

var isStaticRotation = false;

var keyControl = (function(){

    function getKey(evt){
        evt = evt || window.event;
        var charCode = evt.which || evt.keyCode;
        return String.fromCharCode(charCode);
    }

    function keyPressEventHandler(evt){
        if (getKey(evt) == "s") {
            isStaticRotation = !isStaticRotation;
        }
    }

    function enableControl(){
        document.addEventListener("keypress", keyPressEventHandler);
    }

    function disableControl(){
        document.removeEventListener("keypress", keyPressEventHandler);
    }

    return {
        enableControl: enableControl,
        disableControl: disableControl
    }

})();

var resumePlaying = (function(){
    var isFirstTime = true;

    function p(){
        isStaticRotation = false;
        mouseControl.enableControl();
        keyControl.enableControl();

        if(isFirstTime) {
            isFirstTime = false;
            drawf();
        } else {
            drawr();
        }
    }

    return p;
})();

function stopPlaying(){
    mouseControl.disableControl();
    keyControl.disableControl();
}

function drawBackground(){
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, viewportWidth, viewportHeight);
    renderBackgroundf();

    gl.enable(gl.DEPTH_TEST);
}

function drawf(){
    updateUniformsf();

    drawBackground();

    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFrameBuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, shadowViewPortWidth, shadowViewPortHeight);
    renderShadowMapf();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, viewportWidth, viewportHeight);
    renderMysteriousObjectf();

    // renderPointerf();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    renderWallf();

    gl.disable(gl.BLEND);

    drawr();
}

function drawr(){
    requestAnimationFrame(drawr);

    deltaVerticalAngle = ((mouseY - mouseStartY) / viewportHeight) * maxAngelPerDrag;
    deltaHorizontalAngle = ((mouseX - mouseStartX) / viewportWidth) * maxAngelPerDrag;

    mouseStartX = mouseX;
    mouseStartY = mouseY;

    updateUniformsr();

    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, viewportWidth, viewportHeight);
    renderBackgroundr(bgRadio);

    gl.enable(gl.DEPTH_TEST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFrameBuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, shadowViewPortWidth, shadowViewPortHeight);
    renderShadowMapr();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, viewportWidth, viewportHeight);
    renderMysteriousObjectr();

    // renderPointerr();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    renderWallr();

    gl.disable(gl.BLEND);
}

var startDrawingIfPrepared = (function(){
    var count = 6;
    return function(){
        --count;
        if(count === 0) {
            drawBackground();
        }
    }
})();

function init(){
    //common settings
    //there is no need to draw back faces
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    //do remember to update the count in `startDrawingIfPrepared` if the following lines are modified.
    loadShadersAndCreateProgram("shaders/mysObjVertex.glsl", "shaders/mysObjFrag.glsl", createNormalProgram, startDrawingIfPrepared);
    loadShadersAndCreateProgram("shaders/shadowVertex.glsl", "shaders/shadowFrag.glsl", createShadowProgram, startDrawingIfPrepared);
    loadShadersAndCreateProgram("shaders/wallVertex.glsl", "shaders/wallFrag.glsl", createWallProgram, startDrawingIfPrepared);
    loadShadersAndCreateProgram("shaders/bgVertex.glsl", "shaders/bgFrag.glsl", createBackgroundProgram, startDrawingIfPrepared);
    // loadShadersAndCreateProgram("shaders/lineVertex.glsl", "shaders/lineFrag.glsl", createLineProgram, startDrawingIfPrepared);
    loadBackgroundImage(startDrawingIfPrepared);
    loadSceneModelData(startDrawingIfPrepared);
}

function loadShadersAndCreateProgram(vertexShaderPath, fragmentShaderPath, createProgramCallback, doneCallback) {
    var vertexShader, fragmentShader;
    $.get(vertexShaderPath, function(s){
        vertexShader = s;
        if(vertexShader && fragmentShader) {
            createProgramCallback(vertexShader, fragmentShader);
            doneCallback();
        }
    });

    $.get(fragmentShaderPath, function(s){
        fragmentShader = s;
        if(vertexShader && fragmentShader) {
            createProgramCallback(vertexShader, fragmentShader);
            doneCallback();
        }
    });
}

function loadBackgroundImage(doneCallback){
    var img1 = false, img2 = false;
    var bgImg1 = new Image();
    var bgImg2 = new Image();

    bgImg1.onload = function(){
        img1 = true;
        tryStart();
    };

    bgImg2.onload = function(){
        img2 = true;
        tryStart();
    };

    function tryStart(){
        if(img1 && img2){
            setupBackgroundTexture(bgImg1, bgImg2);
            doneCallback();
        }
    }

    bgImg1.src="materials/bg.png";
    bgImg2.src="materials/bg2.png";
}

function loadSceneModelData(doneCallback){
    $.get("models/scene/scene.obj", function(dataStr) {
        setupSceneBuffers(dataStr);
        doneCallback();
    });
}

//-------------------------------------------------------------------------------------------------------------
//  debug
//-------------------------------------------------------------------------------------------------------------
// var lineOneBuffer = gl.createBuffer();
// var lineOneVertices = new Float32Array([0, 0, 0, 0, 30.0, 0]);
// gl.bindBuffer(gl.ARRAY_BUFFER, lineOneBuffer);
// gl.bufferData(gl.ARRAY_BUFFER, lineOneVertices, gl.STATIC_DRAW);
//
// var lineTwoBuffer = gl.createBuffer();
// var lineTwoVertices = new Float32Array([0, 0, 0, 30.0, 0, 0]);
// gl.bindBuffer(gl.ARRAY_BUFFER, lineTwoBuffer);
// gl.bufferData(gl.ARRAY_BUFFER, lineTwoVertices, gl.STATIC_DRAW);
//
// var lineProgram;
// var l_aVertexPosition, l_uObjMVP, l_color;
// function createLineProgram(vertexShaderSrc, fragmentShaderSrc){
//     lineProgram = createProgram("#line-vertex", "#line-frag", vertexShaderSrc, fragmentShaderSrc);
//     l_aVertexPosition = gl.getAttribLocation(lineProgram, "aVertexPosition");
//     l_uObjMVP = gl.getUniformLocation(lineProgram, "uObjMVP");
//     l_color = gl.getUniformLocation(lineProgram, "lineColor");
// }

// function renderPointerf(){
//     console.log(lineProgram);
//     gl.lineWidth(4);
//
//     gl.useProgram(lineProgram);
//     gl.enableVertexAttribArray(l_aVertexPosition);
//
//     gl.uniformMatrix4fv(l_uObjMVP, false, epMVPMatrix);
//
//     gl.bindBuffer(gl.ARRAY_BUFFER, lineOneBuffer);
//     gl.vertexAttribPointer(l_aVertexPosition, 3, gl.FLOAT, false, 0, 0);
//
//     gl.uniform4fv(l_color, expectedPointerOneColor);
//     gl.drawArrays(gl.LINES, 0, 2);
//     gl.uniform4fv(l_color, currentPointerOneColor);
//     gl.drawArrays(gl.LINES, 0, 2);
//
//
//     gl.bindBuffer(gl.ARRAY_BUFFER, lineTwoBuffer);
//     gl.vertexAttribPointer(l_aVertexPosition, 3, gl.FLOAT, false, 0, 0);
//
//     gl.uniform4fv(l_color, expectedPointerTwoColor);
//     gl.drawArrays(gl.LINES, 0, 2);
//     gl.uniform4fv(l_color, currentPointerTwoColor);
//     gl.drawArrays(gl.LINES, 0, 2);
// }
//
// function renderPointerr(){
//     gl.useProgram(lineProgram);
//     gl.bindBuffer(gl.ARRAY_BUFFER, lineOneBuffer);
//
//     gl.vertexAttribPointer(l_aVertexPosition, 3, gl.FLOAT, false, 0, 0);
//
//     gl.bindBuffer(gl.ARRAY_BUFFER, lineOneBuffer);
//     gl.vertexAttribPointer(l_aVertexPosition, 3, gl.FLOAT, false, 0, 0);
//
//     gl.uniformMatrix4fv(l_uObjMVP, false, MVPMatrix);
//     gl.uniform4fv(l_color, currentPointerOneColor);
//     gl.drawArrays(gl.LINES, 0, 2);
//
//     gl.uniformMatrix4fv(l_uObjMVP, false, epMVPMatrix);
//     gl.uniform4fv(l_color, expectedPointerTwoColor);
//     gl.drawArrays(gl.LINES, 0, 2);
//
//     gl.bindBuffer(gl.ARRAY_BUFFER, lineTwoBuffer);
//     gl.vertexAttribPointer(l_aVertexPosition, 3, gl.FLOAT, false, 0, 0);
//
//     gl.uniformMatrix4fv(l_uObjMVP, false, MVPMatrix);
//     gl.uniform4fv(l_color, currentPointerTwoColor);
//     gl.drawArrays(gl.LINES, 0, 2);
//
//     gl.uniformMatrix4fv(l_uObjMVP, false, epMVPMatrix);
//     gl.uniform4fv(l_color, expectedPointerOneColor);
//     gl.drawArrays(gl.LINES, 0, 2);
// }

init();
