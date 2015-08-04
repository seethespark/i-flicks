var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var multer  = require('multer');
var archiver = require('archiver');
var DecompressZip = require('decompress-zip');
var Flick = require('../models/flick');
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
            var doc, folderName, mediaPath, unzipper, tmpFlick;
            folderName = file.name.substring(0, file.name.lastIndexOf('.'));
            mediaPath = path.join(global.iflicks_settings.uploadPath, folderName);

            unzipper = new DecompressZip(file.path);
            unzipper.on('error', function (err) {
                logger.error(req, 'api.copy.post.unzip', 'F06003', err, 2);
            });
            
            unzipper.on('extract', function (log) {
                fs.unlink(file.path, function () {});
                fs.readFile(path.join(mediaPath, '/flick.json'), {encoding: 'utf8', flag: 'r'}, function (err, file) {

                    if (err) { logger.error(req, 'api.copy.post.reafFlickJson', 'F06004', err, 2); }
                    if (file === undefined) { logger.error(req, 'api.copy.post.realFlickJson.1', 'F06005', err, 2); }
                    tmpFlick = JSON.parse(file);
                    var flick = new Flick();
                    flick.userId = req.user.id;
                    flick.name = tmpFlick.name;
                    flick.description = tmpFlick.description;
                    flick.tags = tmpFlick.tags;
                    flick.folderName = folderName;
                    flick.isEncoded = true;
                    flick.isPublic = tmpFlick.isPublic || false;
                    flick.isEncoding = false;
                    flick.isDeleted = false;
                    flick.isDirectLinkable = tmpFlick.isDirectLinkable;
                    flick.thumbnailPath = tmpFlick.thumbnailPath;
                    flick.playCount = 0;
                    flick.mediaPath = mediaPath;
                    flick.originalName = tmpFlick.originalName;
                    flick.fileDetail = tmpFlick.fileDetail;


                    flick.create(function (err, id) {
                        if (err) { logger.error(req, 'api.copy.post.addFlick', 'F06002', err, 2); }
                        global.newFlickNotificationRecipients.forEach(function (res) {
                            res.write('event: newFlick\ndata: "reload"\nretry: 10000\n\n');
                            res.flush();
                        });
                    });
                });
            });
            unzipper.extract({
                path: mediaPath,
                filter: function (filee) {
                    return filee.type !== 'SymbolicLink';
                }
            });
        }
    }),
    function (req, res, next) {
        //console.log(req.user);
        res.status(202).send('Received');
    });


module.exports = router;
