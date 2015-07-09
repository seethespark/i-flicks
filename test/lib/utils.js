var assert = require('assert'),
    fs = require('fs'),
    utils = require('../../lib/utils');

describe('utils object', function () {
    describe('utils', function () {
        it('should return nothing', function () {
            utils.encode({});
        });
    });

    /*describe('check the relevant files exist', function () {
        it('should return true', function () {
            assert.equal(true, fs.existsSync(global.iflicks_settings.ffmpegPath));
            assert.equal(true, fs.existsSync(global.iflicks_settings.ffprobePath));
            assert.equal(true, fs.existsSync(global.iflicks_settings.flvMetaPath));
        });
    });*/
});
