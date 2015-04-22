
/*
 * GET home page.
 */

exports.index = function(req, res) {
    console.log("index route start");
    var id=req.params.id;
    console.log("index route.  url=" + req.url);
    if (req.url === '/home') {
        console.log('render index for /home');
        res.render('index');
        return;
    } 
    if (req.url === '/admin') {
        console.log('render index for /admin');
        res.render('index');
        return;
    }
    if (req.url === '/' || req.url === "") {
        console.log("base URL, app.get('env') = " + global.app.get('env'));
        if (global.app.get('env') === 'production') {
            res.redirect('/home');
            return;
        }
        console.log('no id, going to mongo');
        global.model.currentContest.findOne({}, function (err, currentContest) {
            if (err) {
                res.statusCode = 500;
                res.end('unable to determine current contest unable to find CurrentContest collection');
                console.log('problem getting current contest: ' + err);
            }
            if (currentContest === null || currentContest === undefined) {
                res.statusCode = 500;
                res.end('unable to read CurrentContest');
                console.log('current contest is null or undefined');
                return;
            }
            console.log('found current contest');
            id = currentContest.ContestID;
            console.log('id = ' + id);
            res.redirect('/' + id);
        });
    } else {
        console.log('id = ' + id);
        res.render('index',{contestId:id});
    }
    return;
};

exports.admin = function(req, res) {
    res.render('admin');
    return;
}

exports.contestant = function (req, res) {
    var id = req.params.id;
    var ama = req.params.amaid;
    console.log('id = ' + id + ', amaid=' + ama );
    res.render('contestant', {contestId: id, amaid: ama});
};

exports.partials = function (req, res) {
    var name = req.params.name;
    console.log("rendering partials/" + name);
    res.render('partials/' + name);
};