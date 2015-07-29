// Error code F07
/** 
 * Users subclass.  Use this for all interactions with users when using MS SQL Server.
 * 
 * @module userssqlserver
 */
var mssql = require('mssql');
//var connection = mssql.globalConnection;
var users = {};

/**
 * Get a user list
 * @param {Requester~requestCallback} callback
 */
function listAll(callback) {
    var sql, request, i, dbStartTime = new Date();
    sql = 'SELECT * FROM Users WHERE isDeleted = 0 ORDER BY dateEntered DESC';

    request = new mssql.Request(add);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('users.listAll', dbStartTime);
        }
        if (err) { err.code = 'F06702'; callback(err, undefined); return; }
        if (recordset.length === 0) {
            err = new Error('User not found');
            err.code = 'F07003';
            callback(err, undefined);
            return;
        }
        //console.dir(recordset);
        for(i = 0; i < recordset.length; i++) {
            delete recordset[i].password; // = '';
        }
        callback(undefined, recordset);
    });
}

users.listAll = listAll;

/**
 * Get a user based on the passed in ID
 * @param {string} userId - User ID UUID
 * @param {bool} includeDisabled
 * @param {Requester~requestCallback} callback
 */
function listAllSearch(limit, search, callback) {
    var sql, request, i, dbStartTime = new Date();
    limit = Number(limit);
    sql = 'SELECT TOP ' + limit + ' * FROM Users WHERE isDeleted = 0 ';
    if (search !== undefined && search !== '-') {
        sql +=  'AND (' +
            'username LIKE \'%search%\'' +
            ') ';
        }
        sql += ' ORDER BY dateEntered DESC';

    request = new mssql.Request(mssql.globalConnection);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('users.listAllSearch', dbStartTime);
        }

        if (err) { err.code = 'F06704'; callback(err, undefined); return; }
        if (recordset.length === 0) {
            err = new Error('User not found');
            err.code = 'F07005';
            callback(err, undefined);
            return;
        }
        //console.dir(recordset);
        for(i = 0; i < recordset.length; i++) {
            delete recordset[i].password; // = '';
        }
        callback(undefined, recordset);
    });
}

users.listAllSearch = listAllSearch;
/*
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
};*/



module.exports = users;