var assert = require('assert'),
    utils = require('../testUtils'),
    Flick = require('../../models/flick');

if (global.iflicks_settings === undefined || global.iflicks_settings.dbTypes === undefined) {
    throw new Error('Test i-flicks settings have not been set');
}

global.iflicks_settings.dbTypes.forEach(function (dbType) {
    global.iflicks_settings.databaseType = dbType;
    runTest(dbType, require('../../models/flick' + dbType), require('../../models/flicks' + dbType));
    //runTest(dbType, require('../../models/flick'), require('../../models/flicks' + dbType));
});

function runTest(dbType, Flick1, flicks) {
    describe('flick object - ' + dbType, function () {
        function afterFlickCreated(id) {
            describe('getFlickById ' + dbType, function () {
                it('should return flick object' + dbType, function (done) {
                    var flick = new Flick1();
                    flick.getFlickById(id, 'userId', true, function (err, flk) {
                        assert.ifError(err);
                        assert.equal('object', typeof flk);
                        assert.equal('Test', flk.name);
                        //assert.equal(flick, flk);
                        done();
                    });
                });
            });
            describe('update Flick ' + dbType, function () {
                it('should return path to thumbnail ' + dbType, function (done) {
                    var flick = new Flick1();
                    flick.updateFlick({id: id, name: 'Different name'}, function (err) {
                        assert.equal(undefined, err);
                        var flick2 = new Flick1();
                        flick2.getFlickById(id, 'userId', true, function (err, flk) {
                            assert.ifError(err);
                            assert.equal('object', typeof flk);
                            assert.equal('Different name', flk.name);
                            //assert.equal(flick, flk);
                            done();
                        });
                    });
                });
            });
            describe('delete flick ' + dbType, function () {
                it('should return true ' + dbType, function (done) {
                    var flick = new Flick1();
                    flick.updateFlick({id: id, isDeleted: true}, function (err) {
                        assert.equal(undefined, err);
                        
                        done();
                        
                    });
                });
            });
        }
        describe('insertFlick ' + dbType, function () {
            it('should return the new ID ' + dbType, function (done) {
                var flick = new Flick1(), tmp = {};
                tmp.userId = '6145017E-A403-40C2-BAFA-948EE422F674';
                tmp.name = 'Test';
                tmp.description = 'Test flick description';
                tmp.isEncoded = true;
                tmp.isPublic = false;
                tmp.isEncoding = false;
                tmp.isDirectLinkable = true;
                tmp.thumbnailPath = 'thumb.png';
                tmp.playCount = 0;
                tmp.emailWhenEncoded = false;
                flick.insertFlick(flick.flickFromDatabase(tmp), function (err, id) {
                    assert.ifError(err);
                    if (dbType === 'nedb') {
                        assert.equal(true, (id.length === 16) );
                    } else {    
                        assert.equal(true, (id.length === 8) );
                        ///assert.equal(true, RegExp(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).test(id));
                    }
                    afterFlickCreated(id);
                    done();
                });
            });
        });
    });
}

describe('flick object', function () {
    function afterFlickCreated(id) {
        describe('load', function () {
            it('should return flick object', function (done) {
                var flick = new Flick();
                flick.load(id, 'userId', true, function (err, flk) {
                    assert.ifError(err);
                    assert.equal('object', typeof flk);
                    assert.equal('Test', flk.name);
                    assert.equal(flick, flk);
                    done();
                });
            });
        });
        describe('thumb', function () {
            it('should return path to thumbnail', function (done) {
                var flick = new Flick();
                flick.load(id, 'userId', true, function (err) {
                    var pathToThumbnail = flick.thumbnailPath;
                    assert.equal(undefined, err);
                    if (pathToThumbnail === undefined || pathToThumbnail.length === 0) {
                        throw new Error('No thumbnail path'); 
                    }
                    done();
                });
            });
        });
        describe('flick add user', function () {
            it('should return nothing', function (done) {
                var flick = new Flick();
                flick.load(id, 'userId', true, function (err) {
                    flick.addUser('00000000-0000-0000-0000-000000000000', true,'00000000-0000-0000-0000-000000000000', function (err) {
                        assert.ifError(err);
                        done();

                    });
                });
            });
        });
        describe('flick remove user', function () {
            it('should return nothing', function (done) {
                var flick = new Flick();
                flick.load(id, 'userId', true, function (err) {
                    flick.addUser('00000000-0000-0000-0000-000000000000', true,'00000000-0000-0000-0000-000000000000', function (err) {
                        assert.ifError(err);
                        flick.removeUser('00000000-0000-0000-0000-000000000000', true, '00000000-0000-0000-0000-000000000000', function (err) {
                            assert.ifError(err);
                            done();
                        });
                    });
                });
            });
        });
        describe('delete', function () {
            it('should return true', function (done) {
                var flick = new Flick();
                flick.load(id, 'userId', true, function (err, flk) {
                    assert.ifError(err);
                    flick.delete(function (err, ok) {
                        assert.ifError(err);
                        assert.equal(true, ok);
                        done();
                    });
                });
            });
        });
    }
    describe('create', function () {
        it('should return the new ID', function (done) {
            var flick = new Flick();
            flick.userId = '00000000-0000-0000-0000-000000000000';
            flick.name = 'Test';
            flick.description = 'Test flick description';
            flick.isEncoded = true;
            flick.isPublic = false;
            flick.isEncoding = false;
            flick.isDirectLinkable = true;
            flick.thumbnailPath = 'thumb.png';
            flick.playCount = 0;

            flick.create(function (err, id) {
                assert.ifError(err);
                assert.equal(true, (id.length > 7) );
                afterFlickCreated(id);
                done();
            });
        });
    });
});
