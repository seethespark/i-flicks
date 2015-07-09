// Error code F08
var flick = require('./flick');
var search = require('../lib/search');

var db = flick.db, dbView = flick.dbView, flicks = {}, statsD;

flicks.setStatsD = function (statsd) {
  statsD = statsd;
};

flicks.listUnencoded = function (page, limit, user, callback) {
  var i, skip, where, userId, retVal, dbStartTime = new Date();
  page = Number(page);
  limit = Number(limit);
  skip = page * limit;
  where = { encoded: false, deleted: { $exists: false } };
  user = user || {};
  if (user.isSysAdmin) {
    // Do nothing
  } else if (user.id) {
    userId = user.id || 'zzzzzzzzzzzzzzzz'; // the user columns could be undefined
    where.$or =  [{userId: userId}, {uploader: userId}, {public: true} ];
  } else {
    where.public = true;
  }
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
        }
        retVal = {
          data:  docs,
          count: count
        };
        callback(undefined, retVal);
      });
  });
};

flicks.list = function (page, limit, user, callback) {
  var i, skip, userId, retVal, where, dbStartTime = new Date();
  page = Number(page);
  limit = Number(limit);
  skip = page * limit;
  where = { encoded: true, deleted: { $exists: false } };
  user = user || {};
  if (user.isSysAdmin) {
    // Do nothing
  } else if (user.id) {
    userId = user.id || 'zzzzzzzzzzzzzzzz'; // the user columns could be undefined
    where.$or =  [{userId: userId}, {uploader: userId}, {public: true} ];
  } else {
    where.public = true;
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

flicks.search = function (page, limit, searchh, user, callback) {
  var i,  userId, retVal, where, dbStartTime = new Date();
  page = Number(page);
  limit = Number(limit);
  //skip = page * limit;
  where = { encoded: true, deleted: { $exists: false } };
  user = user || {};
  if (user.isSysAdmin) {
    // Do nothing
  } else if (user.id) {
    userId = user.id || 'zzzzzzzzzzzzzzzz'; // the user columns could be undefined
    where.$or =  [{userId: userId}, {uploader: userId}, {public: true} ];
  } else {
    where.public = true;
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
        return doc;
      });

      var docs3 = search(docs2, [{name: 'description', weight: 5}, {name: 'name', weight: 10}], searchh)
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

      for (i = 0; i < docs.length; i++) {
        if (docs[i].userId === undefined) {
          docs[i].userId = docs[i].uploader;
        }
      }
      retVal = {
        data:  docs3,
        count: count,
        page: page,
        limit: limit,
        search: searchh
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