// Error code F04
/** 
 * Flick subclass.  Use this for all interactions with flicks when using MS SQL Server.
 * 
 * @module flicksqlserver
 */
var mssql = require('mssql');
var crypto = require('crypto');
var logger = require('../lib/logger');
var flickUser = require('./flickUser');
var StatsD = require('statsd-client');

var statsD = StatsD.globalStatsD;

//var connection = mssql.globalConnection;
function flickSqlServer() {

    function doFlickChangeList(property, oldObj, objForDb, defaultVal) {
        if (oldObj[property] === undefined && oldObj.hasOwnProperty(property) && defaultVal !== undefined) {  /// If a default is specified then use that
            objForDb[property] = defaultVal;
        } else if (oldObj.changes === undefined && typeof oldObj[property] === 'object') { /// mainly for fileDetail on copied flicks
            objForDb[property] = JSON.stringify(oldObj[property]);
        } else if (oldObj.changes === undefined) { /// if no changes array then return the original
            objForDb[property] = oldObj[property];
        } else if (oldObj.changes.indexOf(property) > -1 && typeof oldObj[property] === 'object') { /// mainly for fileDetail on new flicks
            objForDb[property] = JSON.stringify(oldObj[property]);
        } else if (oldObj.changes.indexOf(property) > -1) { /// if the item has changed then return it.
            objForDb[property] = oldObj[property];
        } else {
            //console.log('Noithing happening');
        }
    }

    /**
     * Abbreviated flick object with attributes the database cares about
     * @return {object} mini flick
     */
    function doFlickFromDatabase(flick) {
        var flk = {};
        flk.id = flick.id;
        doFlickChangeList('name', flick, flk);
        doFlickChangeList('description', flick, flk);
        doFlickChangeList('isEncoded', flick, flk);
        doFlickChangeList('isEncoding', flick, flk);
        doFlickChangeList('isPublic', flick, flk);
        doFlickChangeList('isDirectLinkable', flick, flk);
        doFlickChangeList('thumbnailPath', flick, flk);
        doFlickChangeList('userId', flick, flk);
        doFlickChangeList('originalName', flick, flk);
        doFlickChangeList('folderName', flick, flk);
        doFlickChangeList('sourcePath', flick, flk);
        doFlickChangeList('mediaPath', flick, flk);
        doFlickChangeList('fileDetail', flick, flk);
        doFlickChangeList('encodingProgress', flick, flk);
        doFlickChangeList('tags', flick, flk);
        doFlickChangeList('playCount', flick, flk, 0);
        doFlickChangeList('fileDetail', flick, flk);
        doFlickChangeList('emailWhenEncoded', flick, flk, false);

        return flk;
    }


    /** Get a flick from the database
     * @param {object} flick - An abbreviated Flick object with the relevant database fields
     * 
     */
    function doGetFlickById(id, userId, isSysAdmin, callback) {
        var err, sql, request, key, dbStartTime = new Date();

        request = new mssql.Request(mssql.globalConnection);
        sql = 'SELECT * FROM flick f ' +
         ' LEFT JOIN flickUser fu ON fu.flickId = f.id AND fu.isGrantedAccess = 1' +
            ' WHERE  f.id = @id AND f.isDeleted = 0 ';
            if (isSysAdmin !== true) {
              sql += ' AND (f.isPublic = 1 ' +
                ' OR fu.flickId IS NOT NULL ' +
                ' OR f.userId = @userId ) ';
            }
        request.input('id', mssql.VarChar(36), id);
        request.input('userId', mssql.UniqueIdentifier, userId);
        request.query(sql, function (err, recordset) {
            if (statsD) {
                statsD.timing('flick.doGetFlickById', dbStartTime);
            }
            if (err) { mssql.errorHandler(err); err.code = 'F04021'; callback(err, undefined); return; }

            recordset.forEach(function (record) {
                for (key in record) { /// Wierd thing where userId comes out as a two row array. 
                    if (key === 'userId' && Array.isArray(record[key])) {
                        record.userId = record.userId[0];
                    }
                    if (key === 'fileDetail' && record[key] !== null) {
                        record.fileDetail = JSON.parse(record.fileDetail);
                    }
                }
            });
            if (recordset.length > 0) {
                callback(undefined, recordset[0]); /// The ALL OK callback
            } else {
                err = new Error('Flick does not exist');
                err.code = 'F04038';
                callback(err, undefined);
            }
        });
    }

    function random(howMany, chars) {
        chars = chars || 'abcdefghijklmnopqrstuwxyz0123456789';
        var rnd = crypto.randomBytes(howMany),
            value = new Array(howMany),
            len = chars.length,
            i;

        for (i = 0; i < howMany; i++) {
            value[i] = chars[rnd[i] % len];
        }

        return value.join('');
    }
    /** Add a new flick to the database
     * @param {object} flick - An abbreviated Flick object with the relevant database fields
     * 
     */
    function doInsertFlick(flick, secondAttempt, callback) {
        var err, sql, request, key, id = random(8), dbStartTime = new Date();

        if (flick.load) {
            err = new Error('flick needs to be passed through flickFromDatabase first');
            err.code = 'F04037';
            callback(err);
        }
        flick.isDeleted = false;
        flick.id = id;

        request = new mssql.Request(mssql.globalConnection);
        sql = 'INSERT INTO Flick (';
        for (key in flick) {
            if (flick.hasOwnProperty(key)) {
                sql += key + ', ';
                request.input(key, flick[key]);
            }
        }
        sql += 'dateUpdated, dateEntered) VALUES (';
        for (key in flick) {
            if (flick.hasOwnProperty(key)) {
                sql += '@' + key + ', ';
            }
        }
        sql += '@now, @now)';
        request.input('now', mssql.DateTime2, new Date());
        request.query(sql, function (err, recordset) {
            if (statsD) {
                statsD.timing('flick.doInsertFlick', dbStartTime);
            }
            if (err) {
                /// This is supposed to handle ID clashes.  It tries a second time.
                if (err.message.indexOf('Violation of PRIMARY KEY constraint') > -1 && secondAttempt === false) {
                    err = new Error('FlickId clash.  Retrying');
                    logger.errorNoReq('flickSqlServer.doInsertFlick', 'F04039', err, 2);
                    doInsertFlick(flick, true, callback);
                } else {
                    err.code = 'F04020'; callback(err, undefined);
                    return;
                }
            } else {
                // console.log(recordset);
                callback(undefined, id); /// The ALL OK callback
            }
        });

    }
    /** Add a new flick to the database
     * @param {object} flick - An abbreviated Flick object with the relevant database fields
     * 
     */
    function doInsertFlickDbGeneratesId(flick, callback) {
        var err, sql, request, key, dbStartTime = new Date();
        if (flick.load) {
            err = new Error('flick needs to be passed through flickFromDatabase first');
            err.code = 'F04037';
            callback(err);
        }
        flick.isDeleted = false;

        request = new mssql.Request(mssql.globalConnection);
        sql = 'INSERT INTO Flick (';
        for (key in flick) {
            if (flick.hasOwnProperty(key) && key !== 'id') {
                sql += key + ', ';
                request.input(key, flick[key]);
            }
        }
        sql += 'dateUpdated, dateEntered) OUTPUT INSERTED.id VALUES (';
        for (key in flick) {
            if (flick.hasOwnProperty(key) && key !== 'id') {
                sql += '@' + key + ', ';
            }
        }
        sql += '@now, @now)';
        request.input('now', mssql.DateTime2, new Date());
        request.query(sql, function (err, recordset) {
            if (statsD) {
                statsD.timing('flick.doInsertFlickGeneratesId', dbStartTime);
            }
            if (err) { err.code = 'F04020'; callback(err, undefined); return; }

            // console.log(recordset);
            if (recordset.length > 0) {
                callback(undefined, recordset[0].id); /// The ALL OK callback
            } else {
                err = new Error('No row inserted');
                err.code = 'F04038';
                callback(err, undefined);
            }
        });
        
    }

    /**
     * Universal flick update
     * @param {object} flick - abbreviated flick object.  If whole flick object is used then pass it through flickFromDatabase.
     * @param {Requester~requestCallback} callback
     */
    function doUpdateFlick(flick, callback) {
        var err, request, sql, key, dbStartTime = new Date();
        if (flick.load) {
            err = new Error('flick needs to be passed through flickFromDatabase first');
            err.code = 'F04036';
            callback(err);
        }
        if (flick.id === undefined || flick.id === null) {
            err = new Error('Flick ID is not defined');
            err.code = 'F04015';
            callback(err, undefined);
            return;
        }

        /*connection = new mssql.Connection(sqlconfig)
            .then(function () {
                request = new sql.Request(connection);
                sql = 'UPDATE Flick SET ';
                for (key in flick) {
                    if (flick.hasOwnProperty(key) && key !== 'id') {
                        sql += key + ' = @' + key;
                        request.input(key, flick[key]);
                    }
                    sql += ', ';
                }
                sql += 'dateUpdated = @now WHERE id = @id';
                request.input('id', mssql.UniqueIdentifier, flick.id);
                request.input('now', mssql.DateTime2, new Date());
                request.query(sql)
                .then(function (recordset) {
                    if (recordset.length > 0) {
                        callback(undefined, true);
                    } else {
                        callback(undefined, false);
                    }
                })
                .catch(function (err) {
                    err.code = 'F04016'; callback(err, undefined); return; 
                });
            })
            .catch(function (err) {
                err.code = 'F04017'; callback(err, undefined); return; 
            });
    */

        request = new mssql.Request(mssql.globalConnection);
        sql = 'UPDATE Flick SET ';
        for (key in flick) {
            if (flick.hasOwnProperty(key) && key !== 'id' && typeof flick[key] !== 'object' && typeof flick[key] !== 'function') {
                sql += key + ' = @' + key + ', ';
                request.input(key, flick[key]);
            }
        }
        sql += 'dateUpdated = @now WHERE id = @id;';
        //console.log(sql);
        request.input('id', mssql.VarChar(36), flick.id);
        request.input('now', mssql.DateTime2, new Date());
        request.query(sql, function (err) {
            if (statsD) {
                statsD.timing('flick.doUpdateFlick', dbStartTime);
            }
            if (err) { mssql.errorHandler(err); err.code = 'F04017'; callback(err, undefined); return; }
            callback(err, true);
        });
    }

    function doAddUser(flickId, userId, callback) {
        var colValues = {isGrantedAccess: true};
        flickUser.update(flickId, userId, colValues, callback);
    }
    function doRemoveUser(flickId, userId, callback) {
        var colValues = {isGrantedAccess: false};
        flickUser.update(flickId, userId, colValues, callback);
    }

    this.flickFromDatabase = function (flick) {
        return doFlickFromDatabase(flick);
    };
    this.getFlickById = function (id, userId, isSysAdmin, callback) {
        return doGetFlickById(id, userId, isSysAdmin, callback);
    };
    this.insertFlick = function (flick, callback) {
        return doInsertFlick(flick, false, callback);
    };
    this.updateFlick = function (flick, callback) {
        return doUpdateFlick(flick, callback);
    };
    this.addUser = function (flickId, userId, callback) {
        return doAddUser(flickId, userId, callback);
    };
    this.removeUser = function (flickId, userId, callback) {
        return doRemoveUser(flickId, userId, callback);
    };
}

module.exports = flickSqlServer;

