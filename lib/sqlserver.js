var mssql = require('mssql');
var sqlconfig = {
    user: global.iflicks_settings.sqlServerUsername,
    password: global.iflicks_settings.sqlServerPassword,
    server: global.iflicks_settings.sqlServerServer, // You can use 'localhost\\instance' to connect to named instance 
    database: global.iflicks_settings.sqlServerDatabaseName,
    connectionTimeout: 4000,
    commandTimeout: 4000
};

var connection = new mssql.Connection(sqlconfig);

connection.on('connect', function (ev) {
    console.log('SQL SERVER CONNECTED!!');
    mssql.globalConnection = connection;
});

connection.on('error', function (ev) {
    console.log('SQL CONNECTION ERROR');
    console.log(ev);
    connection.connect();
});

connection.connect(function (err) {
    if (err) { 
        console.log('SQL CONNECTION ERROR INITAL');
        console.log(err);
    }
});


function mssqlError(err) {
   //console.log(connection);
    if (connection.connecting === false &&  (err.code === 'ENOCONN' || err.code === 'ECONNCLOSED')) {
        //connection = new mssql.Connection(sqlconfig);
        connection.connect(function (err) {
            if (err) { console.log(err); }
            
        });

        console.log('ATTEMPTING SQL SERVER RECONNECT');
    }
}

mssql.errorHandler = mssqlError;