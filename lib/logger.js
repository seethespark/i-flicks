var Nedb = require('nedb');
var path = require('path');
var os = require('os');
var error = require('../models/error');

/**
 * Error module, guess what, it logs errors in a database.
 * @module error
 */

/** 
 * Get the cookie value from a cookie name
 * @param {string[]} headerCookies - cookies object from the request
 * @param {string} cookieName - name to retrieve
*/
function getCookie(headerCookies, cookieName) { if (headerCookies) { return (headerCookies.match('(^|; )' + cookieName + '=([^;]*)') || 0)[2]; } }

/**
 * Log an error
 * @param {Object} req - request
 * @param {string} route - name of the route and method where the error occurred
 * @param {string} errorCode - Standard error code
 * @param {Object} err - Error object or error message
 * @param {number} errorType - 1 for client generated, 2 for server generated.
 * @param {string} extraData - Any more info which might be useful, stack trace for example.
 */
function errorr(req, route, errorCode, err, errorType, extraData) {
    try {
        if (typeof err === 'object') {
            err = err.message;
        }
        if (global.iflicks_settings.showErrorsInConsole) {
            console.log('ERR: ' + route + ': ' + err);
        }
        var trackingCookieId = getCookie(req.headers.cookie, 'tcID');
        if (trackingCookieId === undefined) {
            trackingCookieId = req.params.username;
        }
        var sessionId = getCookie(req.headers.cookie, 'ssID');
        if (sessionId !== undefined) {
            sessionId = sessionId.substring(0, 36);
        }
        var requestId = req.id;
        var action = "route: " + route;
        var server = os.hostname();
        if (!errorType) {
            errorType = 2;
        }
        var userId = 1;

        if (typeof extraData === 'object') {
            extraData = JSON.stringify(extraData);
        }
        if (extraData !== undefined && extraData.toString().length > 5000) {
            extraData = extraData.toString().substring(0, 4998);
        }

        var dataToSave = {
            userId: userId,
            action: action,
            path: req.url,
            server: server,
            errorCode: errorCode,
            error: err,
            errorType: errorType,
            extraData: extraData,
            dateEntered: new Date()
        };

        /*dataToSave.push(req.customer.id);
        dataToSave.push(requestId);
        dataToSave.push(action);
        dataToSave.push(server);
        dataToSave.push(errorCode);
        dataToSave.push(err);
        dataToSave.push(errorType);
        //console.log(extraData.toString().length);
        dataToSave.push(extraData);*/
        error.setStatsD(req.statsD);
        error.add(dataToSave, function (errr) {
            if (errr) {
                console.log(errr);
            }
        });

    } catch (errr) {
        console.log("Server error exception5");
        console.log(route);
        console.log(errr);
    }
}

function errorNoReq(route, errorCode, err, errorType, extraData) {
    try {
        if (typeof err === 'object') {
            err = err.message;
        }
        if (global.iflicks_settings.showErrorsInConsole) {
            console.log('ERR U: ' + route + ': ' + err);
        }
        //var sessionId = getCookie(req.headers.cookie, 'ssID');
        var action = "route: " + route + " :: errorNoReq";
        var server = os.hostname();
        errorType = errorType || 2;
        var userId = 0;

        // remember,the order is important here.
        var dataToSave = {
            userId: userId,
            action: action,
            server: server,
            errorCode: errorCode,
            error: err,
            errorType: errorType,
            extraData: extraData,
            dateEntered: new Date()
        };
        /*dataToSave.push(settings.customerId);
        dataToSave.push(action);
        dataToSave.push(server);
        dataToSave.push(errorCode);
        dataToSave.push(err);
        dataToSave.push(errorTypeId);
        dataToSave.push(extraData);
        */

        error.add(dataToSave);
    } catch (errr) {
        console.log("Server error exception3");
        console.log(route);
        console.log(errr);
    }
}

function errorMessage(req, route, err) {
    try {
        if (global.iflicks_settings.showErrorsInConsole) {
            console.log('MSG: ' + route + ': ' + err);
        }
        var action = route;
        var server = os.hostname();
        var errorType = 3; // server message
        var userId = 1;

        var dataToSave = {
            userId: userId,
            action: action,
            server: server,
            errorCode: 0,
            error: err,
            errorType: errorType,
            extraData: '',
            dateEntered: new Date()
        };
        /*
        dataToSave.push(req.customer.id); //customer ID
        dataToSave.push(req.id); //request ID
        dataToSave.push(action);
        dataToSave.push(server);
        dataToSave.push(0); // error code
        dataToSave.push(error);
        dataToSave.push(errorTypeId);
        */

        error.setStatsD(req.statsD);
        error.add(dataToSave);
    } catch (errr) {
        console.log("Server error exception1");
        console.log(route);
        console.log(errr);
    }
}

/** Logging module
**/
var log  =  {};
log.error = errorr;
log.errorNoReq = errorNoReq;
log.message = errorMessage;

module.exports = log;