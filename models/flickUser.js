// Error code F09


/** 
 * Programmatic representation of a flickUser
 * 
 * @module flickUser
 */
var Flicks;
if (global.iflicks_settings.databaseType === 'nedb') {
    Flicks = require('./flickUsernedb');
} else if (global.iflicks_settings.databaseType === 'sqlserver') {
    Flicks = require('./flickUsersqlserver');
} else {
    throw new Error('Database type not set');
}
module.exports = Flicks;