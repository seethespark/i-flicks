var crypto = require('crypto');


var testUtils = {};


function random(howMany, chars) {
    chars = chars || 'abcdefghijklmnopqrstuwxyzABCDEFGHIJKLMNOPQRSTUWXYZ0123456789';
    var rnd = crypto.randomBytes(howMany),
        value = new Array(howMany),
        len = chars.length,
        i;

    for (i = 0; i < howMany; i++) {
        value[i] = chars[rnd[i] % len];
    }

    return value.join('');
}
testUtils.random = random;

/**
 * Runs over the cache to search for all the cached
 * files
 */
function requireSearchCache(moduleName, callback) {
    // Resolve the module identified by the specified name
    var mod = require.resolve(moduleName);

    // Check if the module has been resolved and found within
    // the cache
    if (mod && ((mod = require.cache[mod]) !== undefined)) {
        // Recursively go over the results
        (function run(mod) {
            // Go over each of the module's children and
            // run over it
            mod.children.forEach(function (child) {
                run(child);
            });

            // Call the specified callback providing the
            // found module
            callback(mod);
        })(mod);
    }
}

/**
 * Removes a module from the cache
 */
function requireUncache(moduleName) {
    // Run over the cache looking for the files
    // loaded by the specified module name
    requireSearchCache(moduleName, function (mod) {
        delete require.cache[mod.id];
    });

    // Remove cached paths to the module.
    // Thanks to @bentael for pointing this out.
    Object.keys(module.constructor._pathCache).forEach(function (cacheKey) {
        if (cacheKey.indexOf(moduleName) > 0) {
            delete module.constructor._pathCache[cacheKey];
        }
    });
}
testUtils.requireUncache = requireUncache;

module.exports = testUtils;