const path = require('path');

module.exports = {
    entry: './src/menu.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js'
    },
    mode: 'development'
};