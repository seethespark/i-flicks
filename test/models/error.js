var assert = require("assert"),
    error = require('../../models/error');
    
describe('error object', function () {
    describe('add', function () {
        it('should return nothing', function () {
            var err = new Error('Test error');
            var errr = {
                userId: 0,
                action: 'Test',
                server: 'server',
                errorCode: '0',
                error: err.message,
                errorType: 2,
                dateEntered: new Date(),
                extraData: ''
            };
            error.add(errr, function (errrr) {
                assert.equal(undefined, errrr);
            });
        });
    });

    describe('list', function () {
        it('should return an array', function () {
            error.list(10, '-', function (errrr, list) {
                assert.equal(undefined, errrr);
                assert.equal(true, Array.isArray(list));
            });
        });
    });
});
