var spawn = require('child_process').spawn,
    fdf = require("./fdf.js"),
    _ = require('lodash'),
    fs = require('fs');

var pdffiller = {

    mapForm2PDF: function (formFields, convMap) {
        var tmpFDFData = this.convFieldJson2FDF(formFields);
        tmpFDFData = _.mapKeys(tmpFDFData, function (value, key) {
            try {
                convMap[key];
            } catch (err) {

                return key;
            }
            return convMap[key];
        });

        return tmpFDFData;
    },

    convFieldJson2FDF: function (fieldJson) {
        var _keys = _.map(fieldJson, 'title'),
            _values = _.map(fieldJson, 'fieldValue');

        _values = _.map(_values, function (val) {
            if (val === true) {
                return 'Yes';
            } else if (val === false) {
                return 'Off';
            }
            return val;
        });

        var jsonObj = _.zipObject(_keys, _values);

        return jsonObj;
    },

    generateFieldJson: function (sourceFile, nameRegex) {
        var regName = /^FieldName: /,
            regType = /^FieldType: /,
            regFlags = /^FieldFlags: /,
            regValue = /^FieldValue: /,
            fieldArray = [],
            currField = {};

        if (nameRegex !== null && (typeof nameRegex) == 'object') regName = nameRegex;

        return new Promise(function (resolve, reject) {
            var childProcess = spawn("pdftk", [sourceFile, "dump_data_fields_utf8"]);
            var output = '';

            childProcess.on('error', function (err) {
                console.log('pdftk exec error: ' + err);
                reject(err);
            });

            childProcess.stdout.on('data', function (data) {
                output += data;
            });

            childProcess.stdout.on('end', function () {
                var fields = output.split('\n').slice(1);
                fields.forEach(function (line) {
                    if (line.match(regName)) {
                        currField.title = line.substr(line.indexOf(' ') + 1).trim() || '';
                    } else if (line.match(regType)) {
                        currField.fieldType = line.substr(line.indexOf(' ') + 1).trim() || '';
                    } else if (line.match(regFlags)) {
                        currField.fieldFlags = line.substr(line.indexOf(' ') + 1).trim() || '';
                    } else if (line.match(regValue)) {
                        currField.fieldValue = line.substr(line.indexOf(' ') + 1).trim() || '';
                    } else if (line === '---') {
                        currField.fieldValue = currField.fieldValue || '';
                        fieldArray.push(currField);
                        currField = {};
                    }
                });

                if (Object.keys(currField).length) {
                    currField.fieldValue = currField.fieldValue || '';
                    fieldArray.push(currField);
                }

                resolve(fieldArray);
            });

        });
    },

    generateFDFTemplate: function (sourceFile, nameRegex) {
        return new Promise(function (resolve, reject) {

            this.generateFieldJson(sourceFile, nameRegex).then(function (_form_fields) {

                var _keys = _.map(_form_fields, 'title'),
                    _values = _.map(_form_fields, 'fieldValue'),
                    jsonObj = _.zipObject(_keys, _values);

                resolve(jsonObj);

            }).catch(function (err) {

                reject(err);

            });
        }.bind(this));
    },

    fillFormWithOptions: function (sourceFile, fieldValues, shouldFlatten) {

        var promised = new Promise(function (resolve, reject) {

            //Generate the data from the field values.
            var FDFinput = fdf.createFdf(fieldValues);

            var args = [sourceFile, "fill_form", '-', "output", '-'];
            if (shouldFlatten) {
                args.push("flatten");
            }
            
            var childProcess = spawn("pdftk", args);

            childProcess.stderr.on('data', function (err) {
                console.log('pdftk exec error: ' + err);
                reject(err);
            });

	        function sendData (data) {
                childProcess.stdout.pause();
                childProcess.stdout.unshift(data);
                resolve(childProcess.stdout);
                childProcess.stdout.removeListener('data', sendData);
            };

            childProcess.stdout.on('data', sendData);

            // now pipe FDF to pdftk
            childProcess.stdin.write(FDFinput);
            childProcess.stdin.end();
            
        });

        // bind convenience method toFile for chaining
        promised.toFile = toFile.bind(null, promised); 
        return promised;
    },

    fillFormWithFlatten: function (sourceFile, fieldValues, shouldFlatten) {
        return this.fillFormWithOptions(sourceFile, fieldValues, shouldFlatten);
    },

    fillForm: function (sourceFile, fieldValues) {
        return this.fillFormWithFlatten(sourceFile, fieldValues, true);
    },

};

/** 
 * convenience chainable method for writing to a file (see examples)
 **/
function toFile (promised, path) {
    return new Promise(function (resolve, reject) {
        promised.then(function(outputStream) {

            var output = fs.createWriteStream(path);

            outputStream.pipe(output);
            outputStream.on('close', function() {
                output.end();
                resolve();
            });

        }).catch(function (error) {
            reject(error);
        });
    });
}

module.exports = pdffiller;
