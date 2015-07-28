var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var flick = require('../models/flick');
var flicks = require('../models/flicks');
var error = require('../models/error');
var users = require('../models/users');
var User = require('../models/user');
var utils = require('../lib/utils');
var gm = require('gm');

/** GET home page.
 * @totdo add security
 */
router.get('/', function (req, res, next) {
    var css = global.iflicks_settings.css;
    js = 'js/toolbox.js';
    if (global.iflicks_settings.env === 'production') {
        css = css.replace('.css', '.min.css');
        js = js.replace('.js', '.min.js');
    }
    res.render('toolbox', { title: 'i-Flicks toolbox', js: js, css: css });
});


router.get('/errorviewercol', function (req, res, next) {
    var cols = [
        {name: 'userId', value: 'User ID', type: 'text'},
        {name: 'action', value: 'Action', type: 'text'},
        {name: 'server', value: 'Server', type: 'text'},
        {name: 'errorCode', value: 'Code', type: 'text'},
        {name: 'error', value: 'Message', type: 'text'},
        {name: 'path', value: 'Path', type: 'text'},
        {name: 'dateEntered', value: 'Date', type: 'text'},
        {name: 'extraData', value: 'Extra', type: 'text'},
        {name: 'errorType', value: 'Type', type: 'text'}
    ];
    res.send(cols);
});


/** GET some recent errors */
router.get('/errorviewer/:limit/:search', function (req, res, next) {
    /*if (req.user.isSysAdmin !== true) {
        var err = new Error('Access is restricted to this data.');
        err.status = 403;
        err.code = 'F05002';
        return next(err);
    }*/
    var limit = req.params.limit, search = req.params.search;
    limit = limit || 10;
    if (search === '-') {
        search = undefined;
    }
    if (limit > 1000) {
       limit = 10;
    }
    error.list(limit, search, function (err, errorList) {
        if (err) {  return next(err); }
        errorList.reverse();
        res.send(errorList);
    });
});

router.get('/flickviewercol', function (req, res, next) {
    var cols = [
        {name: 'uploader', value: 'Uploader', type: 'text'},
        {name: 'name', value: 'Name', type: 'text'},
        {name: 'dateEntered', value: 'Upload time', type: 'text'},
        {name: 'playCount', value: 'Play count', type: 'text'},
        {name: 'isEncoded', value: 'Encoded', type: 'text'},
        {name: 'isDeleted', value: 'deleted', type: 'text'},
        {name: 'encoding', value: 'Encoding', type: 'text'},
        {name: 'encodeProgress', value: 'Progress', type: 'text'},
        {name: 'mediaPath', value: 'Path', type: 'text'}
    ];
    res.send(cols);
});

router.get('/flickviewer/:limit/:search', function (req, res, next) {
    var limit = req.params.limit, search = req.params.search;
    limit = limit || 10;
    if (search === '-') {
        search = undefined;
    }
    if (limit > 1000) {
       limit = 10;
    }
    flicks.listAllSearch(limit, search, function (err, flickList) {
        if (err) {  return next(err); }
        res.send(flickList);
    });
});

router.get('/flickviewsviewercol', function (req, res, next) {
    var cols = [
        {name: 'flickId', value: 'Flick ID', type: 'text'},
        {name: 'userId', value: 'User ID', type: 'text'},
        {name: 'ipAddress', value: 'IP', type: 'text'},
        {name: 'dateEntered', value: 'Date viewed', type: 'text'}
    ];
    res.send(cols);
});

router.get('/flickviewsviewer/:limit/:search', function (req, res, next) {
    var limit = req.params.limit, search = req.params.search;
    limit = limit || 10;
    if (search === '-') {
        search = undefined;
    }
    if (limit > 1000) {
       limit = 10;
    }
    flicks.listAllViews(limit, search, function (err, flickList) {
        if (err) {  return next(err); }
        flickList.reverse();
        res.send(flickList);
    });
});

router.get('/userviewercol', function (req, res, next) {
    var cols = [
        {name: 'username', value: 'Username', type: 'inputText'},
        {name: 'firstName', value: 'First name', type: 'inputText'},
        {name: 'lastName', value: 'Last name', type: 'inputText'},
        {name: 'emailAddress', value: 'Email', type: 'inputText'},
        {name: 'password', value: 'Password', type: 'inputText'},
        {name: 'isConfirmed', value: 'Email confirmed', type: 'inputCheckbox'},
        {name: 'isSysAdmin', value: 'Admin', type: 'inputCheckbox'},
        {name: 'isDisabled', value: 'Disabled', type: 'inputCheckbox'},
        {name: 'userSave', value: 'Save', type: 'inputSave', handler: 'amendUser'},
        {name: 'userDelete', value: 'Delete', type: 'inputSave', handler: 'deleteUser'}
    ];
    res.send(cols);
});

router.get('/userviewer/:limit/:search', function (req, res, next) {
    var limit = req.params.limit, search = req.params.search;
    limit = limit || 10;
    if (search === '-') {
        search = undefined;
    }
    if (limit > 1000) {
       limit = 10;
    }
    users.listAllSearch(limit, search, function (err, usersList) {
        if (err) {  return next(err); }
        res.send(usersList);
    });
});


/** GET FFmpegAvailableFormats column array
* 
*/
router.get('/ffmpegAvailableFormatscol', function (req, res, next) {
    var cols = [
        {name: 'name', value: 'Name', type: 'text'},
        {name: 'description', value: 'Description', type: 'text'},
        {name: 'canDemux', value: 'Can Demux', type: 'text'},
        {name: 'canMux', value: 'Can Mux', type: 'text'}
    ];
    res.send(cols);
});


/** GET FFmpegAvailableFormats
* 
*/
router.get('/ffmpegAvailableFormats/:limit/:search', function (req, res, next) {
    var limit = req.params.limit, search = req.params.search;
    limit = limit || 10;
    if (search === '-') {
        search = undefined;
    }
    if (limit > 10000) {
       limit = 2;
    }
    utils.getFFmpegAvailableFormats(limit, search, function (err, output) {
        if (err) { return next(err); }
        res.send(output);
    });
});


/** GET FFmpegAvailableCodecs column array
* 
*/
router.get('/ffmpegAvailableCodecscol', function (req, res, next) {
    var cols = [
        {name: 'name', value: 'Name', type: 'text'},
        {name: 'description', value: 'Description', type: 'text'},
        {name: 'type', value: 'Type', type: 'text'},
        {name: 'canEncode', value: 'Can encode', type: 'text'},
        {name: 'canDecode', value: 'Can decode', type: 'text'},
        {name: 'intraFrameOnly', value: 'Intra Frame Only', type: 'text'},
        {name: 'isLossy', value: 'Is lossy', type: 'text'},
        {name: 'isLossless', value: 'Is Lossless', type: 'text'}
    ];
    res.send(cols);
});


/** GET FFmpegAvailableCodecs
* 
*/
router.get('/ffmpegAvailableCodecs/:limit/:search', function (req, res, next) {
    var limit = req.params.limit, search = req.params.search;
    limit = limit || 10;
    if (search === '-') {
        search = undefined;
    }
    if (limit > 10000) {
       limit = 2;
    }
    utils.getFFmpegAvailableCodecs(limit, search, function (err, output) {
        if (err) { return next(err); }
        res.send(output);
    });
});

router.delete('/user', function (req, res, next) {
    var user = new User(req);
    user.load(req.body.userId, function (err, usr) {
        if (err) { return next(err); }
        user.delete(function (err) {
            if (err) { return next(err); }
            res.send({reply: 'Deleted'});
        });
    });
});
router.put('/user', function (req, res, next) {
    var user = new User(req);
    user.checkUserExists(req.body.username, function (err, userExists) {
        if (err) { return next(err); }
        if (userExists) {
            err = new Error('Username exists');
            return next(err);
        }

        if (err) { return next(err); }
        console.log(req.body);
        if (req.body.username.length === 0 || 
            req.body.password.length === 0 ||
            req.body.firstName.length === 0 ||
            req.body.lastName.length === 0 ||
            req.body.emailAddress.length === 0) {
            return next(new Error('Some fields are missing'));
        }
        user.username = req.body.username;
        user.password = req.body.password;
        user.firstName = req.body.firstName;
        user.lastName = req.body.lastName;
        user.emailAddress = req.body.emailAddress;
        user.isSysAdmin = req.body.isSysAdmin || false;
        user.isConfirmed = req.body.isConfirmed || false;
        user.isEnabled = req.body.isEnabled || true;
        user.create(function (err, usr) {
            res.send({reply: 'Hello to ' + usr.username});
        });
    });
});

router.post('/user', function (req, res, next) {
    var user = new User(req);
    user.load(req.body.userId, function (err, usr) {
        if (err) { return next(err); }
        user.firstName = req.body.firstName || user.firstName;
        user.lastName = req.body.lastName || user.lastName;
        user.emailAddress = req.body.emailAddress || user.emailAddress;
        user.isSysAdmin = req.body.isSysAdmin || false;
        user.isDisabled = req.body.isDisabled || false;
        user.includeDisabled = true;
        if (req.body.isConfirmed !== undefined) {
            user.isConfirmed = req.body.isConfirmed;
        }

        if (req.body.password !== undefined && req.body.password !== '') {
            user.password = req.body.password;
        }

        if (req.body.username !== user.username) {
            user.checkUserExists(req.body.username, function (err, userExists) {
                if (err) { return next(err); }
                if (userExists) {
                    err = new Error('Username exists');
                    return next(err);
                }
                user.username = req.body.username || user.username;
                user.save(function (err) {
                    if (err) { return next(err); }
                    res.send({reply: 'Saved'});
                });
            });
        } else {
            user.username = req.body.username || user.username;
            user.save(function (err) {
                if (err) { return next(err); }
                res.send({reply: 'Saved'});
            });
        }
    });
});

module.exports = router;
