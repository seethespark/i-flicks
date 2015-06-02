

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


module.exports = users;