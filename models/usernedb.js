// Error code F06
/** 
 * User subclass.  Use this for all interactions with user when using NEDB.
 * 
 * @module usernedb
 */
var crypto = require('crypto');
var bcrypt = require('bcrypt');
var nedb = require('nedb');
var utils = require('../lib/utils');
var nodemailer = require('nodemailer');
var mg = require('nodemailer-mailgun-transport');

var logger = require('../lib/logger');

//var db = new Nedb({ filename: global.iflicks_settings.nedbPath + 'usersdb', autoload: true });

var nodemailerTransport = (function () {
    if (global.iflicks_settings.gmailUsername) {
        return nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: global.iflicks_settings.gmailUsername,
                pass: global.iflicks_settings.gmailPassword
            }
        });
    } else if (global.iflicks_settings.mailgunKey) {
        return nodemailer.createTransport(
            mg({auth: {
                api_key: global.iflicks_settings.mailgunKey,
                domain: global.iflicks_settings.mailgunDomain
            }})
        );
    }
}());

/**
 * Generate a random string.
 * @param {int} howMany - The length of the returned string
 * @param {string} chars - Text to use as the base for the random string.  If ommitted just uses the alphabet and 0-9.
 * @returns {string} random string
 */
function random(howMany, chars) {
    chars = chars || "abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789";
    var rnd = crypto.randomBytes(howMany),
        value = new Array(howMany),
        len = chars.length,
        i;

    for (i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len];
    }

    return value.join('');
}

/**
 * Send an email with a confirmation link
 * @param {string} userId - User ID UUID
 * @param {string} emailAddress.
 */
function sendConformationEmail(userId, emailAddress) {
    var htmlBody, validationUrl, mailOptions, rand = random(10);
    validationUrl =  global.iflicks_settings.baseURL + 'userconfirm/' + userId + '/' + rand;
    htmlBody = '<p><b>i-flicks account created</b></p><p>Please click the following link or copy it into your browser\'s address bar to confirm your email address.</p>' +
        '<a href="' + validationUrl + '">' + validationUrl + '</a>';
    // setup e-mail data with unicode symbols
    mailOptions = {
        from: global.iflicks_settings.mailFrom, // sender address
        to: emailAddress, // list of receivers
        subject: 'i-flicks account', // Subject line
        //text: body, //, // plaintext body
        html: htmlBody
    };
    // send mail with defined transport object
    nodemailerTransport.sendMail(mailOptions, function (err, info) {
        // console.log(info);
        if (err) {
            logger.errorNoReq('utils.sendUploadEmail.sendMail', 'F06016', err, 2);
        }
        nedb.globalDb.user.update({_id: userId}, { $set: { emailConfirmationKey: rand } }, function () {});
    });
}

/**
 * Get a user based on the passed in ID
 * @param {string} userId - User ID UUID
 * @param {bool} includeDisabled
 * @param {Requester~requestCallback} callback
 */
function getUserById(userId, includeDisabled, callback) {
    var query, dbStartTime;
    query = {_id: userId, isDeleted: false};
    if (includeDisabled === undefined || includeDisabled === false) {
        query.isEnabled = true;
    }

    dbStartTime = new Date();
    nedb.globalDb.user.findOne(query, /*{_id: 1, name: 1, description: 1},*/ function (err, result) {
        try {
            /*if (req.statsD) {
                req.statsD.timing('db.getUser', dbStartTime);
            }*/
            if (err) { err.code = 'F06002'; callback(err, undefined); return; }
            if (result === null || result === 0) { // this looks exactly the same as a failed password intentionally.
                err = new Error('Unrecognised user ID, username or password.  Code:F06003');
                err.code = 'F06003';
                err.status = 401;
                callback(err, undefined);
                return;
            }
            result.id = result._id;
            result.isEnabled = result.isEnabled || result.enabled; // Old releases ommitte dthe "is" part.
            delete result.password;
            callback(undefined, result);
        } catch (errr) {
            callback(errr, null);
        }
    });
}

/**
 * Get a user based on the passed in username and password
 * @param {string} username
 * @param {string} password
 * @param {bool} includeDisabled
 * @param {Requester~requestCallback} callback
 */
function getUserByUsername(username, password, callback) {
    var query;
    query = {username: username, isDeleted: false};
    nedb.globalDb.user.findOne(query, /*{_id: 1, name: 1, description: 1},*/ function (err, result) {
        try {
            /*if (req.statsD) {
                req.statsD.timing('db.getUser', dbStartTime);
            }*/
            if (err) { err.code = 'F06005'; callback(err, undefined); return; }
            if (result === null || result === 0) { // this looks exactly the same as a failed password intentionally.
                err = new Error('Unrecognised user ID, username or password.  Code:F06003');
                err.code = 'F06006';
                err.status = 401;
                callback(err, undefined);
                return;
            }
            if (result.lockedDate !== undefined && result.lockedDate > (new Date())) {
                err = new Error('Account temporarily locked.  Try later.');
                err.code = 'F06028';
                callback(err, undefined);
                return;
            }
            result.id = result._id;
            result.isEnabled = result.isEnabled || result.enabled; // Old releases ommitte dthe "is" part.
            result.passwordAttempts = result.passwordAttempts || 0;
            bcrypt.compare(password, result.password, function (err, res) {
                if (err) { err.code = 'F06007'; callback(err, undefined); return; }
                if (res !== true) {
                    var usr;
                    if (result.passwordAttempts > 8) {
                        usr = { id: result.id, lockedDate: (new Date()) + (10 * 60 * 1000), passwordAttempts: 0 };
                    } else {
                        usr = { id: result.id, passwordAttempts: result.passwordAttempts + 1 };
                    }
                    updateUser(usr, function (err) {
                        err = new Error('User not found');
                        err.code = 'F06008';
                        callback(err, undefined);
                        return;
                    });
                } else if (result.passwordAttempts > 0) {
                    updateUser({ id: result.id, passwordAttempts: 0 }, function (err) {
                        if (err) { err.code = 'F06039'; callback(err, undefined); return; }
                        delete result.password;
                        callback(undefined, result);
                    });
                } else {
                    delete result.password;
                    callback(undefined, result);
                }
            });
        } catch (errr) {
            callback(errr, null);
        }
    });
}

/**
 * Lookup a username and see if it has been used.  Deleted users excluded.
 * @param {string} username
 * @param {Requester~requestCallback} callback
 */
function checkUserExists(username, callback) {
    var dbStartTime;
    dbStartTime = new Date();
    nedb.globalDb.user.find({username: username}, /*{_id: 1, name: 1, description: 1},*/ function (err, result) {
        /*if (req.statsD) {
            req.statsD.timing('db.getCheckUserExists', dbStartTime);
        }*/
        if (err) { err.code = 'F06010'; callback(err, undefined); return; }
        if (result.length > 0) {
            callback(undefined, true);
        } else {
            callback(undefined, false);
        }
    });
}

/**
 * Checked before passwords can be submitted.  Add to this if necessary.
 * @param {string} password
 */
function passwordPolicy(password) {
    if (password === undefined || password === null) {
        return false;
    }
    if (password.length < 6) {
        return false;
    }
    return true;
}

/**
 * Update a user's password
 * @param {string} userId
 * @param {string} password
 * @param {Requester~requestCallback} callback
 */
function updateUserPassword(userId, password, callback) {
    var dbStartTime, err;

    /// check the pasword meets policy and complexity requirements.
    if (passwordPolicy(password) === false) {
        err = new Error('Password policy not met.');
        err.status = 400;
        callback(err, undefined);
        return false;
    }
    dbStartTime = new Date();
    bcrypt.genSalt(10, function (err, salt) {
        if (err) { err.code = 'F06011'; callback(err, undefined); return; }
        bcrypt.hash(password, salt, function (err, passwordHash) {
            // Store hash in your password DB.
            /*if (user.req.statsD) {
                user.req.statsD.timing('bcrypt.hashPassword', dbStartTime);
            }*/
            if (err) { err.code = 'F06012'; callback(err, undefined); return; }

            dbStartTime = new Date();
            nedb.globalDb.user.update({_id: userId}, { $set: { password: passwordHash } }, function (err, result) {
                /*if (user.req.statsD) {
                    user.req.statsD.timing('db.updateUserPassword', dbStartTime);
                }*/
                if (err) { err.code = 'F06014'; callback(err, undefined); return; }
                callback(undefined, result);
            });
        });
    });
}

/** Add a new user to the database
 * @param {object} user - An abbreviated User object with the relevant database fields
 * 
 */
function insertUser(user, callback) {
    var err;
    if (user.load) {
        err = new Error('user needs to be passed through userFromDatabase first');
        err.code = 'F06037';
        callback(err);
    }
    user.isDeleted = false;

    checkUserExists(user.username, function (err, exists) {
        if (err) { err.code = 'F06029'; callback(err, undefined); return; }
        if (exists) {
            err = new Error('Username exists');
            err.code = 'F06030';
            callback(err, undefined);
            return;
        }
        user.password = user.password || 'ValueNotSet';
        user.isConfirmed = user.isConfirmed || false;
        user.dateEntered = new Date();
        user.dateUpdated = new Date();
        user.isDeleted = false;
        nedb.globalDb.user.insert(user, function (err, result) {
            /*if (user && user.req && user.req.statsD) {
                user.req.statsD.timing('db.insertUser', dbStartTime);
            }*/
            if (err) { err.code = 'F06020'; callback(err, undefined); return; }
            user.id = result._id;
            if (user.isConfirmed !== true) {
                sendConformationEmail(user.id, user.emailAddress);
            }
            updateUserPassword(user.id, user.password, function (err) {
                if (err) { console.log(err); err.code = err.code || 'F06031'; callback(err, undefined); return; }
                callback(undefined, user.id); /// The ALL OK callback
            });
        });
    });
}

function updateUser(user, callback) {
    var err, request, update, key, userId = user.id || user._id;
    if (user.load) {
        err = new Error('user needs to be passed through userFromDatabase first');
        err.code = 'F06036';
        callback(err);
    }
    if (user.id === undefined || user.id === null) {
        err = new Error('User ID is not defined');
        err.code = 'F06015';
        callback(err, undefined);
        return;
    }

    update = user;
    delete update.id;
    delete update.password;
    update.dateUpdated = new Date();

    //dbStartTime = new Date();
    nedb.globalDb.user.update({_id: userId}, {
        $set: update
    }, function (err, res) {
        if (err) { err.code = 'F06017'; callback(err, undefined); return; }
        callback(undefined, true);
    });
}


/**
 * Logically delete a user in the database.  No hard delete is run.
 * @param {Requester~requestCallback} callback
 */
function deleteUser(callback) {
    var tmpUser, user = this;
    if (user.id === undefined || user.id === null) {
        var err = new Error('User ID is not defined');
        if (callback) {
            callback(err, undefined);
        }
        return;
    }

    tmpUser = userFromDatabase(user);
    tmpUser.isDeleted = true;

    updateUser(tmpUser, function (err, result) {
        callback(err, result);
    });
}

/**
 * stamp each time a user connects
 * @param {string} userId
 */
function setDateLastActive(userId) {
    nedb.globalDb.user.update({_id: userId}, {
        $set: { dateLastActive: new Date() }
    }, function (err) {
        if (err) { console.log(err); }
    });
}

/**
 * Get a user's options object
 * @param {Requester~requestCallback} callback
 */
function getOptions(callback) {
    var user = this;
    callback(undefined, user.options);
}

/**
 * Universal user update
 * @param {string} option - option name
 * @param {string} value - value to update or insert option as
 * @param {Requester~requestCallback} callback
 */
function setOption(option, value, callback) {
    /*var user = this;
    user.options = user.options || {};
    user.options[option] = value;
    console.log(user.options);*/
    var user = this, options = user.options || {};
    options[option] = value;
    user.options = options;
    nedb.globalDb.user.update({_id: user.id}, {
        $set: {  options: user.options }
    }, function (err, result) {
        if (err) { callback(err); return; }
        if (!err && result !== 1) {
            err = new Error('Unexpected number of updates.');
        }
        callback(undefined, true);
    });
}

/**
 * Authenticate a user based o nthe username and password.  Returns true or an error in the callback.
 * @param {string} username
 * @param {string} password 
 * @param {Requester~requestCallback} callback
 */
function authenticate(username, password, callback) {
    var user = this, key;
    getUserByUsername(username, password, function (err, result) {
        if (err) { err.code = err.code || 'F06016'; callback(err, undefined); return; }
        result.id = result._id;
        delete result._id;
        for (key in result) {
            if (result.hasOwnProperty(key)) {
                user[key] = result[key];
            }
        }
        callback(err, user);
        setDateLastActive(user);
    });
}

/**
 * Load a user from the database into the main object
 * @param {string} userId
 * @param {Requester~requestCallback} callback
 */
function load(userId, callback) {
    var user = this, key;
    getUserById(userId, user.includeDisabled, function (err, result) {
        if (err) { err.code = err.code || 'F06017'; callback(err, undefined); return; }
        result.id = result._id;
        delete result._id;
        for (key in result) {
            if (result.hasOwnProperty(key)) {
                user[key] = result[key];
            }
        }
        callback(err, user);
        setDateLastActive(user);
    });
}

/**
 * Use for email confirmaton when signing up
 * @param {string} key - key sent to the user via email
 * @param {Requester~requestCallback} callback
 */
function checkConfirmationKey(key, callback) {
    var user = this;
    if (user.isConfirmed) {
        callback(undefined, true);
    }
    if (user.emailConfirmationKey === key) {
        callback(undefined, true);
        nedb.globalDb.user.update({_id: user.id}, {
            $set: { emailConfirmationKey:  undefined, isConfirmed: true, dateUpdated: new Date() }
        }, function (err) {
            if (err) { err.code = 'F06027'; callback(err, undefined); return; }
            callback(undefined, true);
        });
    } else {
        callback(undefined, false);
    }
}

/**
 * Insert a user into the database.  it uses the values from the User object
 * @param {Requester~requestCallback} callback
 */
function create(callback) {
    var user = this;
    //user.loaded = true; // this is set after creation to prevent the change handlers from firing.
    //user.newUser = true;
    insertUser(userFromDatabase(user), function (err, id) {
        user.id = id;
        //user.newUser = false;
        //user.changed = false;
        callback(err, user.id);
    });
}

// create an empty user
function userForSession() {
    var user = this;
    return user;
}

/**
 * Abbreviated user object with attributes we don't mind sending to the browser
 * @return {object} mini user
 */
function userForBrowser() {
    var userTmp, user = this;
    userTmp = {
        id: user.id,
        username: user.username,
        givenName: user.givenName,
        familyName: user.familyName,
        isSysAdmin: user.isSysAdmin,
        options: user.options,
        isConfirmed: user.isConfirmed,
        gravatarUrl: '//secure.gravatar.com/avatar/' + crypto.createHash('md5').update(user.emailAddress.trim().toLowerCase()).digest('hex') + '?s=30&d=mm'

    };
    return userTmp;
}
/**
 * Populate the user based on the session data
 * @return {object} user
 */
function userFromSession(usr) {
    var user = this;
    user.id = usr.id;
    user.givenName = usr.givenName;
    user.familyName = usr.familyName;
    user.emailAddress = usr.emailAddress;
    user.isSysAdmin = usr.isSysAdmin;
    user.isEnabled = usr.isEnabled;
    user.errorCount = usr.errorCount;
    user.changeCount = usr.changeCount;
    user.customerId = usr.customerId;
    user.emailConfirmed = usr.emailConfirmed;
    setDateLastActive(user);

    return user;
}

/**
 * Abbreviated user object with attributes the database cares about
 * @return {object} mini user
 */
function userFromDatabase(user) {
    var usr = {};
    usr.id = user.id;
    usr.username = user.username;
    usr.givenName = user.givenName;
    usr.familyName = user.familyName;
    usr.emailAddress = user.emailAddress;
    usr.isSysAdmin = user.isSysAdmin;
    usr.isEnabled = user.isEnabled;
    usr.isConfirmed = user.isConfirmed;
    usr.password = user.password;

    return usr;
}

/**
 * Save a user to the database.  Uses info from the main object.
 * @param {Requester~requestCallback} callback
 */
function save(callback) {
    var user = this;
    if (user.password) {
        if (!passwordPolicy(user.password)) {
            var err = new Error('Password policy not met.');
            err.code = 'F06023';
            callback(err);
            return;
        }
    }
    if (user.newUser) {
        console.log('THIS SHOULD NEVER BE CALLED');
        insertUser(userFromDatabase(user), function (err) {
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
            updateUserPassword(user.id, user.password, function (err) {
                if (err) {
                    callback(err, undefined);
                } else {
                    updateUser(userFromDatabase(user), function (err) {
                        if (err) {
                            user.errorCount++;
                            user.err = err;
                            user.changed = true;
                            callback(err, undefined);
                        } else {
                            user.changeCount = 0;
                            callback(undefined, true);
                        }
                    });
                }
            });
        } else {
            updateUser(userFromDatabase(user), function (err) {
                if (err) {
                    user.errorCount++;
                    user.err = err;
                    user.changed = true;
                    callback(err, undefined);
                } else {
                    user.changeCount = 0;
                    callback(undefined, true);
                }
            });
        }
    }
}
/**
 * User constructor
 */
var User = function () {
    var user = {
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
        set username(value) { user.username = value; },
        get givenName() {return user.givenName; },
        set givenName(value) { user.givenName = value; },
        get familyName() {return user.familyName; },
        set familyName(value) { user.familyName = value; },
        get emailAddress() {return user.emailAddress; },
        set emailAddress(value) { user.emailAddress = value; },
        get isSysAdmin() {return user.isSysAdmin; },
        set isSysAdmin(value) { user.isSysAdmin = value; },
        get isEnabled() {return user.isEnabled; },
        set isEnabled(value) { user.isEnabled = value; },
        get password() { return user.password; },
        set password(value) { user.password = value; },
        setPassword: function (password, callback) {
            updateUserPassword(user.id, password, callback);
        },

        get isConfirmed() {return user.isConfirmed; },
        set isConfirmed(value) { user.isConfirmed = value; },
        get emailConfirmationKey() {return user.emailConfirmationKey; },
        set emailConfirmationKey(value) { user.emailConfirmationKey = value; },
        get includeDisabled() {return user.includeDisabled; },
        set includeDisabled(value) { user.includeDisabled = value; },

        get options() { return user.options; },
        set options(value) { user.options = value; },

        userForSession: userForSession,
        userForBrowser: userForBrowser,
        userFromSession: userFromSession,
        authenticate: authenticate,
        load: load,
        create: create,
        save: save,
        delete: deleteUser,
        checkUserExists: checkUserExists,
        setOption: setOption,
        getOptions: getOptions,
        checkConfirmationKey: checkConfirmationKey
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