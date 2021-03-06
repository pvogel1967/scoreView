var mongoose = require('mongoose');
var Q = require('q');
var os = require('os')
var express = require('express'),
    routes = require('./routes'),
    api = require('./routes/api'),
    heartbeat = require('./routes/heartbeat'),
    http = require('http'),
    path = require('path');
var fs = require('fs');
var touch = require('touch')
var xml2js = require('xml2js');
var js2xml = require('js2xmlparser');
var model = require('./model/model');
var mkdirp = require('mkdirp');
var moment = require('moment');
var masterScoreDir = process.env.ProgramData + "/MasterScoring";
var masterScoreImportDir = masterScoreDir + "/TransferIn";
var ad2;
var ad;

var interfaces = os.networkInterfaces();
var addresses = [];
for (k in interfaces) {
    for (k2 in interfaces[k]) {
        var address = interfaces[k][k2];
        if (address.family == 'IPv4' && !address.internal) {
            addresses.push(address.address)
        }
    }
}
global.serverIP = addresses[0];

var classMap = {};
var classNameMap = {};
var classToSequenceMap = {};
var classNameToIDMap = {};
var sequenceManeuverMap = {};
var contestClassToClassMap = {};
var classRoundCount = {};
var personMap = {};
var judgeMap = {};
var contestantNumToContestantId = {};
var judgeNumToPersonId = {};
var judgeHasContestant = {};
var allJudgeNums = [];
var promises = [];

var parser = new xml2js.Parser();
var app = module.exports = express();
global.app = app;
global.model = model;

app.set('mongoConnection', process.env.MONGOCONNECTION || "localhost:27017");
app.set('mongoDB', process.env.MONGODB || "patternscoring");
app.set('port', process.env.PORT || 80);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
var public = path.join(__dirname,'public');
app.use(express.static(public));
app.use(express.bodyParser());

app.use('/api/processContestResults', function(req, res, next) {
    if (!req.is('xml')) next();
    req.rawBody = '';
    req.setEncoding('utf8');

    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });

    req.on('end', function() {
        next();
    });
});

app.use('/api/processContestantResults', function(req, res, next) {
    if (!req.is('xml')) next();
    req.rawBody = '';
    req.setEncoding('utf8');

    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });

    req.on('end', function() {
        next();
    });
});

//app.use('/img', express.static(img));
app.use(app.router);
//app.set('env', 'production');
// production only
global.localAllowed = true;
if (app.get('env') == 'production') {
    // production only
    // TODO
    global.localAllowed = false;
} else {
    app.use(express.errorHandler());
    var mdns = require('mdns2');
}
console.dir(global);
var testScoreExport = function(req, res) {
    var className = req.params.className;
    var contestantNum = req.params.contestantNum;
    var round = req.params.round;
    var judgeNum = req.params.judgeNum;
    var data = {
        'className':className,
        'contestant':contestantNum,
        'round':round,
        'judgeId':judgeNum
    };
    console.dir(data);
    var promise = findExistingScoreMatrix(className, contestantNum, round);
    promise.then(function (scoreMatrix) {
        var promise2 = findScoreMatrixRows(scoreMatrix);
        promise2.then(function (rows) {
            var promise3 = findJudgeScoresForMatrix(scoreMatrix, judgeNum);
            promise3.then(function (scores) {
                console.log('done');
            });
        });
    });
}

var judgeScoresSaved = function (req, res) {
    var className = req.params.className;
    var contestantNum = req.params.contestantNum;
    var round = req.params.round;
    var judgeNum = req.params.judgeNum;
    var data = {
        'className':className,
        'contestant':contestantNum,
        'round':round,
        'judgeId':judgeNum
    };
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
                        scores[i].IsProcessed = true;
                        scores[i].save(function(err, score) {});
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

/**
 * Routes
 */

// serve index and view partials
app.get('/heartbeat', heartbeat.heartbeat);
app.get('/home', routes.index);
app.get('/admin', routes.index);
app.get('/contestList', routes.index);
app.post('/admin', function(req, res) {
    if (req.body.contestId.length > 0) {
        app.set('mongoConnection', process.env.MONGOCONNECTION || "localhost:27017");
        app.set('mongoDB', process.env.MONGODB || "patternscoring");
        app.set('port', process.env.PORT || 80);
        contestId = req.body.contestId;
        mongoose.disconnect(function() {openDB(function() {res.redirect('/' + contestId);});})
        //res.redirect('/' + contestId);
    }
    importDir = req.body.importDir;
    contestFile = req.body.contestFile;
    if (contestFile.indexOf('/') < 0 && contestFile.indexOf('\\') < 0) {
        contestFile = masterScoreDir + "/" + contestFile;
    }
    console.log('importDir = ' + importDir + ', contestFile = ' + contestFile);
    adminConfig(contestFile, importDir, function () {res.redirect('/' + contestId);});
});
app.get('/:id', routes.index);
//app.get('/contestant/:amaid', routes.index);
app.get('/partials/:name', routes.partials);
//app.get('/:id/contestant/:amaid', routes.contestant);

// JSON API
var contestAPIData = {};
app.get('/api/currentContest', function(req, res) {
    contestAPIData.ContestID = contestId;
    res.json(contestAPIData);
});
app.get('/api/currentContest/:id', function(req, res) {
    contestId = req.params.id;
    contestAPIData.ContestID = req.params.id;
    res.json(contestAPIData);
})
app.get('/api/contest/:id', api.contestResults);
app.post('/api/contest/:id', api.contestResults);
app.get('/api/contestList', api.contestList);
app.get('/api/judgeScoresSaved/:className/:contestantNum/:round/:judgeNum', judgeScoresSaved);
app.get('/api/testScoreExport/:className/:contestantNum/:round/:judgeNum', judgeScoresSaved);
app.get('/api/contest/:id/class/:classcode/contestant/:amaid', api.contestantResults);
app.post('/api/contest/:id/class/:classcode/contestant/:amaid', api.contestantResults);
app.get('/api/contest/:id/publish', api.publish);
app.get('/api/contest/:id/nopublish', api.nopublish);
app.get('/api/addTimestamps', api.addPilotTimeStamp);
app.get('/api/readContestResults', function(req, res) {
    var promises = [];
    processContestResultsData(importFilePath, promises);
});
app.post('/api/processContestResults/:contestId', api.processContestResults);
app.post('/api/processContestResults/', api.processContestResults);
app.post('/api/processContestantResults/:contestId', api.processContestantResults);
app.get('/api/secured/pilot/:amaid/class/:classcode', api.contestantAllResults);

// redirect all others to the index (HTML5 history)
app.get('*', routes.index);


var readFile = Q.denodeify(fs.readFile);
var parseString = Q.denodeify(parser.parseString);
var contestId = 'contestId';
var adapterMode = true;
var importFilePath;
var masterScoringPrefsTime = moment();
var contestFilePath = undefined;

if (process.argv.length < 3 || process.argv[2] == "--excel") {
    adapterMode = false;
    openDB(function dbOpened() {
        console.log('opened database: ' + app.get('mongoConnectionString'));
        startServer();
    });
} else if (process.argv.length > 2 && process.argv[2] == "--masterScoring") {
    var masterScoringData = process.env.AppData + "/MasterScoring/App.user";
    setInterval(function(prefsData) {
        var promises = [];
        fs.stat(prefsData, function(err, stats) {
            if (stats !== null && stats !== undefined && moment(stats.mtime).isAfter(masterScoringPrefsTime)) {
                masterScoringPrefsTime = moment(stats.mtime);
                processMasterScoringPrefs(prefsData);
            }
        });
    }, 1*5*1000, masterScoringData);
    processMasterScoringPrefs(masterScoringData);
} else {
    if (process.argv.length > 2) {
        var contestFile = process.argv[2];
        if (contestFile.indexOf('/') < 0 && contestFile.indexOf('\\') < 0) {
            contestFile = masterScoreDir + "/" + contestFile;
        }


        if (process.argv.length < 4) {
            console.log('Must specify score export directory from MasterScoring');
            process.exit(1);
        }
        var importDir = process.argv[3];
        adminConfig(contestFile, importDir, startServer);
    }
}

var resultsMtime = undefined;
function adminConfig(contestFile, importDir, dbCallback) {
    var exportDir = masterScoreImportDir;
    mkdirp(exportDir, function (err) {
        if (err) {
            console.log('Error creating exportDir: ' + err);
            process.exit(2);
        }
    });
    adapterMode = true;
    console.log("disconnecting mongoose");
    mongoose.disconnect(function() {
        contestFilePath = contestFile;
        processContestFile(contestFile, dbCallback);
    });

    console.log('import: ' + importDir + '/contestResults.json');
    importFilePath = importDir + '/contestResults.json';
    var fd = fs.openSync(importFilePath, 'w');
    fs.closeSync(fd);
    resultsMtime = moment();
    //var gaze = new Gaze('contestResults.json', {'debounceDelay':0, 'mode':'poll', cwd:importDir});

    setInterval(function(contestData) {
        var promises = [];
        fs.stat(contestData, function(err, stats) {
            if (stats !== null && stats !== undefined && moment(stats.mtime).isAfter(resultsMtime)) {
                resultsMtime = moment(stats.mtime);
                processContestResultsData(contestData, promises);
            }
        });
    }, 1*20*1000, importFilePath);
// Files have all started watching
    //gaze.on('ready', function(watcher) { console.log('ready, watching '+ importDir + '/contestResults.json') });
    //gaze.on('all', function(event, filepath) {
    //    var promises = [];
    //    if (event === 'changed' || event==='added') {
    //        processContestResultsData(filepath, promises);
    //    }
    //});
}

function processMasterScoringPrefs(masterScoringData) {
    if (fs.existsSync(masterScoringData)) {
        var file = readFile(masterScoringData);
        file.then(function (data) {
            return parseString(data);
        }).then(function (result) {
            //console.dir(result.ContestData.Contest[0]);
            var currentContest = result.userPreferences.contestFile[0];
            var contestFile = masterScoreDir + "/" + currentContest;
            var newImportDir = result.userPreferences.exportFolder[0];
            if (contestFile !== contestFilePath || newImportDir !== importDir) {
                console.log('MasterScoringPrefs changed');
                importDir = newImportDir;
                adminConfig(contestFile, importDir, startServer);
            }
        });
    }
}
function startServer() {
    var server= http.createServer(app);
    var io = require('socket.io').listen(server);
    io.set('log level', 1); // reduce logging
    global.io = io;
    io.on('connection', function webSocketConnection(socket) {
        console.log('got socket connection');
        socket.on('scoresUpdated', function(data) {
            console.log('got scoresUpdated event: ' + data);
            socket.broadcast.emit('contestChanged', data);
            api.updatePatternScoringCom(data);
        });

        socket.on('judgeScoresSaved', function judgeScoresSaved(data) {
            console.dir(data);
            console.log('got judgeScoresSaved ' + data.className + " " + data.contestant + " " + data.round + " " + data.judgeId);
            socket.broadcast.emit('judgeScoresSaved', data);
            if (! adapterMode) {
                return;
            }
            var className = data.className;
            var contestantNum = data.contestant;
            var round = data.round;
            var judgeNum = data.judgeId;
            var promise = findExistingScoreMatrix(className, contestantNum, round);
            promise.then(function(scoreMatrix) {
                var promise2 = findScoreMatrixRows(scoreMatrix);
                promise2.then(function(rows) {
                    var promise3 = findJudgeScoresForMatrix(scoreMatrix, judgeNum);
                    promise3.then(function(scores) {
                        var MasterScoreImport = {};
                        MasterScoreImport['@'] = {'contestId':contestId};
                        MasterScoreImport.Contestant = {'@':{'id':contestantNumToContestantId[contestantNum], 'flightNumber':round}};
                        MasterScoreImport.Contestant.Judge = {'@':{'personId':judgeNumToPersonId[judgeNum]}};
                        MasterScoreImport.Contestant.Judge.Maneuver = [];
                        console.log('got ' + scores.length + ' scores');
                        for (i=0; i<scores.length; i++) {
                            if (rows[i] !== undefined && rows[i] !== null && scores[i] !== undefined && scores[i] !== null) {
                                var maneuver = {'@': {'id': rows[i].MasterScoreID, 'score': scores[i].Score}};
                                scores[i].IsProcessed = true;
                                scores[i].save(function(err, score) {});
                                MasterScoreImport.Contestant.Judge.Maneuver.push(maneuver);
                            }
                        }
                        var fileName = masterScoreImportDir + '/' + className + '-' + contestantNum + '-' + round + '-' + judgeNum+ '.xml';
                        var tmpFile = fileName + ".tmp";
                        fs.writeFile(tmpFile, js2xml('MasterScoreImport', MasterScoreImport), function(err) {
                            if (err) {
                                console.log('problem writing XML for scores: ' + err);
                            } else {
                                fs.rename(tmpFile, fileName, function(err) {
                                    if (err) {
                                        console.log('problem renaming to ' + fileName);
                                    } else {
                                        console.log('export file written to ' + fileName);
                                    }
                                });
                            }
                        });
                        console.log();
                    }).catch(function(error) {
                        console.log('error getting judgeScores: ' + error);
                    });

                });
            });
        });
    });
    server.listen(app.get('port'), function () {
        console.log('Express server listening on port ' + app.get('port'));
    });
    if (app.get('env') === 'production') {
    } else {
        if (ad2 !== undefined && ad2 !== null) {
            ad2.stop();
        }
        ad2 = mdns.createAdvertisement(mdns.tcp('http'), 80, {txtRecord:{name:"PatternScoring"}});
        ad2.start();
        console.log("mdns started for http");
    }
}

function openDB(openCallback) {
    var mongoConnection = app.get('mongoConnection');
    var mongoConnectionString = mongoConnection;
    if (mongoConnection.indexOf("mongodb://") === -1) {
      console.log("no mongodb:// found in mongoConnection, composing connection string");
      mongoConnectionString = "mongodb://" + app.get('mongoConnection') + "/" + app.get('mongoDB');
    }
    contestAPIData = {
        'MongoServer': addresses[0],
        'MongoPort': "27017",
        'MongoDB': app.get('mongoDB')
    };
    console.log('MongoConnection: ' + mongoConnectionString);
    app.set('mongoConnectionString', mongoConnectionString);
    mongoose.connect(mongoConnectionString);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {
        console.log("openDB complete, saving in app.db and global.db");
        app.db = db;
        global.db = db;
        openCallback();
    });
}

var contestDataTime = moment();
function processContestFile(fileName, callbackFn) {
    console.log('processing contestFile: ' + fileName);
    var file = readFile(fileName);
    file.then(function (data) {
        console.log('file read');
        return parseString(data);
    }).then(function (result) {
        //console.dir(result.ContestData.Contest[0]);
        var masterContest = result.ContestData.Contest[0];
        var db = mongoose.connection;
        if (db.readyState != 1) {
            console.log("db not ready in processContestFile, calling openDB");
            app.set('mongoDB', masterContest.ID[0]);
            openDB(function dbCallback() {
                fs.stat(fileName, function(err, stats) {
                    contestDataTime = moment(stats.mtime);
                    processContestData(result, callbackFn);
                });
                setInterval(function(contestData) {
                    fs.stat(contestData, function(err, stats) {
                        if (stats !== null && stats !== undefined && moment(stats.mtime).isAfter(contestDataTime)) {
                            contestDataTime = moment(stats.mtime);
                            processContestFile(contestData, function alreadyStarted() {});
                        }
                    });
                }, 1*20*1000, fileName);
                //fs.watch(fileName, function contestFileChanged(curr, prev) {
                //   processContestFile(fileName, function alreadyStarted() {});
                //});
            });
        } else {
            console.log("db thought to be ready, calling processContestData");
            processContestData(result, callbackFn);
        }
    });
}

function processContestResultsData(filepath, promises) {
    var file = readFile(filepath);
    file.then(function (data) {
        console.log('read contestResults.json');
        contestResults = JSON.parse(data);
        var contestData = contestResults.contestData;
        var promise = deleteContestDataByContestID(contestId);
        promise.then(function () {
            contestData.contestID = contestId;
            console.log('walking classData of length: ' + contestData.classData.length);
            for (var i = 0; i < contestData.classData.length; i++) {
                var classData = contestData.classData[i];
                classData.contestants = [];
                for (var j = 0; j < classData.contestant.length; j++) {
                    classData.contestants[j] = classData.contestant[j];
                    classData.contestants[j].realAmaNumber = classData.contestants[j].amaNumber;
                    classData.contestants[j].name = classData.contestants[j].fullName;
                    //delete classData.contestants[j][fullName];
                }
                delete classData['contestant'];
            }
            console.log('preparing to save contestData to mongo');
            var tmp = new model.contestData(contestData);
            //var deferred = Q.defer();
            tmp.save(function (err, contestData) {
                console.log('saved contestData err=' + err);
                walkImportDir();
            });
            //promises.push(deferred.promise);
        });
    });
}

function walkImportDir() {
    fs.readdir(importDir, function(err, list) {
        if (err) {
            console.log('error reading dir ' + importDir + ': ' + err);
            return;
        }
        var promises = [];
        list.forEach(function(file) {
            if (file.indexOf('contestResults') < 0 && file.indexOf('.json') > 0) {
                file = importDir + '/' + file;
                var stat = fs.statSync(file);
                if (stat && !stat.isDirectory()) {
                    if (file) {
                        processContestantResultsData(file, promises);
                    }
                }
            }
        });
        Q.all(promises).then(function() {
            global.io.sockets.emit('scoresUpdated', contestId);
            global.io.sockets.emit('contestChanged', contestId);
            api.updatePatternScoringCom(contestId);
        });
    });
}

function processContestantResultsData(filepath, promises) {
    var file = readFile(filepath);
    promises.push(file);
    file.then(function (data) {
        console.log('read ' + filepath);
        var contestantResults = JSON.parse(data);
        var promise = deleteContestantResultsByContestIDAndAMANumber(contestId, contestantResults.amaNumber, contestantResults.className);
        promise.then(function () {
            contestantResults.contestID = contestId;
            contestantResults.realClassName = contestantResults.schedules[0].name;
            for (var i=0; i<contestantResults.schedules.length; i++) {
                for (var j=0; j<contestantResults.schedules[i].maneuvers.length; j++) {
                    for (var k=0; k<contestantResults.schedules[i].maneuvers[j].flights.length; k++) {
                        var flight = contestantResults.schedules[i].maneuvers[j].flights[k];
                        flight.JudgeManeuverScores = [];
                        for (var l=0; l<flight.judge.length; l++) {
                            flight.JudgeManeuverScores[l] = {judgeId:flight.judge[l].id,score:flight.judge[l].score};
                        }
                        delete flight['judge'];
                    }
                }
            }
            //console.log('preparing to save contestantResults to mongo');
            var tmp = new model.contestantResult(contestantResults);
            var deferred = Q.defer();
            tmp.save(function (err, contestantResults) {
                if (err !== undefined && err !== null) {
                    console.log('error saving contestantResults: ' + err);
                    deferred.reject(new Error('error saving contestantResults: ' + err));
                } else {
                    console.log('saved contestantResults: ' + contestantResults.amaNumber );
                    deferred.resolve(contestantResults);
                }
            });
            promises.push(deferred.promise);
        });
    });
}



function findScoreMatrix(className, contestant, round) {
    var contestantID = contestant.JudgeNumber;
    //console.log('look for scoreMatrix for ' + className + ', contestantNum: ' + contestantID + ' round: ' + round);
    var deferred = Q.defer();
    model.scoreMatrix.findOne({'Class': className, 'ContestantID':contestantID, 'Round':round}, function(err, scoreMatrix) {
       if (err) {
           deferred.reject(new Error('Problem querying for scorematrix' + err));
       } else {
           deferred.resolve({"scoreMatrix":scoreMatrix,"contestant":contestant,"round":round});
       }
    });
    return deferred.promise;
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
    model.judgeScore.find({'ScoreMatrix': scoreMatrix.id, 'JudgeID': judgeNum, $or: [{'IsProcessed': {$exists:false}}, {'IsProcessed': {$exists:true, $eq:false}}]}, function (err, scores) {
        if (err) {
            deferred.reject(new Error('Problem querying for scores: ' + err));
        } else {
            scores.sort(function(a,b) {
                return a.SequenceOrder - b.SequenceOrder;
            });
            //console.log('got scores');
            //for (var i=0; i<scores.length; i++) {
            //    console.log(i + ' / ' + scores[i].SequenceOrder + ' = ' + scores[i].Score);
            //}
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
            rows.sort(function(a,b) {
                return a.Order - b.Order;
            });
            deferred.resolve(rows);
        }
    });
    return deferred.promise;
}

function deleteScoreMatrixRows(scoreMatrix) {
    //console.log('deleting rows for scoreMatrix: ' + scoreMatrix.id);
    var deferred = Q.defer();
    model.scoreMatrixRow.remove({'ScoreMatrix': scoreMatrix.id}, function (err) {
        if (err) {
            console.log('Problem deleting scoreMatrix rows: ' + err);
            deferred.reject(new Error('Problem deleting rows: ' + err));
        } else {
            deferred.resolve();
        }
    });
    return deferred.promise;
}

function findCompetitionClassByName(name, item) {
	//console.log('look for CompetitionClass: %s', name);
	var deferred = Q.defer();
	model.competitionClass.findOne({'Name': name}, function(err, compClass) {
		if (err) {
			deferred.reject(new Error('Problem querying for ' + className + ': ' + err));
		} else {
			deferred.resolve({'compClass': compClass, 'item': item});
		}
	});
	return deferred.promise;
}
function findPilotByAMA(amaNumber, person) {
	//console.log('look for pilot with AMA: %s', amaNumber);
	var deferred = Q.defer();
	model.pilot.findOne({'AMA': amaNumber}, function(err, pilot) {
		if (err) {
			deferred.reject(new Error('Problem querying for pilot with AMA ' + amaNumber + ': ' + err));
		} else {
			deferred.resolve({'pilot': pilot, 'person': person});
		}
	});
	return deferred.promise;
}

function findContestantByJudgeNum(judgeNum, contestantData) {
    //console.log('look for contestant with judgeNum: ' + judgeNum);
    var deferred = Q.defer();
    model.contestant.findOne({'JudgeNumber': judgeNum}, function(err, contestant) {
        if (err) {
            deferred.reject(new Error('Problem querying for contestant with judgeNum ' + judgeNum + ': ' + err));
        } else {
            deferred.resolve({"contestant":contestant, "data":contestantData});
        }
    });
    return deferred.promise;
}

function findContestByContestID(contestID) {
    console.log('look for Contest: ' + contestID);
    var deferred = Q.defer();
    model.contest.findOne({'ContestID': contestID}, function (err, contest) {
       if (err) {
           console.log('Error looking for contest: ' + err);
           deferred.reject(new Error('Problem querying for contest: ' + contestID));
       } else {
           console.log('successful findOne for contest')
           deferred.resolve(contest);
       }
    });
    return deferred.promise;
}

function updateCurrentContest(contest) {
    var currentContest = new model.currentContest;
    currentContest.Name = contest.Name;
    currentContest.CDName = contest.CDName;
    currentContest.Date = contest.Date;
    currentContest.District = contest.District;
    currentContest.ContestID = contest.ContestID;
    model.currentContest.remove({}, function (err) {
        if (err) {
            console.log('problem updating current contest: ' + err);
            return;
        }
        currentContest.save(function (err) {
            if (err) {
                console.log('problem saving new current contest: ' + err);
                return;
            }
            console.log('updated current contest: ' + currentContest.ContestID);
        });
    });
}
function deleteContestDataByContestID(contestID) {
    console.log('look for ContestData: ' + contestID);
    var deferred = Q.defer();
    model.contestData.remove({'contestID': contestID}, function(err) {
        if (err) {
            deferred.reject(new Error('Problem deleting contestData: ' + contestID));
        } else {
            deferred.resolve();
        }
    });
    return deferred.promise;
}

function deleteContestantResultsByContestIDAndAMANumber(contestID, amaNumber, className) {
    console.log('look for ContestantResults: (' + contestID + ", " + amaNumber + ", " + className + ")");
    var deferred = Q.defer();
    model.contestantResult.remove({'contestID': contestID, 'amaNumber':amaNumber, 'className':className}, function(err) {
        if (err) {
            deferred.reject(new Error('Problem deleting contestantResults: (' + contestID + ", " + amaNumber + ", " + className + ")"));
        } else {
            deferred.resolve();
        }
    });
    return deferred.promise;
}


function createMatricesForContestant(contest, contestant, className) {
	var compClass = classNameMap[className];
	if (compClass === null || compClass === undefined) {
		console.log('Could not find class for name: ' + className);
	}
    var classID = classNameToIDMap[className];
    var roundCount = classRoundCount[classID];
	for (var i = 1; i <= roundCount; i++) {
        (function (i) {
            var promise = findExistingScoreMatrix(className, contestant.JudgeNumber, i);
            promise.then(function (scoreMatrix) {
                //var scoreMatrix = scoreMatrixResults.scoreMatrix;
                //var contestant = scoreMatrixResults.contestant;
                //var i = scoreMatrixResults.round;
                var matrix = null;
                if (scoreMatrix === null || scoreMatrix === undefined) {
                    matrix = new model.scoreMatrix;
                } else {
                    //console.log('found scoreMatrix for ' + scoreMatrix.class + ' contestant: ' + scoreMatrix.ContestantID + ' round: ' + scoreMatrix.Round);
                    matrix = scoreMatrix;
                }
                matrix.ContestID = contest.ContestID;
                matrix.ContestantID = contestant.JudgeNumber;
                matrix.Class = className;
                matrix.Round = i;
                var sequenceID = classToSequenceMap[classID][matrix.Round];
                if (contestant.SequenceID !== undefined && contestant.SequenceID !== null) {
                    sequenceID = contestant.SequenceID;
                }
                if (sequenceID !== undefined && sequenceID !== null) {
                    matrix.save(function (err, matrix) {
                        var matrixDesc = 'round ' + matrix.Round + ', class ' + className + ', contestant ' + contestant.Name + ' - ' + matrix.id;
                        //console.log('saved matrix for ' + matrixDesc);
                        deleteScoreMatrixRows(matrix).then(function () {
                            var classID = classNameToIDMap[className];
                            var sequenceID = undefined;
                            if (contestant.SequenceID !== undefined && contestant.SequenceID !== null) {
                                sequenceID = contestant.SequenceID;
                            } else {
                                sequenceID = classToSequenceMap[classID][matrix.Round];
                            }
                            //console.log('use sequenceID: ' + sequenceID);
                            var sequence = sequenceManeuverMap[sequenceID];
                            for (var j = 0; j < sequence.length; j++) {
                                var matrixRow = new model.scoreMatrixRow;
                                var maneuver = sequence[j];
                                matrixRow.ScoreMatrix = matrix.id;
                                matrixRow.Maneuver = maneuver.Name;
                                matrixRow.MasterScoreID = maneuver.MasterScoreID;
                                matrixRow.Order = j;
                                matrixRow.save(function (err, matrixRow) {
                                    //console.log('saved scoreMatrixRow for ' + matrixDesc + ' / ' + maneuver.Name + 'order: ' + j.toString());
                                    if (err !== null && err !== undefined) {
                                        console.log("ERROR: saving matrixRow: " + err);
                                    }
                                });
                            }
                        }, function(error) {console.log("ERROR: trying to delete scoreMatrixRow for " + matrixDesc + ': ' + error);});
                    });
                }
            }, function(error) {
                console.log("ERROR: trying to find existing scoreMatrix: " + error);
            });
        })(i);
	}
}


function processContestData(result, callbackFn) {
    var db = mongoose.connection;
    var contestData = result.ContestData;
    var masterContest = contestData.Contest[0];
    var contestSearchPromise = findContestByContestID(masterContest.ID[0]);
    contestSearchPromise.then(function (foundContest) {
        var contestState = 'new'
        var contest = new model.contest;
        if (foundContest !== null && foundContest !== undefined) {
            contest = foundContest;
            contestState = 'updated';
        }
        contest.ContestID = masterContest.ID[0];
        contestId = contest.ContestID;
        contest.Name = masterContest.Name[0];
        contest.Date = masterContest.StartDate[0];
        contest.ContestDir = masterContest.Name[0];
        contest.CDName = masterContest.EventDirector[0];
        contest.District = masterContest.NSRCADistrict[0];
        for (var i = contestData.ContestClass.length - 1; i >= 0; i--) {
            var contestClass = contestData.ContestClass[i];
            classToSequenceMap[contestClass.ClassID[0]] = [];
            //contestClass.DefaultSequenceID[0];
            contestClassToClassMap[contestClass.ID[0]] = contestClass.ClassID[0];
            classRoundCount[contestClass.ClassID[0]] = parseInt(contestClass.NumberOfRounds[0]);
            //sequenceManeuverMap[contestClass.DefaultSequenceID[0]] = [];
        }
        console.log('completed ContestClass walk');
        //console.dir(classToSequenceMap);
        //console.dir(classRoundCount);
        for (var i = 0; i < contestData.FlightRound.length; i++) {
            (function(i) {
                var classID = contestClassToClassMap[contestData.FlightRound[i].ContestClassID[0]];
                var sequenceID = contestData.FlightRound[i].SequenceID[0];
                var flightNumber = contestData.FlightRound[i].FlightNumber[0];
                //console.log('Processing FlightRound: ' + i + ', classID: ' + classID);
                sequenceManeuverMap[sequenceID] = [];
                var arr = classToSequenceMap[classID];
                if (arr === undefined || arr === null) {
                    arr = [];
                }
                arr[flightNumber] = sequenceID;
                classToSequenceMap[classID] = arr;
            })(i);
        }
        //console.log('completed FlightRound walk');
        //console.dir(classToSequenceMap);
        for (var i = contestData.Maneuver.length - 1; i >= 0; i--) {
            var maneuver = result.ContestData.Maneuver[i];
            var tmp = {};
            tmp.Name = maneuver.Name[0];
            if (maneuver.SpokenText !== null && maneuver.SpokenText !== undefined) {
                var spoken = maneuver.SpokenText[0];
                if (spoken !== null && spoken.length > 0) {
                    tmp.Name = spoken;
                }
            }
            tmp.KFactor = maneuver.KFactor[0];
            tmp.MasterScoreID = maneuver.ID[0];
            if (sequenceManeuverMap[maneuver.SequenceID[0]] === null || sequenceManeuverMap[maneuver.SequenceID[0]] === undefined) {
                sequenceManeuverMap[maneuver.SequenceID[0]] = [];
            }
            sequenceManeuverMap[maneuver.SequenceID[0]].unshift(tmp);
        }
        //console.log('completed sequenceManeuverMap');
        //console.dir(sequenceManeuverMap);
        contest.SupportedClasses = [];
        for (var i = 0; i < result.ContestData.Class.length; i++) {
            var item = result.ContestData.Class[i];
            //console.log('ContestData.Class[' + i.toString() + ']');
            var className = item.Name[0];
            classNameToIDMap[className] = item.ID[0];
            contest.SupportedClasses.push(className);
            var promise = findCompetitionClassByName(className, item);
            promise.then(function (result) {
                var compClass = result.compClass;
                var item = result.item;
                //console.log('in promise then for find competitionClass: ' + item.Name[0]);
                if (compClass === null || compClass === undefined) {
                    console.log('Did not find competition class %s', item.Name[0]);
                    var newClass = new model.competitionClass;
                    newClass.Name = item.Name[0];
                    newClass.AMAID = item.Event[0];
                    newClass.ExternalKey = item.ID[0];
                    //var sequenceId = classToSequenceMap[item.ID[0]][0];
                    //if (sequenceId !== null && sequenceId !== undefined) {
                    //    var maneuverList = sequenceManeuverMap[sequenceId];
                    //    if (maneuverList !== null && maneuverList !== undefined) {
                    //        //console.dir(maneuverList);
                    //        for (var i = 0; i < maneuverList.length; i++) {
                    //            newClass.ManeuverList.Schedule.push({Name: maneuverList[i].Name, KFactor: maneuverList[i].KFactor, MasterScoreID: maneuverList[i].MasterScoreID});
                    //        }
                    //    }
                    //}
                    classMap[item.ID[0]] = newClass;
                    classNameMap[newClass.Name] = newClass;
                    newClass.save(function () {
                        console.log('saved new class %s', newClass.Name);
                    });
                } else {
                    console.log('got existing class');
                    classMap[item.ID[0]] = compClass;
                    classNameMap[compClass.Name] = compClass;
                }
            }).catch(function (error) {
                console.log('in findOne catch for className %s: %s', className, error);
            });
            promises.push(promise);
        }
        console.log('completed className to ID Map');
        //console.dir(classNameToIDMap);
        Q.all(promises).then(function () {
            console.log('classMap complete');
            promises = [];
            for (var i = 0; i < result.ContestData.Person.length; i++) {
                var person = result.ContestData.Person[i]
                //console.log('processing person: ' + person.ID[0]);
                var amaNumber = person.AMANumber[0];
                 var promise = findPilotByAMA(amaNumber, person);
                promise.then(function (result) {
                    var pilot = result.pilot;
                    var person = result.person;
                    if (person.JudgeNumber !== null && person.JudgeNumber !== undefined) {
                        judgeHasContestant['j' + person.JudgeNumber] = false;
                        allJudgeNums.push(person.JudgeNumber);
                        judgeNumToPersonId[person.JudgeNumber] = person.ID[0];
                    }

                    if (pilot === null) {
                        //console.dir(person);
                        console.log('Did not find pilot: ' + amaNumber);
                        var newPilot = new model.pilot;
                        if (person.FirstName !== null && person.FirstName !== undefined && person.LastName !== null && person.LastName !== undefined) {
                            newPilot.Name = person.FirstName[0] + ' ' + person.LastName[0];
                        } else {
                            if (person.FirstName !== null && person.FirstName !== undefined) {
                                newPilot.Name = person.FirstName[0];
                            } else if (person.LastName !== null && person.LastName !== undefined) {
                                newPilot.Name = person.LastName[0];
                            } else {
                                newPilot.Name = 'Unknown';
                            }
                        }
                        newPilot.AMA = person.AMANumber[0];
                        if (person.AddressLine1 !== null && person.AddressLine1 !== undefined) {
                            newPilot.Street = person.AddressLine1[0];
                        }
                        if (person.City !== null && person.City !== undefined) {
                            newPilot.City = person.City[0];
                        }
                        if (newPilot.State !== null && newPilot.State !== undefined) {
                            newPilot.State = person.State[0];
                        }
                        if (person.ZIP !== null && person.ZIP !== undefined) {
                            newPilot.PostalCode = person.ZIP[0];
                        }
                        if (person.Phone !== null && person.Phone !== undefined) {
                            newPilot.PhoneNumber = person.Phone[0];
                        }
                        if (person.Email !== null && person.Email !== undefined) {
                            newPilot.Email = person.Email[0];
                        }
                        newPilot.ExternalKey = person.ID[0];
                        personMap[newPilot.ExternalKey] = newPilot;
                        newPilot.save(function () {
                            //console.log('saved new pilot: ' + newPilot.Name);
                        });
                    } else {
                        //console.log('Found pilot: ' + pilot.Name + ' for AMANumber: ' + pilot.AMA);
                        pilot.ExternalKey = person.ID[0];
                        personMap[person.ID[0]] = pilot;
                        pilot.save(function () {
                            //console.log('saved updated pilot: ' + pilot.Name);
                        });
                    }

                });
                promises.push(promise);
            }
            Q.all(promises).then(function () {
                //console.log('completed person map')
                //console.log('judgeMap');
                //console.dir(judgeMap);
                promises = [];
                for (var i = 0; i < result.ContestData.Contestant.length; i++) {
                    var contestant = result.ContestData.Contestant[i];
                    var promise = findContestantByJudgeNum(contestant.ContestantNumber[0], contestant);
                    promises.push(promise);
                    promise.then(function (findResult) {
                        var existingContestant = findResult.contestant;
                        var contestant = findResult.data;
                        if (existingContestant !== null && existingContestant !== undefined) {
                            if (contestant.SequenceID !== undefined && contestant.SequenceID !== null) {
                                existingContestant.SequenceID = contestant.SequenceID[0];
                            }
                            console.log('found contestant for judgeNum:' + existingContestant.JudgeNumber);
                            allJudgeNums.push(existingContestant.JudgeNumber);
                            judgeNumToPersonId[existingContestant.JudgeNumber] = contestant.PersonID[0];
                            judgeHasContestant[existingContestant.JudgeNumber] = true;
                            contestantNumToContestantId[existingContestant.JudgeNumber] = existingContestant.MasterScoreID;
                            existingContestant.save(function (err, existingContestant) {
                                console.log('Saved new contestant');
                                createMatricesForContestant(contest, existingContestant, existingContestant.Class);
                            });
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
                            allJudgeNums.push(newContestant.JudgeNumber);
                            judgeNumToPersonId[newContestant.JudgeNumber] = contestant.PersonID[0];
                            judgeHasContestant[newContestant.JudgeNumber] = true;
                            newContestant.MasterScoreID = contestant.ID[0];
                            if (contestant.SequenceID !== undefined && contestant.SequenceID !== null) {
                                newContestant.SequenceID = contestant.SequenceID[0];
                            }
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
                Q.all(promises).then(function() {
                    for (var i=0; i<allJudgeNums.length; i++) {
                        if (!judgeHasContestant[allJudgeNums[i]]) {
                            var newContestant = new model.contestant;
                            var pilot = personMap[judgeNumToPersonId[allJudgeNums[i]]];
                            newContestant.PilotID = pilot.id;
                            newContestant.Name = pilot.Name;
                            newContestant.AMANumber = pilot.AMA;
                            newContestant.ContestID = contest.ContestID;
                            newContestant.JudgeNumber = allJudgeNums[i];
                            newContestant.Class = "Judge";
                            newContestant.Frequency = '2.4GHz';
                            newContestant.MasterScoreID = judgeNumToPersonId[allJudgeNums[i]];
                            judgeHasContestant[newContestant.JudgeNumber] = true;
                            newContestant.save(function (err, newContestant) {
                                console.log('Saved new JUDGE contestant for judge #' + newContestant.JudgeNumber);
                            });
                        }
                    }
                });
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
                    contestAPIData = txtRecord;
                    if (app.get('env') !== "production") {
                        if (ad !== null && ad !== undefined) {
                            ad.stop();
                        }
                        ad = mdns.createAdvertisement(mdns.tcp('mongodb'), 27071, {'txtRecord': txtRecord});
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
