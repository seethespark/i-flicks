var Nedb = require('nedb');
var path = require('path');

var db = new Nedb({ filename: global.iflicks_settings.databasePath + 'iflicksdb', autoload: true });

var statsD, flick = {};

flick.db = db;

flick.setStatsD = function (statsd) {
    statsD = statsd;
};

flick.thumb = function (id, callback) {
    var dbStartTime = new Date();
    db.findOne({_id: id}, /*{_id: 1, name: 1, description: 1},*/ function (err, doc) {
        if (statsD) {
            statsD.timing('db.flick.thumb', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        if (doc === null) { callback(new Error('Missing flick.'), undefined); return; }
        callback(undefined, doc.pathToThumbnail);
    });
};

flick.load = function (id, callback) {
    var dbStartTime = new Date();
    db.findOne({_id: id}, /*{_id: 1, name: 1, description: 1},*/ function (err, doc) {
        if (statsD) {
            statsD.timing('db.flick.load', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        if (doc === null) { callback(new Error('Missing flick.'), undefined); return; }
        flick._id = doc._id;
        flick.userId = doc.userId || doc.uploader;
        flick.name = doc.name;
        flick.description = doc.description;
        flick.playCount = doc.playCount;
        flick.fileDetail = doc.fileDetail;
        callback(undefined, doc);
    });
};

flick.play = function (id, callback) {
    var dbStartTime = new Date();
    db.update({_id: id}, { $inc: { playCount: 1 } }, function (err) {
        if (statsD) {
            statsD.timing('db.flick.play', dbStartTime);
        }
        if (err) { callback(err); return; }
        callback();
    });
};

flick.add = function (newFlick, callback) {
    var dbStartTime = new Date(), doc = {};
    doc = {
        uploader: newFlick.uploader,
        name: newFlick.name || 'unknown',
        description: newFlick.description || '',
        emailComplete: newFlick.emailComplete,
        uploadTime: new Date(),
        storageName: newFlick.storageName || 'unknown',
        path: newFlick.path || 'unknown',
        originalname: newFlick.originalname || 'unknown',
        playCount: 0,
        encoded: false
    };

    db.insert(doc, function (err, newDoc) {
        if (statsD) {
            statsD.timing('db.flick.insert', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback(undefined, newDoc._id);
    });
};

flick.remove = function (id, callback) {
    var dbStartTime = new Date();
    db.update({_id: id}, { $set: { deleted: true} }, function (err) {
        if (statsD) {
            statsD.timing('db.flick.remove', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback();
    });
};

flick.unremove = function (id, callback) {
    var dbStartTime = new Date();
    db.update({_id: id}, { $pull: { deleted: true} }, function (err) {
        if (statsD) {
            statsD.timing('db.flick.unremove', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback();
    });
};

flick.delete = function (id, callback) {
    var dbStartTime = new Date();
    db.remove({_id: id}, function (err) {
        if (statsD) {
            statsD.timing('db.flick.delete', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback();
    });
};

flick.setFileDetails = function (id, fileDetail, callback) {
    var dbStartTime = new Date();
    db.update({_id: id}, {
        $set: { fileDetail: fileDetail }
    }, function (err) {
        if (statsD) {
            statsD.timing('db.flick.setFileDetails', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback();
    });
};

flick.encodeStart = function (id, mediaPath, callback) {
    var dbStartTime = new Date();
    db.update({_id: id}, {
        $set: { encoding: true, encodeProgress: 0, mediaPath: mediaPath, pathToThumbnail: path.join(mediaPath, 'thumb.png') }
    }, function (err) {
        if (statsD) {
            statsD.timing('db.flick.encodeStart', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback();
    });
};

flick.encodeProgress = function (id, progressPercent, callback) {
    var dbStartTime = new Date();
    db.update({_id: id}, { $set: { encodeProgress: progressPercent } }, function (err) {
        if (statsD) {
            statsD.timing('db.flick.encodeProgress', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback();
    });
};

flick.encodeComplete = function (id, callback) {
    var dbStartTime = new Date();
    db.update({ _id: id }, {
        $set: { encoded: true },
        $unset: { path: true, encodeProgress: true, encoding: true }
    },
        {},
        function (err, numReplaced) {
            if (statsD) {
                statsD.timing('db.flick.encodeComplete', dbStartTime);
            }
            if (err) { callback(err, undefined); return; }
            if (numReplaced !== 1) { err = new Error(numReplaced + ' rows updated. this should be 1');  callback(err, undefined); return; }
            callback();
        });
};

flick.comment = function (id, callback) {};

flick.exists = function (storageName, callback) {
    var dbStartTime = new Date();
    db.find({storageName: storageName}, function (err, docs) {
        if (statsD) {
            statsD.timing('db.flick.exists', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        if (docs.length > 0) {
            callback(undefined, true);

        } else {
            callback(undefined, false);
        }
    });
};

/// once stable this should specify which properties to update rather than just adding all properties which aren't unctions
flick.save = function (callback) {
    //console.log(flick);
    var key, updateObj = {}, dbStartTime = new Date();
    for (key in flick) {
        if (flick.hasOwnProperty(key) && (typeof flick[key] === 'string' || typeof flick[key] === 'number' || typeof flick[key] === 'boolean') && key !== '_id') {
            updateObj[key] = flick[key];
        }
    }
    db.update({_id: flick._id}, { $set: updateObj }, function (err, rows) {
        if (statsD) {
            statsD.timing('db.flick.save', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback(undefined, rows);
    });
};



module.exports = flick;
