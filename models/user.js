// Error code F06
/** 
 * User class.  Use this for all interactions with user
 * 
 * @module User
 */

var User;
if (global.iflicks_settings.databaseType === 'nedb') {
    User = require('./usernedb');
} else if (global.iflicks_settings.databaseType === 'sqlserver') {
    User = require('./usersqlserver');
} else {
    throw new Error('Database type not set');
}
module.exports = User;