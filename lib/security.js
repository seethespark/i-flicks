// Error code F05
var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var BasicStrategy = require('passport-http').BasicStrategy;
var User = require('../models/user');



passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (user, done) {
    done(null, user);
});
passport.use(new LocalStrategy({passReqToCallback: true},
    function (req, username, password, done) {
        var userForSession, user = new User();
        user.authenticate(username, password, function (err, result) {
            if (err) {done(err); return;}
            user.getOptions(function (err, options) {
                if (err) {done(err); return;}if (err) {throw err;}
                userForSession = user.userForSession();
                userForSession.options = options;
                done(err, userForSession);
            });
            
        });
    }
    ));

passport.use(new BasicStrategy({passReqToCallback: true},
    function (req, username, password, done) {
        var userForSession, user = new User();
        user.authenticate(username, password, function (err, result) {
            if (err) {done(err); return;}
            user.getOptions(function (err, options) {
                if (err) {done(err); return;}
                userForSession = user.userForSession();
                userForSession.options = options;
                done(err, userForSession);
            });
        });
    }
));

router.basicAuth = function(req, res, next) {
    //return passport.authenticate('basic', { session: false });
    passport.authenticate('basic',  { session: false }, function (err, user, info) {
        if (err) {
            err.status = 401;
            return next(err);
        }
        if (!user) {
            err = new Error('Incorrect username or password.');
            err.status = 401;
            return next(err);
        }
        req.logIn(user, function (err) {
            if (err) {
                return next(err);
            }
            return next();
        });
    })(req, res, next);
};

router.ensureAuthenticated = function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }

    if (req.baseUrl.substring(0,4) === '/api') {
        var err = new Error('Access denied');
        err.code = 'F05001';
        err.status = 401;
        return next(err);
    }
    res.redirect('./');
};

router.initialize = passport.initialize(); // Add passport initialization
router.session = passport.session();    // Add passport initialization

router.post('/', function (req, res, next) {
    passport.authenticate('local', function (err, user, info) {
        if (err) {
            err.status = 401;
            return next(err);
        }
        if (!user && req.headers['content-type'] === 'application/json') {
            err = new Error('Incorrect username or password.');
            err.status = 401;
            return next(err);
        }
        if (!user) {
            return res.redirect('/signin');
        }
        req.logIn(user, function (err) {
            if (err) {
                return next(err);
            }
            if (req.body.path === '') {
                req.body.path = './';
            }
            if (req.body.path !== undefined && req.body.path.length > 0) {
                return res.redirect(req.body.path);
            }
            user.getOptions(function (err, options) {
                var userForBrowser = user.userForBrowser();
                userForBrowser.options = options;
                res.status(200).send(userForBrowser);
            });
           // return res.status(200).send(user.userForBrowser());

        });
    })(req, res, next);
});


router.get('/', function (req, res, next) {
    if (req.user) {
        var user = new User();
        user.load(req.user.id, function (err, usr) {
            if (err) {
                return next(err);
            }
            user.getOptions(function (err, options) {
                var userForBrowser = user.userForBrowser();
                userForBrowser.options = options;
                res.status(200).send(userForBrowser);
            });
            //res.send(usr.userForBrowser());
        });
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.status(401).send({error: 'Access denied'});
    }
});
// route to log out
router.delete('/', function (req, res) {
    req.logOut();
    res.status(204).end();
});

module.exports = router;