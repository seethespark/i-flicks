// Error code F04
/** 
 * Flick class.  Use this for all interactions with flicks.
 * 
 * @module flick
 */

var flickDb, FlickDb;
if (global.iflicks_settings.databaseType === 'nedb') {
    FlickDb = require('./flicknedb');
} else if (global.iflicks_settings.databaseType === 'sqlserver') {
    FlickDb = require('./flicksqlserver');
} else {
    throw new Error('Database type not set');
}

flickDb = new FlickDb();


/**
 * Load a flick from the database into the main object
 * @param {string} flickId
 * @param {Requester~requestCallback} callback
 */
function load(flickId, userId, isSysAdmin, callback) {
    var flick = this, key;
    flickDb.getFlickById(flickId, userId, isSysAdmin, function (err, result) {
        if (err) { err.code = err.code || 'F04022'; callback(err, undefined); return; }
        flick.changes = [];
        flick.trackChanges = false;
        for (key in result) {
            if (result.hasOwnProperty(key)) {
                flick[key] = result[key];
            }
        }
        flick.trackChanges = true;
        callback(err, flick);
    });
}


/**
 * Logically delete a flick in the database.  No hard delete is run.
 * @param {Requester~requestCallback} callback
 */
function deleteFlick(callback) {
    var flick = this;
    if (flick.id === undefined || flick.id === null) {
        var err = new Error('Flick ID is not defined');
        if (callback) {
            callback(err, undefined);
        }
        return;
    }

    flickDb.updateFlick({id: flick.id, isDeleted: true}, function (err, result) {
        callback(err, result);
    });
}

/**
 * Insert a flick into the database.  it uses the values from the Flick object
 * @param {Requester~requestCallback} callback
 */
function create(callback) {
    var flick = this;
    flickDb.insertFlick(flickDb.flickFromDatabase(flick), function (err, id) {
        flick.id = id;
        flick.changes = [];
        flick.trackChanges = true;
        callback(err, flick.id);
    });
}

/**
 * Save a flick to the database.  Uses info from the main object.
 * @param {Requester~requestCallback} callback
 */
function save(callback) {
    var flick = this;
    flickDb.updateFlick(flickDb.flickFromDatabase(flick), function(err) {
        if (err) {
            callback(err, undefined);
        } else {
            flick.changes = [];
            callback(undefined, true);
        }
    });
}

/**
 * Record a play of a video.  This should probably have an IP or user based check to prevent spam.
 * @param {Requester~requestCallback} callback
 */
function play(ipAddress, callback) {
    var flick = this;
    if (flick.id === undefined || flick.id === null) {
        var err = new Error('Flick ID is not defined');
        callback(err, undefined);
        return;
    }
    flick.playCount++;
    flickDb.updateFlick({id: flick.id, playCount: flick.playCount}, function (err, result) {
        ///// Add an entry into the usage table
        callback(err, flick.playCount);
    });
}

/**
 * Set the current user's rating.  Compiling ratings is an offline operation.
 * @param {Requester~requestCallback} callback
 */
function suggestRating(rating, userId, ipAddress, callback) {
    var flick = this;
    if (flick.id === undefined || flick.id === null) {
        var err = new Error('Flick ID is not defined');
        callback(err, undefined);
        return;
    }

    flickDb.addRating(flick.id, rating, userId, ipAddress, function (err, result) {
        callback(err, result);
    });
}

/**
 * Grant access
 * @param {uuid} currentUserId - user's unique id. 
 * @param {boolean} isSysAdmin - well, are they?
 * @param {uuid} newUserId - user to add to this flick
 * @param {Requester~requestCallback} callback
 */
function addUser(currentUserId, isSysAdmin, newUserId, callback) {

    var err, flick = this;
    if (!isSysAdmin && currentUserId !== flick.userId) {
        err = new Error('Only the owner or sys admins can change permissions');
        err.code = 'F04023';
        callback(err, undefined);
        return;
    }
    if (flick.id === undefined || flick.id === null) {
        err = new Error('Flick ID is not defined');
        err.code = 'F04024';
        callback(err, undefined);
        return;
    }

    flickDb.addUser(flick.id, newUserId, callback);
}
/**
 * Revoke access
 * @param {uuid} currentUserId - user's unique id. 
 * @param {boolean} isSysAdmin - well, are they?
 * @param {uuid} newUserId - user to add to this flick
 * @param {Requester~requestCallback} callback
 */
function removeUser(currentUserId, isSysAdmin, newUserId, callback) {
    var err, flick = this;
    if (!isSysAdmin && currentUserId !== flick.userId) {
        err = new Error('Only the owner or sys admins can change permissions');
        err.code = 'F04025';
        callback(err, undefined);
        return;
    }
    if (flick.id === undefined || flick.id === null) {
        err = new Error('Flick ID is not defined');
        err.code = 'F04026';
        callback(err, undefined);
        return;
    }

    flickDb.removeUser(flick.id, newUserId, callback);
}



/**
 * Flick constructor
 */
var Flick = function (id, user, callback) {
    var changes,  flick = {};
    flick.trackChanges = false;
    if (id !== undefined) {
        this.load(id, user.id, user.isSysAdmin, function () {});
    }

    /**
     * Flick.change
     * @param {string} property - Append to an array to keep track of object changes.  Limits the number of updates required on a database.
     */
    function change (property) {
       // console.log('property', property, flick.trackChanges)
        if (flick.trackChanges && changes === undefined) {
            changes = [property];
        } else if (flick.trackChanges && changes.indexOf(property) === -1) {
            changes.push(property);
        }
    }

    return {
        get id() {return flick.id; },
        set id(value) { flick.id = value; },
        get trackChanges() {return flick.trackChanges; },
        set trackChanges(value) { flick.trackChanges = value; },
        get changes() {return changes; },
        set changes(value) { changes = value; },
        get uploader() {return flick.uploader; },
        set uploader(value) { flick.uploader = value; change('uploader'); },
        get userId() {return flick.userId; },
        set userId(value) { flick.userId = value; change('userId'); },
        get name() {return flick.name; },
        set name(value) { flick.name = value; change('name'); },
        get description() {return flick.description; },
        set description(value) { flick.description = value; change('description'); },
        get emailWhenEncoded() {return flick.emailWhenEncoded; },
        set emailWhenEncoded(value) { flick.emailWhenEncoded = value; change('emailWhenEncoded'); },
        get originalName() {return flick.originalName; },
        set originalName(value) { flick.originalName = value; change('originalName'); },
        //get thumbnailPath() {return (flick.thumbnailPath || flick.mediaPath + '\\thumb.jpg'); },
        get thumbnailPath() { if (flick.mediaPath == undefined && flick.thumbnailPath == undefined) {return undefined;} else {return flick.mediaPath + '/thumb.jpg'; } },
        set thumbnailPath(value) { flick.thumbnailPath = value; change('thumbnailPath'); },
        get isEncoded() {return flick.isEncoded; },
        set isEncoded(value) { flick.isEncoded = value; change('isEncoded'); },
        get isDeleted() {return flick.isDeleted; },
        set isDeleted(value) { flick.isDeleted = value; change('isDeleted'); },
        get isDirectLinkable() {return flick.isDirectLinkable; },
        set isDirectLinkable(value) { flick.isDirectLinkable = value; change('isDirectLinkable'); },
        get isPublic() {return flick.isPublic; },
        set isPublic(value) { flick.isPublic = value; change('isPublic'); },
        get folderName() {return flick.folderName; },
        set folderName(value) { flick.folderName = value; change('folderName'); },
        get mediaPath() {return flick.mediaPath; },
        set mediaPath(value) { flick.mediaPath = value; change('mediaPath'); },
        get fileDetail() {return flick.fileDetail; },
        set fileDetail(value) { flick.fileDetail = value; change('fileDetail'); },
        get isEncoding() {return flick.isEncoding; },
        set isEncoding(value) { flick.isEncoding = value; change('isEncoding'); },
        get encodingProgress() {return flick.encodingProgress; },
        set encodingProgress(value) { flick.encodingProgress = value; change('encodingProgress'); },
        get tags() {return flick.tags; },
        set tags(value) { flick.tags = value; change('tags'); },
        get playCount() {return flick.playCount; },
        set playCount(value) { flick.playCount = value; change('playCount'); },

        get forBrowser() {return {
            id: flick.id,
            name: flick.name,
            description: flick.description,
            fileDetail: flick.fileDetail,
            tags: flick.tags,
            playCount: flick.playCount,
            isPublic: flick.isPublic,
            allowDirectLink: flick.allowDirectLink
        }; },

        addUser: addUser,
        removeUser: removeUser,
        suggestRating: suggestRating,
        load: load,
        create: create,
        save: save,
        delete: deleteFlick,
        play: play
    };
};

module.exports = Flick;