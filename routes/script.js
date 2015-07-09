// Error code F03
var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');

function setHeaders(res, contentType) {
    var seconds = 14 * 24 * 3600;// 4 days
    res.setHeader('Cache-Control', 'public, max-age=' + seconds); 
    res.setHeader('Expires', new Date(Date.now() + (seconds * 1000)).toUTCString());

    if (contentType) {
        res.setHeader('Content-Type', contentType);
    }
}

router.get('/video.js', function (req, res, next) {
	if (global.iflicks_settings.env === 'production') {
        setHeaders(res, 'text/javascript');
		res.sendFile(path.join(__dirname, '../node_modules/video.js/dist/video-js/video.js'));
	} else {
        res.sendFile(path.join(__dirname, '../node_modules/video.js/dist/video-js/video.dev.js'));
	}
});
router.get('/video-js.css', function (req, res, next) {
    if (global.iflicks_settings.env === 'production') {
        setHeaders(res, 'text/css');
        res.sendFile(path.join(__dirname, '../node_modules/video.js/dist/video-js/video-js.min.css'));
    } else {
        res.sendFile(path.join(__dirname, '../node_modules/video.js/dist/video-js/video-js.css'));
    }
});
router.get('/font/:font', function (req, res, next) {
    setHeaders(res, 'text/css');
    res.sendFile(path.join(__dirname, '../node_modules/video.js/dist/video-js/font/' + req.params.font));
});

router.get('/video-js.swf', function (req, res, next) {
    res.sendFile(path.join(__dirname, '../node_modules/video.js/dist/video-js/video-js.swf'));
});
router.get('/promise.js', function (req, res, next) {
	if (global.iflicks_settings.env === 'production') {
        setHeaders(res, 'text/javascript');
		res.sendFile(path.join(__dirname, '../node_modules/es6-promise/dist/es6-promise.min.js'));
	} else {
		res.sendFile(path.join(__dirname, '../node_modules/es6-promise/dist/es6-promise.js'));
	}
});
router.get('/history.js', function (req, res, next) {
    if (global.iflicks_settings.env === 'production') {
        setHeaders(res, 'text/javascript');
        res.sendFile(path.join(__dirname, '../node_modules/html5-history-api/history.min.js'));
    } else {
        res.sendFile(path.join(__dirname, '../node_modules/html5-history-api/history.js'));
    }
});
router.get('/fetch.js', function (req, res, next) {
    setHeaders(res, 'text/javascript');
    res.sendFile(path.join(__dirname, '../node_modules/fetch-polyfill/fetch.js'));
    
});
router.get('/classlist.js', function (req, res, next) {
    setHeaders(res, 'text/javascript');
    res.sendFile(path.join(__dirname, '../node_modules/classlist-polyfill/src/index.js'));
});
/*if (global.iflicks_settings.env === 'production') {
        app.use('/promise.js', express.static(path.join(__dirname, 'node_modules/promise-polyfill/Promise.min.js')));
        app.use('/video.js', express.static(path.join(__dirname, 'node_modules/video.js/dist/video-js/video.js')));
        app.use(morgan('common'));
    } else {
        app.use('/promise.js', express.static(path.join(__dirname, 'node_modules/promise-polyfill/Promise.js')));
        app.use('/video.js', express.static(path.join(__dirname, 'node_modules/video.js/dist/video-js/video.dev.js')));
        app.use(morgan('dev'));
    }
    app.use('/fetch.js', express.static(path.join(__dirname, 'node_modules/whatwg-fetch/fetch.js')));
    app.use('/video-js.swf', express.static(path.join(__dirname, 'node_modules/video.js/dist/video-js/video-js.swf')));
    
*/

 /** Exports router */
module.exports = router;