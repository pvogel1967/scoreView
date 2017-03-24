/**
 * Created by pvogel on 9/27/2014.
 */
var mongoose = require('mongoose');
var Q = require('q');
var ss=require('simple-statistics');
var mongoConnectionString = "mongodb://patternscoring:patternscoring@candidate.20.mongolayer.com:10104/patternscoring";
var model = require('./model/model');
mongoose.connect(mongoConnectionString);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    model.contestantResult.find({"amaNumber": "L732", "realClassName":"Intermediate (2015)"}, function(err, results) {
        if (err !== null) {
            //res.statusCode = 500;
            //res.end
            //console.log('unable to get all results for ' + req.params.amaid + ' in class ' + req.params.classcode);
	    console.log('error from contestantResult.find: ' + err);
        }
        var maneuverData = [];
        var contestManeuverData = [];
        var maneuverNames = [];
        var maneuverKFactor = [];
        var maneuverAvg = [];
        var maneuverMin = [];
        var maneuverMax = [];
        var maneuverRange = [];
        var maneuverStdDev = [];
        var allScores = [];
        var maneuverLRm = [];
        var maneuverLRb = [];
        if (results.count < 1) {
            res.statusCode = 404;
            res.end("no results found");
        }
        var first = results[0];
        var sched = first.schedules[0];
        for (var m = 0; m < sched.maneuvers.length; m++) {
            var maneuver = sched.maneuvers[m];
            maneuverKFactor[m] = maneuver.kfactor;
            maneuverNames[m] = maneuver.name;
            maneuverData[m] = [];
            contestManeuverData[m] = [];
        }
        for (var i=0; i<results.length; i++) {
            var result = results[i];
            sched = result.schedules[0];
            if (sched !== undefined && sched !== null) {
                for (m = 0; m < sched.maneuvers.length; m++) {
                    var scoreArray = [];
                    var maneuver = sched.maneuvers[m];
                    if (maneuver != null) {
                        var flightScores = [];
                        for (var r = 0; r < maneuver.flights.length; r++) {
                            for (var j = 0; j < maneuver.flights[r].JudgeManeuverScores.length; j++) {
                                var score = maneuver.flights[r].JudgeManeuverScores[j].score;
                                scoreArray.push(score);
                                allScores.push(score);
                                flightScores.push(score);
                            }
                            maneuverData[m].push(ss.mean(flightScores));
                        }
                    }
                    if (scoreArray.length > 0) {
                        contestManeuverData[m].push([i, ss.mean(scoreArray)]);
                    }
                }
            }

        }
        for (m=0; m<maneuverData.length; m++) {
            maneuverAvg[m] = ss.mean(maneuverData[m]);
            maneuverMin[m] = ss.min(maneuverData[m]);
            maneuverMax[m] = ss.max(maneuverData[m]);
            maneuverRange[m] = maneuverMax[m] - maneuverMin[m];
            maneuverStdDev[m] = ss.standard_deviation(maneuverData[m]);
            var lr = ss.linear_regression()
                .data(contestManeuverData[m]);
            maneuverLRm[m] = lr.m();
            maneuverLRb[m] = lr.b();
        }
        console.log(JSON.stringify({
            'overallAvg':ss.mean(allScores),
            'maneuverNames':maneuverNames,
            'maneuverKFactor':maneuverKFactor,
            'maneuverData':maneuverData,
            'contestManeuverData':contestManeuverData,
            'maneuverAverage':maneuverAvg,
            'maneuverMin': maneuverMin,
            'maneuverMax': maneuverMax,
            'maneuverRange': maneuverRange,
            'maneuverStdDev': maneuverStdDev,
            'maneuverLRm' : maneuverLRm,
            'maneuverLRb' : maneuverLRb
        }));
    });

});

