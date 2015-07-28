// Error code F10
var Nedb = require('nedb');

var db = new Nedb({ filename: global.iflicks_settings.nedbPath + 'errorsdb', autoload: true });

var statsD, error = {};

error.setStatsD = function (statsd) {
    statsD = statsd;
};

error.add = function (newError, callback) {
    var dbStartTime = new Date();
    db.insert(newError, function (err, newDoc) {
        if (statsD) {
            statsD.timing('db.error.add', dbStartTime);
        }
        if (err) {
            console.log("Server error exception4");
            console.log(err);
        }
        if (callback !== undefined) {
            callback();
        }
    });

    /// Delete errors if over 10,000 already exist
    db.find({}).sort({ dateEntered: -1 }).skip(10000).exec(function (err, docs) {
        if (err) {
            console.log('Error object error 1');
        } else {
            docs.forEach(function (doc) {
                db.remove({_id: doc._id}, {}, function () {});
            });
            db.persistence.compactDatafile();
        }

    });

    /// Delete errors over 30 days old.
    db.remove({dateEntered: {$lt: (new Date((new Date()).getTime() - (30 * 24 * 60 * 60 * 1000)))}}, {multi: true}, function (err, count) {
        if (err) {
            console.log('Error object error 2');
        } else {
            db.persistence.compactDatafile();
        }
    });
};

error.list = function (limit, search, callback) {
    var searchy, i, where = {};
    if (search) {
        searchy = new RegExp(search, 'i');
        where = {error: searchy};
    }
    db.find(where)
        .sort({ dateEntered: -1 })
        .limit(limit)
        .exec(function (err, docs) {
            if (err) {
                callback(err, undefined);
                return;
            }
            
            callback(undefined, docs);
    });
};


module.exports = error;