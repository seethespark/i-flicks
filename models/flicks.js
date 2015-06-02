var flick = require('./flick');

var db = flick.db, flicks = {}, statsD;

flick.setStatsD = function (statsd) {
    statsD = statsd;
};

flicks.listUnencoded = function (callback) {
    var dbStartTime = new Date();
    db.find({ encoded: false }, function (err, docs) {
        if (statsD) {
            statsD.timing('db.flicks.listUnencoded', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback(undefined, docs);
    });
};

flicks.list = function (page, callback) {
    var i, dbStartTime = new Date();
    db.find({ encoded: true, deleted: { $exists: false } })
        .sort({uploadTime: -1})
        .skip(page)
        .limit(5)
        .exec(function (err, docs) {
            if (statsD) {
                statsD.timing('db.flicks.list', dbStartTime);
            }
            if (err) { callback(err, undefined); return; }
            for (i = 0; i < docs.length; i++) {
                if (docs[i].userId === undefined) {
                    docs[i].userId = docs[i].uploader;
                }
            }
            callback(undefined, docs);
        });
};

flicks.listAll = function (callback) {
    var dbStartTime = new Date();
    db.find({ }, /*{_id: 1, name: 1},*/ function (err, docs) {
        if (statsD) {
            statsD.timing('db.flicks.listAll', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback(undefined, docs);
    });
};


module.exports = flicks;