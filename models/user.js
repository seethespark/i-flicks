// Error code F06

var crypto = require('crypto');
var bcrypt = require('bcrypt');
var Nedb = require('nedb');
var utils = require('../lib/utils');

var logger = require('../lib/logger');

var db = new Nedb({ filename: global.iflicks_settings.databasePath + 'usersdb', autoload: true });

/// The database portion of the user instantiation process
function getUser(req, username, password, userId, includeDisabled, callback) {
    var query, dbStartTime, user;
    if (username) {
        query = {username: username, deleted: false};
    } else if (userId) {
        query = {_id: userId, deleted: false};
        //query = {_id: userId};
    } else {
        throw new Error('Username or ID required');
    }
    dbStartTime = new Date();
    db.findOne(query, /*{_id: 1, name: 1, description: 1},*/ function (err, result) {
        try {
            if (req.statsD) {
                req.statsD.timing('db.getUser', dbStartTime);
            }
            if (err) {
                logger.error(req, 'user.getuser.1', 'F06002', err);
                err.message = err.message + '. Code:F06002.';
                callback(err, undefined);
            } else if (result === null || result === 0) { // this looks exactly the same as a failed password intentionally.
                err = new Error('Unrecognised user ID, username or password.  Code:F06003_');
                err.code = 'F06003';
                callback(err, undefined);
            } else if (userId !== undefined) {
                user = {};
                user.id = result._id;
                user.username = result.username;
                user.forename = result.forename;
                user.surname = result.surname;
                user.emailAddress = result.emailAddress;
                user.isSysAdmin = result.isSysAdmin;
                user.aesKey = result.aeskey;
                user.enabled = result.enabled;
                user.customerId = result.customerid;
                user.dateLastActive = result.dateLastActive;
                user.options = result.options;
                callback(undefined, user);
            } else {
                bcrypt.compare(password, result.password, function (err, res) {
                    if (err) {
                        logger.error(req, 'user.getuser.3', 'F06007', err);
                        err.message = err.message + '. Code:F06007.';
                        callback(err, undefined);
                    }
                    if (res === true) {
                        user = {};
                        user.id = result._id;
                        user.username = result.username;
                        user.forename = result.forename;
                        user.surname = result.surname;
                        user.emailAddress = result.emailAddress;
                        user.isSysAdmin = result.isSysAdmin;
                        user.aesKey = result.aeskey;
                        user.enabled = result.enabled;
                        user.options = result.options;

                        callback(undefined, user);
                    } else { // bcrypt match failed
                        logger.error(req, 'user.getuser.4', 'F06008', err);
                        err = {};
                        err.message = 'Unrecognised user ID, username or password.  Code:F06008';
                        callback(err, undefined);
                    }
                });
            }
        } catch (errr) {
            callback(errr, null);
        }
    });
}

//* Check a username isnt't already in use */
function checkUserExists(username, callback) {
    var dbStartTime, req = this.req;
    dbStartTime = new Date();
    db.find({username: username}, /*{_id: 1, name: 1, description: 1},*/ function (err, result) {
        if (req.statsD) {
            req.statsD.timing('db.getCheckUserExists', dbStartTime);
        }
        if (err) {
            logger.error(req, 'user.getCheckUserExists.1', 'F06027', err);
            err.message = err.message + '. Code:F06027.';
            callback(err, undefined);
        }
        if (result.length > 0) {
            callback(undefined, true);
        } else {
            callback(undefined, false);
        }
    });
}

/// Checked before passwords can be submitted.  Add to this if necessary.
function passwordPolicy(password) {
    if (password === undefined || password === null) {
        return false;
    }
    if (password.length < 6) {
        return false;
    }
    return true;
}


function updateUserPassword(user, callback) {
    var dbStartTime, err;
    if (user.newUser === true) {
        return;
    }
    /// check the pasword meets policy and complexity requirements.
    if (passwordPolicy(user.password) === false) {
        err = new Error('Password policy not met.');
        err.status = 400;
        callback(err, undefined);
        return false;
    }
    dbStartTime = new Date();
    bcrypt.genSalt(10, function (err, salt) {
        if (err) {
            user.errorCount++;
            logger.error(user.req, 'user.updateUserPassword.1', 'F06009', err);
            err.message = err.message + '. Code:F06009. ';
            callback(err, undefined);
            return;
        }
        bcrypt.hash(user.password, salt, function (err, passwordHash) {
            // Store hash in your password DB.
            if (user.req.statsD) {
                user.req.statsD.timing('bcrypt.hashPassword', dbStartTime);
            }
            if (err) {
                user.errorCount++;
                logger.error(user.req, 'user.updateUserPassword.2', 'F06008', err);
                err.message = err.message + '. Code:F06008. ';
                callback(err, undefined);
                return;
            }

            dbStartTime = new Date();
            db.update({_id: user.id}, { $set: { password: passwordHash } }, function (err, result) {
                try {
                    if (user.req.statsD) {
                        user.req.statsD.timing('db.updateUserPassword', dbStartTime);
                    }
                    if (err) {
                        user.errorCount++;
                        logger.error(user.req, 'user.updateUserPassword.3', 'F06004', err);
                        err.message = err.message + '. Code:F06004. ';
                        callback(err, undefined);
                    } else if (result === 0) {
                        user.errorCount++;
                        delete user.password;
                        err = new Error('No rows updated.');
                        logger.error(user.req, 'user.updateUserPassword.4', 'F060012', err);
                        callback(err, undefined);
                    } else {
                        delete user.password;
                        callback(undefined, result);
                    }

                } catch (errr) {
                    user.errorCount++;
                    logger.error(user.req, 'user.updateUserPassword.5', 'F060013', errr);
                    callback(errr, undefined);
                }
            });
        });
    });
}

function updateUser(user, callback) {
    var dbStartTime;
    if (user.id === undefined || user.id === null) {
        var err = new Error('User ID is not defined');
        callback(err, undefined);
        return;
    }
    if (user.changed === true) {
        delete user.changed; // delete it before the database call as another change could take place while we are waiting.
        user.changeCount = 0;
        dbStartTime = new Date();
        db.update({_id: user.id}, {
            $set: { username: user.username,
                forename: user.forename,
                surname: user.surname,
                emailAddress: user.emailAddress,
                isSysAdmin: user.isSysAdmin,
                enabled: user.enabled,
                dateUpdated: new Date()
                }
        }, function (err, result) {
            try {
                if (user && user.req && user.req.statsD) {
                    user.req.statsD.timing('db.updateUser', dbStartTime);
                }
                if (err) {
                    user.errorCount++;
                    logger.error(user.req, 'user.updateUser.1', 'F06006', err);
                    user.changed = true; // as it back as it failed
                    err.message = err.message + '. Code:F06006. ';
                    callback(err, undefined);
                } else if (result === 0) {
                    user.errorCount++;
                    err = new Error('No rows updated.');
                    logger.error(user.req, 'user.updateUser.2', 'F060014', err);
                    callback(err, undefined);
                } else {
                    callback(undefined, undefined);
                }

            } catch (errr) {
                user.errorCount++;
                logger.error(user.req, 'user.updateUser.3', 'F06015', errr);
                callback(errr, null);
            }
        });
    } else {
        callback();
    }
}


function insertUser(user, callback) {
    var tmpUser, dbStartTime;
    if (passwordPolicy(user.password) === false) {
        var err = new Error('Password policy not met.');
        err.status = 400;
        callback(err, null);
        return;
    }

    delete user.changed; // delete it before the database call as another change could take place while we are waiting.
    delete user.newUser;
    user.changeCount = 0;

    dbStartTime = new Date();
    tmpUser = {username: user.username,
        password: 'ValueNotSet',
        forename: user.forename,
        surname: user.surname,
        emailAddress: user.emailAddress,
        isSysAdmin: user.isSysAdmin,
        dateEntered: new Date(),
        dateUpdated: new Date(),
        deleted: false
        };
    db.insert(tmpUser, function (err, result) {
        try {
            if (user && user.req && user.req.statsD) {
                user.req.statsD.timing('db.insertUser', dbStartTime);
            }
            if (err) {
                user.errorCount++;
                logger.error(user.req, 'user.insertUser.1', 'F06018', err);
                user.changed = true; // as it back as it failed
                err.message = err.message + '. Code:F06018. ';
                callback(err, undefined);
            } else if (result === undefined) {
                user.errorCount++;
                err = new Error('No rows inserted.');
                logger.error(user.req, 'user.insertUser.2', 'F060019', err);
                callback(err, undefined);
            } else {
                user.id = result._id;
                updateUserPassword(user, callback);
            }
        } catch (errr) {
            user.errorCount++;
            logger.error(user.req, 'user.insertUser.3', 'F06020', errr);
            callback(errr, null);
        }
    });
}

function deleteUser(callback) {
    var user = this;
    var dbStartTime, userCustID = global.iflicks_settings.customerId;
    if (user.id === undefined || user.id === null) {
        var err = new Error('User ID is not defined');
        if (callback) {
            callback(err, undefined);
        }
        return;
    }

    dbStartTime = new Date();
    db.update({_id: user.id}, {
        $set: { dateUpdated: new Date(), deleted: true }
    }, function (err, result) {
        try {
            if (user && user.req && user.req.statsD) {
                user.req.statsD.timing('db.deleteUser', dbStartTime);
            }
            if (err) {
                user.errorCount++;
                logger.error(user.req, 'user.deleteUser.1', 'F06022', err);
                err.message = err.message + '. Code:F06022. ';
                callback(err, undefined);
            } else if (result === 0) {
                user.errorCount++;
                err = new Error('No rows updated.');
                logger.error(user.req, 'user.deleteUser.2', 'F06023', err);
                callback(err, undefined);
            } else {
                callback(undefined, result);
            }
        } catch (errr) {
            user.errorCount++;
            logger.error(user.req, 'user.deleteUser.3', 'F06024', errr);
            callback(errr, null);
        }
    });
}

function setDateLastActive(user) {
    //console.log('lastActiveDate');
    var dbStartTime;
    if (user.id === undefined || user.id === null) {
        //var err = new Error('User ID is not defined');
        return;
    }

    dbStartTime = new Date();
    db.update({_id: user.id}, {
        $set: { dateLastActive: new Date() }
    }, function (err, result) {
        try {
            if (user && user.req && user.req.statsD) {
                user.req.statsD.timing('db.setDateLastActive', dbStartTime);
            }
            if (err) {
                logger.error(user.req, 'user.setDateLastActive.1', 'F06025', err);
                err.message = err.message + '. Code:F06022. ';
            } else if (result === 0) {
                err = new Error('No rows updated.');
                logger.error(user.req, 'user.setDateLastActive.2', 'F06026', err);
            }
        } catch (errr) {
            logger.error(user.req, 'user.setDateLastActive.3', 'F06026', errr);
        }
    });
}

function userChanged(user) {
    if (user.loaded) {
        user.changed = true;
        user.changeCount++;
    }
}

function setOption(option, value, callback) {
    /*var user = this;
    user.options = user.options || {};
    user.options[option] = value;
    console.log(user.options);*/
    var user = this, options = user.options || {};
    options[option] = value;
    user.options = options;
    db.update({_id: user.id}, {
        $set: {  options: user.options }
    }, function (err, result) {
        if (err) { callback(err); return; }
        if (!err && result !== 1) {
            err = new Error('Unexpected number of updates.');
        }
        callback(err);
    });
}

function authenticate(username, password, callback) {
    var user = this;
    getUser(user.req, username, password, undefined, false, function (err, result) {
        if (err) {
            logger.error(user.req, 'user.authenticate.1', 'F06016', err);
            user.errorCount++;
            user.err = err;
        } else {
            //user.req = null;
            user.id = result.id;
            user.username = result.username;
            user.forename = result.forename;
            user.surname = result.surname;
            user.emailAddress = result.emailAddress;
            user.isSysAdmin = result.isSysAdmin;
            user.aesKey = result.aesKey;
            user.enabled = result.enabled;
            user.customerId = result.customerId;
            user.loaded = true; // this is set after loading to prevent the change handlers from firing.
        }
        callback(err, user);
        //setDateLastActive(user);
    });
}

function load(userId, callback) {
    var user = this;
    getUser(user.req, undefined, undefined, userId, user.includeDisabled, function (err, result) {
        if (err) {
            logger.error(user.req, 'user.load.1', 'F06017', err);
            user.errorCount++;
            user.err = err;
        } else {
            user.id = userId;
            user.username = result.username;
            user.forename = result.forename;
            user.surname = result.surname;
            user.emailAddress = result.emailAddress;
            user.isSysAdmin = result.isSysAdmin;
            user.aesKey = result.aesKey;
            user.enabled = result.enabled;
            user.customerId = result.customerId;
            user.loaded = true; // this is set after loading to prevent the change handlers from firing.
            user.options = result.options;
        }
        if (callback !== undefined) {
            callback(err, user);
        }
        setDateLastActive(user);
    });
}

// create an empty user
function create(callback) {
    var user = this;
    user.loaded = true; // this is set after creation to prevent the change handlers from firing.
    user.newUser = true;
    callback(undefined, user);
}

// create an empty user
function userForSession() {
    var user = this;
    /*var userTmp = {
        username: user.username,
        surname: user.surname,
        id: user.id
    };*/
    delete user.req; // session serialisation doesn't like the req reference as it's attached to the req object.
    //console.log(user);
    return user;
}
function userForBrowser() {
    var userTmp, user = this;
    userTmp = {
        id: user.id,
        username: user.username,
        forename: user.forename,
        surname: user.surname,
        isSysAdmin: user.isSysAdmin,
        options: user.options
    };
    
    return userTmp;
}
function userFromSession(usr) {
    var user = this;
    user.loaded = false;
    user.id = usr.id;
    user.forename = usr.forename;
    user.surname = usr.surname;
    user.emailAddress = usr.emailAddress;
    user.isSysAdmin = usr.isSysAdmin;
    user.enabled = usr.enabled;
    user.errorCount = usr.errorCount;
    user.changeCount = usr.changeCount;
    user.aesKey = usr.aesKey;
    user.customerId = usr.customerId;
    user.loaded = true;
    setDateLastActive(user);

    return user;
}

function save(callback) {
    var user = this;
    if (user.newUser) {
        insertUser(user, function (err) {
            if (err) {
                user.errorCount++;
                user.err = err;
                user.changed = true;
                callback(err, undefined);
            } else {
                user.changeCount = 0;
                callback(undefined, user);
            }
        });
    } else {
        if (user.password) { // fire and forget probably isn't great.
            updateUserPassword(user, function (err, result) {
                if (err) {
                    callback(err, undefined);
                } else {
                    updateUser(user, function (err) {
                        if (err) {
                            user.errorCount++;
                            user.err = err;
                            user.changed = true;
                            callback(err, undefined);
                        } else {
                            user.changeCount = 0;
                            callback(undefined, user);
                        }
                    });
                }
            });
        } else {
            updateUser(user, function (err) {
                if (err) {
                    user.errorCount++;
                    user.err = err;
                    user.changed = true;
                    callback(err, undefined);
                } else {
                    user.changeCount = 0;
                    callback(undefined, user);
                }
            });
        }
    }
}
//var user;
// User constructor
var User = function (req) {
    var user = {
        req: req,
        errorCount: 0,
        changeCount: 0,
        loaded: false,
        includeDisabled: false

        /*,
        errors: []*/
    };
    return {
        get id() {return user.id; },
        set id(value) { user.id = value; },
        get loaded() {return user.loaded; },
        set loaded(value) { user.loaded = value; },
        get username() {return user.username; },
        set username(value) { user.username = value; userChanged(user); },
        get forename() {return user.forename; },
        set forename(value) { user.forename = value; userChanged(user); },
        get surname() {return user.surname; },
        set surname(value) { user.surname = value; userChanged(user); },
        get emailAddress() {return user.emailAddress; },
        set emailAddress(value) { user.emailAddress = value; userChanged(user); },
        get isSysAdmin() {return user.isSysAdmin; },
        set isSysAdmin(value) { user.isSysAdmin = value; userChanged(user); },
        get enabled() {return user.enabled; },
        set enabled(value) { user.enabled = value; userChanged(user); },
        get customerId() {return user.customerId; },
        set customerId(value) { user.customerId = value; userChanged(user); },
        get password() { return user.password; },
        set password(value) { user.password = value; userChanged(user); },
        setPassword: function (password, callback) {
            this.password = password;
            //user.changeCount++;
            updateUserPassword(user, callback);
        },
        get includeDisabled() {return user.includeDisabled; },
        set includeDisabled(value) { user.includeDisabled = value; },
        get newUser() {return user.newUser; },
        set newUser(value) { user.newUser = value; },
        get req() {return user.req; },
        set req(value) { user.req = value; },
        get options() {return user.options; },
        set options(value) { user.options = value; },
        get errorCount() {return user.errorCount; },
        set errorCount(value) { user.errorCount = value; },
        /*get errors() {return user.errors; },
        set errors(value) { user.errors.push(value); },*/
        get changed() {return user.changed; },
        set changed(value) { user.changed = value; },
        get changeCount() {return user.changeCount; },
        set changeCount(value) { user.changeCount = value; },
        get timeout() {return user.timeout; },
        set timeout(value) { user.timeout = value; },
        userForSession: userForSession,
        userForBrowser: userForBrowser,
        userFromSession: userFromSession,
        authenticate: authenticate,
        load: load,
        create: create,
        save: save,
        delete: deleteUser,
        checkUserExists: checkUserExists,
        setOption: setOption
    };
};
/*
Object.defineProperty(User, 'forename', {
    get: function () { return this.forename; },
    set: function (v) { this.forename = v;  userChamged(this); console.log('thing'); }
});
User.prototype.setForename = function (forename, callback) {
    this.forename = forename;
    userChamged(this);
};
User.prototype.setPassword = function (password, callback) {
    this.password = password;
    updateUserPassword(this, callback);
};*/


module.exports = User;