// Error code F08
var nedb = require('nedb');
//var flick = require('./flick');
var search = require('../lib/search');

var db = nedb.globalDb.flick, dbView = nedb.globalDb.flickView, flicks = {}, statsD;
if (db === undefined) { /// for testing
  console.log('DEE BEE ERROR');
 // db = new Nedb({ filename: global.iflicks_settings.nedbPath + 'iflicksdb', autoload: true });
}

flicks.setStatsD = function (statsd) {
  statsD = statsd;
};

flicks.listUnencoded = function (page, limit, userId, callback) {
  var i, skip, where, retVal, dbStartTime = new Date();
  page = Number(page);
  limit = Number(limit);
  skip = page * limit;
  where = { isEncoded: false, isDeleted: false };
  where.$or =  [{userId: userId}, {uploader: userId} ];
  db.count(where, function (err, count) {
    db.find(where)
      .sort({uploadTime: -1})
      .skip(skip)
      .limit(limit)
      .exec(function (err, docs) {
        if (statsD) {
          statsD.timing('db.flicks.listUnencoded', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        for (i = 0; i < docs.length; i++) {
          if (docs[i].userId === undefined) {
            docs[i].userId = docs[i].uploader;
          }
          docs[i].description = docs[i].name + '<hr>' + docs[i].description;
          if (docs[i].encodeProgress === undefined) {
            docs[i].name = 'Encoding not started';
          } else {
            docs[i].name = 'Encoding ' + Math.round(docs[i].encodeProgress) + ' % complete.';
          }
          docs[i].id = docs[i]._id;
          delete docs[i]._id;
        }

        retVal = {
          data:  docs,
          count: count
        };
        callback(undefined, retVal);
      });
  });
};

flicks.listUnencodedAll = function (page, limit,  callback) {
  var i, skip, where, userId, retVal, dbStartTime = new Date();
  page = Number(page);
  limit = Number(limit);
  skip = page * limit;
  where = { isEncoded: false, isDeleted: false };
  db.find(where)
    .sort({uploadTime: -1})
    .skip(skip)
    .limit(limit)
    .exec(function (err, docs) {
      if (statsD) {
        statsD.timing('db.flicks.listUnencoded', dbStartTime);
      }
      if (err) { callback(err, undefined); return; }
      for (i = 0; i < docs.length; i++) {
        if (docs[i].userId === undefined) {
          docs[i].userId = docs[i].uploader;
        }
        docs[i].id = docs[i]._id;
        delete docs[i]._id;
      }
      callback(undefined, docs);
    });
};

flicks.list = function (page, limit, userId, isSysAdmin, callback) {
  var i, skip,  retVal, where, dbStartTime = new Date();
  page = Number(page);
  limit = Number(limit);
  skip = page * limit;
  where = { isEncoded: true, isDeleted: false };
  if (isSysAdmin) {
    // Do nothing
  } else if (userId) {
    where.$or =  [{userId: userId}, {isPublic: true} ];
  } else {
    where.isPublic = true;
  }

  db.count(where, function (err, count) {
    db.find(where)
      .sort({uploadTime: -1})
      .skip(skip)
      .limit(limit)
      .exec(function (err, docs) {
        if (statsD) {
          statsD.timing('db.flicks.list', dbStartTime);
        }
        if (err) { callback(err, undefined); return; }
        for (i = 0; i < docs.length; i++) {
          if (docs[i].userId === undefined) {
            docs[i].userId = docs[i].uploader;
          }
          docs[i].id = docs[i]._id;
          delete docs[i]._id;
        }
        retVal = {
          data:  docs,
          count: count,
          page: page,
          limit: limit
        };
        callback(undefined, retVal);
      });
  });
};

flicks.search = function (page, limit, searchTerm, userId, isSysAdmin, callback) {
  var i,  retVal, where, dbStartTime = new Date();
  page = Number(page);
  limit = Number(limit);
  //skip = page * limit;
  where = { isEncoded: true, isDeleted: false };
  if (isSysAdmin) {
    // Do nothing
  } else if (userId) {
    where.$or =  [{userId: userId}, {isPublic: true} ];
  } else {
    where.isPublic = true;
  }
  db.find(where)
    .exec(function (err, docs) {
      if (statsD) {
        statsD.timing('db.flicks.search', dbStartTime);
        dbStartTime = new Date();
      }
      if (err) { callback(err, undefined); return; }

      var docs2 = docs.map(function (doc) {
        if (doc.tags) {
          doc.tags = doc.tags.split(',');
        }
        doc.id = doc._id;
        delete doc._id;
        return doc;
      });

      var docs3 = search(docs2, [{name: 'description', weight: 5}, {name: 'name', weight: 10}], searchTerm)
        .map(function (doc) { /// match the searched dataset to the original to get full details
          var ii;
          if (docs.some(function (val, i) {
              if (val._id === doc._id) {
                ii = i;
                return true;
              }
            })) {
            return docs[ii];
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

      retVal = {
        data:  docs3,
        count: count,
        page: page,
        limit: limit,
        search: searchTerm
      };
      if (statsD) {
        statsD.timing('flicks.search', dbStartTime);
      }
      callback(undefined, retVal);
    });
};

flicks.listAll = function (callback) {
  var dbStartTime = new Date();
  db.find({}, function (err, docs) {
    if (statsD) {
      statsD.timing('db.flicks.listAll', dbStartTime);
    }
    if (err) { callback(err, undefined); return; }
    callback(undefined, docs);
  });
};

flicks.listAllSearch = function (limit, search, callback) {
  var searchy, where = {}, dbStartTime = new Date();
  if (search) {
    searchy = new RegExp(search, 'i');
    where = {$or: [{_id: searchy}, {name: searchy}, {description: searchy}, {uploader: searchy}, {userId: searchy}, ] };
  }
  limit = limit || 10;
  limit = Number(limit);
  db.find(where)
    .sort({dateEntered: -1})
    .limit(limit)
    .exec(function (err, docs) {
      if (statsD) {
        statsD.timing('db.flicks.listAllSearch', dbStartTime);
      }
      if (err) { callback(err, undefined); return; }
      callback(undefined, docs);
    });
};

flicks.listAllViews = function (limit, searchh, callback) {
  var searchy, where = {}, dbStartTime = new Date();
  if (searchh) {
    searchy = new RegExp(searchh, 'i');
    where = {$or: [{flickId: searchy}, {userId: searchy}, {ipAddress: searchy}] };
  }
  limit = limit || 10;
  limit = Number(limit);
  dbView.find(where)
    .sort({dateEntered: -1})
    .limit(limit)
    .exec(function (err, docs) {
      if (statsD) {
        statsD.timing('db.flicks.listAllViews', dbStartTime);
      }
      if (err) { callback(err, undefined); return; }
      callback(undefined, docs);
    });
};

module.exports = flicks;