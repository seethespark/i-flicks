var assert = require('assert'),
    flick = require('../../models/flick'),
    flicks = require('../../models/flicks');

describe('flick object', function () {
    describe('thumb', function () {
        it('should return path to thumbnail', function () {
            flicks.list(0, 1, '-', {isSysAdmin: true}, function (err, list) {
                if (err) { throw new Error(err);  }
                if (list.data.length === 0 ) { throw new Error('No flicks to list');  }
                flick.thumb(list.data[0]._id, 'foo', {isSysAdmin: true}, function (err, pathToThumbnail) {
                    assert.equal(undefined, err);
                    if (pathToThumbnail === undefined || pathToThumbnail.length === 0) {
                        throw new Error('No thumbnail path'); 
                    }
                });

            });
        });
    });
});
