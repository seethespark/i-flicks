var assert = require("assert"),
    flick = require('../../models/flick'),
    flicks = require('../../models/flicks');
    //formatUkDate = require('../../lib/utils').formatUkDate,
    //formatPostcode = require('../../lib/utils').formatPostcode;
//global.iflicks_settings = require('../../settings');

describe('flick object', function () {
    describe('thumb', function () {
        it('should return path to thumbnail', function () {
            flicks.list(function (err, list) {
                if (err) { throw new Error(err);  }
                if (list.length === 0 ) { throw new Error('No flicks to list');  }
                flick.thumb(list[0]._id, function (err, pathToThumbnail) {
                    assert.equal(undefined, err);
                    if (pathToThumbnail === undefined || pathToThumbnail.length === 0) {
                        throw new Error('No thumbnail path'); 
                    }
                });

            });
        });
    });
});
