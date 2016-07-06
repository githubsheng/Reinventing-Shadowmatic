// OBJDoc object
// Constructor
// it assumes that the vertices using 3DS Max default coordinate system. When exporting to obj file, "flipYZ axis" option is not
// selected.
var OBJDoc = function() {
    this.objects = new Array(0);   // Initialize the property for Object
    this.vertices = new Array(0);  // Initialize the property for Vertex
    this.normals = new Array(0);   // Initialize the property for Normal
};

// Parsing the OBJ file
OBJDoc.prototype.parse = function(fileString, scale) {
    var lines = fileString.split('\n');  // Break up into lines and store them as array
    lines.push(null); // Append null. So that if I find null I will know that I have reached the end..
    var index = 0;    // Initialize index of line.

    //define the default values here.
    scale = scale || 1;
    var currentObject = null;

    // Parse line by line
    var line;         // A string in the line to be parsed
    var sp = new StringParser();  // Create StringParser
    while ((line = lines[index++]) != null) {
        sp.init(line);                  // init StringParser
        var command = sp.getWord();     // Get command
        if (command === null)
            continue;  // check null command, or more precisely, a line that has no words....

        switch (command) {
            case '#':
                continue;  // Skip comments
            case 'o':
            case 'g':   // Read Object name
                //create a object, and set its name...an object is basically a collection of faces. 
                //and of course methods to add faces.
                var object = this.parseObjectName(sp);
                this.objects.push(object);
                currentObject = object;
                continue; // Go to the next line
            case 'v':   // Read vertex
                var vertex = this.parseVertex(sp, scale);
                this.vertices.push(vertex);
                continue; // Go to the next line
            case 'vn':   // Read normal
                var normal = this.parseNormal(sp);
                this.normals.push(normal);
                continue; // Go to the next line
            case 'f': // Read face
                var face = this.parseFace(sp);
                currentObject.addFace(face); //it not only adds the face to the object but also updates the object's 'numberIndices'
                continue; // Go to the next line
            case 'usemtl': // Read Material name
                continue; // Go to the next line
        }
    }

    return true;
};

OBJDoc.prototype.parseObjectName = function(sp) {
    var name = sp.getWord();
    return (new OBJObject(name));
};

OBJDoc.prototype.parseVertex = function(sp, scale) {
    var x = sp.getFloat() * scale; //getFloat: get a word and parse it to a float...
    var z = 0 - sp.getFloat() * scale; //in 3ds max y axis is equivalent to the opposite of z axis in opengl.
    var y = sp.getFloat() * scale; // in 3ds max z axis is equivalent to y axis in opengl
    return (new Vertex(x, y, z));
};

OBJDoc.prototype.parseNormal = function(sp) {
    var x = sp.getFloat();
    var z = 0 - sp.getFloat();
    var y = sp.getFloat();
    return (new Normal(x, y, z));
};

OBJDoc.prototype.parseFace = function(sp) {
    var face = new Face();
    // get indices
    while(true) {
        var word = sp.getWord();
        if (word === null)
            break;
        var subWords = word.split('/');

        var vi = parseInt(subWords[0]) - 1;
        face.vIndices.push(vi);

        var ni = parseInt(subWords[2]) - 1;
        face.nIndices.push(ni);
    }

    face.numIndices = face.vIndices.length;
    return face;
};

//------------------------------------------------------------------------------
// Retrieve the information for drawing 3D model
//------------------------------------------------------------------------------
OBJDoc.prototype.getDrawingInfo = function() {
    // Create an arrays for vertex coordinates, normals, colors, and indices


    var r = {};

    // Set vertex, normal and color
    for (var i = 0; i < this.objects.length; i++) {
        var w = 0;
        var object = this.objects[i];

        var numIndices = object.numIndices;
        var numVertices = numIndices;
        var vertices = new Float32Array(numVertices * 3);
        var normals = new Float32Array(numVertices * 3);
        var indices = new Uint16Array(numIndices);

        for (var j = 0; j < object.faces.length; j++) {
            var face = object.faces[j];
            for (var k = 0; k < face.vIndices.length; k++) {
                // Set index
                indices[w] = w;
                // Copy vertex
                var vIdx = face.vIndices[k];
                var vertex = this.vertices[vIdx];
                vertices[w * 3] = vertex.x;
                vertices[w * 3 + 1] = vertex.y;
                vertices[w * 3 + 2] = vertex.z;
                // Copy normal
                var nIdx = face.nIndices[k];
                var normal = this.normals[nIdx];
                normals[w * 3] = normal.x;
                normals[w * 3 + 1] = normal.y;
                normals[w * 3 + 2] = normal.z;

                w++;
            }
        }
        console.log(object.name);
        r[object.name] = new DrawingInfo(vertices, normals, indices);

    }

    return r;
};


//------------------------------------------------------------------------------
// Vertex Object
//------------------------------------------------------------------------------
var Vertex = function(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
};

//------------------------------------------------------------------------------
// Normal Object
//------------------------------------------------------------------------------
var Normal = function(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
};

//------------------------------------------------------------------------------
// OBJObject Object
//------------------------------------------------------------------------------
var OBJObject = function(name) {
    this.name = name;
    this.faces = new Array(0);
    this.numIndices = 0;
};

OBJObject.prototype.addFace = function(face) {
    this.faces.push(face);
    this.numIndices += face.numIndices;
};

//------------------------------------------------------------------------------
// Face Object
//------------------------------------------------------------------------------
var Face = function() {
    this.vIndices = new Array(0);
    this.nIndices = new Array(0);
};

//------------------------------------------------------------------------------
// DrawInfo Object
//------------------------------------------------------------------------------
var DrawingInfo = function(vertices, normals, indices) {
    this.vertices = vertices;
    this.normals = normals;
    this.indices = indices;
};

//------------------------------------------------------------------------------
// Constructor
//------------------------------------------------------------------------------
var StringParser = function(str) {
    this.str;   // Store the string specified by the argument
    this.index; // Position in the string to be processed
    this.init(str);
};
// Initialize StringParser object
StringParser.prototype.init = function(str) {
    this.str = str;
    this.index = 0;
};

/**
 * Skip delimiters
 * @returns the index (in the line, or in the string) of the next none delimiter letter.
 */
StringParser.prototype.skipDelimiters = function() {
    for (var i = this.index, len = this.str.length; i < len; i++) {
        var c = this.str.charAt(i);
        // Skip TAB, Space, '(', ')
        if (c == '\t' || c == ' ' || c == '(' || c == ')' || c == '"')
            continue;
        break;
    }
    this.index = i;
};

// Skip to the next word
StringParser.prototype.skipToNextWord = function() {
    this.skipDelimiters();
    var n = getWordLength(this.str, this.index);
    this.index += (n + 1);
};

// Get word
StringParser.prototype.getWord = function() {
    this.skipDelimiters();
    var n = getWordLength(this.str, this.index);
    if (n === 0)
        return null; //return null if there is no more word after skipping delimiters....
    //Trimming is needed cos I found some weird symbol that is either tab, white space or anything else
    //appended at the end of a line in some cases.
    //To be more precisely, this weird symbol is appended at each line of "indices".
    //The lucky thing is that the symbol can be removed by trim().
    var word = this.str.substr(this.index, n).trim();
    //we need to increment the index anyway so that next time getword() is called, it starts with the correct index.
    this.index += (n + 1);
    
    if(word === ""){
        //if the weird symbol is trimmed, then the word would equals to an empty string.
        //in this case it is effectively the same as "there is no word", and therefore the method should return null.
        return null;
    }
    
    return word;
};

// Get integer
StringParser.prototype.getInt = function() {
    return parseInt(this.getWord());
};

// Get floating number
StringParser.prototype.getFloat = function() {
    return parseFloat(this.getWord());
};

// Get the length of word
function getWordLength(str, start) {
    var n = 0;
    for (var i = start, len = str.length; i < len; i++) {
        var c = str.charAt(i);
        if (c == '\t' || c == ' ' || c == '(' || c == ')' || c == '"')
            break;
    }
    return i - start;
}
