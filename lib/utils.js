var fs = require('fs');
var path = require('path');
var ffmpeg = require('fluent-ffmpeg');
var gm = require('gm');
var mkdirp = require('mkdirp');
var rinraf = require('rimraf');
var nodemailer = require('nodemailer');
var mg = require('nodemailer-mailgun-transport');
var Flick = require('../models/flick');
var flicks = require('../models/flicks');
var logger = require('./logger');
var User = require('../models/user');
var StatsD = require('statsd-client');
var statsD = StatsD.globalStatsD;
/**
 * utils module.
 * @module utils
 */

var utils = {},  encodeCount = 0, checkForUnencodedTimeout = 10000;
/**  This looks up all files which need encoding and creates the relevant files */
function encode() {
    var archivePath, docCount = 0, dbStartTime = new Date(), startTime = new Date();
    //console.log('encode', encodeCount);
    /// if ore than 2 instances are running then quit and retry in a few seconds.
    if (encodeCount > global.iflicks_settings.maxFFmpegInsatances - 1) {
        setTimeout(encode, checkForUnencodedTimeout);
        return;
    }

    ffmpeg.setFfmpegPath(global.iflicks_settings.ffmpegPath);
    ffmpeg.setFfprobePath(global.iflicks_settings.ffprobePath);
    ffmpeg.setFlvtoolPath(global.iflicks_settings.flvMetaPath);

    flicks.listUnencodedAll(0, global.iflicks_settings.maxFFmpegInsatances, function (err, docs) {

        if (err && err.code !== 'ENOCONN') {
            logger.errorNoReq('utils.encode', 'F02001', err, 2);
            return;

        }
        if (docs === undefined || docs.length === 0) {
            setTimeout(encode, checkForUnencodedTimeout);
            return;
        }
        docs.forEach(function (doc) {
            var flick = new Flick();
            flick.load(doc.id, '', true, function (err, ok) {
                
                getFileDetails(doc.sourcePath, function (err, fileDetail) {
                    if (err) {
                        logger.errorNoReq('utils.encode.getFileDetails', 'F02015', err, 2);
                    }
                    flick.mediaPath = path.join(global.iflicks_settings.mediaPath, doc.folderName);
                    flick.fileDetail = fileDetail;
                    flick.isEncoding = true;
                    flick.save(function (err) {if (err) {
                        logger.errorNoReq('utils.encode.flickSave', 'F02016', err, 2);
                    }});

                    fs.mkdirp(flick.mediaPath, function (err) {
                        if (statsD) {
                            statsD.timing('fs.utils.encode.mkdir', dbStartTime);
                        }
                        if (err) {
                            logger.errorNoReq('utils.encode.makedir', 'F02003', err, 2);
                            return;
                        }
                        dbStartTime = new Date();
                        encodeImage(flick.sourcePath, flick.mediaPath, function (err) {
                            if (err) {
                                logger.errorNoReq('utils.encode.thumbnail', 'F02004', err, 2);
                                return;
                            }
                            if (statsD) {
                                statsD.timing('ffmpeg.utils.encode.thumb', dbStartTime);
                            }
                            console.log('Thumb processing finished !');
                            encodeVideo(flick.sourcePath, flick.mediaPath, flick.id, function (err) {
                                if (statsD) {
                                    statsD.timing('ffmpeg.utils.encode.flick', dbStartTime);
                                }
                                if (err) {
                                    logger.errorNoReq('utils.encode.flick', 'F02005', err, 2);
                                    return;
                                }
                                console.log('Vid processing finished in ' + ((new Date()) - startTime) / 1000 + 's');
                                if (flick.emailWhenEncoded === true) {
                                    sendUploadEmail(flick.id);
                                }
                                flick = new Flick();
                                flick.load(doc.id, '', true, function (err) {
                                    if (err) { console.log(err); }
                                    flick.isEncoded = true;
                                    
                                    archivePath = path.join(global.iflicks_settings.uploadPath, '/archive/' + flick.folderName + '.' + flick.originalName.substring(flick.originalName.lastIndexOf('.')));
                                    fs.rename(flick.sourcePath, archivePath, function (err) {
                                        if (err) {
                                            logger.errorNoReq('utils.encode', 'F02008', err, 2);
                                            return;
                                        }
                                    });
                                    flick.save(function (err) { if (err) { console.log(err); }
                                        /// This isn't a "production ready" solution but OK for dev.
                                        global.newFlickNotificationRecipients.forEach(function (res) {
                                            res.write('event: newFLick\ndata: "reload"\nretry: 10000\n\n');
                                            res.flush();
                                        });
                                        docCount++;
                                        if (docCount === docs.length) {
                                            setTimeout(encode, checkForUnencodedTimeout);
                                        }
                                    });
                                });


                                

                            });
                        });
                    });

                });
            });

            
        });
    });
}


var nodemailerTransport = (function () {
    if (global.iflicks_settings.gmailUsername) {
        return nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: global.iflicks_settings.gmailUsername,
                pass: global.iflicks_settings.gmailPassword
            }
        });
    } else if (global.iflicks_settings.mailgunKey) {
        return nodemailer.createTransport(
            mg({auth: {
                api_key: global.iflicks_settings.mailgunKey,
                domain: global.iflicks_settings.mailgunDomain
            }})
        );
    }
}());


function sendUploadEmail(id) {
    if (nodemailerTransport === undefined) { return; }
    var flick = new Flick();
    flick.load(id, '', true, function (err) {
        if (err) { logger.errorNoReq('utils.sendUploadEmail.loadFlick', 'F020017', err, 2); return;}
        var user = new User();
        user.load(flick.userId, function (err, usr) {
            if (err) { logger.errorNoReq('utils.sendUploadEmail.loadUser', 'F020015', err, 2); return;}
            // setup e-mail data with unicode symbols
            var mailOptions = {
                from: global.iflicks_settings.mailFrom, // sender address
                to: user.emailAddress, // list of receivers
                subject: 'i-flicks', // Subject line
                //text: body, //, // plaintext body
                html: '<b>Your flick, named "' + flick.name + '" has been encoded and is ready for viewing. ✔</b>' // html body
            };
            // send mail with defined transport object
            nodemailerTransport.sendMail(mailOptions, function (err, info) {
                // console.log(info);
                if (err) {
                    logger.errorNoReq('utils.sendUploadEmail.sendMail', 'F020016', err, 2);
                }
            });
        });
    });
}

/**  Does the actual encoding of thumbnail files
*/
function getFileDetails(sourcePath, callback) {
    var retVal = {};

    ffmpeg.ffprobe(sourcePath, function (err, data) {
        if (err) {
            callback(err);
            return;
        }

        retVal.width = Math.max.apply(null, data.streams.map(function (probe) {
            if (probe.width !== undefined && !isNaN(probe.width)) {
                return probe.width;
            } else {
                return 0;
            }
        }));
        retVal.height = Math.max.apply(null, data.streams.map(function (probe) {
            if (probe.height !== undefined && !isNaN(probe.width)) {
                return probe.height;
            } else {
                return 0;
            }
        }));
        retVal.duration = Math.max.apply(null, data.streams.map(function (probe) {
            if (probe.duration !== undefined) {
                return probe.duration;
            } else {
                return 0;
            }
        }));
        retVal.rotate = data.streams.map(function (probe) {
            if (probe.tags !== undefined && probe.tags.rotate !== undefined) {
                return probe.tags.rotate;
            } else {
                return 0;
            }
        }).reduce(function (previousValue, currentValue, index, array) {
            if (currentValue > previousValue) {
                return currentValue;
            }
            return previousValue;
        });

        callback(undefined, retVal);

    });
}
utils.getFileDetails = getFileDetails;
/**  Does the actual encoding of thumbnail files
*/
function encodeImageXX(sourcePath, destinationFolderPath, callback) {
    var rotate, imagePath = path.join(destinationFolderPath, 'thumb.png');

    fs.mkdirp(destinationFolderPath, function (err) {
        if (err) {
            callback(err);
            return;
        }
        //encodeCount++;
        ffmpeg(sourcePath)
            .screenshots({ timestamps: ['5%'],
                filename: 'thumb',
                folder: destinationFolderPath,
                size: '247x?'
                })
            .on('error', function (err) {
                //encodeCount--;
                callback(err);
                return;
            })
            .on('end', function () {
                //encodeCount--;
                ffmpeg(sourcePath)
                    .screenshots({ timestamps: ['5%'],
                        filename: 'big',
                        folder: destinationFolderPath,
                        size: '880x?'
                        })
                    .on('error', function (err) {
                        //encodeCount--;
                        callback(err);
                        return;
                    })
                    .on('end', function () {
                        ffmpeg(sourcePath)
                            .screenshots({ timestamps: ['5%'],
                                filename: 'medium',
                                folder: destinationFolderPath,
                                size: '500x?'
                                })
                            .on('error', function (err) {
                                //encodeCount--;
                                callback(err);
                                return;
                            })
                            .on('end', function () {

                                ffmpeg.ffprobe(sourcePath, function (err, data) {
                                    if (err) {
                                        callback(err);
                                        return;
                                    }
                                    if (data.streams.length && data.streams[1].tags && data.streams[1].tags.rotate) {
                                        rotate = data.streams[1].tags.rotate;
                                    }
                                    if (data.streams.length && data.streams[0].tags && data.streams[0].tags.rotate) {
                                        rotate = data.streams[0].tags.rotate;
                                    }
                                    if (rotate) {
                                        gm(imagePath).rotate('white', rotate)
                                            .write(imagePath, function (err) {
                                                callback(err);
                                                return;
                                            });
                                    } else {
                                        callback();
                                    }
                                });
                            });
                    });
            });
    });
}

function encodeImageFile(sourcePath, destinationFolderPath, destinationFileName, width, height, callback) {
    destinationFileName += '.jpg';
    var rotate, size, imagePath = path.join(destinationFolderPath, destinationFileName);
    if (height !== undefined) {
        size = width + 'x' + height;
    } else {
        size = width + 'x?';
    }
    getFileDetails(sourcePath, function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        ffmpeg(sourcePath)
            .screenshots({ timestamps: ['5%'],
                filename: destinationFileName,
                folder: destinationFolderPath,
                size: size
                })
            .on('error', function (err) {
                //encodeCount--;
                callback(err);
                return;
            })
            .on('end', function () {
                gm(imagePath).interlace('Plane')
                    .write(imagePath, function (err) {
                        if (err) {callback(err); return;}

                        /*  as of May 2015 FFmpeg automatically rotates.
                        if (data.rotatett) {
                            console.log('rotating image');
                            gm(imagePath).rotate('white', data.rotate)
                                .write(imagePath, function (err) {
                                    callback(err);
                                    return;
                                });
                        } else {
                            callback();
                        }*/
                        callback();
                    });
            });
    });
}

function encodeImage(sourcePath, destinationFolderPath, callback) {
    encodeImageFile(sourcePath, destinationFolderPath, 'big', 880, undefined, function (err) {
        if (err) { callback(err); }
        encodeImageFile(sourcePath, destinationFolderPath, 'medium', 500, undefined, function (err) {
            if (err) { callback(err); }
            encodeImageFile(sourcePath, destinationFolderPath, 'small', 400, undefined, function (err) {
                if (err) { callback(err); }
                encodeImageFile(sourcePath, destinationFolderPath, 'thumb', 250, undefined, function (err) {
                    if (err) { callback(err); }
                    callback();
                });
            });
        });
    });
}


/**  Does the actual encoding of video files
*/
function encodeVideo(sourcePath, destinationFolderPath, id, callback) {
    var command, interval, rotate, width, height, widthHeight, sizeBig, sizeMed, sizeSmall, flick, encodingProgress = 0;
    encodeCount++;
    flick = new Flick(); /// THis only updates the encode time so can hold the flick for a while.  If other updates start happening then the flick should be reloaded each time.
    flick.load(id, '', true, function (err) {
        if (err) { console.log(err); }
        getFileDetails(sourcePath, function (err, data) {
            if (err) {
                callback(err);
                return;
            }
            rotate = data.rotate/90;
            widthHeight = data.width/data.height;
            if (widthHeight > 1.77777778) {
                width = 880;
                height = 880 / widthHeight;
            } else {
                height = 495;
                width = 495 * widthHeight;
            }

            sizeBig = width + 'x' + height;
            sizeMed = Math.round(0.568 * width) + 'x' + Math.round(0.568 * height);
            sizeSmall = Math.round(0.45 * width) + 'x' + Math.round(0.45 * height);
            command = ffmpeg(sourcePath)
                /*.output(path.join(destinationFolderPath, '/big.flv'))
                .preset('flashvideo')
        */


                .output(path.join(destinationFolderPath, '/big.mp4'))
                //.audioCodec('libfaac')
                .audioCodec('aac')
                .videoCodec('libx264')
                //.videoBitrate('1000k')
                .size(sizeBig)
                //.outputOption( '-vf', 'rotate=90*PI/180:out_w=880')
                //.format('mp4')

                .output(path.join(destinationFolderPath, '/medium.mp4'))
                .audioCodec('aac')
                .videoCodec('libx264')
                //.videoBitrate('500k')
                .size(sizeMed)
                //.outputOption( '-vf', 'transpose=1')
                //.format('mp4')

                .output(path.join(destinationFolderPath, '/small.mp4'))
                .audioCodec('aac')
                .videoCodec('libx264')
                .videoBitrate('200k')
                .size(sizeSmall)
                //.outputOption( '-vf', 'transpose=1')
                //.format('mp4')

                .output(path.join(destinationFolderPath, '/big.webm'))
                .audioCodec('libvorbis')
                .videoCodec('libvpx')
                //.videoBitrate('1000k')
                .size(sizeBig)
                //.outputOption( '-vf', 'transpose=1')
        /* Ubuntu version doesn't have lobtheora
                .output(path.join(destinationFolderPath, '/big.ogv'))
                .audioCodec('libvorbis')
                .videoCodec('libtheora')
                .videoBitrate('1000k')
                .size('800x?')
                .outputOption( '-vf', 'transpose=1')
        */
                .on('error', function (err) {
                    clearInterval(interval);
                    encodeCount--;
                    callback(err);
                    return;
                })
                .on('progress', function (progress) {
                    if (progress.percent > encodingProgress + 1) {
                        flick.encodingProgress = progress.percent;
                        flick.save(function (err) { if (err) { console.log(err); } });
                        encodingProgress = progress.percent;
                    } else if ( progress.percent > 99 &&  progress.percent > encodingProgress + 0.1 ) {
                        flick.encodingProgress = progress.percent;
                        flick.save(function (err) { if (err) { console.log(err); } });
                        encodingProgress = progress.percent;
                    }
                })
     /*           .on('start', function(commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })*/
                .on('end', function () {
                    getFileDetails(path.join(destinationFolderPath, '/big.mp4'), function (err, data) {
                        if (err) {
                            callback(err);
                            return;
                        }
                        //console.log(data.rotate);
                        getFileDetails(path.join(destinationFolderPath, '/medium.mp4'), function (err, data) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            //console.log(data.rotate);
                            clearInterval(interval);
                            encodeCount--;
                            callback(undefined);
                        });
                    });
                })
                .save(path.join(destinationFolderPath, '/extra.mp4'));
                //.run();


            interval = setInterval(function () {
                flick.load(id, '', true, function (err, doc) {
                    if (doc === undefined || doc.deleted === true) {
                        command.kill();
                    }
                });
            }, 4000);
        }); // getFileDetails
    });
}

/// This isn't used as it can't be stopped and fires the callbacks before all streams have completed.  It might be better if these are overcome.
function encodeVideo1(sourcePath, destinationFolderPath, id, callback) {
    var command, interval;
    encodeCount++;
    command = ffmpeg(sourcePath)
        //.audioCodec('libfaac')
        .audioCodec('aac')
        .videoCodec('libx264')
        .videoBitrate('1000k')
        .size('800x?')
        //.format('mp4')

        .on('error', function (err) {
            clearInterval(interval);
            encodeCount--;
            callback(err);
            return;
        })
        .on('progress', function (progress) {
            flick.encodeProgress(id, progress.percent, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
            });
        })
        .on('end', function () {
            clearInterval(interval);
            encodeCount--;
            callback(undefined);
        });

    command.clone()
        .audioCodec('aac')
        .videoCodec('libx264')
        .videoBitrate('500k')
        .size('500x?')
        .format('mp4')
        .save(path.join(destinationFolderPath, '/medium.mp4'));

    command.clone()
        .audioCodec('aac')
        .videoCodec('libx264')
        .videoBitrate('200k')
        .size('400x?')
        .save(path.join(destinationFolderPath, '/small.mp4'));

    command.clone()
        .audioCodec('libvorbis')
        .videoCodec('libvpx')
        .videoBitrate('1000k')
        .size('800x?')
        .save(path.join(destinationFolderPath, '/big.webm'));

    command.clone()
        .preset('flashvideo')
        .save(path.join(destinationFolderPath, '/big.flv'));


    command.save(path.join(destinationFolderPath, '/big.mp4'));
/*
        .output(path.join(destinationFolderPath, '/big.ogv'))
        .audioCodec('libvorbis')
        .videoCodec('libtheora')
        .videoBitrate('1000k')
        .size('800x?')
*/


    interval = setInterval(function () {
        flick.load(id, '', true, function (err, doc) {
            if (doc.deleted === true) {
                command.kill();
            }
        });
    }, 4000);
}


/**  Clears out old, deleted video files and non-existent database entries.
*/
function doCleanMedia() {
    var flick;
    /// delete files where not in DB
    fs.readdir(global.iflicks_settings.mediaPath, function (err, dirs) {
        if (err) {
            logger.errorNoReq('utils.cleanMedia', 'F02009', err, 2);
            return;
        }
        dirs.forEach(function (dir) {
            if (dir === 'notencoded' || dir === 'archive') { return; }
            //db.find({storageName: dir}, function (err, docs) {
            flicks.checkExists(dir, function (err, exists) {
                if (exists === false) {
                    console.log('delete' + dir);
                    rinraf(path.join(global.iflicks_settings.mediaPath, dir), function (err) {
                        if (err) {
                            logger.errorNoReq('utils.cleanMedia', 'F02005', err, 2);
                            return;
                        }
                        console.log(dir + ' removed');
                    });
                }
            });
        });
    });

    /// delete DB where files don't exist
    flicks.listAll(function (err, docs) {
        if (err) {
            logger.errorNoReq('utils.cleanMedia', 'F02011', err, 2);
            return;
        }
        docs.forEach(function (doc) {
            if (doc.mediaPath !== undefined && doc.mediaPath !== null) {
                
                fs.readdir(doc.mediaPath, function (err, files) {
                    if (err) {
                        flick = new Flick(doc.id);
                        flick.delete(function (err) {
                            if (err) {
                                logger.errorNoReq('utils.cleanMedia', 'F02010', err, 2);
                                return;
                            }
                        });
                    }
                });
            }
        });
    });
    /// delete DB where unencoded files don't exist
    flicks.listUnencodedAll(0, 1000,  function (err, docs) {
        if (err) {
            logger.errorNoReq('utils.cleanMedia', 'F02013', err, 2);
            return;
        }
        docs.forEach(function (doc) {
            //console.log(doc.sourcePath)
            fs.stat(doc.sourcePath, function (err, files) {
                if (err) {
                    flick = new Flick();
                    flick.load(doc.id, '', true, function (err) {
                        if (err) {
                            logger.errorNoReq('utils.cleanMedia', 'F02017', err, 2);
                            return;
                        }
                        flick.delete(function (err) {
                            if (err) {
                                logger.errorNoReq('utils.cleanMedia', 'F02012', err, 2);
                                return;
                            }
                        });

                    });
                }
            });
        });
    });
}

function cleanMedia() {
    //setTimeout(doCleanMedia, 1500);
}

/**  Stops EventSource timing out.
*/
function pingNewFlick() {
    //console.log(global.newFlickNotificationRecipients.length);
    global.newFlickNotificationRecipients.forEach(function (res) {
        res.write('data: "ping ' + new Date() + '"\n\n');
        res.flush();
    });
    var rand = 59000 + (59000 * Math.random()); // Between 
    setTimeout(pingNewFlick, rand);
}

/** 
 * Get a whole load of FFmpeg info
 * @param {function} callback - function to call on completion
*/
function getFFmpegDetails(callback) {
    var retVal = {};
    ffmpeg.getAvailableFormats(function (err, formats) {
        retVal.getAvailableFormats = formats || err;
        ffmpeg.getAvailableCodecs(function (err, codecs) {
            retVal.getAvailableCodecs = codecs || err;
            //ffmpeg.getAvailableEncoders(function(err, encoders) {
            //    retVal.getAvailableEncoders = encoders || err;
            ffmpeg.getAvailableFilters(function (err, filters) {
                retVal.getAvailableFilters = filters || err;
                callback(undefined, retVal);
            });
            //});
        });
    });
}


/** 
 * Get a whole load of FFmpeg info
 * @param {function} callback - function to call on completion
*/
function getFFmpegAvailableFormats(limit, search, callback) {
    var format, reg, tmpFormat, retVal = [];
    ffmpeg.getAvailableFormats(function (err, formats) {
        if (err) { callback(err); return; }
        reg = new RegExp(search, 'i');
        for (format in formats) {
            if (formats.hasOwnProperty(format)) {
                tmpFormat = formats[format];
                tmpFormat.name = format;
                if (search === undefined || reg.test(tmpFormat.name) || reg.test(tmpFormat.description)) {
                    retVal.push(tmpFormat);
                }
            }
        }
        callback(undefined, retVal);

    });
}

/** 
 * Get a whole load of FFmpeg info
 * @param {function} callback - function to call on completion
*/
function getFFmpegAvailableCodecs(limit, search, callback) {
    var format, reg, tmpFormat, retVal = [];
    ffmpeg.getAvailableCodecs(function (err, formats) {
        if (err) { callback(err); return; }
        reg = new RegExp(search, 'i');
        for (format in formats) {
            if (formats.hasOwnProperty(format)) {
                tmpFormat = formats[format];
                tmpFormat.name = format;
                if (search === undefined || reg.test(tmpFormat.name) || reg.test(tmpFormat.description)) {
                    retVal.push(tmpFormat);
                }
            }
        }
        callback(undefined, retVal);

    });
}

/** 
 * Get the cookie value from a cookie name
 * @param {string[]} headerCookies - cookies object from the request
 * @param {string} cookieName - name to retrieve
*/
function getCookie(headerCookies, cookieName) { if (headerCookies) { return (headerCookies.match('(^|; )' + cookieName + '=([^;]*)') || 0)[2]; } }

utils.pingNewFlick = pingNewFlick;
utils.cleanMedia = cleanMedia;
utils.encodeVideo = encodeVideo;
utils.encode = encode;
utils.encodeImage = encodeImage;
utils.getCookie = getCookie;
utils.getFFmpegAvailableFormats = getFFmpegAvailableFormats;
utils.getFFmpegAvailableCodecs = getFFmpegAvailableCodecs;

module.exports = utils;