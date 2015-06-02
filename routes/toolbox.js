var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var flick = require('../models/flick');
var flicks = require('../models/flicks');
var error = require('../models/error');
var users = require('../models/users');
var User = require('../models/user');
var gm = require('gm');


/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('toolbox', { title: 'i-Flicks toolbox', js: 'js/toolbox.js', css: 'css/toolbox.css' });
});

router.get('/errorviewer/:count', function (req, res, next) {
    /*if (req.user.isSysAdmin !== true) {
        res.status(403).send('access is restricted to this data.');
        return;
    }*/
    if (req.params.count === undefined || req.params.count > 200) {
        req.params.count = 10;
    }
    if (req.params.count === 0 || req.params.count === '0') {
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
    } else {
        error.list(req.params.count, function (err, errorList) {
            if (err) {  return next(err); }
            var i, newList = [];
            for (i = errorList.length - 1; i > -1; i--) {
                newList.push(errorList[i]);
            }
            res.send(newList);
        });
    }
});

router.get('/flickviewercol', function (req, res, next) {
    var cols = [
        {name: 'uploader', value: 'Uploader', type: 'text'},
        {name: 'name', value: 'Name', type: 'text'},
        {name: 'uploadTime', value: 'Upload time', type: 'text'},
        {name: 'playCount', value: 'Play count', type: 'text'},
        {name: 'encoded', value: 'Encoded', type: 'text'},
        {name: 'deleted', value: 'deleted', type: 'text'},
        {name: 'encoding', value: 'Encoding', type: 'text'},
        {name: 'encodeProgress', value: 'Progress', type: 'text'},
        {name: 'mediaPath', value: 'Path', type: 'text'}
    ];
    res.send(cols);
});

router.get('/flickviewer', function (req, res, next) {
    flicks.listAll(function (err, flickList) {
        if (err) {  return next(err); }

        res.send(flickList);
    });
});

router.get('/userviewercol', function (req, res, next) {
    var cols = [
        {name: 'username', value: 'Username', type: 'inputText'},
        {name: 'forename', value: 'Forename', type: 'inputText'},
        {name: 'emailAddress', value: 'Email', type: 'inputText'},
        {name: 'password', value: 'Password', type: 'inputText'},
        {name: 'isSysAdmin', value: 'Admin', type: 'inputCheckbox'},
        {name: 'userSave', value: 'Save', type: 'inputSave', handler: 'amendUser'},
        {name: 'userDelete', value: 'Delete', type: 'inputSave', handler: 'deleteUser'}
    ];
    res.send(cols);
});

router.get('/userviewer', function (req, res, next) {
    users.listAll(function (err, usersList) {
        if (err) {  return next(err); }

        res.send(usersList);
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
            usr.isSysAdmin = req.body.isSysAdmin;

            //usr.isSysAdmin = true;
            usr.customerId = 0;
            usr.save(function (err) {
                if (err) { return next(err); }
                res.send({reply: 'Hello to ' + usr.username});
            });
        });
    });
});

router.post('/user', function (req, res, next) {
    var user = new User(req);
    user.load(req.body.userId, function (err, usr) {
        if (err) { return next(err); }
        user.forename = req.body.forename || user.forename;
        user.emailAddress = req.body.emailAddress || user.emailAddress;
        user.isSysAdmin = req.body.isSysAdmin;
        //console.log(req.body.isSysAdmin);

        if (req.body.password !== undefined && req.body.password !== '') {
            user.password = req.body.password;
        }

        if (req.body.username !== user.username) {
            user.checkUserExists(req.body.username, function(err, userExists) {
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
