var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var multer = require('multer');
var logger = require('../lib/logger');
var Flick = require('../models/flick');
/**
 * upload module.
 * @module upload
 */

/**  Receive an upload file */
router.put('/:filename',
    multer({
        changeDest: function (dest, req, res) {
            return path.join(global.iflicks_settings.uploadPath, '/notencoded/');
        },
        onError: function (err, next) { err.code = 'F04001'; next(err); },
        onFileUploadStart: function (file, req, res) {
        /*console.log(req.body);
            }*/
        },
        onFileUploadComplete: function (file, req, res) {
            if (req.body.name === undefined || req.body.name === '') {
                res.status(500).send('Error: Name must be supplied.');
                res.end();
                return;
            }
            if (req.user.isConfirmed !== true) {
                res.status(500).send('Error: email not confirmed.');
                res.end();
                return;
            }
            var doc, folderName;
            folderName = file.name.substring(0, file.name.lastIndexOf('.'));

            var flick = new Flick();
            flick.userId = req.user.id;
            flick.name = req.body.name;
            flick.tags = req.body.tags;
            flick.description = req.body.description;
            flick.folderName = folderName;
            flick.originalName = file.originalname;
            flick.isEncoding = false;
            flick.isEncoded = false;
            flick.isPublic = false;
            flick.isDirectLinkable = false;
            flick.sourcePath = file.path;
            flick.originalname = file.originalname;
            flick.emailWhenEncoded = req.body.emailWhenEncoded;
            /*doc = {
 
                emailComplete: req.body.emailComplete,
                storageName: storageName,
                path: file.path,
                originalname: file.originalname
            };*/
            //console.log(req.body);
            //flick.setStatsD(req.statsD);

            flick.create(function (err) {
                if (err) {
                    err.code = err.code || 'F04001';
                    logger.error(req,  'upload.put.flickCreate', err.code, err, 2);
                    return (err);
                }
            });
        }
    }),
    function (req, res, next) {
        //console.log(req.body);
        if (Object.keys(req.files).length === 0) {
            console.log('No file');
            res.status(500).send('Error: No file received.');
        } else if (req.body.name === undefined || req.body.name === '') {
            console.log('No name');
            res.status(500).send('Error: Name must be supplied.');
        } else if (req.user.isConfirmed !== true) {
            console.log('Email not confirmed');
            res.status(500).send('Error: email not confirmed.');
        }else {
            res.status(202).send('Received and now encoding.');
        }
    });

module.exports = router;
