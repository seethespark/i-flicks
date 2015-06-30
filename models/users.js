// Error code F07

var Nedb = require('nedb');

var db = new Nedb({ filename: global.iflicks_settings.databasePath + 'usersdb', autoload: false });

var users = {}, statsD;


users.listAll = function (callback) {
    var dbStartTime = new Date();
    db.loadDatabase(function (err) {
        if (err) { callback(err, undefined); return; }
        db.find({ deleted: false }, /*{_id: 1, name: 1},*/ function (err, docs) {
            if (statsD) {
                statsD.timing('db.flicks.listAll', dbStartTime);
            }
            if (err) { callback(err, undefined); return; }
            docs.forEach(function(doc) {
                doc.password = '';
            });
            callback(undefined, docs);
        });
    });
};

users.listAllSearch = function (limit, search, callback) {
    var searchy, where = { deleted: false }, dbStartTime = new Date();
    if (search) {
        searchy = new RegExp(search, 'i');
        where = {$or: [{username: searchy}, {forename: searchy}, {surname: searchy}, {emailAddress: searchy}] };
    }
    db.loadDatabase(function (err) {
        if (err) { callback(err, undefined); return; }
        db.find(where)
            .sort({username: 1})
            .limit(limit)
            .exec(function (err, docs) {
                if (statsD) {
                    statsD.timing('db.flicks.listAllSearch', dbStartTime);
                }
                if (err) { callback(err, undefined); return; }
                docs.forEach(function(doc) {
                    doc.password = '';
                });
                callback(undefined, docs);
        });
    });
};



module.exports = users;