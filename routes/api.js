var http = require('http');
var ss=require('simple-statistics');
exports.contestResults = function(req, res) {
    if (req.method == 'POST') {
        console.log('got POST of ContestData');
        res.statusCode = 200;
        res.end('accepted ContestData, processing');
        var newContestData = req.body;
        delete newContestData['id'];
        delete newContestData['_id'];
        console.log("Got ContestData: " + JSON.stringify(newContestData));
        global.model.contestData.findOneAndUpdate({"contestID": req.params.id}, newContestData,{upsert:true},function(err, updated) {
            if (err !== null) {
                console.log(err);
                return;
            }
            global.io.sockets.emit('contestChanged', req.params.id);
        });
    } else {
        global.model.contestData.findOne({"contestID": req.params.id}, function(err, contest) {
            if (err !== null) {
                res.statusCode = 500;
                res.end('unable to read contest');
                console.log(err);
                return;
            }
            if (contest === null || contest === undefined) {
                res.statusCode = 200;
                res.end('no contest');
                return;
            }
            if (contest.classData[contest.classData.length-1] === null) {
                contest.classData.pop();
            }
            res.json(contest);
        });
    }
}

function sendToPatternScoring(uri, obj) {
    var data = JSON.stringify(obj)
    var options = {
        host: 'www.patternscoring.com',
        port: 80,
        path: uri,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    console.log('POSTing to http://www.patternscoring.com' + uri + ": " + data);
	var req = http.request(options, function(res) {
	    res.setEncoding('utf8');
	    res.on('data', function (chunk) {
	        console.log("response from patternScoring: " + chunk);
	    });
	});

	req.write(data);
	req.end();
};


exports.updatePatternScoringCom = function updatePatternScoringCom(data) {
    global.model.contestData.findOne({"contestID": data}, function(err, contest) {
        if (err != null) {
            console.log('unable to update patternScoring.com, cannot read contest: ' + data + ':' + err);
            return;
        }
        if (contest == null) {
            console.log('unable to update patternScoring.com, cannot find contest: ' + data);
            return;
        }
        delete contest['_id'];
        delete contest['id'];
        sendToPatternScoring('/api/contest/' + data, contest);
        global.model.contestantResult.find({"contestID": data}, function(err, contestants) {
            if (err != null) {
                console.log('unable to update patternScoring.com, no contestantResults found:' + err);
                return;
            }
            if (typeof(contestants) == 'undefined' || contestants === null || contestants.length == 0) {
                console.log('found no contestantResult records');
            }
            for (var i=0; i<contestants.length; i++) {
                var item = contestants[i];
                var uri = "/api/contest/" + data + "/class/" + item.className + "/contestant/" + item.amaNumber;
                console.log('found contestantResult: ' + uri);
                delete item["_id"];
                delete item["id"];
                sendToPatternScoring(uri, item);
            }
        });
    });
};

exports.contestChange = function(socket) 
{

};

exports.contestantAllResults = function(req, res) {
    console.log("got request for all results for contestant: " + req.params.amaid + " in class: " + req.params.classcode);
    model.contestantResult.find({"amaNumber": req.params.amaid, "className":req.params.classcode}, function(err, results) {
        if (err !== null) {
            res.statusCode = 500;
            res.end('unable to get all results for ' + req.params.amaid + ' in class ' + req.params.classcode);
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
                        for (var r = 0; r < maneuver.flights.length; r++) {
                            for (var j = 0; j < maneuver.flights[r].JudgeManeuverScores.length; j++) {
                                var score = maneuver.flights[r].JudgeManeuverScores[j].score;
                                scoreArray.push(score);
                                allScores.push(score);
                                maneuverData[m].push(score);
                            }
                        }
                    }
                    contestManeuverData[m].push([i, ss.mean(scoreArray)]);
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
        res.json({
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
        });
    });

}
exports.contestantResults = function(req, res) {
    if (req.method == 'POST') {
        console.log("got POST of contestantResult: ");
        delete req.body['_id'];
        delete req.body['id'];
        console.log("Got ContestData: " + JSON.stringify(req.body));
        res.statusCode = 200;
        res.end('contestantResult received, processing');
        var newContestantResult = req.body;
        global.model.contestantResult.findOneAndUpdate({"contestID": req.params.id, "amaNumber": req.params.amaid, "className": req.params.classcode}, newContestantResult, {upsert: true}, function (err, updated) {
            if (err !== null) {
                console.log(err);
            }
        });
    } else {
        console.log('got request for contestant results: {"contestID":"' + req.params.id + '","amaNumber":"'+ req.params.amaid + '","className":"' + req.params.classcode +'"}');
        global.model.contestantResult.findOne({"contestID":req.params.id, "amaNumber":req.params.amaid, "className":req.params.classcode}, function(err, res1) {
            var result = res1.toObject();
            if (err !== null) {
                res.statusCode = 500;
                res.end('unable to find contestant detailed results for ' + req.params.amaid);
                console.log(err);
                return;
            }
            if (result === null && req.method==='GET') {
                console.log('got empty result');
                res.statusCode = 200;
                res.end('no results');
                return;
            }
            for (var s=0; s<result.schedules.length; s++) {
                (function(s) {
                    var scoreCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                    var overallAvgDiff = [];
                    var maneuverAvg = [];
                    var maneuverVariance = [];
                    var opponentAvg = [];
                    var maneuverKAvg = [];
                    var opponentKAvg = [];
                    var maneuverStdDev = [];
                    var kFactorAvg = [
                        {"kfactor": 1, "tot": 0, "count": 0},
                        {"kfactor": 2, "tot": 0, "count": 0},
                        {"kfactor": 3, "tot": 0, "count": 0},
                        {"kfactor": 4, "tot": 0, "count": 0},
                        {"kfactor": 5, "tot": 0, "count": 0},
                        {"kfactor": 6, "tot": 0, "count": 0}
                    ];
                    var maneuverNames = [];
                    var maneuverRealNames = [];
                    var maneuverKFactor = [];
                    var sched = result.schedules[s];
                    sched.opponentAverages = opponentAvg;
                    sched.opponentKAverages = opponentKAvg;
                    sched.maneuverKAverages = maneuverKAvg;
                    for (var m = 0; m < sched.maneuvers.length; m++) {
                        console.log("maneuver: " + m);
                        var mTot = 0;
                        var mCount = 0;
                        var maneuver = sched.maneuvers[m];
                        if (maneuver != null) {
                            var maneuverData = [];
                            for (var r = 0; r < maneuver.flights.length; r++) {
                                console.log('flight: ' + r);
                                for (var j = 0; j < 2; j++) {
                                    console.log('judge: ' + j);
                                    var score = maneuver.flights[r].JudgeManeuverScores[j].score;
                                    maneuverData.push(score);
                                    scoreCount[score * 2]++;
                                    var kfAvg = kFactorAvg[maneuver.kfactor - 1];
                                    kfAvg.tot += score;
                                    kfAvg.count++;
                                    mTot += score;
                                    mCount++;
                                }
                            }
                            maneuverAvg[m] = ss.mean(maneuverData);
                            maneuverStdDev[m]  = ss.standard_deviation(maneuverData);
                            maneuverVariance[m] = ss.variance(maneuverData);
                            maneuverKAvg[m] = maneuverAvg[m] * maneuver.kfactor;
                            maneuverKFactor[m] = maneuver.kfactor;
                            maneuverNames[m] = m + 1;
                            maneuverRealNames[m] = maneuver.name;
                        }
                    }
                    console.log("kFactorAvg length = " + kFactorAvg.length);
                    while (kFactorAvg[kFactorAvg.length - 1].count == 0) {
                        kFactorAvg.pop();
                        console.log("kFactorAvg length = " + kFactorAvg.length);
                    }
                    sched.kFactorAverages = kFactorAvg;
                    sched.scoreCount = scoreCount;
                    sched.maneuverNames = maneuverNames;
                    sched.maneuverStdDev = maneuverStdDev;
                    sched.maneuverVariances = maneuverVariance;
                    sched.maneuverRealNames = maneuverRealNames;
                    sched.maneuverAverages = maneuverAvg;
                    sched.overallAvg = ss.mean(maneuverAvg);
                    sched.maneuverDiff = [];
                    for (var m = 0; m < sched.maneuvers.length; m++) {
                        sched.maneuverDiff[m] = (maneuverAvg[m] - sched.overallAvg) * maneuverKFactor[m];
                    }

                    console.log('get opponent results: {"contestID":"' + req.params.id + '","finalPlacement":"1","className":"' + req.params.classcode + '"}');
                    global.model.contestantResult.findOne({"contestID": req.params.id, "finalPlacement": "1", "className": req.params.classcode}, function (err, opponent) {
                        if (err != null) {
                            console.log('unable to find contestant detailed results #1 in class:' + result.className + ' -- err: ' + err);
                        } else if (opponent === null || opponent.schedules === null || opponent.schedules[0] === null || opponent.schedules[0].maneuvers === null) {
                            console.log('got empty results for opponent');
                        } else {
                            console.log('got #1 opponent: ' + opponent.amaNumber);
                            for (var m = 0; m < opponent.schedules[0].maneuvers.length; m++) {
                                var mTot = 0;
                                var mCount = 0;
                                var maneuver = opponent.schedules[0].maneuvers[m];
                                if (maneuver != null) {
                                    for (var r = 0; r < maneuver.flights.length; r++) {
                                        for (var j = 0; j < 2; j++) {
                                            var score = maneuver.flights[r].JudgeManeuverScores[j].score;
                                            mTot += score;
                                            mCount++;
                                        }
                                    }
                                    opponentAvg[m] = mTot / mCount;
                                    opponentKAvg[m] = opponentAvg[m] * maneuver.kfactor;
                                    opponentAvg[m] = opponentAvg[m].toPrecision(3);
                                    opponentKAvg[m] = opponentKAvg[m].toPrecision(3);
                                }
                            }
                            sched.opponentAverages = opponentAvg;
                            result.schedules[s] = sched;
                            res.json(result);
                        }
                    });
                })(s);
            }
        });
    }
};


exports.contestList = function(req, res) {
    var query = {'location':{$not: /test/i}};
    if (req.query.includeTest == '1') {
        query = {};
    }
    global.model.contestData.find(query, 'contestID location district', function(err, contests) {
        console.log('contestList query callback');
        if (err != null) {
            res.statusCode = 500;
            res.end('error querying contestData collection');
            console.log(err);
            return;
        }
        res.json(contests);
    });
};

exports.addPilotTimeStamp = function(req, res) {
    global.model.pilot.find({}, function(err, pilots) {
        if (err != null) {
            res.statusCode = 500;
            res.end('error querying for pilots: ' + err);
            console.log(err);
            return;
        }
        for (var i=0; i<pilots.length; i++) {
            var pilot = pilots[i];
            pilot.TimeStamp = new Date;
            pilot.save(function(err, saved) {
                if (err !== null) {
                    console.log('error saving: ' + err);
                } else {
                    console.log('saved: ');
                }
            });
        }
        res.json(pilots);
    });
}
