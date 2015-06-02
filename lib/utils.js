/**
 * utils module.
 * @module utils
 */
/*var express = require('express');
var router = express.Router();*/
var fs = require('fs');
var path = require('path');
var ffmpeg = require('fluent-ffmpeg');
var gm = require('gm');
var mkdirp = require('mkdirp');
var rinraf = require('rimraf');
var flick = require('../models/flick');
var flicks = require('../models/flicks');
var logger = require('./logger');


var utils = {},  encodeCount = 0;
/**  This looks up all files which need encoding and creates the relevant files */
function encode(statsD) {
    var archivePath, docCount = 0, dbStartTime = new Date(), startTime = new Date();
    /// if ore than 2 instances are running then quit and retry in a few seconds.

    if (encodeCount > global.iflicks_settings.maxFFmpegInatances - 1) {
        setTimeout(encode, 5000);
        return;
    }
    
    ffmpeg.setFfmpegPath(global.iflicks_settings.ffmpegPath);
    ffmpeg.setFfprobePath(global.iflicks_settings.ffprobePath);
    ffmpeg.setFlvtoolPath(global.iflicks_settings.flvMetaPath);

    flicks.listUnencoded(function (err, docs) {
        if (err) {
            logger.errorNoReq('utils.encode', 'F02001', err, 2);
            return;
        }
        if (docs.length === 0) {
            setTimeout(encode, 2000);
        }
        docs.forEach(function (doc) {
            doc.mediaPath = path.join(global.iflicks_settings.mediaPath, doc.storageName);
            getFileDetails(doc.path, function (err, fileDetail) {
                if (err) {
                    logger.errorNoReq('utils.encode.getFileDetails', 'F02015', err, 2);
                }
                flick.setFileDetails(doc._id, fileDetail, function (err) {
                    if (err) {
                        logger.errorNoReq('utils.encode.getFileDetails', 'F02002', err, 2);
                    }
                });
            });
            flick.encodeStart(doc._id, doc.mediaPath, function (err) {
                if (err) {
                    logger.errorNoReq('utils.encode', 'F02002', err, 2);
                    return;
                }
            });
            dbStartTime = new Date();
            fs.mkdirp(doc.mediaPath, function (err) {
                if (statsD) {
                    statsD.timing('fs.utils.encode.mkdir', dbStartTime);
                }
                if (err) {
                    logger.errorNoReq('utils.encode.makedir', 'F02003', err, 2);
                    return;
                }
                dbStartTime = new Date();
                encodeImage(doc.path, doc.mediaPath, function (err) {
                    if (err) {
                        logger.errorNoReq('utils.encode.thumbnail', 'F02004', err, 2);
                        return;
                    }
                    if (statsD) {
                        statsD.timing('ffmpeg.utils.encode.thumb', dbStartTime);
                    }
                    console.log('Thumb processing finished !');
                    encodeVideo(doc.path, doc.mediaPath, doc._id, function (err) {
                        if (statsD) {
                            statsD.timing('ffmpeg.utils.encode.video', dbStartTime);
                        }
                        if (err) {
                            logger.errorNoReq('utils.encode.flick', 'F02005', err, 2);
                            return;
                        }
                        console.log('Vid processing finished in ' + ((new Date()) - startTime) / 1000 + 's');
                        flick.encodeComplete(doc._id, function (err) {
                            if (err) {
                                logger.errorNoReq('utils.encode', 'F02007', err, 2);
                                return;
                            }
                        });

                        archivePath = path.join(global.iflicks_settings.uploadPath, '/archive/' + doc.storageName + '.' + doc.originalname.substring(doc.originalname.lastIndexOf('.')));
                        fs.rename(doc.path, archivePath, function (err) {
                            if (err) {
                                console.log(archivePath);
                                logger.errorNoReq('utils.encode', 'F02008', err, 2);
                                return;
                            }
                        });
                        /// This isn't a "production ready" solution but OK for dev.
                        global.newVideoNotificationRecipients.forEach(function (res) {
                            res.write('event: newVideo\ndata: "reload"\nretry: 10000\n\n');
                        });
                        docCount++;
                        if (docCount === docs.length) {
                            setTimeout(encode, 2000);
                        }
                    });
                });
            });
        });
    });
}

/**  Does the actual encoding of thumbnail files
*/
function getFileDetails(sourcePath, callback) {
    var i, retVal = {};

    ffmpeg.ffprobe(sourcePath, function (err, data) {
        if (err) {
            callback(err);
            return;
        }

        retVal.width = Math.max.apply(null, data.streams.map(function (probe) {
            if (probe.width !== undefined) {
                return probe.width;
            } else {
                return 0;
            }
        }));
        retVal.height = Math.max.apply(null, data.streams.map(function (probe) {
            if (probe.height !== undefined) {
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

        callback(undefined, data);

    });
}
utils.getFileDetails = getFileDetails;
/**  Does the actual encoding of thumbnail files
*/
function encodeImage(sourcePath, destinationFolderPath, callback) {
    var rotate, imagePath = path.join(destinationFolderPath, 'thumb.png');

    fs.mkdirp(destinationFolderPath, function (err) {
        if (err) {
            callback(err);
            return;
        }
        encodeCount++;
        ffmpeg(sourcePath)
            .screenshots({ timestamps: ['5%'],
                filename: 'thumb',
                folder: destinationFolderPath,
                size: '320x240'
                })
            .on('error', function (err) {
                encodeCount--;
                callback(err);
                return;
            })
            .on('end', function () {
                encodeCount--;
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
}

/**  Does the actual encoding of video files
*/
function encodeVideo(sourcePath, destinationFolderPath, id, callback) {
    encodeCount++;
    ffmpeg(sourcePath)
        .output(path.join(destinationFolderPath, '/big.flv'))
        .preset('flashvideo')

        .output(path.join(destinationFolderPath, '/big.mp4'))
        //.audioCodec('libfaac')
        .audioCodec('aac')
        .videoCodec('libx264')
        .videoBitrate('1000k')
        .size('800x?')
        .format('mp4')

        .output(path.join(destinationFolderPath, '/medium.mp4'))
        .audioCodec('aac')
        .videoCodec('libx264')
        .videoBitrate('500k')
        .size('500x?')
        .format('mp4')

        .output(path.join(destinationFolderPath, '/small.mp4'))
        .audioCodec('aac')
        .videoCodec('libx264')
        .videoBitrate('200k')
        .size('400x?')
        .format('mp4')

        .output(path.join(destinationFolderPath, '/big.webm'))
        .audioCodec('libvorbis')
        .videoCodec('libvpx')
        .videoBitrate('1000k')
        .size('800x?')
/*
        .output(path.join(destinationFolderPath, '/big.ogv'))
        .audioCodec('libvorbis')
        .videoCodec('libtheora')
        .videoBitrate('1000k')
        .size('800x?')
*/
        .on('error', function (err) {
            encodeCount--;
            callback(err);
            return;
        })
        .on('progress', function (progress) {
            // console.log(progress);
            flick.encodeProgress(id, progress.percent, function (err) {
                if (err) {
                    callback(err);
                    return;
                }
            });
        })
        .on('end', function () {
            encodeCount--;
            callback(undefined);
        })
        .run();
}

/**  Clears out old, deleted video files and non-existent database entries.
*/
function cleanMedia() {
    /// delete files where not in DB
    fs.readdir(global.iflicks_settings.mediaPath, function (err, dirs) {
        if (err) {
            logger.errorNoReq('utils.cleanMedia', 'F02009', err, 2);
            return;
        }
        dirs.forEach(function (dir) {
            if (dir === 'notencoded' || dir === 'archive') { return; }
            //db.find({storageName: dir}, function (err, docs) {
            flick.exists(dir, function (err, exists) {
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
            if (doc.mediaPath !== undefined) {
                fs.readdir(doc.mediaPath, function (err, files) {
                    if (err) {
                        flick.delete(doc._id, function (err) {
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
    flicks.listUnencoded(function (err, docs) {
        if (err) {
            logger.errorNoReq('utils.cleanMedia', 'F02013', err, 2);
            return;
        }
        docs.forEach(function (doc) {
            fs.stat(doc.path, function (err, files) {
                if (err) {
                    flick.delete(doc._id, function (err) {
                        if (err) {
                            logger.errorNoReq('utils.cleanMedia', 'F02012', err, 2);
                            return;
                        }
                    });
                }
            });
        });
    });
}

/**  Stops EventSource timing out.
*/
function pingNewVideo() {
    //console.log('pinging...');
    //console.log(global.newVideoNotificationRecipients.length);
    global.newVideoNotificationRecipients.forEach(function (res) {
        res.write('data: "ping ' + new Date() + '"\n\n');
    });
    var rand = 59000 + (59000 * Math.random()); // Between 
    setTimeout(pingNewVideo, rand);
}

utils.pingNewVideo = pingNewVideo;
utils.cleanMedia = cleanMedia;
utils.encodeVideo = encodeVideo;
utils.encode = encode;
utils.encodeImage = encodeImage;

module.exports = utils;