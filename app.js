
/**
 * Module dependencies
 */

var express = require('express'),
  routes = require('./routes'),
  api = require('./routes/api'),
  heartbeat = require('./routes/heartbeat'),
  http = require('http'),
  path = require('path');


var MongoClient = require('mongodb').MongoClient; 
MongoClient.connect("mongodb://172.17.97.54:27017/patternscoring", function(err, db) {
  if (err != null) {
    console.log('unable to open DB: ' + err);
    process.exit();
  }
  if (db == null) {
    res.end('could not find db for scoreview');
    process.exit();
  }
  global.db = db;
});

var app = module.exports = express();
global.app = app;
/**
 * Configuration
 */

// all environments
app.set('port', process.env.PORT || 80);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

// development only
if (app.get('env') == 'development') {
  app.use(express.errorHandler());
}

// production only
if (app.get('env') == 'production') {
  // TODO
}


/**
 * Routes
 */

// serve index and view partials
app.get('/heartbeat', heartbeat.heartbeat);
app.get('/home', routes.index);
app.get('/:id', routes.index);
//app.get('/contestant/:amaid', routes.index);
app.get('/partials/:name', routes.partials);
//app.get('/:id/contestant/:amaid', routes.contestant);

// JSON API
app.get('/api/contest/:id', api.contestResults);
app.post('/api/contest/:id', api.contestResults);
app.get('/api/contest/:id/class/:classcode/contestant/:amaid', api.contestantResults);
app.post('/api/contest/:id/class/:classcode/contestant/:amaid', api.contestantResults);

// redirect all others to the index (HTML5 history)
app.get('*', routes.index);


/**
 * Start Server
 */

var server= http.createServer(app);
var io = require('socket.io').listen(server);
global.io = io;
io.sockets.on('connection', api.contestChange); 

server.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});

if (app.get('env') === 'production') {
} else {

	var mdns = require('mdns2');
	var ad = mdns.createAdvertisement(mdns.tcp('http'), 80, {txtRecord:{name:"PatternScoring"}});
	ad.start();
	console.log("mdns started");
}

