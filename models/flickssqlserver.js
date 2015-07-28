// Error code F08
var mssql = require('mssql');
var search = require('../lib/search');


var flicks = {};


/**
 * Get a list of flicks which are waiting to be encoded.
 * @param {number} page
 * @param {number} limit
 * @param {string} userId - User ID UUID
 * @param {Requester~requestCallback} callback
 */
function listUnencoded(page, limit, userId, callback) {
    var sql, request, rowLower, rowUpper;
    rowLower = page * limit;
    rowUpper = (page + 1) * limit;
    sql = 'SELECT COUNT(*) as count FROM flick WHERE userId = @userId AND isEncoded = 0 AND isDeleted = 0';
    
    request = new mssql.Request(mssql.globalConnection);
    request.input('userId', mssql.UniqueIdentifier, userId);
    request.query(sql, function (err, recordset) {
      if (err) { mssql.errorHandler(err); err.code = 'F08001'; callback(err, undefined); return; }
      count = recordset.count;
      sql = 'SELECT * ' +
        'FROM ( SELECT ROW_NUMBER() OVER ( ORDER BY f.dateEntered ) AS RowNum, f.* ' +
        ' FROM flick f ' +
        ' WHERE f.isDeleted = 0 AND f.isEncoded = 0 AND f.userId = @userId ' +
        ') AS RowConstrainedResult ' +
        'WHERE RowNum >= @rowLower ' +
        'AND RowNum < @rowUpper ' +
        'ORDER BY RowNum ';
      //if (connection.connected === false) { connection.connect(function () {console.log('Late connect'); }); }
      request = new mssql.Request(mssql.globalConnection);
      request.input('userId', mssql.UniqueIdentifier, userId);
      request.input('rowLower', mssql.Int, rowLower);
      request.input('rowUpper', mssql.Int, rowUpper);
      request.query(sql, function (err, recordset) {
          if (err) { mssql.errorHandler(err); err.code = 'F08002'; callback(err, undefined); return; }
          if (recordset.length === 0) { callback(undefined, {data: [], count:0 } ); return; }
          /*for (i = 0; i < recordset[0].length; i++) {
            recordset[0][i].description = recordset[0][i].name + '<hr>' + recordset[0][i].description;
            if (recordset[0][i].encodeProgress === undefined) {
              recordset[0][i].name = 'Encoding not started';
            } else {
              recordset[0][i].name = 'Encoding ' + Math.round(recordset[0][i].encodeProgress) + ' % complete.';
            }
          }*/
          for (i = 0; i < recordset.length; i++) {
            recordset[i].description = recordset[i].name + '<hr>' + recordset[i].description;
            if (recordset[i].encodingProgress === undefined) {
              recordset[i].name = 'Encoding not started';
            } else {
              recordset[i].name = 'Encoding ' + Math.round(recordset[i].encodingProgress) + ' % complete.';
            }
          }
          retVal = {
            data:  recordset,
            count: count
          };
          callback(undefined, retVal);
      });
    });
}
flicks.listUnencoded = listUnencoded;

/**
 * Get a list of flicks which are waiting to be encoded.  Not to be called by the web front end.
 * @param {number} page
 * @param {number} limit
 * @param {string} userId - User ID UUID
 * @param {Requester~requestCallback} callback
 */
function listUnencodedAll(page, limit, callback) {
  var sql, request, rowLower, rowUpper;
  rowLower = (page * limit) + 1;
  rowUpper = ((page + 1) * limit) + 1;
  sql = 'SELECT * ' +
    'FROM ( SELECT ROW_NUMBER() OVER ( ORDER BY f.dateEntered ASC ) AS RowNum, f.* ' +
    ' FROM flick f ' +
    ' WHERE f.isDeleted = 0 AND f.isEncoded = 0 ' +
    ') AS RowConstrainedResult ' +
    'WHERE RowNum >= @rowLower ' +
    'AND RowNum < @rowUpper ' +
    'ORDER BY RowNum ';
  //if (connection.connected === false) { connection.connect(function () {console.log('Late connect'); }); }
  request = new mssql.Request(mssql.globalConnection);
  request.input('rowLower', mssql.Int, rowLower);
  request.input('rowUpper', mssql.Int, rowUpper);
  request.query(sql, function (err, recordset) {
    if (err) { mssql.errorHandler(err); callback(err, undefined); return; }
    callback(undefined, recordset);
  });
}
flicks.listUnencodedAll = listUnencodedAll;


/**
 * Get a list of flicks
 * @param {number} page
 * @param {number} limit
 * @param {string} userId - User ID UUID
 * @param {Requester~requestCallback} callback
 */
function list(page, limit, userId, isSysAdmin, callback) {
    var sql, request, rowLower, rowUpper;
    rowLower = page * limit;
    rowUpper = (page + 1) * limit;

    sql = 'SELECT COUNT(*) as count FROM flick WHERE userId = @userId AND isEncoded = 0 AND isDeleted = 0';
    request = new mssql.Request(mssql.globalConnection);
    request.input('userId', mssql.UniqueIdentifier, userId);
    request.query(sql, function (err, recordset) {
      if (err) { mssql.errorHandler(err); err.code = 'F08003'; callback(err, undefined); return; }
      count = recordset.count;
      sql = 'SELECT * ' +
        'FROM ( SELECT ROW_NUMBER() OVER ( ORDER BY f.dateEntered ) AS RowNum, f.* ' +
        'FROM flick f ' +
        ' LEFT JOIN flickUser fu ON fu.flickId = f.id ' +
        ' WHERE f.isDeleted = 0 AND f.isEncoded = 1 ';
        if (isSysAdmin !== true) {
          sql += ' AND (f.isPublic = 1 ' +
            ' OR fu.flickId IS NOT NULL ' +
            ' OR f.userId = @userId ) ';
        }
        sql += ') AS RowConstrainedResult ' +
          'WHERE RowNum >= @rowLower ' +
          'AND RowNum < @rowUpper ' +
          'ORDER BY RowNum DESC ';
      //if (connection.connected === false) { connection.connect(function () {console.log('Late connect'); }); }
      request = new mssql.Request(mssql.globalConnection);
      request.input('userId', mssql.UniqueIdentifier, userId);
      request.input('rowLower', mssql.Int, rowLower);
      request.input('rowUpper', mssql.Int, rowUpper);
      request.query(sql, function (err, recordset) {
          if (err) { mssql.errorHandler(err);  err.code = 'F08004'; callback(err, undefined); return; }
          retVal = {
            data:  recordset,
            count: count
          };
          callback(undefined, retVal);
      });
    });
}
flicks.list = list;


function innerSearch(page, limit, searchTerm, rows) {
    var retVal, docs2 = rows.map(function (doc) {
        if (doc.tags) {
          doc.tags = doc.tags.split(',');
        }
        return doc;
      });
      var docs3 = search(docs2, [{name: 'description', weight: 5}, {name: 'name', weight: 10}, {name: 'tags', weight: 5}], searchTerm)
        .map(function (doc) { /// match the searched dataset to the original to get full details
          var ii;
          if (rows.some(function (val, i) {
              if (val.id === doc.id) {
                ii = i;
                return true;
              }
            })) {
            return rows[ii];
          }
        });

      var count = docs3.length;
      docs3 = docs3.reduce(function (prev, curr, i) { /// pagination
        if (i >= page * limit && i < (page + 1) * limit) {
          prev.push(curr);
          return prev;
        }
        return prev;
      }, []);
     /* for (i = 0; i < rows.length; i++) {
        if (rows[i].userId === undefined) {
          rows[i].userId = rows[i].uploader;
        }
      }*/
      retVal = {
        data:  docs3,
        count: count,
        page: page,
        limit: limit,
        search: searchTerm
      };
      return retVal;
}

/**
 * Get a list of flicks
 * @param {number} page
 * @param {number} limit
 * @param {string} userId - User ID UUID
 * @param {Requester~requestCallback} callback
 */
function searchy(page, limit, searchTerm, userId, isSysAdmin, callback) {
    var sql, request, count, retVal, rowLower, rowUpper;
    rowLower = page * limit;
    rowUpper = (page + 1) * limit;

    sql = 'SELECT f.* ' +
      'FROM flick f ' +
      ' LEFT JOIN flickUser fu ON fu.flickId = f.id ' +
      ' WHERE f.isDeleted = 0 AND f.isEncoded = 1 AND ( ' +
        'name like \'%\' + @searchTerm + \'%\''+
        'OR description like \'%\' + @searchTerm + \'%\''+
        'OR tags like \'%\' + @searchTerm + \'%\''+
      ')';
      if (isSysAdmin !== true) {
        sql += ' AND (f.isPublic = 1 ' +
          ' OR fu.flickId IS NOT NULL ' +
          ' OR f.userId = @userId ) ';
      }
    //if (connection.connected === false) { connection.connect(function () {console.log('Late connect'); }); }
    request = new mssql.Request(mssql.globalConnection);
    request.input('userId', mssql.UniqueIdentifier, userId);
    request.input('searchTerm', mssql.VarChar, searchTerm);
    request.query(sql, function (err, recordset) {
      if (err) { mssql.errorHandler(err);  err.code = 'F08005'; callback(err, undefined); return; }
      retVal = innerSearch(page, limit, searchTerm, recordset);
      
      /*if (statsD) {
        statsD.timing('flicks.search', dbStartTime);
      }*/
      callback(undefined, retVal);
    });
}
flicks.search = searchy;


/**
 * Get a list of flicks.  This should not be called by website facing code.
 * @param {Requester~requestCallback} callback
 */
function listAll(callback) {
    var sql, request;

    sql = 'SELECT * FROM flick WHERE isDeleted = 0';
    request = new mssql.Request(mssql.globalConnection);
   
    request.query(sql, function (err, recordset) {
      if (err) { mssql.errorHandler(err); err.code = 'F08006'; callback(err, undefined); return; }
        callback(undefined, recordset);
    });
}
flicks.listAll = listAll;

/**
 * Basic search for the toolbox.  This should not be called by website facing code.
 * @param {Requester~requestCallback} callback
 */
function listAllSearch(limit, search, callback) {
    var sql, request;
    limit = Number(limit);
    sql = 'SELECT TOP ' + limit + ' * FROM flick WHERE isDeleted = 0 ';
    if (search !== undefined && search !== '-')
      sql += ' AND (' +
        'name like \'%@search%\''+
        'OR description like \'%@search%\''+
        'OR userId like \'%@search%\''+
        ')';
    request = new mssql.Request(mssql.globalConnection);
    request.input('search', mssql.VarChar, search);
   
    request.query(sql, function (err, recordset) {
      if (err) { mssql.errorHandler(err); err.code = 'F08007'; callback(err, undefined); return; }
        callback(undefined, recordset);
    });
}
flicks.listAllSearch = listAllSearch;

/**
 * Basic search for the toolbox.  This should not be called by website facing code.
 * @param {Requester~requestCallback} callback
 */
function checkExists(folderName, callback) {
    var sql, request;

    sql = 'SELECT TOP 1 id FROM flick WHERE isDeleted = 0 AND folderName = @folderName';
    request = new mssql.Request(mssql.globalConnection);
    request.input('folderName', mssql.VarChar, folderName);
   
    request.query(sql, function (err, recordset) {
      if (err) { mssql.errorHandler(err); err.code = 'F08008'; callback(err, undefined); return; }
      if (recordset.length > 0) {
        callback(undefined, true);
      } else {
        callback(undefined, false);
      }
    });
}
flicks.checkExists = checkExists;
module.exports = flicks;