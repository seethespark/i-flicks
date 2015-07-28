// Error code F06

var User;
if (global.iflicks_settings.databaseType === 'nedb') {
    User = require('./usernedb');
} else if (global.iflicks_settings.databaseType === 'sqlserver') {
    User = require('./usersqlserver');
} else {
    throw new Error('Database type not set');
}
module.exports = User;