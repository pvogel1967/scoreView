var mongoose = require('mongoose');
var Q = require('q');
var model = require('./model/model');
var mongoConnectionString = "mongodb://" + "localhost:27017" + "/" + "patternscoring";
console.log('MongoConnection: ' + mongoConnectionString);
//app.set('mongoConnectionString', mongoConnectionString);
mongoose.connect(mongoConnectionString);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    global.db = db;
    model.contestDataOld.find(function(err, contests) {
        if (err !== null  && err !== undefined) {
            console.log('error getting old contests: ' + err);
            return;
        }
        for (var i=0; i<contests.length; i++) {
            var contest = contests[i];
            var newContest = new model.contestData(contest.toObject());
            newContest.save(function(err) {
                if (err !== null && err !== undefined) {
                    console.log('error saving contest: ' + err);
                    return;
                }
                console.log('saved contest with new schema');
            });
        }
    });
});


