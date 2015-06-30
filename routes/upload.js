var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var multer = require('multer');
var flick = require('../models/flick');
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
        onFileUploadComplete: function (file, req, res) {
            var doc, storageName;
            storageName = file.name.substring(0, file.name.lastIndexOf('.'));

            doc = {
                uploader: req.user.id,
                name: req.body.name,
                tags: req.body.tags,
                description: req.body.description,
                emailComplete: req.body.emailComplete,
                storageName: storageName,
                path: file.path,
                originalname: file.originalname
            };
            if (req.body.emailComplete === 'on') {
                doc.emailOnEncode = true;
            }
            flick.setStatsD(req.statsD);
            flick.add(doc, function (err) {
                if (err) { err.code = 'F04001'; return (err); }
            });
        }
    }),
    function (req, res, next) {
        res.status(202).send('Received and now encoding.');
    });

module.exports = router;
