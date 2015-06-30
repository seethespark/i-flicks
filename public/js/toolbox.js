var iflicks = (function iflicks() {
    var listPollInterval, handlers = {}, messages = [];

    function showMessage(message, timeout) {
        if (timeout === undefined) {
            timeout = 10;
        }
        if (message !== undefined) {
            console.log((new Date()).toUTCString() + ' :: ' + message);
        }
        var minTimeout = 90000000000000, frag, messageElement, msg, br, err = {}; // minTimeout is an epoch date in 4821
        if (message) {
            timeout = Date.now() + (timeout * 1000);
            err.message = message;
            err.timeout = timeout;
            messages.push(err);
        }
        messageElement = document.getElementById('message');
        while (messageElement.hasChildNodes()) {
            messageElement.removeChild(messageElement.firstChild);
        }
        frag = document.createDocumentFragment();
        messages.forEach(function (err, i) {
            if (err.timeout <= Date.now()) {
                messages.splice(i, 1);
            } else {
                msg = document.createTextNode(err.message);
                br = document.createElement('br');
                frag.appendChild(msg);
                frag.appendChild(br);
                if (err.timeout < minTimeout) { minTimeout = err.timeout; }
            }
        });
        messageElement.appendChild(frag);

        if (minTimeout < 90000000000000) {
            timeout = minTimeout - Date.now();
            setTimeout(function () { showMessage(); }, timeout);
        }
    }
    function getCookie(k) { return (document.cookie.match('(^|; )' + k + '=([^;]*)') || 0)[2]; }
    function setCookie(n, v, d) {
        var e, dd;
        if (d) {
            dd = new Date();
            dd.setTime(dd.getTime() + (d * 24 * 60 * 60 * 1000));
            e = "; expires=" + dd.toGMTString();
        } else { e = ""; }
        document.cookie = n + "=" + v + e + "; path=/";
    }

    handlers.deleteUser = function deleteUserHandler(ev, userId) {
        var c = window.confirm("Are you sure you want to delete?");
        if (c === true) {
            window.fetch('/toolbox/user', {
                credentials: 'include',
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({userId: userId})
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    ev.target.parentNode.parentNode.parentNode.removeChild(ev.target.parentNode.parentNode);
                    if (json.error) {
                        showMessage(json.error, 6);
                    } else if (json.reply) {
                        showMessage(json.reply, 6);
                    } else {
                        showMessage('Unexpected response', 10);
                    }
                })
                .catch(function (ex) {
                    showMessage(ex.message, 10);
                });
        }
    };

    handlers.addUser = function addUserHandler(ev) {
        var i, el, newUser = {};
        for (i = 0; i < ev.target.parentNode.childNodes.length; i++) {
            el = ev.target.parentNode.childNodes[i];
            if (el.type === 'text') {
                newUser[el.name] = el.value;
            } else if (el.type === 'checkbox') {
                newUser[el.name] = el.checked;
            }
        }

        window.fetch('/toolbox/user', {
            credentials: 'include',
            method: 'PUT',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newUser)
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (json) {
                if (json.error) {
                    showMessage(json.error, 6);
                } else if (json.reply) {
                    showMessage(json.reply, 6);
                    userViewerShow();
                } else {
                    showMessage('Unexpected response', 10);
                }
            })
            .catch(function (ex) {
                showMessage(ex.message, 10);
            });
    };

    handlers.amendUser = function amendeUserHandler(ev, userId) {
        var i, el, newUser = {userId: userId};

        for (i = 0; i < ev.target.parentNode.parentNode.childNodes.length; i++) {
            el = ev.target.parentNode.parentNode.childNodes[i].firstChild;
            if (el.type === 'text') {
                if (el.value) {
                    newUser[el.name] = el.value;
                }
            } else if (el.type === 'checkbox') {
                newUser[el.name] = el.checked;
            }
        }
        window.fetch('/toolbox/user', {
            credentials: 'include',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newUser)
        })
            /*.then(function (response) {
                if (response.status >= 200 && response.status < 300) {
                    response.json().then(function(json) { showMessage(json.reply, 10); });
                }
                response.json().then(function(json) { showMessage(json.reply, 10); });
            })*/
            .then(function (response) {
                return response.json();
            })
            .then(function (json) {
                if (json.error) {
                    showMessage(json.error, 6);
                } else if (json.reply) {
                    showMessage(json.reply, 6);
                } else {
                    showMessage('Unexpected response', 10);
                }
            })
            .catch(function (ex) {
                showMessage(ex.message, 10);
            });
    };

    function displayTableBody(rowList, colList, updateable, tableId) {
        var i, j, k, l, row, cell, match, table, tableBody, cellText;

        table = document.getElementById(tableId);
        tableBody = table.getElementsByTagName('tbody')[0];

        //Remoce table rows which don't now exist
        for (i = tableBody.getElementsByTagName('tr').length - 1; i > -1; i--) {
            row = tableBody.rows[i];
            match = false;
            //errorList.every(checkErrorExists);
            for (j = rowList.length - 1; j > -1; j--) {
                if (rowList[j]._id === row.id) {
                    if (!updateable) {
                        rowList.splice(j, 1);
                    } else {
                        rowList.update = true;
                    }
                    match = true;
                    break;
                }
            }
            if (match === false) {
                tableBody.removeChild(row);
            }
        }

        // Update table cells which already exist but have changed
        if (updateable) {
            for (i = tableBody.getElementsByTagName('tr').length - 1; i > -1; i--) {
                row = tableBody.rows[i];
                for (j = 0; j < rowList.length; j++) {
                    if (rowList[j]._id === row.id) {
                        if (row.title !== JSON.stringify(rowList[j])) {
                            row.title = JSON.stringify(rowList[j]);
                        }
                        for (k = 0; k < row.cells.length; k++) {
                            if (colList[k].type === 'text') { /// only text type column will update
                                match = false;
                                for (l in rowList[j]) {
                                    if (rowList[j]._id + l === row.cells[k].id) {
                                        match = true;
                                        // check they match and update accordingly
                                        if (rowList[j][l].toString() !== row.cells[k].textContent) {

                                            row.cells[k].textContent = rowList[j][l];
                                        }
                                    }
                                }
                                if (!match) {
                                    row.cells[k].textContent = '';
                                }
                            }
                        }
                        rowList.splice(j, 1);
                    }
                }
            }
        }

        /// Add new rows
        var cellTextNode, col;
        rowList.forEach(function (roww) {
            row = tableBody.insertRow(0);
            row.id = roww._id;
            row.title = JSON.stringify(roww);
            for (i = 0; i < colList.length; i++) {
                col = colList[i];
                if (roww[col.name] === undefined) {
                    cellText = '';
                } else {
                    cellText = roww[col.name];
                }
                cell = row.insertCell(-1);
                cell.id = roww._id + col.name;
                if (col.type === 'text') {
                    cellTextNode = document.createTextNode(cellText);
                } else if (col.type === 'inputText') {
                    cellTextNode = document.createElement('input');
                    cellTextNode.type = 'text';
                    cellTextNode.name = col.name;
                    cellTextNode.value = cellText;
                    cellTextNode.className = 'formInput';
                } else if (col.type === 'inputCheckbox') {
                    cellTextNode = document.createElement('input');
                    cellTextNode.type = 'checkbox';
                    cellTextNode.name = col.name;
                    cellTextNode.checked = cellText;
                    cellTextNode.className = 'formInput';
                } else if (col.type === 'inputSave') {
                    cellTextNode = document.createElement('input');
                    cellTextNode.type = 'button';
                    cellTextNode.name = col.name;
                    cellTextNode.value = col.value;
                    if (col.handler) {
                        (function (colHandler, userId) {
                            cellTextNode.addEventListener('click', function (ev) { handlers[colHandler](ev, userId); });
                        })(col.handler, row.id);
                    }
                } else {
                    cellTextNode = document.createTextNode('ERROR :: ' + cellText);
                }
                cell.appendChild(cellTextNode);
            }
        });
        table.classList.remove('hide');
    }

    function displayTableHead(colList, tableId) {
        var i, table, tableHead, tableHeadRow, headCell, headCellText;

        table = document.getElementById(tableId);
        tableHead = table.getElementsByTagName('thead')[0];
        tableHead.classList.add('tableHead');
        /// clear out the old row(s)
        while (tableHead.firstChild) {
            tableHead.removeChild(tableHead.firstChild);
        }
        tableHeadRow = tableHead.insertRow(0);
        for (i = 0; i < colList.length; i++) {
            //console.log(errEl);
            headCell = tableHeadRow.insertCell(-1);
            headCellText = document.createTextNode(colList[i].value);
            headCell.appendChild(headCellText);
        }
    }

    function fetchy(url, callback) {
        window.fetch(url, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .then(function (response) {
                return response.json();
            })
            .then(callback)
            .catch(function (ex) {
                console.log(ex.message);
                if (ex.message === 'Failed to fetch') {
                    document.location.reload(false);
                }
            });
    }

    function viewerClick(e) {
        e.preventDefault();
        var extras = document.getElementById('extras'),
            targetId = e.target.id,
            search = document.getElementById('search').value,
            limit = document.getElementById('limit').value;
        if (search === undefined || search.length === 0) {
            search = '-';
        }
        while (extras.firstChild) {
            extras.removeChild(extras.firstChild);
        }

        fetchy('/toolbox/' + targetId + 'col', function (colList) {
            displayTableHead(colList, 'list');
            fetchy('/toolbox/' + targetId + '/' + limit + '/' + search, function (itemList) {
                displayTableBody(itemList, colList, true, 'list');
                clearInterval(listPollInterval);
                listPollInterval = setInterval(function () {
                    fetchy('/toolbox/' + targetId + '/' + limit + '/' + search, function (itemList) {
                        displayTableBody(itemList, colList, true, 'list');
                    });
                }, 5000);
            });
        });
    }

    function userViewerShow() {
        var search = document.getElementById('search').value,
            limit = document.getElementById('limit').value;
        if (search === undefined || search.length === 0) {
            search = '-';
        }
        fetchy('/toolbox/userviewercol', function (colList) {
            displayTableHead(colList, 'list');
            addUserForm(colList);
            fetchy('/toolbox/userviewer/' + limit + '/' + search, function (flickList) {
                displayTableBody(flickList, colList, true, 'list');
                clearInterval(listPollInterval);
                listPollInterval = setInterval(function () {
                    fetchy('/toolbox/userviewer/' + limit + '/' + search, function (flickList) {
                        displayTableBody(flickList, colList, true, 'list');
                    });
                }, 5000);
            });
        });
        function addUserForm(colList) {
            var i, col, cellTextNode, addButton, addContainer = document.getElementById('extras'), row = document.createElement('span');
            for (i = 0; i < colList.length; i++) {
                col = colList[i];
                if (col.type === 'inputText') {
                    cellTextNode = document.createElement('input');
                    cellTextNode.type = 'text';
                    cellTextNode.name = col.name;
                    cellTextNode.placeholder = col.value;
                } else if (col.type === 'inputCheckbox') {
                    cellTextNode = document.createElement('input');
                    cellTextNode.type = 'checkbox';
                    cellTextNode.name = col.name;
                }
                row.appendChild(cellTextNode);
            }
            addButton = document.createElement('input');
            addButton.type = 'button';
            addButton.value = 'Add';
            addButton.addEventListener('click', handlers.addUser);
            row.appendChild(addButton);
            while (addContainer.firstChild) {
                addContainer.removeChild(addContainer.firstChild);
            }
            addContainer.appendChild(row);
        }

    }
    function userViewerClick(e) {
        e.preventDefault();
        userViewerShow();
    }


    function limitChange() {
        clearInterval(listPollInterval);
        displayTableHead([], 'list');
        displayTableBody([], [], false, 'list');
    }

    function cookieCheck() {
        if (getCookie('cookeiConsent') === 'true') {
            document.getElementById('cookieBanner').className = 'hide';
        }
    }
    function cookieAccept() {
        document.getElementById('cookieBanner').className = 'hide';
        setCookie('cookeiConsent', 'true', 1);
    }

    function start() {
        var i, cookieApt, viewers = document.getElementsByClassName('viewers');
        for (i = 0; i < viewers.length; i++) {
            viewers[i].addEventListener('click', viewerClick);
        }
        document.getElementById('userviewer').addEventListener('click', userViewerClick);
        document.getElementById('limit').addEventListener('change', limitChange);
        cookieApt = document.getElementById('submitCookieAccept');
        if (cookieApt) {
            cookieApt.addEventListener('click', cookieAccept);
        }
        cookieCheck();
    }
/* When loading with Modernizr this isn't required
    if (document.addEventListener !== undefined) {
        document.addEventListener('DOMContentLoaded', function () {
            start();
        });
    } else {
        start();
    }*/
    start();
}());