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

/*
exports.contestantResultsOld = function(req, res)
{
	global.db.collection('ContestantResult', function(err, results) {
		if (err != null) {
			res.statusCode = 500;
			res.end('unable to find contestantResult collection');
			console.log(err);
			return;
		}
		if (results == null) {
			res.statusCode = 500;
			res.end('no contestantResult collection found');
			return;
		}
		if (req.method == 'POST') {
			console.log("got POST of contestantResult: " + req.body);
			res.statusCode = 200;
			res.end('contestantResult received, processing');
			results.findAndModify({"contestID":req.params.id, "amaNumber":req.params.amaid, "className":req.params.classcode},
			[['_id', 'asc']],
			req.body,
			{"upsert":true},
			function(err, result) {
				if (err != null) {
					//res.statusCode = "500";
					//res.end('unable to update contestant results for ' + req.params.amaid);
					console.log(err);
					return;
				}
				//res.json(result);
			});
		} else {
			results.findOne({"contestID":req.params.id, "amaNumber":req.params.amaid, "className":req.params.classcode}, 
				function (err, result) {
				if (err !== null) {
					res.statusCode = 500;
					res.end('unable to find contestant detailed results for ' + req.params.amaid);
					console.log(err);
					return;
				}
				if (result === null && req.method==='GET') {
					console.log('got empty result');
					return;
				}
				for (var s=0; s<result.schedules.length; s++) {
					var scoreCount = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
					var maneuverAvg = [];
					var opponentAvg = [];
					var maneuverKAvg = [];
					var opponentKAvg = [];
					var kFactorAvg = [	{"kfactor":1, "tot":0, "count":0},
										{"kfactor":2, "tot":0, "count":0},
										{"kfactor":3, "tot":0, "count":0},
										{"kfactor":4, "tot":0, "count":0},
										{"kfactor":5, "tot":0, "count":0},
										{"kfactor":6, "tot":0, "count":0}];
					var maneuverNames = [];
					var sched = result.schedules[s];
					sched.opponentAverages = opponentAvg;
					sched.opponentKAverages = opponentKAvg;
					sched.maneuverKAverages = maneuverKAvg;
					for (var m=0; m<sched.maneuvers.length; m++) {
                        console.log("maneuver: " + m);
						var mTot = 0;
						var mCount = 0;
						var maneuver = sched.maneuvers[m];
						if (maneuver != null) {
							for (var r = 0; r<maneuver.flights.length; r++) {
                                console.log('flight: ' + r);
								for (var j = 0; j < 2; j++) {
                                    console.log('judge: ' + j);
									var score = maneuver.flights[r].JudgeManeuverScores[j].score;
									scoreCount[score*2]++;
									var kfAvg = kFactorAvg[maneuver.kfactor-1];
									kfAvg.tot += score;
									kfAvg.count++;
									mTot+=score;
									mCount++;
								}
							}
							maneuverAvg[m] = mTot/mCount;
							maneuverKAvg[m] = maneuverAvg[m] * maneuver.kfactor;
							maneuverAvg[m] = maneuverAvg[m].toPrecision(3);
							maneuverKAvg[m] = maneuverKAvg[m].toPrecision(3);
							maneuverNames[m] = m+1;
						}
					}
					console.log("kFactorAvg length = " + kFactorAvg.length);
					while(kFactorAvg[kFactorAvg.length-1].count == 0) {
						kFactorAvg.pop();
						console.log("kFactorAvg length = " + kFactorAvg.length);
					}
					sched.maneuverAverages = maneuverAvg;
					sched.kFactorAverages = kFactorAvg;
					sched.scoreCount = scoreCount;
					sched.maneuverNames = maneuverNames;
					results.findOne({"contestID":req.params.id, "finalPlacement":"1", "className":result.className}, function(err, opponent) {
						if (err != null) {
							console.log('unable to find contestant detailed results #1 in class:' + result.className + ' -- err: ' + err);
						} else if (opponent === null || opponent.schedules===null || opponent.schedules[0] === null || opponent.schedules[0].maneuvers === null) {
							console.log('got empty results for opponent');
						} else {
							for (var m=0; m<opponent.schedules[0].maneuvers.length; m++) {
								var mTot = 0;
								var mCount = 0;
								var maneuver = opponent.schedules[0].maneuvers[m];
								if (maneuver != null) {
									for (var r = 0; r<maneuver.flights.length; r++) {
										for (var j = 0; j < 2; j++) {
											var score = maneuver.flights[r].JudgeManeuverScores[j].score;
											mTot+=score;
											mCount++;
										}
									}
									opponentAvg[m] = mTot/mCount;
									opponentKAvg[m] = opponentAvg[m] * maneuver.kfactor;
									opponentAvg[m] = opponentAvg[m].toPrecision(3);
									opponentKAvg[m] = opponentKAvg[m].toPrecision(3);
								}
							}
							sched.opponentAverages = opponentAvg;
						}
						res.json(result);
					});
				}
			});
		}
	});

};

*/

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
/*
exports.contestListOld = function(req, res)
{
	global.db.collection('ContestData', function(err, contests) {
		if (err != null) {
			console.log('unable to update patternScoring.com, could not find ContestData' + err);
			return;
		}
		if (contests == null) {
			console.log('unable to update patternScoring.com, no contestData collection');
			return;
		}
		var query = {'location':{$not: /test/i}};
		if (req.query.includeTest == '1') {
			query = {};
		}
		contests.find(query, {'contestID':1,'location':1, 'district':1}).toArray(function (err, contests) {
			console.log('contestList query callback');
			if (err != null) {
				res.statusCode = 500;
				res.end('error querying contestData collection');
				console.log(err);
				return;
			}
			res.json(contests);
		});
	});

}
*/

/*
exports.opponentAverages = function(req, res)
{
	global.db.collection('ContestantResult', function(err, results) {
		if (err != null) {
			res.statusCode = 500;
			res.end('unable to find contestantResult collection');
			console.log(err);
			return;
		}
		if (results == null) {
			res.statusCode = 500;
			res.end('no contestantResult collection found');
			return;
		}
		results.findOne({"contestID":req.params.id, "amaNumber":req.params.amaid}, function (err, result) {
			if (err != null) {
				res.statusCode = 500;
				res.end('unable to find contestant detailed results for ' + req.params.amaid);
				console.log(err);
				return;
			}
			if (result == null) {
				console.log('got empty result');
				return;
			}
			for (var s=0; s<result.schedules.length; s++) {
				var scoreCount = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
				var maneuverAvg = [];
				var opponentAvg = [];
				var kFactorAvg = [	{"kfactor":1, "tot":0, "count":0},
									{"kfactor":2, "tot":0, "count":0},
									{"kfactor":3, "tot":0, "count":0},
									{"kfactor":4, "tot":0, "count":0},
									{"kfactor":5, "tot":0, "count":0},
									{"kfactor":6, "tot":0, "count":0}];
				var maneuverNames = [];
				var sched = result.schedules[s];
				sched.opponentAverages = opponentAvg;
				for (var m=0; m<sched.maneuvers.length; m++) {
					var mTot = 0;
					var mCount = 0;
					var maneuver = sched.maneuvers[m];
					if (maneuver != null) {
						for (var r = 0; r<maneuver.flights.length; r++) {
							for (var j = 0; j < 2; j++) {
								var score = maneuver.flights[r].JudgeManeuverScores[j].score;
								scoreCount[score*2]++;
								var kfAvg = kFactorAvg[maneuver.kfactor-1];
								kfAvg.tot += score;
								kfAvg.count++;
								mTot+=score;
								mCount++;
							}
						}
						maneuverAvg[m] = mTot/mCount;
						maneuverAvg[m] = maneuverAvg[m].toPrecision(3);
						maneuverNames[m] = m+1;
					}
				}
				while(kFactorAvg[kFactorAvg.length-1].count == 0) {
					kFactorAvg.pop();
				}
				sched.maneuverAverages = maneuverAvg;
				sched.kFactorAverages = kFactorAvg;
				sched.scoreCount = scoreCount;
				sched.maneuverNames = maneuverNames;
				results.findOne({"contestID":req.params.id, "finalPlacement":"1", "className":result.className}, function(err, opponent) {
					if (err != null) {
						console.log('unable to find contestant detailed results #1 in class:' + result.className + ' -- err: ' + err);
					} else if (opponent === null || opponent.schedules===null || opponent.schedules[0] === null || opponent.schedules[0].maneuvers === null) {
						console.log('got empty results for opponent');
					} else {
						for (var m=0; m<opponent.schedules[0].maneuvers.length; m++) {
							var mTot = 0;
							var mCount = 0;
							var maneuver = opponent.schedules[0].maneuvers[m];
							if (maneuver != null) {
								for (var r = 0; r<maneuver.flights.length; r++) {
									for (var j = 0; j < 2; j++) {
										var score = maneuver.flights[r].JudgeManeuverScores[j].score;
										mTot+=score;
										mCount++;
									}
								}
								opponentAvg[m] = mTot/mCount;
								opponentAvg[m] = opponentAvg[m].toPrecision(3);
							}
						}
						sched.opponentAverages = opponentAvg;
					}
					res.render('contestant', {'contestant':result});
				});
			}
		});
	});

};

    */