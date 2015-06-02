var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var vidStreamer = require('vid-streamer');
var flick = require('../models/flick');
var flicks = require('../models/flicks');
var User = require('../models/user');
var utils = require('../lib/utils');



/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', { title: 'i-Flicks', js: 'js/index.js' });
});

router.get('/videolist', function (req, res, next) {
    flicks.list(0, function (err, docs) {
        if (err) { err.code = 'F03001'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.send(docs);
    });
});

router.get('/videodetail/:id', function (req, res, next) {
    flick.load(req.params.id, function (err, doc) {
        if (err) { err.code = 'F03011'; console.log(err); return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.send(doc);
    });
});

router.get('/thumb/:id', function (req, res, next) {
    flick.thumb(req.params.id, function (err, thumbPath) {
        if (err) { err.code = 'F03002'; return next(err); }
        if (thumbPath === undefined) { console.log('image 404'); res.status(404); return; }
        res.sendFile(thumbPath, {}, function (err) {
            if (err) {
                err.code = 'F03003';
                return next(err);
            }
        });
    });
});

//router.get("/videos/:a/:b", vidStreamer);

router.get('/video/:id/:fileName', function (req, res, next) {
    var file;
    flick.load(req.params.id, function (err, flickf) {
        if (err) { err.code = 'F03004'; return next(err); }
        //console.log(req.headers);
        file = path.join(flickf.mediaPath + '/' + req.params.fileName);
        vidStreamer.settings({
            "rootFolder": flickf.mediaPath,
            "rootPath": 'video/' + req.params.id
        });
        vidStreamer(req, res);
    });
});


router.post('/playVideo/:id', function (req, res, next) {
    flick.play(req.params.id, function (err) {
        if (err) { err.code = 'F03007'; return next(err); }
        res.status(200).send('');
    });
});

router.delete('/video/:id', function (req, res, next) {
    if (!req.user) { var err = new Error('Delete access denied'); err.status = 401; return next(err); }
    flick.load(req.params.id, function (err, flickf) {
        if (err) { err.code = 'F03012'; return next(err); }
        if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.

            flick.remove(req.params.id, function (err) {
                if (err) { err.code = 'F03008'; return next(err); }
                res.status(200).send('');
            });
        } else {
            err = new Error('Delete access denied'); err.status = 401; return next(err);
        }
    });
});

router.post('/undelete/:id', function (req, res, next) {
    if (!req.user) { var err = new Error('Undelete access denied'); err.status = 401; return next(err); }
    flick.load(req.params.id, function (err, flickf) {
        if (err) { err.code = 'F03013'; return next(err); }
        if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.

            flick.remove(req.params.id, function (err) {
                if (err) { err.code = 'F03009'; return next(err); }
                res.status(200).send('');
            });
        } else {
            err = new Error('Undelete access denied'); err.status = 401; return next(err);
        }
    });
});

router.get('/videolistunencoded', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    flicks.listUnencoded(function (err, flicks) {
        if (err) { err.code = 'F03010'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(flicks);
    });
});

router.get('/newvideo', function (req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    global.newVideoNotificationRecipients.push(res);
    req.once('close', function () {
        global.newVideoNotificationRecipients.pop(res);
    });
});

router.post('/editVideo', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    flick.load(req.body.id, function (err, flickf) {
        if (err) { err.code = 'F03009'; return next(err); }
        if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.
            flick.name = req.body.name;
            flick.description = req.body.description;
            flick.save(function (err) {
                if (err) { err.code = 'F03010'; return next(err); }
                res.status(200).send({All: "OK"});
            });
        } else {
            err = new Error('Edit access denied'); err.status = 401; return next(err);
        }
    });
});

router.post('/option', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    var opt, user = new User(req);
    user.load(req.user.id, function (err, usr) {
        if (err) { return next(err); }
        for(opt in req.body) {
            user.setOption(opt, req.body[opt], function (err) {
                if (err) { return next(err); }
                res.send({reply: 'Saved'});
            });
        }
    });
});


router.get('/test', function (req, res, next) {
    utils.getFileDetails('E:\\Mercurial\\nodejs\\iflicks\\uploads\\archive\\1d48fe31a8e5d8b20d7c24362bfc4e02.mp4', function (err, output) {
        if (err) { return next(err); }
        res.send(output);
    });
});



/* GET home page. */
router.get('/:vid', function (req, res, next) {
    res.render('index', { title: 'i-flicks', vid: req.params.vid, js: 'js/index.js' });
});

module.exports = router;
