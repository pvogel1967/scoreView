/*
 * Serve JSON to our AngularJS client
 */
var http = require('http');
exports.contestResults = function(req, res)
{
	var MongoClient = require('mongodb').MongoClient;	
	MongoClient.connect("mongodb://localhost:27017/patternscoring", function(err, db) {
		if (err != null) {
			res.statusCode = 500;
			res.end('unable to open DB');
			console.log(err);
			return;
		}
		if (db == null) {
			res.statusCode = 500;
			res.end('could not find db');
			return;
		}
		db.collection('ContestData', function(err, contests) {
			if (err != null) {
				res.statusCode = 500;
				res.end('unable to find contestData collection');
				console.log(err);
				return;
			}
			if (contests == null) {
				res.statusCode = 500;
				res.end('no contestData collection');
				return;
			}
			if (req.method == 'POST') {
				console.log("got POST of ContestData: " + req.body);
				contests.findAndModify({"contestID":req.params.id},
				[['_id', 'asc']],
				req.body,
				{"upsert":true},
				function(err, result) {
					if (err != null) {
						res.statusCode = "500";
						res.end('unable to update contest results for ' + req.params.id);
						console.log(err);
						return;
					}
					res.json(result);
				});
			} else {
				contests.findOne({"contestID":req.params.id}, function (err, contest) {
					if (err != null) {
						res.statusCode = 500;
						res.end('unable to read contest');
						console.log(err);
						return;
					}
					if (contest.classData[contest.classData.length-1] === null) {
						contest.classData.pop();
					}
					res.json(contest);
				});
			}
		});
	});
};

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

	var req = http.request(options, function(res) {
	    res.setEncoding('utf8');
	    res.on('data', function (chunk) {
	        console.log("response from patternScoring: " + chunk);
	    });
	});

	req.write(data);
	req.end();
}

function updatePatternScoringCom(data) {
	var MongoClient = require('mongodb').MongoClient;	
	MongoClient.connect("mongodb://localhost:27017/patternscoring", function(err, db) {
		if (err != null) {
			console.log('could not update patternScoring.com, mongoConnect error: ' + err);
			return;
		}
		if (db == null) {
			console.log('could not update patternScoring.com, could not find db');
			return;
		}
		db.collection('ContestData', function(err, contests) {
			if (err != null) {
				console.log('unable to update patternScoring.com, could not find ContestData' + err);
				return;
			}
			if (contests == null) {
				console.log('unable to update patternScoring.com, no contestData collection');
				return;
			}
			contests.findOne({"contestID":data}, function (err, contest) {
				if (err != null) {
					console.log('unable to update patternScoring.com, cannot read contest: ' + data + ':' + err);
					return;
				}
				sendToPatternScoring('/api/contest/' + data, contest);
			});
		});
		db.collection('ContestantResult', function(err, contestantResults) {
			if (err != null) {
				console.log('unable to update patternScoring.com, could not find ContestantResults' + err);
				return;
			}
			if (contestantResults == null) {
				console.log('unable to update patternScoring.com, no ContestantResults collection');
				return;
			}
			contestantResults.find({"contestID":data}, function(err, contestants) {
				for (var i=0; i < contestants.length; i++) {
					var c = contestants[i];
					var uri = "/api/contest/" + data + "/class/" + c.className + "/" + c.amaNumber;
					sendToPatternScoring(uri, c);
				}
			});
		});
	});
}

exports.contestChange = function(socket) 
{
	socket.on('scoresUpdated', function(data) {
		console.log('got scoresUpdated event: ' + data);
		socket.broadcast.emit('contestChanged', data);
		updatePatternScoringCom(data);
	});
	socket.on('judgeScoresSaved', function(data) {
		console.log('got judgeScoresSaved event');
		socket.broadcast.emit('judgeScoresSaved', data);
	});
}

exports.contestantResults = function(req, res)
{
	var MongoClient = require('mongodb').MongoClient;	
	MongoClient.connect("mongodb://localhost:27017/patternscoring", function(err, db) {
		if (err != null) {
			res.statusCode = 500;
			res.end('unable to open DB');
			console.log(err);
			return;
		}
		if (db == null) {
			res.statusCode = 500;
			res.end('could not find db');
			return;
		}
		db.collection('ContestantResult', function(err, results) {
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
				results.findAndModify({"contestID":req.params.id, "amaNumber":req.params.amaid, "className":req.params.classcode},
				[['_id', 'asc']],
				req.body,
				{"upsert":true},
				function(err, result) {
					if (err != null) {
						res.statusCode = "500";
						res.end('unable to update contestant results for ' + req.params.amaid);
						console.log(err);
						return;
					}
					res.json(result);
				});
			} else {
				results.findOne({"contestID":req.params.id, "amaNumber":req.params.amaid, "className":req.params.classcode}, 
					function (err, result) {
					if (err != null) {
						res.statusCode = 500;
						res.end('unable to find contestant detailed results for ' + req.params.amaid);
						console.log(err);
						return;
					}
					if (result == null && req.method=='GET') {
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
										opponentAvg[m] = opponentAvg[m].toPrecision(3);
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
	});

};

exports.opponentAverages = function(req, res)
{
	var MongoClient = require('mongodb').MongoClient;	
	MongoClient.connect("mongodb://localhost:27017/patternscoring", function(err, db) {
		if (err != null) {
			res.statusCode = 500;
			res.end('unable to open DB');
			console.log(err);
			return;
		}
		if (db == null) {
			res.statusCode = 500;
			res.end('could not find db');
			return;
		}
		db.collection('ContestantResult', function(err, results) {
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
	});

};
