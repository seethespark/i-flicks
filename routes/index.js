// Error code F03
var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var vidStreamer = require('vid-streamer');
var marked = require('marked');
var archiver = require('archiver');
var request = require('request');
var mkdirp = require('mkdirp');
var FormData = require('form-data');
var flick = require('../models/flick');
var flicks = require('../models/flicks');
var flickUser = require('../models/flickUser');
var User = require('../models/user');
var utils = require('../lib/utils');
var logger = require('../lib/logger');

/** 
 * Main user interface support.
 * Presented with JLDoc tags but I can't get JLDoc to extract them when running the router's methods.
 * @module index
 */

/** Present the home page */
router.get('/', function (req, res, next) {
    var showInfo = false, info = '', settings, css, js, showCookieBanner = true;
    css = global.iflicks_settings.css;
    js = 'js/index.js';
    if (global.iflicks_settings.env === 'production') {
        css = css.replace('.css', '.min.css');
        js = js.replace('.js', '.min.js');
    } else {
        css = 'index.css';
    }
    /// Check the cookie consent cookie.  If this is ommitted the client will still check but the banner flashes on page load.
    if (utils.getCookie(req.headers.cookie, 'cookieConsent') === 'true') {
        showCookieBanner = false;
    }
    // Check if they have requested to hide the Info box.
    if (utils.getCookie(req.headers.cookie, 'closeInfoPanel') !== 'true') {
        showInfo = true;
        info = '<p>i-flkicks is a video sharing website where access is controlled by the uploader of the videos.  ' +
            'The software is available for anyone who wants to download it, use it or modify it; yes it\'s free.</p>' +
            '<p>Once you have an account you will be able to upload videos and share them with friends, family ' +
            'and the world.</p><p>There are other video content websites but most are geared towards free access for '+
            'everyone.  Here we value discresion and privacy.</p><p>Please do not upload indecent videos or ' +
            'material for which you don\'t have permission.  If you do it will be removed.</p>';
    }
    settings = JSON.stringify({ videoListPageLength: 10 });
    res.render('index', { 
        title: 'i-Flicks',
        js: js,
        css: css,
        usersCanCreateAccount: global.iflicks_settings.usersCanCreateAccount,
        showCookieBanner: showCookieBanner,
        showInfo: showInfo,
        info: info
    });
});

/**
 * GET the video list for the grid view.
 * @param {number} page - The page number to retrieve for paginated views.
 * @param {number} limit - The number of records to return.
 * @param {string} search - Search term, does a limple pattern match.  Use "-" if you want everything.  This prevents the URL from dropping the trailing slash.
 * @method
 */
router.get('/videolist/:page/:limit/:search', function (req, res, next) {
    flicks.setStatsD(req.statsD);
    flicks.list(req.params.page, req.params.limit, req.params.search, req.user, function (err, docs) {
        if (err) { err.code = 'F03001'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.send(docs);
    });
});

/** GET the text detail about a video
* @param {string} id - The _id of the video
* 
*/
router.get('/videodetail/:id', function (req, res, next) {
    var userId;
    if (req.user && req.user.id) {
        userId = req.user.id;
    }
    flick.setStatsD(req.statsD);
    flick.load(req.params.id, req.user, function (err, doc) {
        if (err) { err.code = 'F03011'; console.log(err); return next(err); }
            flickUser.timeGet(req.params.id, userId, function (err, time) {
                if (err) { err.code = 'F030017'; return next(err); }
                doc.currentTime = time;
                res.setHeader('Content-Type', 'application/json');
                res.send(doc);
            });
    });
});

/** GET the thumbnail image file
* @param {string} id - The _id of the video
* 
*/
router.get('/thumb/:id/:fileName', function (req, res, next) {
    flick.setStatsD(req.statsD);
    flick.thumb(req.params.id, req.params.fileName, req.user, function (err, thumbPath) {
        if (err) { err.code = 'F03002'; return next(err); }
        if (thumbPath === undefined) { err = new Error('Image missing (404)'); err.status = 404; return next(err); }
        res.sendFile(thumbPath, {}, function (err) {
            if (err) {
                err.code = 'F03003';
                return next(err);
            }
        });
    });
});

/** GET the video stream
* @param {string} id - The _id of the video
* @param {string} filename - The variant of the file being requested (small.mp4, bit.webm etc.)
*/
router.get('/video/:id/:fileName', function (req, res, next) {
    flick.setStatsD(req.statsD);
    flick.load(req.params.id, req.user, function (err, flickf) {
        if (err) {  err.code = err.code || 'F03004'; return next(err); }
        file = path.join(flickf.mediaPath + '/' + req.params.fileName);
        vidStreamer.settings({
            "rootFolder": flickf.mediaPath,
            "rootPath": 'video/' + req.params.id
        });
        vidStreamer(req, res);
    });
    flick.view(req, function (err) {
        if (err) {
            logger.error(req,  'index.get.video.flickView',(err.code || 'F03016'), err, 2);
        }
    });
});

/** POST a record that a video has been played
* @param {string} id - The _id of the video
* 
*/
router.post('/error', function (req, res, next) {
    logger.error(req, (req.body.location || 'client'), 'F03015', req.body.message, 1);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send('{}');
});

/** POST a record that a video has been played
* @param {string} id - The _id of the video
* 
*/
router.post('/playVideo/:id', function (req, res, next) {
    flick.setStatsD(req.statsD);
    flick.play(req.params.id, function (err) {
        if (err) { err.code = 'F03007'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send('{}');
    });
});


/** POST an rating
* @param {string} id - The _id of the video
* 
*/
router.post('/rating/:id/:rating', function (req, res, next) {
    if (req.user === undefined) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send({error: "You must be logged in to rate"});
        return;
    }
    flick.setStatsD(req.statsD);
    flick.rating1(req.params.id, req.user.id, req.params.rating, function (err) {
        if (err) { err.code = 'F030018'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send({All: "OK"});
    });
});


/** POST an update to the video time
* @param {string} id - The _id of the video
* 
*/
router.post('/timeupdate/:id/:time', function (req, res, next) {
    if (req.user === undefined) {
        res.status(200).send('{}');
        return;
    }
    flick.setStatsD(req.statsD);
    flickUser.timeUpdate(req.params.id, req.user.id, req.params.time, function (err) {
        if (err) { err.code = 'F030014'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send('{}');
    });
});

/** DELETE a video
* @param {string} id - The _id of the video
* 
*/
router.delete('/video/:id', function (req, res, next) {
    if (!req.user) { var err = new Error('Delete access denied'); err.status = 401; return next(err); }
    flick.setStatsD(req.statsD);
    flick.load(req.params.id, req.user, function (err, flickf) {
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

/** POST Undo the soft delete on a video
* @param {string} id - The _id of the video
* 
*/
router.post('/undelete/:id', function (req, res, next) {
    if (!req.user) { var err = new Error('Undelete access denied'); err.status = 401; return next(err); }
    flick.setStatsD(req.statsD);
    flick.load(req.params.id, req.user, function (err, flickf) {
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

/** GET unencoded videos
* @param {number} page - The page number to retrieve for paginated views.
* @param {number} limit - The number of records to return.
* 
*/
router.get('/videolistunencoded/:page/:limit', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    //userId = req.user.id;
    flicks.setStatsD(req.statsD);
    flicks.listUnencoded(req.params.page, req.params.limit, req.user, function (err, flicks) {
        if (err) { err.code = 'F03010'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(flicks);
    });
});

/** GET new videos event emmitter.  This sends a message when any new videos are added
* 
*/
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

/** POST edit text and access information for a video
* @param {Object} body - {id, name, description, public, directLink}
* 
*/
router.post('/editVideo', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    flick.setStatsD(req.statsD);
    flick.load(req.body.id, req.user, function (err, flickf) {
        if (err) { err.code = 'F03009'; return next(err); }
        if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.
            flick.name = req.body.name;
            flick.description = req.body.description;
            flick.public = req.body.public;
            flick.directLink = req.body.directLink;
            console.log(req.body.directLink);
            flick.save(function (err) {
                if (err) { err.code = 'F03010'; return next(err); }
                res.setHeader('Content-Type', 'application/json');
                res.status(200).send({All: "OK"});
            });
        } else {
            err = new Error('Edit access denied'); err.status = 401; return next(err);
        }
    });
});

/** POST user options and settings
* @param {Object} body - Options to set array
* 
*/
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

/** PUT add a new user object
* @param {Object} body - User object {username, password, forename, lastname, emailAddress}
* 
*/
router.put('/user', function (req, res, next) {
    var user = new User(req);
    user.checkUserExists(req.body.username, function(err, userExists) {
        if (err) { return next(err); }
        if (userExists) {
            err = new Error('Username exists');
            return next(err);
        }
        user.create(function (err, usr) {
            if (err) { return next(err); }
            usr.username = req.body.username;
            usr.password = req.body.password;
            usr.forename = req.body.forename;
            usr.emailAddress = req.body.emailAddress;
            usr.isSysAdmin = false;

            //usr.isSysAdmin = true;
            usr.customerId = undefined;
            usr.save(function (err) {
                if (err) { return next(err); }
                res.send({reply: 'Hello ' + usr.username});
            });
        });
    });
});

router.post('/copy', function (req, res, next) {
    var err, zip;
    if (!req.user) { err = new Error('Copy access denied'); err.status = 401; return next(err); }
    if (req.body.destination.substring(0, 4) !== 'http') {
        err = new Error('Destination must be in the form http:// or https://' ); err.code = 'F03019'; err.status = 500; return next(err); 
    }
    request.get({url: req.body.destination + '/api/testconnection', headers: {Accept: 'application/json'}})
        .auth(req.body.username, req.body.password, true)
        .on('error', function(err) {
            console.log('err');
            err.code = 'F03016';
            return next(err);
        })
        .on('response', function(response) {
            if (response.statusCode !== 200) {
                var body = '';
                response.on('data', function (chunk) {
                    body += chunk;
                });
                response.on('end', function () {
                    err = new Error('Destination returned an error ' + response.statusCode + ', ' + body );
                    err.code = 'F03017';
                    return next(err);
                });
            } else {
                flick.setStatsD(req.statsD);
                flick.load(req.body.id, req.user, function (err, flickf) {
                    if (err) { err.code = 'F03015'; return next(err); }

                    mkdirp(flickf.mediaPath + '_tmp', function(err) {
                        var output = fs.createWriteStream(flickf.mediaPath + '_tmp/output.zip');
                        /*var archive = archiver('tar', {
                            gzip: true,
                            gzipOptions: {
                                level: 1
                            }
                        });*/
                        var archive = archiver('zip');

                        archive.on('error', function(err) {
                          throw err;
                        });
                        output.on('close', function () {
                            console.log('sending');
                            var formData = {flick: fs.createReadStream(flickf.mediaPath + '_tmp/output.zip')};
                            request.put({url: req.body.destination + '/api/copy', formData: formData, headers: {Accept: 'application/json'}})
                                .auth(req.body.username, req.body.password, true)

                                .on('error', function(err) {
                                    err.code = 'F03018';
                                    logger.error(req, 'api.copy.post.unzip', 'F03018', err, 2);
                                    //return next(err);
                                })
                                .on('response', function(response) {
                                    //console.log(response.statusCode); // 200
                                    //console.log(response);
                                    //console.log(response.headers['content-type']); // 'image/png'
                                });
                        });
                        archive.pipe(output);
                        archive.directory(flickf.mediaPath, '');
                        archive.append(JSON.stringify(flickf), { name:'flick.json' });
                        archive.finalize();                    
                    });

                    
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({All: "OK"});
                });
            }
        });
});

/** GET testing something out
* @todo remove this
* 
*/
router.get('/test', function (req, res, next) {
    utils.getFileDetails('E:\\Mercurial\\nodejs\\iflicks\\uploads\\archive\\1d48fe31a8e5d8b20d7c24362bfc4e02.mp4', function (err, output) {
        if (err) { return next(err); }
        res.send(output);
    });
});

/** GET testing something out
* @todo remove this
* 
*/
router.get('/ffmpeg', function (req, res, next) {
    utils.getFFmpegDetails(function (err, output) {
        if (err) { return next(err); }
        res.send(output);
    });
});


/** GET convert the readme file from .md into HTML
* 
*/
router.get('/readme', function (req, res, next) {
    fs.readFile(path.join(__dirname, '../README.md'), {encoding: 'utf-8'}, function (err, data) {
        if (err) { return next(err); }
       /* marked.setOptions({
          renderer: new marked.Renderer(),
          gfm: true,
          tables: true,
          breaks: true,
          pedantic: false,
          sanitize: true,
          smartLists: true,
          smartypants: true
        */
        res.render('readme', {layout: 'markdown', md: marked(data), title: 'i-flicks readme'});
    });
});

/** GET the privacy statement
* 
*/
router.get('/privacy', function (req, res, next) {
    var js, css = global.iflicks_settings.css;
    if (global.iflicks_settings.env === 'production') {
        css = css.replace('.css', '.min.css');
    }
    res.render('privacy', {title: 'i-flicks privacy and cookies'});
});

/** GET the home page but display a video inthe URL.  USed for deep linking videos.
* @param {string} vid - The _ID of the video.
* 
*/
router.get('/:vid', function (req, res, next) {
    var js, css = global.iflicks_settings.css;
    js = 'js/index.js';
    if (global.iflicks_settings.env === 'production') {
        css = css.replace('.css', '.min.css');
        js = js.replace('.js', '.min.js');
    }
    res.render('index', { title: 'i-flicks', vid: req.params.vid, css: css, js: js });
});


 /** Exports router */
module.exports = router;
