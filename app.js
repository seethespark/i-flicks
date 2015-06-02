/** app.js for iFlicks
*/
var express = require('express');
var path = require('path');
var fs = require('fs');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var StatsD = require('statsd-client');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var NedbSession = require('connect-nedb-session-two')(session);
//var Nedb = require('nedb');

global.iflicks_settings = require('./settings');

var utils = require('./lib/utils');
var runOnce = require('./lib/runOnce');
var logger = require('./lib/logger');
var routes = require('./routes/index');
var upload = require('./routes/upload');
var toolbox = require('./routes/toolbox');
var User = require('./models/user');

//var ffmpeg = require('fluent-ffmpeg');
module.exports = function ret (sett) {
    global.newVideoNotificationRecipients = [];
    var statsD, app = express();

    global.iflicks_settings.databasePath = sett.databasePath || global.iflicks_settings.databasePath;
    global.iflicks_settings.uploadPath = sett.uploadPath || global.iflicks_settings.uploadPath;
    global.iflicks_settings.mediaPath = sett.mediaPath || global.iflicks_settings.mediaPath;
    global.iflicks_settings.ffmpegPath = sett.ffmpegPath || global.iflicks_settings.ffmpegPath;
    global.iflicks_settings.ffprobePath = sett.ffprobePath || global.iflicks_settings.ffprobePath;
    global.iflicks_settings.flvMetaPath = sett.flvMetaPath || global.iflicks_settings.flvMetaPath;
    global.iflicks_settings.maxFFmpegInatances = sett.maxFFmpegInatances || global.iflicks_settings.maxFFmpegInatances;


    app.enable('strict routing');//???

    if (global.iflicks_settings.statsDServer !== undefined) {
        var statsDParams = {
            host: global.iflicks_settings.statsDServer,
            prefix: global.iflicks_settings.appId + '_' + global.iflicks_settings.customerId + '.',
            debug: global.iflicks_settings.statsDDebug
        };

        statsD = new StatsD(statsDParams);

        app.use(function (req, res, next) {
            //statsD.increment('page_view');
            /// Make statsD available in our routers
            req.statsD = statsD;
            next();
        });

        /// Add a listener to the end of the request to log the duration
        app.use(function (req, res, next) {
            var start = new Date();
            res.on('finish', function () {
                req.statsD.timing('page_load', start);
            });
            next();
        });
    }

    ///// NOTE::: Enocde currently unreliable when called this way.
    utils.cleanMedia();
    utils.encode(statsD);
    utils.pingNewVideo();

    passport.serializeUser(function (user, done) {
        done(null, user);
    });
    passport.deserializeUser(function (user, done) {
        done(null, user);
    });
    passport.use(new LocalStrategy({passReqToCallback: true},
        function (req, username, password, done) {
            var user = new User(req);
            user.authenticate(username, password, function (err, user) {
                done(err, user.userForSession());
            });
        }
        ));

    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'hbs');

    // uncomment after placing your favicon in /public
    //app.use(favicon(__dirname + '/public/favicon.ico'));
    app.use(morgan('dev'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use('/doc', express.static(path.join(__dirname, 'doc')));
    app.use('/video.js', express.static(path.join(__dirname, 'node_modules/video.js/dist/video-js/video.js')));
    app.use('/fetch.js', express.static(path.join(__dirname, 'node_modules/whatwg-fetch/fetch.js')));
    app.use('/promise.js', express.static(path.join(__dirname, 'node_modules/promise-polyfill/Promise.js')));
    if(sett.cssPath) {
        app.use('/css/index.css', express.static(sett.cssPath));
    }
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(session({ secret: 'scrambledeggs',
        key: 'iflicks_cookie',
        resave: false,
        saveUninitialized: false,
        cookie: { path: '/',
            httpOnly: true,
            maxAge: 1 * 24 * 3600 * 1000   // One day for example 
            },
        store: new NedbSession({ filename: 'sessiondb', clearInterval: 24 * 3600 * 1000 })
        }));
    app.use(passport.initialize()); // Add passport initialization
    app.use(passport.session());    // Add passport initialization

    function ensureAuthenticated(req, res, next) {
        if (req.isAuthenticated()) { return next(); }
        res.redirect(utils.pagePathLevel(req.originalUrl) + 'login?path=./' + utils.pagePathLevel(req.originalUrl) + req.originalUrl.substr(1));
    }

    app.post('/login', function (req, res, next) {
        passport.authenticate('local', function (err, user, info) {
            if (err) {
                err.status = 401;
                return next(err);
            }
            if (!user && req.headers['content-type'] === 'application/json') {
                err = new Error('Incorrect username or password.');
                err.status = 401;
                return next(err);
            }
            if (!user) {
                return res.redirect('/login');
            }
            req.logIn(user, function (err) {
                if (err) {
                    return next(err);
                }
                if (req.body.path === '') {
                    req.body.path = './';
                }
                if (req.body.path !== undefined && req.body.path.length > 0) {
                    return res.redirect(req.body.path);
                } else {
                    return res.status(200).send(user.userForBrowser());
                }
            });
        })(req, res, next);
    });


    app.get('/login', function (req, res, next) {
        if (req.user) {
            var user = new User(req);
            user.load(req.user.id, function (err, usr) {
                if (err) {
                    return next(err);
                }
                res.send(usr.userForBrowser());
            });
        } else {
            res.status(401).send('');
        }
    });
    // route to log out
    app.delete('/login', function (req, res) {
        req.logOut();
        res.status(204).end();
    });

    if (global.iflicks_settings.runOnce === true) {
        try {
            fs.statSync(path.join(__dirname, '/views/runOnce.hbs'));
            app.use(runOnce);
        } catch (ex) {
            global.iflicks_settings.runOnce = false;
        }
    }
    app.use('/toolbox', toolbox);
    app.use('/upload', upload);
    app.use('/', routes);

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    // error handlers

    // development error handler
    // will print stacktrace
    if (app.get('env') === 'development') {
        app.use(function (err, req, res, next) {
            err.code = err.code || 'F01001';
            logger.error(req, 'app.errorHandler', err.code, err, 2);
            res.status(err.status || 500);
            //console.log(req.headers);
            if (req.headers.accept === 'application/json' || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                res.send({error: err.message});
            } else {
                res.render('error', {
                    message: err.message,
                    error: err
                });
            }
        });
    }

    // production error handler
    // no stacktraces leaked to user
    app.use(function (err, req, res, next) {
        err.code = err.code || 'F01002';
        logger.error(req, 'app.errorHandler', err.code, err, 2);
        res.status(err.status || 500);
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.send(err.message);
        } else {
            res.render('error', {
                message: err.message,
                error: {}
            });
        }
    });

    return app;
};
