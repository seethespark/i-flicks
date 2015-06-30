var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var multer  = require('multer');
var archiver = require('archiver');
var DecompressZip = require('decompress-zip');
var flick = require('../models/flick');
var logger = require('../lib/logger');


router.get('/testconnection', function (req, res, next) {
    res.send('f');
});


router.put('/copy',
    multer({
        dest: path.join(global.iflicks_settings.uploadPath, '/notencoded/'),
        /*changeDest: function (dest, req, res) {
            //console.log(res);
            return path.join(global.iflicks_settings.uploadPath, '/notencoded/');
        },*/
        onError: function (err, next) { 
            console.log('Broken');
            err.code = 'F06001'; 
            logger.errorNoReq('api.copy.post.multer', 'F06006', err, 2);
            next(err); 
        },
        onFileUploadStart: function (file, req, res) {
            //console.log(file);
            if (req.user === undefined) {
                res.status(500).send('Missing user');
                return;
            }
        },
        onFileSizeLimit: function (file) {
          console.log('Failed: ', file.originalname);
          fs.unlink('./' + file.path); // delete the partially written file 
        },
        onFilesLimit: function () {
          console.log('Crossed file limit!');
        },
        onFieldsLimit: function () {
          console.log('Crossed fields limit!');
        },
        onPartsLimit: function () {
          console.log('Crossed parts limit!');
        },
        onFileUploadComplete: function (file, req, res) {
            if (req.user === undefined) {
                res.status(500).send('Missing user');
                return;
            }
            var doc, storageName, storagePath, unzipper;
            storageName = file.name.substring(0, file.name.lastIndexOf('.'));
            storagePath = path.join(global.iflicks_settings.uploadPath, storageName);

            unzipper = new DecompressZip(file.path);
            unzipper.on('error', function (err) {
                logger.error(req, 'api.copy.post.unzip', 'F06003', err, 2);
            });
            
            unzipper.on('extract', function (log) {
                fs.unlink(file.path, function () {});
                fs.readFile(path.join(storagePath, '/flick.json'), {encoding: 'utf8', flag: 'r'}, function (err, file) {

                    if (err) { logger.error(req, 'api.copy.post.reafFlickJson', 'F06004', err, 2); }
                    if (file === undefined) { logger.error(req, 'api.copy.post.reafFlickJson.1', 'F06005', err, 2); }
                    file = JSON.parse(file);
                    file.uploader = req.user.id;
                    file.encoded = true;
                    file.mediaPath = storagePath;
                    file.storageName = storageName;

                    flick.add(file, function (err) {
                        if (err) { logger.error(req, 'api.copy.post.addFlick', 'F06002', err, 2); }
                        global.newVideoNotificationRecipients.forEach(function (res) {
                            res.write('event: newVideo\ndata: "reload"\nretry: 10000\n\n');
                            res.flush();
                        });
                    });
                });
            });
            unzipper.extract({
                path: storagePath,
                filter: function (filee) {
                    return filee.type !== "SymbolicLink";
                }
            });
        }
    }),
    function (req, res, next) {
        //console.log(req.user);
        res.status(202).send('Received');
    });


module.exports = router;
