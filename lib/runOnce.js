// Error code F11
/**
 * Run this when the application is first installed.  It shows a page to create a new admin user.
* @module runOnce
 */
var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var User = require('../models/user');
var users = require('../models/users');


/** 
 * Display a page to enter a default admin user and password.  If users already exist then this is an upgrade. 
 */
router.get('/', function (req, res, next) {
    if (global.iflicks_settings.runOnce === true) {
        users.listAll(function (err, users) {
            if (users && users.length > 0) {
                console.log('Rename runOnce');
                fs.rename(path.join(__dirname, '../views/runOnce.hbs'), path.join(__dirname, '../views/runOnce.done.hbs'), function (err) {
                    if (err) { return next(err); }
                    global.iflicks_settings.runOnce = false;
                    res.redirect('/');
                });
            } else {
                res.render('runOnce', { title: 'i-Flicks', js: 'js/index.js' });

            }
        });
    } else {
        return next();
    }
});

/** 
* Create the initial admin user and the required directories. Some sync operations but this will only run once 
*/
router.post('/', function (req, res, next) {
    if (global.iflicks_settings.databasePath !== '' && global.iflicks_settings.databasePath !== undefined) {
        try {
            fs.mkdirSync(global.iflicks_settings.databasePath);
        } catch (errr) {
            if (errr && errr.message && errr.message.indexOf('EEXIST') === -1) { return next(errr); }
        }
    }
    var user = new User();
    user.username = req.body.username;
    user.password = req.body.password;
    user.firstName = req.body.firstName;
    user.lastName = '';
    user.emailAddress = req.body.emailAddress;

    user.isSysAdmin = true;
    user.isEnabled = true;
    user.isConfirmed = false;
    user.isDeleted = false;

    user.create(function (err, userId) {
        if (err) { return next(err); }
        fs.rename(path.join(__dirname, '../views/runOnce.hbs'), path.join(__dirname, '../views/runOnce.done.hbs'), function (err) {
            if (err) { return next(err); }
            global.iflicks_settings.runOnce = false;

            fs.mkdir(global.iflicks_settings.uploadPath, function (err) {
                if (err && err.message && err.message.indexOf('EEXIST') === -1) { return next(err); }
                fs.mkdir(global.iflicks_settings.uploadPath + '/archive', function (err) {
                    if (err && err.message && err.message.indexOf('EEXIST') === -1) { return next(err); }
                    fs.mkdir(global.iflicks_settings.uploadPath + '/notencoded', function (err) {
                        if (err && err.message && err.message.indexOf('EEXIST') === -1) { return next(err); }
                        fs.mkdir(global.iflicks_settings.mediaPath, function (err) {
                            if (err && err.message && err.message.indexOf('EEXIST') === -1) { return next(err); }
                            res.redirect('/');
                        });
                    });
                });
            });
        });
    });
});


module.exports = router;