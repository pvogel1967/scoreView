
/*
 * GET home page.
 */

exports.index = function(req, res){
  	var id=req.params.id;
  	if (req.url == '/' || req.url=="") {
  		console.log('no id, going to mongo');
		var MongoClient = require('mongodb').MongoClient;	
		MongoClient.connect("mongodb://localhost:27017/patternscoring", function(err, db) {
			if (err != null) {
				res.statusCode = 500;
				res.end('unable to determine current contest');
				console.log(err);
				return;
			}
			if (db == null) {
				res.statusCode = 500;
				res.end('unable to determine current contest could not find db');
				return;
			}
			db.collection('CurrentContest', function(err, contests) {
				if (err != null) {
					res.statusCode = 500;
					res.end('unable to determine current contest unable to find CurrentContest collection');
					console.log(err);
					return;
				}
				if (contests == null) {
					res.statusCode = 500;
					res.end('no CurrentContest collection');
					return;
				}
				contests.findOne({}, function (err, contest) {
					if (err != null) {
						res.statusCode = 500;
						res.end('unable to read CurrentContest');
						console.log(err);
						return;
					}
					console.log('found current contest');
					id = contest.ContestID;
  					console.log('id = ' + id);
					res.redirect('/'+id);
				});
			});
		});
	} else {
		console.log('id = ' + id);
		res.render('index',{contestId:id});
	}
	return;
};

exports.contestant = function(req, res) {
   var id = req.params.id;
   var ama = req.params.amaid;
	console.log('id = ' + id + ', amaid=' + ama );
   res.render('contestant', {contestId:id, amaid:ama});
};

exports.partials = function (req, res) {
  var name = req.params.name;
  res.render('partials/' + name);
};