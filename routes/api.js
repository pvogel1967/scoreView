var http = require('http');
var request = require('request');
var ss=require('simple-statistics');
var noPublish = false;

exports.judgeScoresSaved = function (req, res) {
    var className = req.params.className;
    var contestantNum = req.params.contestantNum;
    var round = req.params.round;
    var judgeNum = req.params.judgeNum;
    var data = {
        'className':className,
        'contestant':contestantNum,
        'round':round,
        'judgeId':judgeNum
    }
    console.dir(data);
    var promise = findExistingScoreMatrix(className, contestantNum, round);
    promise.then(function (scoreMatrix) {
        var promise2 = findScoreMatrixRows(scoreMatrix);
        promise2.then(function (rows) {
            var promise3 = findJudgeScoresForMatrix(scoreMatrix, judgeNum);
            promise3.then(function (scores) {
                var MasterScoreImport = {};
                MasterScoreImport['@'] = {'contestId': contestId};
                MasterScoreImport.Contestant = {'@': {'id': contestantNumToContestantId[contestantNum], 'flightNumber': round}};
                MasterScoreImport.Contestant.Judge = {'@': {'personId': judgeNumToPersonId[judgeNum]}};
                MasterScoreImport.Contestant.Judge.Maneuver = [];
                console.log('got ' + scores.length + ' scores');
                for (i = 0; i < scores.length; i++) {
                    if (rows[i] !== undefined && rows[i] !== null && scores[i] !== undefined && scores[i] !== null) {
                        var maneuver = {'@': {'id': rows[i].MasterScoreID, 'score': scores[i].Score}};
                        MasterScoreImport.Contestant.Judge.Maneuver.push(maneuver);
                    }
                }
                var fileName = exportDir + '/' + className + '-' + contestantNum + '-' + round + '-' + judgeNum + '.xml';
                var tmpFile = fileName + ".tmp";
                fs.writeFile(tmpFile, js2xml('MasterScoreImport', MasterScoreImport), function (err) {
                    if (err) {
                        console.log('problem writing XML for scores: ' + err);
                    } else {
                        fs.rename(tmpFile, fileName, function (err) {
                            if (err) {
                                console.log('problem renaming to ' + fileName);
                            } else {
                                console.log('export file written to ' + fileName);
                            }
                        });
                    }
                });
                console.log();
            }).catch(function (error) {
                console.log('error getting judgeScores: ' + error);
            });

        });
    });
    res.json(data);
};

exports.publish = function(req, res) {
    noPublish = false;
    exports.updatePatternScoringCom(req.params.id);
    res.json({publish: !noPublish});
}

exports.nopublish = function(req, res) {
    noPublish = true;
    res.json({publish: !noPublish});
}

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
    if (!noPublish) {
        request({
            url:'http://www.patternscoring.com'+uri,
            method: 'POST',
            json: true,
            body: obj
        }, function(error, response, body) {
            if (error !== null && error !== undefined) {
                console.log('error calling patternscoring.com: ' + error);
            } else {
                console.log('response from patternscoring.com: ' + response.statusCode + ',' + response.body);
            }
        });
    }
};

function scrubContestData(contest) {
    delete contest['_id'];
    delete contest['__v'];
    for (var i=0; i<contest.classData.length; i++) {
        var classData = contest.classData[i];
        delete classData['_id'];
        delete classData['__v'];
        for (var j=0; j<classData.contestants.length; j++) {
            var contestant = classData.contestants[j];
            delete contestant['_id'];
            delete contestant['__v'];
            for (var k=0; k<contestant.scoringData.length; k++) {
                delete contestant.scoringData[k]['_id'];
                delete contestant.scoringData[k]['__v'];
            }
        }
    }
    return contest;
}

function scrubContestantData(contestant) {
    delete contestant['_id'];
    delete contestant['__v'];
    for (var i=0; i<contestant.schedules.length; i++) {
        var sched = contestant.schedules[i];
        delete sched['_id'];
        delete sched['__v'];
        for (var j=0; j<sched.maneuvers.length; j++) {
            var maneuver = sched.maneuvers[j];
            delete maneuver['_id'];
            delete maneuver['__v'];
            for (var k=0; k<maneuver.flights.length; k++) {
                var flight = maneuver.flights[k];
                delete flight['_id'];
                delete flight['__v'];
                for (var s=0; s<flight.JudgeManeuverScores.length; s++) {
                    delete flight.JudgeManeuverScores[s]['_id'];
                    delete flight.JudgeManeuverScores[s]['__v'];
                }
            }
        }
        for (j=0; j<sched.subTotals.length; j++) {
            delete sched.subTotals[j]['_id'];
            delete sched.subTotals[j]['__v'];
        }
        for (j=0; j<sched.flightAverages.length; j++) {
            delete sched.flightAverages[j]['_id'];
            delete sched.flightAverages[j]['__v'];
        }
        for (j=0; j<sched.percentages.length; j++) {
            delete sched.percentages[j]['_id'];
            delete sched.percentages[j]['__v'];
        }
    }
    return contestant;
}

exports.updatePatternScoringCom = function updatePatternScoringCom(data) {
    if (noPublish) {
        return;
    }
    global.model.contestData.findOne({"contestID": data}, function(err, contest) {
        if (err != null) {
            console.log('unable to update patternScoring.com, cannot read contest: ' + data + ':' + err);
            return;
        }
        if (contest == null) {
            console.log('unable to update patternScoring.com, cannot find contest: ' + data);
            return;
        }
        contest = scrubContestData(contest.toObject());
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
                item = scrubContestantData(item.toObject());
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

};

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
        var tmpClassCode = req.params.classcode;
        var classCodeSuffix = '';
        if (req.params.id.length > 5 && tmpClassCode.length > 3) {
            tmpClassCode = tmpClassCode.substr(0,3);
            classCodeSuffix = req.params.classcode.substr(3,1);
        }
        global.model.contestantResult.findOne({"contestID":req.params.id, "amaNumber":req.params.amaid, "className":tmpClassCode}, function(err, res1) {
            if (err !== null) {
                res.statusCode = 500;
                res.end('unable to find contestant detailed results for ' + req.params.amaid);
                console.log(err);
                return;
            }

            if (res1 === null && req.method==='GET') {
                console.log('got empty result');
                res.statusCode = 200;
                res.end('no results');
                return;
            }
            var result = res1.toObject();
            var s = 0;
            if (result.schedules.length > 1 && (classCodeSuffix === 'F' || classCodeSuffix === 'S') ) {
                result.schedules[0] = result.schedules[1];
                result.schedules.length = 1;
            }
            if (result.schedules.length > 1 && (classCodeSuffix === 'P')) {
                result.schedules.length = 1;
            }
            (function(s) {
                    var scoreCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                    var overallAvgDiff = [];
                    var maneuverAvg = [];
                    var maneuverVariance = [];
                    var opponentAvg = [];
                    var maneuverKAvg = [];
                    var opponentKAvg = [];
                    var maneuverStdDev = [];
                    var kFactorAvg = [];
                    for (var avgIndex = 0; avgIndex < 100; avgIndex++) {
                        kFactorAvg[avgIndex] = {"kfactor": avgIndex+1, "tot": 0, "count": 0};
                    }
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
                    console.log("kFactorAvg length before winnowing = " + kFactorAvg.length);
                    for(var avgIndex = kFactorAvg.length - 1; avgIndex >= 0; avgIndex--) {
                        if(kFactorAvg[avgIndex].count === 0) {
                            kFactorAvg.splice(avgIndex, 1);
                            console.log("Removing kFactorAvg at index = " + avgIndex);
                        }
                    }
                    console.log("kFactorAvg final length = " + kFactorAvg.length);
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

                    console.log('get opponent results: {"contestID":"' + req.params.id + '","finalPlacement":"1","className":"' + tmpClassCode + '"}');
                    global.model.contestantResult.findOne({"contestID": req.params.id, "finalPlacement": "1", "className": tmpClassCode}, function (err, opponent) {
                        if (err != null) {
                            console.log('unable to find contestant detailed results #1 in class:' + result.className + ' -- err: ' + err);
                        } else if (opponent === null || opponent.schedules === null || opponent.schedules[0] === null || opponent.schedules[0].maneuvers === null) {
                            console.log('got empty results for opponent');
                        } else {
                            console.log('got #1 opponent: ' + opponent.amaNumber);
                            if (opponent.schedules.length > 1 && classCodeSuffix === 'F') {
                                opponent.schedules[0] = opponent.schedules[1];
                                opponent.schedules.length = 1;
                            }
                            for (var m = 0; m < opponent.schedules[s].maneuvers.length; m++) {
                                var mTot = 0;
                                var mCount = 0;
                                var maneuver = opponent.schedules[s].maneuvers[m];
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
        });
    }
};

function parseContestDate(a) {
    var adate = a.date.split('/');
    if (a.date.length > 10)  {
        adate = a.date.split(' ')[0];
        adate = adate.split('/');
    }
    if (adate[0].length < 2) {
        adate[0] = '0' + adate[0];
    }
    if (adate[1].length < 2) {
        adate[1] = '0' + adate[1];
    }
    return adate[2] + '-' + adate[0] + '-' + adate[1];
}

exports.contestList = function(req, res) {
    var query = {'location':{$not: /test/i}};
    if (req.query.includeTest == '1') {
        query = {};
    }
    global.model.contestData.find(query, 'contestID location district nsrcaDistrict contestName date', function(err, contests) {
        console.log('contestList query callback');
        if (err != null) {
            res.statusCode = 500;
            res.end('error querying contestData collection');
            console.log(err);
            return;
        }
        if (contests.length == 0) {
            res.json(contests);
        }
        contests.sort(function(a,b) {
            return Date.parse(parseContestDate(b)) - Date.parse(parseContestDate(a));
        });

        for (var i=0; i < contests.length; i++) {
            var d = new Date(Date.parse(parseContestDate(contests[i])));
            contests[i].year = d.getFullYear();
        }
        var ret = [];
        ret[0] = {year: contests[0].year, districts:[
            {district:"1", contests:[]},
            {district:"2", contests:[]},
            {district:"3", contests:[]},
            {district:"4", contests:[]},
            {district:"5", contests:[]},
            {district:"6", contests:[]},
            {district:"7", contests:[]},
            {district:"8", contests:[]},
            {district:"Canada", contests:[]}]};
        var retIndex = 0;
        for (var i = 0; i<contests.length; i++) {
            if (contests[i].year != ret[retIndex].year) {
                retIndex++;
                ret[retIndex] = {year:contests[i].year, districts:[
                    {district:"1", contests:[]},
                    {district:"2", contests:[]},
                    {district:"3", contests:[]},
                    {district:"4", contests:[]},
                    {district:"5", contests:[]},
                    {district:"6", contests:[]},
                    {district:"7", contests:[]},
                    {district:"8", contests:[]},
                    {district:"Canada", contests:[]}]};
            }
            var districtIndex = -1;
            for (var j= 0; j < ret[retIndex].districts.length; j++) {
                if (ret[retIndex].districts[j].district === contests[i].nsrcaDistrict) {
                    districtIndex = j;
                    break;
                }
            }
            if (districtIndex > -1) {
                ret[retIndex].districts[districtIndex].contests.push(contests[i].toObject());
            }
        }
        for (var y = 0; y < ret.length; y++) {
            for (var d=ret[y].districts.length-1; d >= 0; --d) {
                if (ret[y].districts[d].contests.length < 1) {
                    ret[y].districts.splice(d, 1);
                }
            }
        }
        res.json(ret);
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
