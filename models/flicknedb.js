// Error code F04
var nedb = require('nedb');
var path = require('path');
var fs = require('fs');

/** 
 * Programmatic representation of a flick, or video.
 * 
 * @module flick
 */

var db = nedb.globalDb.flick, dbView = nedb.globalDb.flickView;
//var db = new Nedb({ filename: global.iflicks_settings.nedbPath + 'iflicksdb', autoload: true });
//var dbView = new Nedb({ filename: global.iflicks_settings.nedbPath + 'iflicksviewdb', autoload: true });

function flickNedb() {
    /**
     * Abbreviated flick object with attributes the database cares about
     * @return {object} mini flick
     */
    function doFlickFromDatabase(flick) {
        var flk = {};
        flk.id = flick.id;
        flk.name = flick.name;
        flk.description = flick.description;
        flk.isEncoded = flick.isEncoded;
        flk.isPublic = flick.isPublic;
        flk.isDirectLinkable = flick.isDirectLinkable;
        flk.thumbnailPath = flick.thumbnailPath;
        flk.userId = flick.userId;
        flk.originalName = flick.originalName;
        flk.folderName = flick.folderName;
        flk.sourcePath = flick.sourcePath;
        flk.fileDetail = flick.fileDetail;
        flk.mediaPath = flick.mediaPath;
        flk.encodingProgress = flick.encodingProgress;
        flk.tags = flick.tags;
        flk.playCount = flick.playCount;
        flk.emailWhenEncoded = flick.emailWhenEncoded;
        
        return flk;
    }

    /** Get a flick from the database
     * @param {object} flick - An abbreviated Flick object with the relevant database fields
     * 
     */
    function doGetFlickById(id, userId, isSysAdmin, callback) {
        var where;
        where = {_id: id };
        if (isSysAdmin) {
            // Do nothing
        } else if (userId) {
            where.$or =  [{userId: userId}, {idPublic: true}, {isDirectLinkable: true} ];
        } else {
            where.$or =  [{isPublic: true}, {isDirectLinkable: true} ];
        }
        db.findOne(where, /*{_id: 1, name: 1, description: 1},*/ function (err, doc) {
            if (err) { callback(err, undefined); return; }
            if (doc === null) {
                err = new  Error('Missing flick');
                err.status = 401;
                err.code = 'F04005';
                callback(err, undefined); 
                return;
            }
            doc.id = doc._id;
            delete doc._id;
            callback(undefined, doc);
        });

    }


    /** Add a new flick to the database
     * @param {object} flick - An abbreviated Flick object with the relevant database fields
     * 
     */
    function doInsertFlick(flick, callback) {
        var err, sql, request, key;
        if (flick.load) {
            err = new Error('flick needs to be passed through flickFromDatabase first');
            err.code = 'F04037';
            callback(err);
        }
        flick.isDeleted = false;
        nedb.globalDb.flick.insert(flick, function (err, newDoc) {
            if (err) { err.code = 'F04020'; callback(err, undefined); return; }
            callback(undefined, newDoc._id);
        });    
    }

    /**
     * Universal flick update
     * @param {object} flick - abbreviated flick object.  If whole flick object is used then pass it through flickFromDatabase.
     * @param {Requester~requestCallback} callback
     */
    function doUpdateFlick(flick, callback) {
        var err, request, update, key, flickId;
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
        flickId = flick.id;
        update = flick;
        delete update.id;
        update.dateUpdated = new Date();

        //dbStartTime = new Date();
        db.update({_id: flickId}, {
            $set: update
        }, function (err, res) {
            if (err) { err.code = 'F04017'; callback(err, undefined); return; }
            callback(undefined, true);
        });
    }                   

    this.flickFromDatabase = function (flick) {
        return doFlickFromDatabase(flick);
    };
    this.getFlickById = function (id, userId, isSysAdmin, callback) {
        return doGetFlickById(id, userId, isSysAdmin, callback);
    };
    this.insertFlick = function (flick, callback) {
        return doInsertFlick(flick, callback);
    };
    this.updateFlick = function (flick, callback) {
        return doUpdateFlick(flick, callback);
    };
}

module.exports = flickNedb;


