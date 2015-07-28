// Error code F09
var Nedb = require('nedb');
var path = require('path');
var fs = require('fs');

/** 
 * Programmatic representation of a flickUser
 * 
 * @module flickUser
 */


var db = new Nedb({ filename: global.iflicks_settings.databasePath + 'iflicksflickUserdb', autoload: true });

var statsD, flickUser = {};

flickUser.setStatsD = function (statsd) {
    statsD = statsd;
};

/**
 * 
 */
function timeUpdate(flickId, userId, time, callback) {
    if (userId === undefined) { callback(undefined); return; }
	var where, update, dbStartTime = new Date();
	where = { flickId: flickId, userId: userId };
	update = { flickId: flickId, userId: userId, time: time, dateUpdated: new Date()};

	if (time === 0) {
		db.remove(where, {}, function (err) {
	        if (statsD) {
	            statsD.timing('db.flickUser.timeUpdate.remove', dbStartTime);
	        }
	        if (err) { callback(err); return; }
	        callback();
	    });
	} else {
	    db.update(where, update, { upsert: true }, function (err) {
	        if (statsD) {
	            statsD.timing('db.flickUser.timeUpdate.update', dbStartTime);
	        }
	        if (err) { callback(err); return; }
	        callback();
	    });
	}
}

/** 
 * Get the time the video was played to last time.
 * @param {int} flickId - ID for flick
 * @param {int} userId - UUID for user
 * @param {Requester~requestCallback} callback
 */
function timeGet(flickId, userId, callback) {
    if (userId === undefined) { callback(undefined, 0); return; }
	var retVal, where = { flickId: flickId, userId: userId };
	db.findOne(where, {time: 1}, function (err, doc) {
        if (statsD) {
            statsD.timing('db.flickUser.timeGet', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        if (doc === null || doc === undefined) {
            retVal = 0;
        } else {
            retVal = Number(doc.time);
        }
        callback(undefined, retVal);
    });
}


flickUser.timeUpdate = timeUpdate;
flickUser.timeGet = timeGet;
module.exports = flickUser;