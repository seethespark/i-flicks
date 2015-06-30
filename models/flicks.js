// Error code F08
var flick = require('./flick');

var db = flick.db, dbView = flick.dbView, flicks = {}, statsD;

flicks.setStatsD = function (statsd) {
    statsD = statsd;
};

flicks.listUnencoded = function (page, limit, user, callback) {
    var i, skip, where, userId, retVal, dbStartTime = new Date();
    page = Number(page);
    limit = Number(limit);
    skip = page*limit;
    where = { encoded: false, deleted: { $exists: false } };
    user = user || {};
    if (user.isSysAdmin) {
        // Do nothing
    } else if (user.id) {
        userId = user.id || 'zzzzzzzzzzzzzzzz'; // the user columns could be undefined
        where.$or =  [{userId: userId}, {uploader: userId}, {public: true} ];
    } else {
        where.public = true;
    }
    db.count(where, function (err, count) {
        db.find(where)
            .sort({uploadTime: -1})
            .skip(skip)
            .limit(limit)
            .exec(function (err, docs) {
                if (statsD) {
                    statsD.timing('db.flicks.listUnencoded', dbStartTime);
                }
                if (err) { callback(err, undefined); return; }
                for (i = 0; i < docs.length; i++) {
                    if (docs[i].userId === undefined) {
                        docs[i].userId = docs[i].uploader;
                    }
                    docs[i].description = docs[i].name + '<hr>' + docs[i].description;
                    if (docs[i].encodeProgress === undefined) {
                        docs[i].name = 'Encoding not started';
                    } else {
                        docs[i].name = 'Encoding ' + Math.round(docs[i].encodeProgress) + ' % complete.';
                    }
                }
                retVal = {
                    data:  docs,
                    count: count
                };
                callback(undefined, retVal);
            });
    });
};

flicks.list = function (page, limit, search, user, callback) {
    var i, skip, userId, retVal, where, dbStartTime = new Date();
    page = Number(page);
    limit = Number(limit);
    skip = page*limit;
    where = { encoded: true, deleted: { $exists: false } };
    user = user || {};
    if (user.isSysAdmin) {
        // Do nothing
    } else if (user.id) {
        userId = user.id || 'zzzzzzzzzzzzzzzz'; // the user columns could be undefined
        where.$or =  [{userId: userId}, {uploader: userId}, {public: true} ];
    } else {
        where.public = true;
    }
    if (search !== '-') {
        var regex = new RegExp(search, "g");
        where.description = {$regex: regex};
    }
    db.count(where, function (err, count) {
        db.find(where)
            .sort({uploadTime: -1})
            .skip(skip)
            .limit(limit)
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
                retVal = {
                    data:  docs,
                    count: count,
                    page: page,
                    limit: limit,
                    search: search
                };
                callback(undefined, retVal);
            });
    });
};

flicks.listAll = function (callback) {
    db.find({}, function (err, docs) {
        if (statsD) {
            statsD.timing('db.flicks.listAll', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        callback(undefined, docs);
    });
};

flicks.listAllSearch = function (limit, search, callback) {
    var searchy, where = {}, dbStartTime = new Date();
    if (search) {
        searchy = new RegExp(search, 'i');
        where = {$or: [{_id: searchy}, {name: searchy}, {description: searchy}, {uploader: searchy}, {userId: searchy}, ] };
    }
    limit = limit || 10;
    limit = Number(limit);
    db.find(where)
        .sort({dateEntered: -1})
        .limit(limit)
        .exec(function (err, docs) {
            if (statsD) {
                statsD.timing('db.flicks.listAllSearch', dbStartTime);
            }
            if (err) { callback(err, undefined); return; }
            callback(undefined, docs);
    });
};

flicks.listAllViews = function (limit, search, callback) {
    var searchy, where = {}, dbStartTime = new Date();
    if (search) {
        searchy = new RegExp(search, 'i');
        where = {$or: [{flickId: searchy}, {userId: searchy}, {ipAddress: searchy}] };
    }
    limit = limit || 10;
    limit = Number(limit);
    dbView.find(where)
        .sort({dateEntered: -1})
        .limit(limit)
        .exec(function (err, docs) {
            if (statsD) {
                statsD.timing('db.flicks.listAllViews', dbStartTime);
            }
            if (err) { callback(err, undefined); return; }
            callback(undefined, docs);
        });
};

module.exports = flicks;