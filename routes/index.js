
/*
 * GET home page.
 */

exports.index = function(req, res){
	console.log("index route start");
  	var id=req.params.id;
  	console.log("index route.  url=" + req.url);
  	if (req.url === '/home') {
  		console.log('render index for /home');
  		res.render('index');
  		return;
  	}
  	if (req.url === '/' || req.url==="") {
  		console.log("base URL, app.get('env') = " + global.app.get('env'));
  		if (global.app.get('env') === 'production') {
  			res.redirect('/home');
  			return;
  		}
  		console.log('no id, going to mongo');
		global.db.collection('CurrentContest', function(err, contests) {
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
  console.log("rendering partials/" + name);
  res.render('partials/' + name);
};