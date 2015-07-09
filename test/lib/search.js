var assert = require("assert"),
  search = require('../../lib/search');

describe('search object', function () {
  describe('search', function () {
    it('should return array', function () {
    	var docs = [{_id: 'a', name: 'Test thing'}, {_id: 'b', name: 'other thing k'}, {_id: 'c', name: 'random string'}];
      var s = search(docs, [{name: 'name', weight: 10}], 'Test');
      assert.equal(1, s.length);
      s = search(docs, [{name: 'name', weight: 10}], 'thing');
      assert.equal(2, s.length);
      s = search(docs, [{name: 'name', weight: 10}], 'g');
      assert.equal(3, s.length);
    });
  });
});