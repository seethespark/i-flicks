// Error code F07

var Users;
if (global.iflicks_settings.databaseType === 'nedb') {
    Users = require('./usersnedb');
} else if (global.iflicks_settings.databaseType === 'sqlserver') {
    Users = require('./userssqlserver');
} else {
    throw new Error('Database type not set');
}
module.exports = Users;