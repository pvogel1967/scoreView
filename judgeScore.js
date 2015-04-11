/**
 * Created by pvogel on 10/11/2014.
 */
var mongoose = require('mongoose');
var Q = require('q');
var model = require('./model/model');
var mkdirp = require('mkdirp');

var contestFile = process.argv[2];
if (contestFile.indexOf('/') < 0 && contestFile.indexOf('\\') < 0) {
    contestFile = masterScoreDir + "/" + contestFile;
}




openDB(function dbOpened() {
    var exportDir = "."
    var className = process.argv[3];
    var contestantNum = process.argv[4];
    var round = process.argv[5];
    var judgeNum = process.argv[6];
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
});

function openDB(openCallback) {
    var mongoConnectionString = "mongodb://localhost:27017/52999346-72f6-40a4-bf74-793851ce4fb0";
    console.log('MongoConnection: ' + mongoConnectionString);
    mongoose.connect(mongoConnectionString);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {
        global.db = db;
        openCallback();
    });
}

function findExistingScoreMatrix(className, contestantID, round) {
    //console.log('look for scoreMatrix for ' + className + ', contestantNum: ' + contestantID + ' round: ' + round);
    var deferred = Q.defer();
    model.scoreMatrix.findOne({'Class': className, 'ContestantID':contestantID, 'Round':round}, function(err, scoreMatrix) {
        if (err) {
            deferred.reject(new Error('Problem querying for scorematrix' + err));
        } else {
            deferred.resolve(scoreMatrix);
        }
    });
    return deferred.promise;
}

function findJudgeScoresForMatrix(scoreMatrix, judgeNum) {
    //console.log('find scores for scoreMatrix: ' + scoreMatrix.id + ', judgeNum: ' + judgeNum);
    var deferred = Q.defer();
    model.judgeScore.find({'ScoreMatrix': scoreMatrix.id, 'JudgeID': judgeNum}, function (err, scores) {
        if (err) {
            deferred.reject(new Error('Problem querying for scores: ' + err));
        } else {
            deferred.resolve(scores);
        }
    });
    return deferred.promise;
}

function findScoreMatrixRows(scoreMatrix) {
    console.log('find rows for scoreMatrix: ' + scoreMatrix.id);
    var deferred = Q.defer();
    model.scoreMatrixRow.find({'ScoreMatrix': scoreMatrix.id}, function (err, rows) {
        if (err) {
            deferred.reject(new Error('Problem querying for matrix rows: ' + err));
        } else {
            deferred.resolve(rows);
        }
    });
    return deferred.promise;
}

function processContestFile(fileName, callbackFn) {
    console.log('processing contestFile: ' + fileName);
    var file = readFile(fileName);
    file.then(function (data) {
        console.log('file read');
        return parseString(data);
    }).then(function (result) {
        var masterContest = result.ContestData.Contest[0];
        var db = mongoose.connection;
        processContestData(result, callbackFn);
    });
}

function processContestData(result, callbackFn) {
    var db = mongoose.connection;
    var contestData = result.ContestData;
    var masterContest = contestData.Contest[0];
                    var contestant = result.ContestData.Contestant[i];
                    var promise = findContestantByJudgeNum(contestant.ContestantNumber[0], contestant);
                    promise.then(function (findResult) {
                        var existingContestant = findResult.contestant;
                        var contestant = findResult.data;
                        if (existingContestant !== null && existingContestant !== undefined) {
                            console.log('found contestant for judgeNum:' + existingContestant.JudgeNumber);
                            judgeNumToPersonId[existingContestant.JudgeNumber] = contestant.PersonID[0];
                            contestantNumToContestantId[existingContestant.JudgeNumber] = existingContestant.MasterScoreID;
                            return;
                        }
                        var newContestant = new model.contestant;
                        var pilot = personMap[contestant.PersonID[0]];
                        if (pilot !== null && pilot !== undefined) {
                            newContestant.PilotID = pilot.id;
                            newContestant.Name = pilot.Name;
                            newContestant.AMANumber = pilot.AMA;
                            newContestant.ContestID = contest.ContestID;
                            newContestant.JudgeNumber = contestant.ContestantNumber[0];
                            judgeNumToPersonId[newContestant.JudgeNumber] = contestant.PersonID[0];
                            newContestant.MasterScoreID = contestant.ID[0];
                            contestantNumToContestantId[newContestant.JudgeNumber] = newContestant.MasterScoreID;
                            var actualClassID = contestClassToClassMap[contestant.ContestClassID[0]];
                            var actualClass = classMap[actualClassID];
                            if (actualClass === null || actualClass === undefined) {
                                console.log('unable to map to actual class for contestant %s', newContestant.Name);
                            }
                            newContestant.Class = actualClass.Name;
                            newContestant.Frequency = '2.4 GHz';
                            newContestant.save(function (err, newContestant) {
                                console.log('Saved new contestant');
                                createMatricesForContestant(contest, newContestant, newContestant.Class);
                            });
                        } else {
                            console.log('unable to map contestant to person for %s', contestant.PersonID[0]);
                        }
                    });
                }
                contest.save(function () {
                    console.log('saved ' + contestState + ' contest');
                    updateCurrentContest(contest);
                    var txtRecord = {
                        'ContestID': contest.ContestID,
                        'ContestName': contest.Name,
                        'MongoServer': addresses[0],
                        'MongoPort': "27017",
                        'MongoDB': contest.ContestID
                    };
                    if (app.get('env') !== "production") {
                        var ad = mdns.createAdvertisement(mdns.tcp('mongodb'), 27071, {'txtRecord': txtRecord});
                        ad.start();
                    }
                    callbackFn();
                });
            }).catch(function (error) {
                console.log('error from Q.all(pilotPromises): %s', error);
            });
        }).catch(function (error) {
            console.log('error from Q.all(classPromises): %s', error);
        });
    });
}