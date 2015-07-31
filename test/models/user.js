var assert = require('assert'),
    utils = require('../testUtils');

/// This can be set as the username I use may already exist in someone else's database.
var username = utils.random(10);

global.iflicks_settings.dbTypes.forEach(function (dbType) {
    global.iflicks_settings.databaseType = dbType;
    runTest(dbType, require('../../models/user' + dbType));
});

function runTest(dbType, User) {
    describe('user object - ' + dbType, function () {

        function afterUserCreated(id) {
            describe('load', function () {
                it('should return user object', function (done) {
                    var user = new User();
                    user.load(id, function (err, usr) {
                        assert.ifError(err);
                        assert.equal('object', typeof usr);
                        assert.equal('Test', usr.givenName);
                        assert.equal(user, usr);
                        done();
                    });
                });
            });
            describe('authenticate', function () {
                it('should return user object', function (done) {
                    var user = new User();
                    user.authenticate(username, 'password', function (err, usr) {
                        assert.ifError(err);
                        assert.equal('object', typeof usr);
                        assert.equal('Test', user.givenName);
                        assert.equal(user, usr);
                        done();
                    });
                });
            });
            describe('userFor* functions', function () { 
                it('userForSession should be a subset of user', function (done) {
                    var user = new User();
                    user.load(id, function (err, usr) {
                        var userLength = Object.keys(usr).length;
                        assert.ifError(err);
                        assert(userLength === Object.keys(usr.userForSession()).length);
                        assert(userLength > Object.keys(usr.userForBrowser()).length);
                        done();
                    });
                });
            });
            describe('create duplicate username', function () {
                it('should return an error', function (done) {
                    var user = new User();
                    user.username = username;
                    user.givenName = 'Test';
                    user.familyName = 'Test';
                    user.emailAddress = '';
                    user.isSysAdmin = false;
                    user.isConfirmed = true;
                    user.isEnabled = true;
                    user.password = 'password';
                    user.create(function (err, id) {
                        assert(err !== undefined);
                        done();
                    });
                });
            });
            describe('save', function () { 
                it('should return true', function (done) {
                    var user = new User();
                    user.load(id, function (err, usr) {
                        assert.ifError(err);
                        user.givenName = 'tseT';
                        user.save(function (err, result) {
                            assert.ifError(err);
                            assert.equal(true, result);
                            var user2 = new User();
                            user2.load(id, function (err, usr2) {
                                assert.ifError(err);
                                assert.equal(user2.givenName, 'tseT');
                                done();
                                
                            });
                            //done();
                        });
                    });
                });
            });

            describe('update password', function () { 
                it('should return true', function (done) {
                    var user = new User();
                    user.load(id, function (err, usr) {
                        assert.ifError(err);
                        user.setPassword('newPassword', function (err, result) {
                            assert.ifError(err);
                            assert.equal(true, result);
                            user.authenticate(username, 'password', function (err, usr) {
                                assert(err !== undefined);
                                assert.equal(usr, undefined);
                                user.authenticate(username, 'newPassword', function (err, usr) {
                                    assert.ifError(err);   
                                    done();
                                });
                            });
                        });
                    });
                });
            });

            describe('options', function () { 
                it('should return true', function (done) {
                    var user = new User();
                    user.load(id, function (err, usr) {
                        assert.ifError(err);
                        user.setOption('testOption', 'test value', function (err, result) {
                            assert.ifError(err);
                            assert.equal(true, result);
                            user.getOptions(function(err, options) {
                                assert.ifError(err);
                                console.log();
                                assert.equal('test value', options.testOption);
                                done();
                            });
                        });
                    });
                });
            });
            describe('delete', function () {
                it('should return true', function (done) {
                    var user = new User();
                    user.load(id, function (err, usr) {
                        assert.ifError(err);
                        user.delete(function (err, result) {
                            assert.ifError(err);
                            assert.equal(true, result);
                            done();
                        });
                    });
                });
            });

            describe('authenticate with deleted user', function () {
                it('should return error', function (done) {
                    var user = new User();
                    user.authenticate(username, 'password', function (err, usr) {
                        //assert.ifError(err);
                        assert(err !== undefined);
                        assert.equal(usr, undefined);
                        
                        done();
                    });
                });
            });
        }

        describe('create', function () {
            it('should return the new ID', function (done) {
                var user = new User();
                user.username = username;
                user.givenName = 'Test';
                user.familyName = 'Test';
                user.emailAddress = '';
                user.isSysAdmin = false;
                user.isConfirmed = true;
                user.isEnabled = true;
                user.password = 'password';
                user.create(function (err, id) {
                    assert.ifError(err);
                    if (dbType === 'nedb') {
                        assert.equal(true, (id.length === 16) );
                    } else {
                        assert.equal(true, RegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).test(id));
                    }
                    afterUserCreated(id);
                    done();
                });
            });
        });

    });
}