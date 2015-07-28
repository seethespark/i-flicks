/*jslint unparam: true*/
var express = require('express');
var path = require('path');
var fs = require('fs');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compress = require('compression');
var StatsD = require('statsd-client');
var session = require('express-session');
var NedbSession = require('connect-nedb-session-two')(session);
var StatsD = require('statsd-client');

global.iflicks_settings = require('./settings');


/** Main application entry point
* @return {Object}
*/

/** Return the module */
module.exports = function ret(sett) {
    var app = express();

    global.iflicks_settings.nedbPath = sett.nedbPath || global.iflicks_settings.nedbPath || '';
    global.iflicks_settings.uploadPath = sett.uploadPath || global.iflicks_settings.uploadPath || '';
    global.iflicks_settings.mediaPath = sett.mediaPath || global.iflicks_settings.mediaPath || '';
    global.iflicks_settings.ffmpegPath = sett.ffmpegPath || global.iflicks_settings.ffmpegPath;
    global.iflicks_settings.ffprobePath = sett.ffprobePath || global.iflicks_settings.ffprobePath;
    global.iflicks_settings.flvMetaPath = sett.flvMetaPath || global.iflicks_settings.flvMetaPath;
    global.iflicks_settings.maxFFmpegInsatances = sett.maxFFmpegInsatances || global.iflicks_settings.maxFFmpegInsatances;
    global.iflicks_settings.statsDServer = sett.statsDServer;
    global.iflicks_settings.statsDDebug = sett.statsDDebug;
    global.iflicks_settings.statsDPrefix = sett.statsDPrefix;
    global.iflicks_settings.gmailUsername = sett.gmailUsername;
    global.iflicks_settings.gmailPassword = sett.gmailPassword;
    global.iflicks_settings.mailgunKey = sett.mailgunKey;
    global.iflicks_settings.mailgunDomain = sett.mailgunDomain;
    global.iflicks_settings.mailFrom = sett.mailFrom || global.iflicks_settings.mailFrom;
    global.iflicks_settings.usersCanCreateAccount = sett.usersCanCreateAccount;
    global.iflicks_settings.css = sett.css || global.iflicks_settings.css;
    global.iflicks_settings.env = sett.env || process.env.NODE_ENV;
    global.iflicks_settings.googleAnalyticsId = sett.googleAnalyticsId;
    global.iflicks_settings.baseURL = sett.baseURL;
    global.iflicks_settings.databaseType = sett.databaseType || global.iflicks_settings.databaseType;
    global.iflicks_settings.sqlServerServer = sett.sqlServerServer;
    global.iflicks_settings.sqlServerUsername = sett.sqlServerUsername;
    global.iflicks_settings.sqlServerPassword = sett.sqlServerPassword;
    global.iflicks_settings.sqlServerDatabaseName = sett.sqlServerDatabaseName;
    global.iflicks_settings.showErrorsInConsole = sett.showErrorsInConsole || global.iflicks_settings.showErrorsInConsole;

    /// Setup the global connections
    if (global.iflicks_settings.databaseType === 'sqlserver') {
        require('./lib/sqlserver.js');
    }
    if (global.iflicks_settings.databaseType === 'nedb') {
        require('./lib/nedb.js');
    }
    app.use(require('./lib/restarting'));
    /// Setup statsD and attach it to the statsD module for global use. 
    if (global.iflicks_settings.statsDServer !== undefined) {
        var statsDParams = {
            host: global.iflicks_settings.statsDServer,
            prefix: global.iflicks_settings.statsDPrefix,
            debug: global.iflicks_settings.statsDDebug
        };

        statsD = new StatsD(statsDParams);
        StatsD.globalStatsD = statsD;

        /// Add a listener to the end of the request to log the duration
        app.use(function (req, res, next) {
            var start = new Date();
            res.on('finish', function () {
                statsD.timing('page_load', start);
            });
            next();
        });
    }
    var utils = require('./lib/utils');
    var runOnce = require('./lib/runOnce');
    var logger = require('./lib/logger');
    var routes = require('./routes/index');
    var upload = require('./routes/upload');
    var toolbox = require('./routes/toolbox');
    var script = require('./routes/script');
    var api = require('./routes/api');
    var security = require('./lib/security');

    global.newVideoNotificationRecipients = [];

    app.enable('strict routing');//???


    ///// NOTE::: Enocde currently unreliable when called this way.
    utils.cleanMedia();
    utils.encode();
    utils.pingNewVideo();

    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'hbs');


    app.use(compress());
    /** Set the cache header on static files  */
    app.get('/*', function (req, res, next) {
        if ((global.iflicks_settings.env === 'production') && (req.url.indexOf("/img/") === 0 || req.url.indexOf("/css/") === 0 || req.url.indexOf("/js/") === 0  || req.url.indexOf("/video.js") === 0)) {
            res.setHeader("Cache-Control", "public, max-age=2592000");
            res.setHeader("Expires", new Date(Date.now() + 2592000000).toUTCString());
        }
        next();
    });
    // uncomment after placing your favicon in /public
    app.use(favicon(__dirname + '/public/favicon.ico'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use('/doc', express.static(path.join(__dirname, 'doc')));
    /*if (global.iflicks_settings.env === 'production') {
        app.use('/promise.js', express.static(path.join(__dirname, 'node_modules/promise-polyfill/Promise.min.js')));
        app.use('/video.js', express.static(path.join(__dirname, 'node_modules/video.js/dist/video-js/video.js')));
        app.use(morgan('common'));
    } else {
        app.use('/promise.js', express.static(path.join(__dirname, 'node_modules/promise-polyfill/Promise.js')));
        app.use('/video.js', express.static(path.join(__dirname, 'node_modules/video.js/dist/video-js/video.dev.js')));
        
    }
    app.use('/fetch.js', express.static(path.join(__dirname, 'node_modules/whatwg-fetch/fetch.js')));
    app.use('/video-js.swf', express.static(path.join(__dirname, 'node_modules/video.js/dist/video-js/video-js.swf')));
    */
    app.use(morgan('dev'));
    if (sett.cssPath) {
        app.use('/css/index.css', express.static(sett.cssPath));
        app.use('/css/index.min.css', express.static(sett.cssPath));
    }
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(session({ secret: sett.sessionSecret,
        key: 'iflicks_cookie',
        resave: false,
        saveUninitialized: false,
        cookie: { path: '/',
            httpOnly: true,
            maxAge: 1.2 * 24 * 3600 * 1000   // One day for example 
            },
        store: new NedbSession({ filename: 'sessiondb', clearInterval: 24 * 3600 * 1000 })
        }));
    app.use(security.initialize); // Add passport initialization
    app.use(security.session);    // Add passport initialization 

    if (global.iflicks_settings.runOnce === true) {
        try {
            fs.statSync(path.join(__dirname, '/views/runOnce.hbs'));
            app.use(runOnce);
        } catch (ex) {
            global.iflicks_settings.runOnce = false;
        }
    }
    app.use('/login', security);
    app.use('/script', script);
    app.use('/toolbox', security.ensureAuthenticated, toolbox);
    app.use('/api/*', security.basicAuth);
    app.use('/api', security.ensureAuthenticated, api);
    app.use('/upload', security.ensureAuthenticated, upload);
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
    if (global.iflicks_settings.env === 'development') {
        app.use(function (err, req, res, next) {
            err.code = err.code || 'F01001';
            logger.error(req, 'app.errorHandler', err.code, err, 2);
            res.status(err.status || 500);
            //console.log(req.headers);
            if (req.headers.accept === 'application/json' || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                res.send({error: err.message});
            } else {
                res.render('error', {
                    message: err.message + ' ' + err.code,
                    error: err,
                    css: global.iflicks_settings.css
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
        if (req.headers.accept === 'application/json' || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.send({error: err.message});
        } else {
            res.render('error', {
                message: err.message,
                error: {},
                css: global.iflicks_settings.css
            });
        }
    });

    return app;
};
