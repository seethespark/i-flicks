var assert = require("assert"),
    flicks = require('../../models/flicks');
    //formatUkDate = require('../../lib/utils').formatUkDate,
    //formatPostcode = require('../../lib/utils').formatPostcode;

describe('flicks object', function () {
    describe('listUnencoded', function () {
        it('should return nothing', function () {
            flicks.listUnencoded(function (err, flicksList) {
                assert.equal(undefined, err);
                assert.equal(true, Array.isArray(flicksList));
            });
        });
    });

    describe('list', function () {
        it('should return nothing', function () {
            flicks.listUnencoded(function (err, flicksList) {
                assert.equal(undefined, err);
                assert.equal(true, Array.isArray(flicksList));
            });
        });
    });
});
