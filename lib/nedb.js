var Nedb = require('nedb');
var path = require('path');
var db = {};
Nedb.globalDb = db;
var dbPath;
if (global.iflicks_settings.nedbPath === undefined || global.iflicks_settings.nedbPath === '') {
    dbPath = __dirname;
} else {
    dbPath = global.iflicks_settings.nedbPath;
}
db.flick = new Nedb({ filename: path.join(dbPath, '../flick.db'), autoload: true });
db.user = new Nedb({ filename: path.join(dbPath, '../user.db'), autoload: true });
db.flickUser = new Nedb({ filename: path.join(dbPath, '../flickUser.db'), autoload: true });
db.flickView = new Nedb({ filename: path.join(dbPath, '../flickView.db'), autoload: true });
