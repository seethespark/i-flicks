// Error code F08
var Flicks;
if (global.iflicks_settings.databaseType === 'nedb') {
    Flicks = require('./flicksnedb');
} else if (global.iflicks_settings.databaseType === 'sqlserver') {
    Flicks = require('./flickssqlserver');
} else {
    throw new Error('Database type not set');
}
module.exports = Flicks;