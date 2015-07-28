var assert = require('assert');

if (global.iflicks_settings === undefined || global.iflicks_settings.dbTypes === undefined) {
    throw new Error('Test i-flicks settings have not been set');
}

global.iflicks_settings.dbTypes.forEach(function (dbType) {
    global.iflicks_settings.databaseType = dbType;
    runTest(dbType, require('../../models/flicks' + dbType));
});

function runTest(dbType, flicks) {
    describe('flicks object - ' + dbType, function () {
        describe('listUnencoded', function () {
            it('should return array', function () {
                flicks.listUnencoded(0, 1,  'userId', function (err, flicksList) {
                    assert.equal(undefined, err);
                    assert.equal(true, Array.isArray(flicksList.data));
                });
            });
        });

        describe('list', function () {
            it('should return an array', function () {
                flicks.list(0, 2, 'userId', true, function (err, flicksList) {
                    assert.equal(undefined, err);
                    //console.log(flicksList);
                    assert.equal(true, Array.isArray(flicksList.data));
                    //assert.equal(true, (function () { if (flicksList.data.length <= 2) { return true; } return false; })());
                });
            });
        });

        describe('search', function () {
            it('should return an array', function () {
                flicks.search(0, 2, '-', 'userId', true, function (err, flicksList) {
                    assert.equal(undefined, err);
                    assert.equal(true, Array.isArray(flicksList.data));
                    //assert.equal(true, (function () { if (flicksList.data.length <= 2) { return true; } return false; })());
                });
            });
        });
    });
}


