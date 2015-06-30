var assert = require("assert"),
    flicks = require('../../models/flicks');

describe('flicks object', function () {
    describe('listUnencoded', function () {
        it('should return array', function () {
            flicks.listUnencoded(0, 1, {isSysAdmin: true}, function (err, flicksList) {
                assert.equal(undefined, err);
                assert.equal(true, Array.isArray(flicksList.data));
            });
        });
    });

    describe('list', function () {
        it('should return an array', function () {
            flicks.list(0, 2, '-', {isSysAdmin: true}, function (err, flicksList) {
                assert.equal(undefined, err);
                assert.equal(true, Array.isArray(flicksList.data));
                //assert.equal(true, (function () { if (flicksList.data.length <= 2) { return true; } return false; })());
            });
        });
    });
});
