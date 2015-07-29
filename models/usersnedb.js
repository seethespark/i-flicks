// Error code F07
/** 
 * Users subclass.  Use this for all interactions with users when using NEDB.
 * 
 * @module usersnedb
 */

var Nedb = require('nedb');

var db = Nedb.globalDb.user; //new Nedb({ filename: global.iflicks_settings.nedbPath + 'usersdb', autoload: false });

var users = {}, statsD;

users.listAll = function (callback) {
    var dbStartTime = new Date();
    db.loadDatabase(function (err) {
        if (err) { callback(err, undefined); return; }
        db.find({ isDeleted: false }, /*{_id: 1, name: 1},*/ function (err, docs) {
            if (statsD) {
                statsD.timing('db.flicks.listAll', dbStartTime);
            }
            if (err) { callback(err, undefined); return; }
            docs.forEach(function (doc) {
                doc.password = '';
            });
            callback(undefined, docs);
        });
    });
};

users.listAllSearch = function (limit, search, callback) {
    var searchy, where = { isDeleted: false }, dbStartTime = new Date();
    if (search) {
        searchy = new RegExp(search, 'i');
        where = {$or: [{username: searchy}, {firstName: searchy}, {lastName: searchy}, {emailAddress: searchy}] };
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
                docs.forEach(function (doc) {
                    doc.password = '';
                });
                callback(undefined, docs);
            });
    });
};



module.exports = users;