// Error code F09
var nedb = require('nedb');
var path = require('path');
var fs = require('fs');
var StatsD = require('statsd-client');

var statsD = StatsD.globalStatsD;

/** 
 * Programmatic representation of a flickUser for NEDB
 * 
 * @module flickUsernedb
 */
 
var flickUser = {};

/** 
 * Add a flickUser entry
 * @param {string} flickId - ID for flick
 * @param {uuid} userId - UUID for user
 * @param {object} colValues - object with values for additional columns.
 * @param {Requester~requestCallback} callback
 */
function add(flickId, userId, colValues, callback) {
    var flickUser = colValues;
    flickUser.userId = userId;
    flickUser.flickId = flickId;
    flickUser.dateEntered = new Date();
    flickUser.dateUpdated = new Date();
    nedb.globalDb.flickUser.insert(flick, function (err, newDoc) {
        if (err) { err.code = 'F09008'; callback(err, undefined); return; }
        callback();
    }); 
}

/**
 * Set the time the video was played to last time.
 * @param {string} flickId - ID for flick
 * @param {uuid} userId - UUID for user
 * @param {intiger} time - seconds into the vid
 * @param {Requester~requestCallback} callback
 */
 function timeUpdate(flickId, userId, time, callback) {
    if (userId === undefined) { callback(undefined); return; }
    var where, update, dbStartTime = new Date();
    where = { flickId: flickId, userId: userId };
    update = {$set: { time: time, dateUpdated: new Date()} };

    nedb.globalDb.flickUser.update(where, update, { upsert: true }, function (err, rowCount) {
        if (statsD) {
            statsD.timing('db.flickUser.timeUpdate.update', dbStartTime);
        }
        if (err) { callback(err); return; }
        if (rowCount === 0) {
            add(flickId, userId, {flickTime: time}, callback);
        } else if (rowCount === 1) {
            callback();
        } else {
            err = new Error('Unexpected number of rows updated: ' + recordset[0].rows);
            err.code = 'F09006';
            callback(err);
        }
    });
}

/** 
 * Get the time the video was played to last time.
 * @param {string} flickId - ID for flick
 * @param {uuid} userId - UUID for user
 * @param {Requester~requestCallback} callback
 */
function timeGet(flickId, userId, callback) {
    if (userId === undefined) { callback(undefined, 0); return; }
    var retVal, where = { flickId: flickId, userId: userId }, dbStartTime = new Date();
    nedb.globalDb.flickUser.findOne(where, {time: 1}, function (err, doc) {
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


flickUser.add = add;
flickUser.timeUpdate = timeUpdate;
flickUser.timeGet = timeGet;
module.exports = flickUser;