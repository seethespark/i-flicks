var assert = require('assert'),
    fs = require('fs');

/*** Setup the SQL Server bit */
var mssql = require('mssql');
var settings = require ('../../.testSettings');
var sqlconfig = {
    user: settings.databaseUser,
    password: settings.databasePassword,
    server: settings.databaseServer,
    database: settings.databaseName,
    connectionTimeout: 4000,
    commandTimeout: 4000
};
var connection = new mssql.Connection(sqlconfig);
mssql.globalConnection = connection;
connection.connect();

global.iflicks_settings = global.iflicks_settings || {};

global.iflicks_settings.nedbPath = settings.nedbPath;

var utils;

var databaseTypes = ['sqlserver', 'nedb'];

databaseTypes.forEach(function (dbType) {
    global.iflicks_settings.databaseType = dbType;
    utils = require('../../lib/utils');

    describe('utils object', function () {
        describe('utils', function () {
            it('should return nothing ' + dbType, function () {
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
});