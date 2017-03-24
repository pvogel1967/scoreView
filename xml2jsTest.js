/**
 * Created by pvogel on 3/29/16.
 */
var fs = require('fs'),
    xml2js = require('xml2js')
    uuid = require('node-uuid');

var parser = new xml2js.Parser({explicitArray: false});
fs.readFile(__dirname + '/foo.xml', function(err, data) {
    parser.parseString(data, function (err, result) {
        //console.dir(result);
        result.contestResultDocument.contestData.contestID = uuid.v4();
        console.dir(result.contestResultDocument.contestData);
        //console.log('Done');
    });
});
