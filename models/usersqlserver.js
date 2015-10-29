// Error code F06
/** 
 * User subclass.  Use this for all interactions with user when using MS SQL Server.
 * 
 * @module usersqlserver
 */
var crypto = require('crypto');
var bcrypt = require('bcrypt');
var mssql = require('mssql');
var utils = require('../lib/utils');
var nodemailer = require('nodemailer');
var mg = require('nodemailer-mailgun-transport');
var logger = require('../lib/logger');
var StatsD = require('statsd-client');
var url = require('url');

var statsD = StatsD.globalStatsD;

//var connection = mssql.globalConnection;

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
    var i, rnd = crypto.randomBytes(howMany),
        value = new Array(howMany),
        len = chars.length;

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
    var sql, request, htmlBody, validationUrl, mailOptions, rand = random(10);
    validationUrl =  url.resolve(global.iflicks_settings.baseURL, 'userconfirm/' + userId + '/' + rand);
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
            return;
        } //'DELETE FROM UserConfirmation WHERE UserID = @id; '+
        sql = 'INSERT INTO UserConfirmation (UserID, ConfirmationKey, DateEntered, DateUpdated) ' +
            'VALUES (@id, @key, getdate(), getdate())';

        request = new mssql.Request(mssql.globalConnection);
        request.input('id', mssql.UniqueIdentifier, userId);
        request.input('key', mssql.VarChar, rand);
        //request.input('now', mssql.VarChar, new Date());
        request.query(sql, function (err) {
            if (err) { console.log(err); logger.errorNoReq('utils.sendUploadEmail.saveKey', 'F06022', err, 2); }
        });

    });
}

/**
 * Get a user based on the passed in ID
 * @param {string} userId - User ID UUID
 * @param {bool} includeDisabled
 * @param {Requester~requestCallback} callback
 */
function getUserById(userId, includeDisabled, callback) {
    var sql, request, dbStartTime = new Date();
    sql = 'SELECT * FROM Users WHERE id = @id AND isDeleted = 0';
    if (includeDisabled === undefined || includeDisabled === false) {
        sql += ' AND isEnabled = 1';
    }
    //if (mssql.globalConnection.connected === false) { connection.connect(function () {console.log('Late connect'); }); }
    request = new mssql.Request(mssql.globalConnection);
    request.input('id', mssql.UniqueIdentifier, userId);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('user.getUserById', dbStartTime);
        }
        if (err) { mssql.errorHandler(err); err.code = 'F06002'; callback(err, undefined); return; }
        if (recordset.length === 0) {
            err = new Error('User not found');
            err.code = 'F06003';
            callback(err, undefined);
            return;
        }
        //console.dir(recordset);
        delete recordset[0].password;
        callback(undefined, recordset[0]);
    });
}

/**
 * Get a user based on the passed in username and password
 * @param {string} username
 * @param {string} password - if undefined then just based on username
 * @param {Requester~requestCallback} callback
 */
function getUserByUsername(username, password, callback) {
    var sql, request, dbStartTime = new Date();
    sql = 'SELECT * FROM Users WHERE username = @username AND isDeleted = 0';
    /*if (includeDisabled === undefined || includeDisabled === false) {
        sql += ' AND isEnabled = 1';
    }*/

    request = new mssql.Request(mssql.globalConnection);
    request.input('username', mssql.VarChar, username);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('user.getUserByUsername.db', dbStartTime);
            dbStartTime = new Date();
        }
        if (err) { mssql.errorHandler(err); err.code = 'F06005'; callback(err, undefined); return; }
        if (recordset.length === 0) {
            err = new Error('User not found');
            err.code = 'F06006';
            callback(err, undefined);
            return;
        }
        if (recordset[0].lockedDate > (new Date())) {
            err = new Error('Account temporarily locked.  Try later.');
            err.code = 'F06028';
            callback(err, undefined);
            return;
        }
        /// if just the username passed in that use that.
        if (password === undefined) {
            delete recordset[0].password;
            callback(undefined, recordset[0]);
            return;
        }
        bcrypt.compare(password, recordset[0].password, function (err, res) {
            if (statsD) {
                statsD.timing('user.getUserByUsername.bcrypt', dbStartTime);
            }
            if (err) { err.code = 'F06007'; callback(err, undefined); return; }
            if (res !== true) {
                var usr;
                if (recordset[0].passwordAttempts > 8) {
                    usr = { id: recordset[0].id, lockedDate: (new Date()) + (10 * 60 * 1000), passwordAttempts: 0 };
                } else {
                    usr = { id: recordset[0].id, passwordAttempts: recordset[0].passwordAttempts + 1 };
                }
                updateUser(usr, function (err) {
                    err = new Error('User not found');
                    err.code = 'F06008';
                    callback(err, undefined);
                    return;
                });
            } else if (recordset[0].passwordAttempts > 0) {
                delete recordset[0].password;
                updateUser({ id: recordset[0].id, passwordAttempts: 0 }, function (err) {
                    if (err) { err.code = 'F06039'; callback(err, undefined); return; }
                    callback(undefined, recordset[0]);
                });
            } else {
                delete recordset[0].password;
                callback(undefined, recordset[0]);
            }
        });
    });
}
/**
 * Get a user based on the passed in email address or username
 * @param {string} searchTerm
 * @param {Requester~requestCallback} callback
 */
function getUserByUsernameOrEmailAddress(searchTerm, callback) {
    var sql, request, dbStartTime = new Date();
    sql = 'SELECT * FROM Users WHERE (username = @searchTerm OR emailAddress = @searchTerm) AND isDeleted = 0';

    request = new mssql.Request(mssql.globalConnection);
    request.input('searchTerm', mssql.VarChar, searchTerm);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('user.getUserByUsernameOrEmailAddress.db', dbStartTime);
            dbStartTime = new Date();
        }
        if (err) { mssql.errorHandler(err); err.code = 'F06040'; callback(err, undefined); return; }
        if (recordset.length === 0) {
            err = new Error('User not found');
            err.code = 'F06041';
            callback(err, undefined);
            return;
        }

        delete recordset[0].password;
        callback(undefined, recordset[0]);
    });
}

/**
 * Lookup a username and see if it has been used.  Deleted users excluded.
 * @param {string} username
 * @param {Requester~requestCallback} callback
 */
function checkUserExists(username, callback) {
    var sql = 'SELECT TOP 1 * FROM Users WHERE username = @username AND isDeleted = 0';
    var request = new mssql.Request(mssql.globalConnection);
    request.input('username', mssql.VarChar, username);
    request.query(sql, function (err, recordset) {
        if (err) { mssql.errorHandler(err); err.code = 'F06010'; callback(err, undefined); return; }

        if (recordset.length > 0) {
            callback(err, true);
        } else {
            callback(err, false);
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
    var err, sql, request, dbStartTime = new Date();
    /// check the pasword meets policy and complexity requirements.
    if (passwordPolicy(password) === false) {
        err = new Error('Password policy not met.');
        err.status = 400;
        callback(err, undefined);
        return false;
    }
    bcrypt.genSalt(10, function (err, salt) {
        if (err) { err.code = 'F06011'; callback(err, undefined); return; }
        bcrypt.hash(password, salt, function (err, passwordHash) {
            if (err) { err.code = 'F06012'; callback(err, undefined); return; }

            sql = 'UPDATE Users SET password = @password, dateUpdated = @now WHERE id = @id AND isDeleted = 0';
            request = new mssql.Request(mssql.globalConnection);
            request.input('id', mssql.UniqueIdentifier, userId);
            request.input('password', mssql.VarChar, passwordHash);
            request.input('now', mssql.DateTime2, new Date());
            request.query(sql, function (err) {
                if (statsD) {
                    statsD.timing('user.updateUserPassword', dbStartTime);
                }
                if (err) { mssql.errorHandler(err); err.code = 'F06014'; callback(err, undefined); return; }
                callback(err, true);
            });

        });
    });
}

/** Add a new user to the database
 * @param {object} user - An abbreviated User object with the relevant database fields
 * 
 */
function insertUser(user, callback) {
    var err, sql, request, key, dbStartTime = new Date();
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
        request = new mssql.Request(mssql.globalConnection);
        sql = 'INSERT INTO Users (';
        for (key in user) {
            if (user.hasOwnProperty(key) && key !== 'id') {
                sql += key + ', ';
                if (key === 'password') {
                    request.input(key, 'ValueNotSet');
                } else {
                    request.input(key, user[key]);
                }
            }
        }
        sql += 'dateUpdated, dateEntered) OUTPUT INSERTED.id VALUES (';
        for (key in user) {
            if (user.hasOwnProperty(key) && key !== 'id') {
                sql += '@' + key + ', ';
            }
        }
        sql += '@now, @now)';
        request.input('now', mssql.DateTime2, new Date());
        request.query(sql, function (err, recordset) {
            if (statsD) {
                statsD.timing('user.insertUser', dbStartTime);
            }
            if (err) { mssql.errorHandler(err); err.code = 'F06020'; callback(err, undefined); return; }

            // console.log(recordset);
            if (recordset.length > 0) {
                if (user.isConfirmed !== true) {
                    sendConformationEmail(recordset[0].id, user.emailAddress);
                }
                updateUserPassword(recordset[0].id, user.password, function (err) {
                    if (err) { err.code = err.code || 'F06031'; callback(err, undefined); return; }
                    callback(undefined, recordset[0].id); /// The ALL OK callback
                });
            } else {
                err = new Error('No row inserted');
                err.code = 'F06038';
                callback(err, undefined);
            }
        });
    });
}

/**
 * Universal user update
 * @param {object} user - abbreviated user object.  If whole user object is used then pass it through userFromDatabase.
 * @param {Requester~requestCallback} callback
 */
function updateUser(user, callback) {
    var err, request, sql, key, dbStartTime = new Date();
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

    /*connection = new mssql.Connection(sqlconfig)
        .then(function () {
            request = new sql.Request(connection);
            sql = 'UPDATE Users SET ';
            for (key in user) {
                if (user.hasOwnProperty(key) && key !== 'id') {
                    sql += key + ' = @' + key;
                    request.input(key, user[key]);
                }
                sql += ', ';
            }
            sql += 'dateUpdated = @now WHERE id = @id';
            request.input('id', mssql.UniqueIdentifier, user.id);
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
                err.code = 'F06016'; callback(err, undefined); return; 
            });
        })
        .catch(function (err) {
            err.code = 'F06017'; callback(err, undefined); return; 
        });
*/

    request = new mssql.Request(mssql.globalConnection);
    sql = 'UPDATE Users SET ';
    for (key in user) {
        if (user.hasOwnProperty(key) && key !== 'id' && key !== 'password') {
            sql += key + ' = @' + key;
            request.input(key, user[key]);
            sql += ', ';
        }
    }
    sql += 'dateUpdated = @now WHERE id = @id;';
    //console.log(sql);
    request.input('id', mssql.UniqueIdentifier, user.id);
    request.input('now', mssql.DateTime2, new Date());
    request.query(sql, function (err) {
        if (statsD) {
            statsD.timing('user.updateUser', dbStartTime);
        }
        if (err) { mssql.errorHandler(err); err.code = 'F06017'; callback(err, undefined); return; }
        callback(err, true);
    });
}

/**
 * Logically delete a user in the database.  No hard delete is run.
 * @param {Requester~requestCallback} callback
 */
function deleteUser(callback) {
    var user = this;
    if (user.id === undefined || user.id === null) {
        var err = new Error('User ID is not defined');
        if (callback) {
            callback(err, undefined);
        }
        return;
    }

    updateUser({id: user.id, isDeleted: true}, function (err, result) {
        callback(err, result);
    });
}

/**
 * stamp each time a user connects
 * @param {uuid} userId
 */
function setDateLastActive(userId) {
    var sql, request, dbStartTime = new Date();
    request = new mssql.Request(mssql.globalConnection);
    sql = 'UPDATE Users SET dateLastActive = @now WHERE id = @id;';
    request.input('id', mssql.UniqueIdentifier, userId);
    request.input('now', mssql.DateTime2, new Date());
    request.query(sql, function (err) {
        if (statsD) {
            statsD.timing('user.setDateLastActive', dbStartTime);
        }
        if (err) {
            logger.errorNoReq('usersqlserver.setDateLastActive', 'F06018', err, 2);
        }
    });
}


/*function userChanged(user) {
    if (user.loaded) {
        user.changed = true;
        user.changeCount++;
    }
}*/

/**
 * Get a user's options object
 * @param {Requester~requestCallback} callback
 */
function getOptions(callback) {
    var user = this, sql, request, dbStartTime = new Date();
    request = new mssql.Request(mssql.globalConnection);
    sql = 'SELECT userOption, value FROM UserOption WHERE userId = @id;';
    request.input('id', mssql.UniqueIdentifier, user.id);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('user.getOptions', dbStartTime);
        }
        if (err) { err.code = 'F06035'; callback(err, undefined); return; }
        var retVal = {};
        recordset.forEach(function (opt) {
            retVal[opt.userOption] = opt.value;
        });
        callback(undefined, retVal);
    });
}

/**
 * Universal user update
 * @param {string} option - option name
 * @param {string} value - value to update or insert option as
 * @param {Requester~requestCallback} callback
 */
function setOption(option, value, callback) {
    var user = this, sql, request, dbStartTime = new Date();
    request = new mssql.Request(mssql.globalConnection);
    sql = 'SELECT TOP 1 * FROM UserOption WHERE userId = @id AND userOption = @option;';
    request.input('id', mssql.UniqueIdentifier, user.id);
    request.input('option', mssql.VarChar, option);
    request.query(sql, function (err, recordset) {
        if (statsD) {
            statsD.timing('user.setOption', dbStartTime);
        }
        if (err) { err.code = 'F06033'; callback(err, undefined); return; }
        if (recordset.length > 0) {
            sql = 'UPDATE UserOption SET value = @value, dateUpdated = @now ' +
                'WHERE userId = @id AND userOption = @option;';
        } else {
            sql = 'INSERT INTO UserOption (userId, userOption, value, dateEntered, dateUpdated) ' +
                'VALUES (@id, @option, @value, @now, @now)';
        }
        request.input('id', mssql.UniqueIdentifier, user.id);
        request.input('option', mssql.VarChar, option);
        request.input('value', mssql.VarChar, value);
        request.input('now', mssql.DateTime2, new Date());
        request.query(sql, function (err) {
            if (err) { err.code = 'F06034'; callback(err, undefined); return; }
            callback(undefined, true);
        });
    });
}

/**
 * Authenticate a user based o nthe username and password.  Returns true or an error in the callback.
 * @param {string} username
 * @param {string} password 
 * @param {Requester~requestCallback} callback
 */
function authenticate(username, password, callback) {
    var user = this, key, dbStartTime = new Date(), err;
    if (password === undefined || password === null) {
        err = new Error('Password is required');
        err.code = 'F06024';
        callback(err);
        return;
    }
    getUserByUsername(username, password, function (err, result) {
        if (err) { err.code = err.code || 'F06016'; callback(err, undefined); return; }
        for (key in result) {
            if (result.hasOwnProperty(key)) {
                user[key] = result[key];
            }
        }
        user.getOptions(function (err, options) {
            if (statsD) {
                statsD.timing('user.authenticate', dbStartTime);
            }
            if (err) { err.code = err.code || 'F06038'; callback(err, undefined); return; }
            user.options = options;
            callback(err, user);
            setDateLastActive(user.id);
        });
    });
}

/**
 * Load a user from the database into the main object
 * @param {string} userId
 * @param {Requester~requestCallback} callback
 */
function load(userId, callback) {
    var user = this, key;
    if (RegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).test(userId)) {
        getUserById(userId, user.includeDisabled, function (err, result) {
            if (err) { err.code = err.code || 'F06017'; callback(err, undefined); return; }
            for (key in result) {
                if (result.hasOwnProperty(key)) {
                    user[key] = result[key];
                }
            }
            user.getOptions(function (err, options) {
                if (err) { err.code = err.code || 'F06037'; callback(err, undefined); return; }
                user.options = options;
                callback(err, user);
                setDateLastActive(user.id);
            });
        });
    } else { /// Use the alternative natural keys
        getUserByUsernameOrEmailAddress(userId, function (err, result) {
            if (err) { err.code = err.code || 'F06042'; callback(err, undefined); return; }
            for (key in result) {
                if (result.hasOwnProperty(key)) {
                    user[key] = result[key];
                }
            }
            callback(err, user);
            /*user.getOptions(function (err, options) {
                if (err) { err.code = err.code || 'F06043'; callback(err, undefined); return; }
                user.options = options;
                setDateLastActive(user.id);
            });*/
        });
    }
}

/**
 * Use for email confirmaton when signing up
 * @param {string} key - key sent to the user via email
 * @param {Requester~requestCallback} callback
 */
function checkConfirmationKey(key, callback) {
    var sql, request, user = this;
    if (user.isConfirmed) {
        callback(undefined, true);
    }

    sql = 'SELECT TOP 1 * FROM UserConfirmation WHERE UserId = @id AND confirmationKey = @key';
    request = new mssql.Request(mssql.globalConnection);
    request.input('id', mssql.UniqueIdentifier, user.id);
    request.input('key', mssql.VarChar, key);
    request.query(sql, function (err, recordset) {
        if (err) { console.log(sql); err.code = 'F06025'; callback(err, undefined); return; }

        if (recordset.length > 0) {
            sql = 'UPDATE Users SET isConfirmed = 1, dateUpdated = @now WHERE id = @id';
            var request1 = new mssql.Request(mssql.globalConnection);
            request1.input('id', mssql.UniqueIdentifier, user.id);
            request1.input('now', mssql.DateTime2, new Date());
            request1.query(sql, function (err) {
                if (err) { err.code = 'F06026'; callback(err, undefined); return; }
                sql = 'DELETE FROM UserConfirmation WHERE UserId = @id';
                var request2 = new mssql.Request(mssql.globalConnection);
                request2.input('id', mssql.UniqueIdentifier, user.id);
                request2.query(sql, function (err) {
                    if (err) { err.code = 'F06027'; callback(err, undefined); return; }
                    callback(undefined, true);
                });
            });
        } else {
            callback(undefined, false);
        }
    });
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
    setDateLastActive(user.id);

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
                            callback(err, undefined);
                        } else {
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
Object.defineProperty(User, 'firstName', {
    get: function () { return this.firstName; },
    set: function (v) { this.firstName = v;  userChamged(this); console.log('thing'); }
});
User.prototype.setfirstName = function (firstName, callback) {
    this.firstName = firstName;
    userChamged(this);
};
User.prototype.setPassword = function (password, callback) {
    this.password = password;
    updateUserPassword(this, callback);
};*/


module.exports = User;