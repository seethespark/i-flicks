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
var Flick = require('../models/flick');
var user = require('../models/user');
var flicks = require('../models/flicks');
var flickUser = require('../models/flickUser');
var User = require('../models/user');
var utils = require('../lib/utils');
var logger = require('../lib/logger');
var packagejson = require('../package.json');

/** 
 * Main user interface support.
 * Presented with JLDoc tags but I can't get JLDoc to extract them when running the router's methods.
 * @module index
 */

/** Set standard headers.  Just cach headers for now. */
function setHeaders(res, contentType) {
    var seconds = 14 * 24 * 3600;// 4 days
    res.setHeader('Cache-Control', 'public, max-age=' + seconds); 
    res.setHeader('Expires', new Date(Date.now() + (seconds * 1000)).toUTCString());

    if (contentType) {
        res.setHeader('Content-Type', contentType);
    }
}

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
            '<p>If you see nothing below then that\'s probably because you aren\'t logged in and there are no public flicks.</p>' +
            '<p>Once you have an account you will be able to upload videos and share them with friends, family ' +
            'and the world.</p><p>There are other video content websites but most are geared towards free access for '+
            'everyone.  Here we value discresion and privacy.</p><p>Please do not upload indecent videos or ' +
            'material for which you don\'t have permission.  If you do it will be removed.</p>';
    }
    settings = JSON.stringify({ flickListPageLength: 10 });
    setHeaders(res);
    res.render('index', { 
        title: 'i-Flicks',
        js: js,
        css: css,
        usersCanCreateAccount: global.iflicks_settings.usersCanCreateAccount,
        showCookieBanner: showCookieBanner,
        showInfo: showInfo,
        info: info,
        version: '-- v' + packagejson.version,
        googleAnalyticsId: global.iflicks_settings.googleAnalyticsId
    });
});

/**
 * GET the video list for the grid view.
 * @param {number} page - The page number to retrieve for paginated views.
 * @param {number} limit - The number of records to return.
 * @param {string} search - Search term, does a limple pattern match.  Use "-" if you want everything.  This prevents the URL from dropping the trailing slash.
 * @method
 */
router.get('/flicklist/:page/:limit/:search', function (req, res, next) {
    var userId, isSysAdmin;
    if (req.user) {
        userId = req.user.id;
        isSysAdmin = req.user.isSysAdmin;
    }
    if (req.params.search === undefined || req.params.search === '-') {
        flicks.list(req.params.page, req.params.limit, userId, isSysAdmin, function (err, docs) {
            if (err) { err.code = err.code || 'F03001'; return next(err); }
            res.setHeader('Content-Type', 'application/json');
            res.send(docs);
        });
    } else {
        flicks.search(req.params.page, req.params.limit, req.params.search,  userId, isSysAdmin, function (err, docs) {
            if (err) { err.code = err.code || 'F03001'; return next(err); }
            res.setHeader('Content-Type', 'application/json');
            res.send(docs);
        });
    }
});

/** GET the text detail about a video
* @param {string} id - The _id of the video
* 
*/
router.get('/flickdetail/:id', function (req, res, next) {
    var userId, flick, isSysAdmin, retVal;
    if (req.user && req.user.id) {
        userId = req.user.id;
        isSysAdmin = req.user.isSysAdmin;
    }
    flick = new Flick();
    flick.load(req.params.id, userId, isSysAdmin, function (err) {
        if (err) { err.code = err.code || 'F03011'; console.log(err); return next(err); }
        retVal = flick.forBrowser;
        flickUser.timeGet(req.params.id, userId, function (err, time) {
            if (err) { err.code = err.code || 'F030017'; return next(err); }
            retVal.currentTime = time;
            res.setHeader('Content-Type', 'application/json');
            res.send(retVal);
        });
    });
});

/** GET the thumbnail image file
* @param {string} id - The _id of the video
* 
*/
router.get('/thumb/:id/:fileName', function (req, res, next) {
    var userId, isSysAdmin, flick, filePath;
    if (req.user) {
        userId = req.user.id;
        isSysAdmin = req.user.isSysAdmin;
    }
    flick = new Flick();
    flick.load(req.params.id, userId, isSysAdmin, function (err) {
        if (err) { return next(err); }
        if (flick.thumbnailPath === undefined || flick.thumbnailPath.indexOf('null') > -1) { err = new Error('Image missing (404)'); err.status = 404; return next(err); }
        setHeaders(res);
        /// If fileName is requested then get the path to that otherwise send the default.
        if (req.params.fileName !== undefined) {
            filePath = path.join(flick.thumbnailPath.substring(0, (flick.thumbnailPath.lastIndexOf('/') + 1)), req.params.fileName + path.extname(flick.thumbnailPath));
        } else {
            filePath = flick.thumbnailPath;
        }
        fs.stat(filePath, function(err) {
            if (err) { /// if err then assume file doesn't exist.
                filePath = flick.thumbnailPath;
            }
            res.sendFile(filePath, {}, function (err) {
                if (err) {
                    err.code = err.code || 'F03003';
                    return next(err);
                }
            });
        });
    });
});

/** GET the video stream
* @param {string} id - The _id of the video
* @param {string} filename - The variant of the file being requested (small.mp4, bit.webm etc.)
*/
router.get('/flick/:id/:fileName', function (req, res, next) {
    var userId, isSysAdmin, flick;
    if (req.user) {
        userId = req.user.id;
        isSysAdmin = req.user.isSysAdmin;
    }
    flick = new Flick();
    flick.load(req.params.id, userId, isSysAdmin, function (err) {
        if (err) {  err.code = err.code || 'F03004'; return next(err); }
        var file = path.join(flick.mediaPath + '/' + req.params.fileName);
        vidStreamer.settings({
            "rootFolder": flick.mediaPath,
            "rootPath": 'flick/' + flick.id
        });
        vidStreamer(req, res);
    });
    /*flick.view(req, function (err) {
        if (err) {
            logger.error(req,  'index.get.video.flickView',(err.code || 'F03016'), err, 2);
        }
    });*/
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
router.post('/playFlick/:id', function (req, res, next) {
    var userId, isSysAdmin, flick;
    if (req.user) {
        userId = req.user.id;
        isSysAdmin = req.user.isSysAdmin;
    }
    flick = new Flick(), ip = req.headers['x-real-ip'] || req.connection.remoteAddress || req.ip;
    flick.load(req.params.id, userId, isSysAdmin, function (err) {
        if (err) { err.code = err.code || 'F03007'; return next(err); }
        flick.play(ip, function (err, newCount) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({playcount: newCount});
        });
    });
});


/** POST a rating
* @param {string} id - The _id of the video
* 
*/
router.post('/rating/:id/:rating', function (req, res, next) {
    if (req.user === undefined) {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send({error: "You must be logged in to rate"});
        return;
    }
    var flick = new Flick(), ip = req.headers['x-real-ip'] || req.connection.remoteAddress || req.ip;
    flick.load(req.params.id, req.user.id, req.user.isSysAdmin, function (err) {
        if (err) { err.code = err.code || 'F030018'; return next(err); }
        flick.suggestRating(req.params.rating, req.user.id, ip, function (err) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).send({All: "OK"});
        });
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
    flickUser.timeUpdate(req.params.id, req.user.id, req.params.time, function (err) {
        if (err) { err.code = err.code || 'F030014'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send('{}');
    });
});

/** DELETE a video
* @param {string} id - The _id of the video
* 
*/
router.delete('/flick/:id', function (req, res, next) {
    if (!req.user) { var err = new Error('Delete access denied'); err.status = 401; return next(err); }
    var flick = new Flick();
    flick.load(req.params.id, req.user.id, req.user.isSysAdmin, function (err, flickf) {
        if (err) { err.code = err.code || 'F03012'; return next(err); }
        if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.

            flick.delete(function (err) {
                if (err) { err.code = err.code || 'F03008'; return next(err); }
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
    var flick = new Flick();
    flick.load(req.params.id, req.user.id, req.user.isSysAdmin, function (err, flickf) {
        if (err) { err.code = err.code || 'F03013'; return next(err); }
        if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.

            flick.remove(req.params.id, function (err) {
                if (err) { err.code = err.code || 'F03009'; return next(err); }
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
router.get('/flicklistunencoded/:page/:limit', function (req, res, next) {
    if (!req.user) { var err = new Error('This page is restricted to logged in people'); err.status = 401; return next(err); }
    //userId = req.user.id;
    flicks.listUnencoded(req.params.page, req.params.limit, req.user.id, function (err, flicks) {
        if (err) { err.code = err.code || 'F03010'; return next(err); }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(flicks);
    });
});

/** GET new videos event emmitter.  This sends a message when any new videos are added
* 
*/
router.get('/newflick', function (req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    global.newFlickNotificationRecipients.push(res);
    req.once('close', function () {
        global.newFlickNotificationRecipients.pop(res);
    });
});

/** POST edit text and access information for a video
* @param {Object} body - {id, name, description, public, directLink}
* 
*/
router.post('/editFlick', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    var flick = new Flick();
    flick.load(req.body.id, req.user.id, req.user.isSysAdmin, function (err, flickf) {
        if (err) { err.code = err.code || 'F03009'; return next(err); }
        if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.
            flick.name = req.body.name;
            flick.description = req.body.description;
            flick.isPublic = req.body.public;
            flick.isDirectLinkable = req.body.directLink;
            flick.tags = req.body.tags;
            flick.save(function (err) {
                if (err) { err.code = err.code || 'F03010'; return next(err); }
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
    var opt, user = new User();
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
    var user = new User();
    user.checkUserExists(req.body.username, function(err, userExists) {
        if (err) { return next(err); }
        if (userExists) {
            err = new Error('Username exists');
            return next(err);
        }
        if (req.body.username.length === 0 ||
            req.body.password === undefined ||
            req.body.password.length === 0 ||
            req.body.givenName.length === 0 ||
            req.body.familyName.length === 0 ||
            req.body.emailAddress.length === 0) {
            err = new Error('Required fields missing.');
            return next(err);
        }
        if ( /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i.test(req.body.emailAddress) === false) {
            err = new Error('Invalid email address.  If you think this is wrong please contact support.');
            return next(err);
        }
        user.username = req.body.username;
        user.password = req.body.password;
        user.givenName = req.body.givenName;
        user.familyName = req.body.familyName;
        user.emailAddress = req.body.emailAddress;
        user.isEnabled = true;
        user.isConfirmed = false;
        user.isSysAdmin = false;
        user.create(function (err, usr) {
            if (err) { return next(err); }
            res.send({reply: 'Hello ' + user.givenName});
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
            err.code = err.code || 'F03016';
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
                var flick = new Flick();
                flick.load(req.body.id, req.user.id, req.user.isSysAdmin, function (err, flickf) {
                    if (err) { err.code = err.code || 'F03021'; return next(err); }

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
                                    err.code = err.code || 'F03018';
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
                        archive.append(JSON.stringify(flick), { name:'flick.json' });
                        archive.finalize();                    
                    });

                    
                    res.setHeader('Content-Type', 'application/json');
                    res.status(200).send({All: "OK"});
                });
            }
        });
});

/** GET grant list of flick users
* 
*/
router.get('/flickuser', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    var flick = new Flick();
    flick.load(req.body.id, req.user.id, req.user.isSysAdmin, function (err, flickf) {
        if (err) { err.code = err.code || 'F03028'; return next(err); }
        if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.
            flickUser.get(flick.id, function (err, psudoUsers) {
                if (err) { err.code = err.code || 'F03029'; return next(err); }
                res.send({data: psudoUsers});
            });
        } else {
            err = new Error('Edit access denied'); err.status = 401; return next(err);
        }
    }); 
});

/** PUT grant a specified username or email address access
* 
*/
router.put('/flickuser', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    var flick = new Flick(), user = new User();
    user.load(req.body.searchTerm, function (err) {
        if (err) { err.code = err.code || 'F03026'; return next(err); }
        flick.load(req.body.id, req.user.id, req.user.isSysAdmin, function (err, flickf) {
            if (err) { err.code = err.code || 'F03022'; return next(err); }
            if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.
                flickUser.add(flick.id, user.id, req.body.searchTerm, function (err) {
                    if (err) { err.code = err.code || 'F03023'; return next(err); }
                    res.send({All: 'OK'});
                });
            } else {
                err = new Error('Edit access denied'); err.status = 401; return next(err);
            }
        });

    });
});

/** DELETE revoke a specified username or email address access rights
* 
*/
router.delete('/flickuser', function (req, res, next) {
    if (!req.user) { var err = new Error('Edit access denied'); err.status = 401; return next(err); }
    var flick = new Flick(), user = new User();
    user.load(req.body.searchTerm, function (err) {
        if (err) { err.code = err.code || 'F03027'; return next(err); }
        flick.load(req.body.id, req.user.id, req.user.isSysAdmin, function (err, flickf) {
            if (err) { err.code = err.code || 'F03024'; return next(err); }
            if ((flick.userId === req.user.id || req.user.isSysAdmin) && req.user.id !== undefined) {/// user is logged in and has permissions or is admin.
                flickUser.remove(flick.id, user.id, function (err) {
                    if (err) { err.code = err.code || 'F03025'; return next(err); }
                    res.send({All: 'OK'});
                });
            } else {
                err = new Error('Edit access denied'); err.status = 401; return next(err);
            }
        });
    });
});


/** GET user validation
* @todo remove this
* 
*/
router.get('/userconfirm/:userId/:key', function (req, res, next) {
    var user = new User();
    user.load(req.params.userId, function (err, usr) {
        if (err) { err.code = err.code || 'F03020'; return next(err); }
        user.checkConfirmationKey(req.params.key, function (err, isConfirmed) {
            if (err) { return next(err); }
            if (isConfirmed) {
                res.render('emailValidate', {confirmed: true, message: 'Your email has now been confirmed and so you can upload videos.  You will be redirected to the home page now.'});
            } else {
            res.render('emailValidate', {confirmed: false, message: 'Code does not match'});
            }
        });
    });
});

/** GET testing something out
* @todo remove this
* 
*/
router.get('/test', function (req, res, next) {
    flicks.search(1, 10, 'ABCDs Lokey', req.user, function (err, flcikList) {
        if (err) { return next(err); }
        res.send(flcikList);
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
        setHeaders(res);
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
    setHeaders(res);
    res.render('privacy', {title: 'i-flicks privacy and cookies'});
});

/** GET the home page but display a video inthe URL.  USed for deep linking videos.
* @param {string} vid - The _ID of the video.
* 
*/
router.get('/:vidName/:vid', function (req, res, next) {
    var userId, isSysAdmin;
    if (req.user) {
        userId = req.user.id;
        isSysAdmin = req.user.isSysAdmin;
    }
    var flick = new Flick();
    flick.load(req.params.vid, userId, isSysAdmin, function (err) {
        if (err) { err.code = err.code || 'F03014'; console.log(err); return next(err); }
        var js = 'js/index.js', 
            showCookieBanner = true,
            css = global.iflicks_settings.css;
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
        res.render('index', { 
            title: 'i-flicks',
            vid: req.params.vid,
            css: css,
            js: js,
            showCookieBanner: showCookieBanner,
            usersCanCreateAccount: global.iflicks_settings.usersCanCreateAccount,
            googleAnalyticsId: global.iflicks_settings.googleAnalyticsId
        });
    });
    
});
 /** Exports router */
module.exports = router;
