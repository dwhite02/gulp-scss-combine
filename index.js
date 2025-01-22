'use strict';

var fs = require('fs');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');

// Function to find and return valid @import statements (ignores those inside comments)
function findImports(cssText) {
    // Step 1: Remove CSS block comments (/* ... */) and single-line comments (// ...)
    const uncommentedCSS = cssText
        .replace(/\/\*[\s\S]*?\*\//g, '')   // Remove block comments
        .replace(/\/\/[^\n]*/g, '');        // Remove single-line comments

    // Step 2: Match @import statements in the uncommented CSS
    const regex = /@import\s*['"][^'"]+?['"]\s*;?/g;
    const matches = [];
    let match;

    // Find all @import matches
    while ((match = regex.exec(uncommentedCSS)) !== null) {
        matches.push(match[0].trim());
    }

    return matches;
}

// Main function to handle SCSS imports
function scssCombine(content, baseDir) {
    // Step 1: Find and collect valid @import statements
    const validImports = findImports(content);

    // Step 2: Replace each valid @import statement with the contents of the resolved file
    validImports.forEach(function (importStatement) {
        var regex = /@import\s*['"]([^'"]+)['"]\s*;?/;
        var match = importStatement.match(regex);
        if (match) {
            var capture = match[1]; // Extract the import path

            var parse = path.parse(path.resolve(baseDir, capture));
            var file = parse.dir + '/_' + parse.name;

            if (fs.existsSync(file + '.scss')) {
                file = file + '.scss';
            } else if (fs.existsSync(file + '.scss.liquid')) {
                file = file + '.scss.liquid';
            } else {
                // If no file is found, skip this import statement
                return;
            }

            // Step 3: Replace the import statement with the file contents
            content = content.replace(importStatement, fs.readFileSync(file, 'utf8'));
        }
    });

    return content;
}

module.exports = function (opts) {
    return through.obj(function (file, enc, cb) {
        if (file.isNull()) {
            cb(null, file);
            return;
        }

        if (file.isStream()) {
            cb(new gutil.PluginError('gulp-scss-combine', 'Streaming not supported'));
            return;
        }

        if (path.basename(file.path).indexOf('_') === 0) {
            return cb();
        }

        // Call scssCombine to process the file contents
        file.contents = Buffer.from(scssCombine(file.contents.toString(), path.dirname(file.path)));

        setImmediate(cb, null, file);
    });
};
