// Error code F09
var mssql = require('mssql');
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
function addInternal(flickId, userId, colValues, callback) {
    var err, retVal, colName, sql, request, key, dbStartTime = new Date();
    if (userId === undefined || flickId === undefined) {
        err = new Error('UserId and flickId are required.');
        err.code = 'F09004';
        callback(err); 
        return;
    }
    request = new mssql.Request(mssql.globalConnection);
    sql = 'INSERT INTO flickUser (userId, flickId, ';
    for(colName in colValues) {
        if (colName.indexOf(';') > -1 || colName.length > 40) {
            err = new Error('Odd looking column names');
            err.code = 'F09007';
            callback(err);
            return;
        }
        sql += colName + ', ';
    }
    sql +=' dateEntered, dateUpdated) ' +
        'VALUES (@userId, @flickId, ';
    for(colName in colValues) {
        sql += '@' + colName + ', ';
        request.input(colName, colValues[colName]);
    }
    sql +=' @now, @now);';

    request.input('userId', mssql.UniqueIdentifier, userId);
    request.input('flickId', mssql.VarChar(36), flickId);
    request.input('now', mssql.DateTime2, new Date());
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('flickUser.add.insert', dbStartTime);
        }
        if (err) { mssql.errorHandler(err); err.code = 'F09005'; callback(err, undefined); return; }
        callback();
    });
}

/**
 * Update or insert flickUser data
 * @param {string} flickId - ID for flick
 * @param {uuid} userId - UUID for user
 * @param {object} colValues - object with values for additional columns.
 * @param {Requester~requestCallback} callback
 */
function update(flickId, userId, colValues, callback) {
    if (userId === undefined) { callback(undefined); return; }
    var err, sql, colName, request, key, dbStartTime = new Date();

    request = new mssql.Request(mssql.globalConnection);
    sql = 'UPDATE flickUser SET ';
    for(colName in colValues) {
        if (colName.indexOf(';') > -1 || colName.length > 40 || colName.toLowerCase().indexOf(' truncate ') > -1 || colName.toLowerCase().indexOf(' drop ') > -1) {
            err = new Error('Odd looking column names');
            err.code = 'F09008';
            callback(err);
            return;
        }
        sql += colName + ' = @' + colName + ', ';
        request.input(colName, colValues[colName]);
    }
    sql += 'dateUpdated = @now ' +
        'WHERE userId = @userId AND flickId = @flickId; SELECT @@ROWCOUNT as rows';
    request.input('userId', mssql.UniqueIdentifier, userId);
    request.input('flickId', mssql.VarChar(36), flickId);
    request.input('now', mssql.DateTime2, new Date());
    request.query(sql, function (err, recordset, moo) {
        if (statsD) {
            statsD.timing('flickUser.update', dbStartTime);
        }
        if (err) { mssql.errorHandler(err); err.code = 'F09009'; callback(err, undefined); return; }
        if (recordset[0].rows === 0) {
            addInternal(flickId, userId, colValues, callback);
        } else if (recordset[0].rows === 1) {
            callback();
        } else {
            err = new Error('Unexpected number of rows updated: ' + recordset[0].rows);
            err.code = 'F09010';
            callback(err);
        }
    });
}
/**
 * Shortcut for update to add access to a flick
 * @param {string} flickId - ID for flick
 * @param {uuid} userId - UUID for user
 * @param {Requester~requestCallback} callback
 */
function add(flickId, userId, userAlias, callback) {
    update(flickId, userId, {isGrantedAccess: true, userAlias: userAlias}, callback);
}
/**
 * Shortcut for update to remove access to a flick
 * @param {string} flickId - ID for flick
 * @param {uuid} userId - UUID for user
 * @param {Requester~requestCallback} callback
 */
function remove(flickId, userId, callback) {
    update(flickId, userId, {isGrantedAccess: false}, callback);
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
    var err, sql, request, key, dbStartTime = new Date();

    sql = 'UPDATE flickUser SET flickTime = @flickTime, dateUpdated = @now ' +
        'WHERE userId = @userId AND flickId = @flickId; SELECT @@ROWCOUNT as rows';
    request = new mssql.Request(mssql.globalConnection);
    request.input('userId', mssql.UniqueIdentifier, userId);
    request.input('flickId', mssql.VarChar(36), flickId);
    request.input('flickTime', mssql.Int, time);
    request.input('now', mssql.DateTime2, new Date());
    request.query(sql, function (err, recordset, moo) {
        if (statsD) {
            statsD.timing('flickUser.timeUpdate.update', dbStartTime);
        }
        if (err) { mssql.errorHandler(err); err.code = 'F09002'; callback(err, undefined); return; }
        if (recordset[0].rows === 0) {
            add(flickId, userId, {flickTime: time}, callback);
        } else if (recordset[0].rows === 1) {
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
    var retVal, sql, request, key, dbStartTime = new Date();
    sql = 'SELECT flickTime FROM flickUser WHERE userId = @userId AND flickId = @flickId;';
    request = new mssql.Request(mssql.globalConnection);
    request.input('userId', mssql.UniqueIdentifier, userId);
    request.input('flickId', mssql.VarChar(36), flickId);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('flickUser.timeGet', dbStartTime);
        }
        if (err) { mssql.errorHandler(err); err.code = 'F09003'; callback(err, undefined); return; }
        if (recordset.length > 0) {
            retVal = recordset[0].flickTime || 0;
        } else {
            retVal = 0;
        }
        
        callback(undefined, retVal);
    });
}

function get(flickId, callback) {
    var retVal, sql, request, dbStartTime = new Date();
    sql = 'SELECT userId, userAlias FROM flickUser WHERE flickId = @flickId;';
    request = new mssql.Request(mssql.globalConnection);
    request.input('flickId', mssql.VarChar(36), flickId);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('flickUser.get', dbStartTime);
        }
        if (err) { mssql.errorHandler(err); err.code = 'F09011'; callback(err, undefined); return; }
        callback(undefined, recordset);
    });
}


flickUser.get = get;
flickUser.add = add;
flickUser.update = update;
flickUser.remove = remove;
flickUser.timeUpdate = timeUpdate;
flickUser.timeGet = timeGet;
module.exports = flickUser;