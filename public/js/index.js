/** This is the master i-flicks object which controls uploads, playing and editing flicks
 */
window.iflicks = (function iflicks(settings) {
    'use strict';
    var vidTimeTicks = 0, intervalCheckEncoded, newFlickEvents, vjs, newFlickCount, previousDisplayedPage,
        currentFlickDetail, currentOrientation, user = {}, flickListMaster = [], messages = [], loadingImage = new Image();
    settings.flickListPageLength = settings.flickListPageLength || 10;
    loadingImage.src = '/img/loading.gif';
    currentOrientation = window.orientation;

   /* var console = {};
    console.log = function() {};*/

    user.options = {};

    function walkTheDom(node, f) {
        f(node);
        node = node.firstChild;
        while (node) {
            walkTheDom(node, f);
            node = node.nextSibling;
        }
    }
    var $ = {};
    function get(id) {
        return document.getElementById(id);
    }

    function addListener(element, eventType, track, callback) {
        if (typeof element === 'string') {
            element = document.getElementById(element);
        }
        if (element === null) { return; }
        if (element.addEventListener) {
            element.addEventListener(eventType, callback, false);
        } else if (element.attachEvent) {
            element.attachEvent('on' + eventType, callback);
        }
        if (track) {
            var elementType = element.type || 'button';
            addListener(element, eventType, false, function () {
                ga('send', 'event', elementType, eventType, 'nav-buttons');
            });
        }
    }

    /** Attempt to detect touch devices. This isn't 100% accurate but helps improve the experience. **/
    function isTouchDevice() {
        return ('ontouchstart' in window || navigator.MaxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
    }

    /** Send errors to the server */
    function sendError(message, location) {
        var error = {message: message, location: location};
        window.fetch('/error', {
            credentials: 'include',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(error)
        })
            .catch(function (ex) {
                console.log(ex);
            });
    }

    function showMessage(message, location, timeout) {
        var i, origTimeout, minTimeout = 90000000000000, frag, messageElement, messageElements, msg, br, err = {}; // minTimeout is an epoch date in 4821
        origTimeout = timeout;
        if (timeout === undefined) {
            timeout = 10;
        }
        if (typeof message === 'object' && message.message !== undefined) { /// an error object was passed in.
            message = message.message;
        }
        if (message !== undefined && window.console !== undefined) {
            window.console.log((new Date()).toUTCString() + ' :: ' + location + ' :: ' + message);
        }
        if (message !== undefined && message.indexOf('<') === 0 && message.length > 90) {
            message = 'Unexpected error from server.';
        }
        if (message) {
            timeout = Date.now() + (timeout * 1000);
            err.message = message;
            err.timeout = timeout;
            messages.push(err);
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
                if (err.timeout < minTimeout) {
                    minTimeout = err.timeout;
                }
            }
        });
        messageElements = document.getElementsByClassName('message');
        for (i = 0; i < messageElements.length; i++) {
            messageElement = messageElements.item(i);
            while (messageElement.hasChildNodes()) {
                messageElement.removeChild(messageElement.firstChild);
            }
            messageElement.appendChild(frag.cloneNode(true));
        }
       /* messageElement = document.getElementById('message');
        while (messageElement.hasChildNodes()) {
            messageElement.removeChild(messageElement.firstChild);
        }
        
        messageElement.appendChild(frag);
*/
        if (minTimeout < 90000000000000) {
            timeout = minTimeout - Date.now();
            setTimeout(function () { showMessage(); }, timeout);
        }
        // Hacky convention, even numbers get sent to the server, odd ones don't.
        if (message !== undefined && origTimeout % 2 === 0) {
            sendError(message, location);
        }
    }

    function getCookie(k) { return (document.cookie.match('(^|; )' + k + '=([^;]*)') || 0)[2]; }
    function setCookie(n, v, d) {
        var e, dd;
        if (d) {
            dd = new Date();
            dd.setTime(dd.getTime() + (d * 24 * 60 * 60 * 1000));
            e = '; expires=' + dd.toGMTString();
        } else { e = ""; }
        document.cookie = n + "=" + v + e + "; path=/";
    }

    function show(el) {
        if (typeof el === 'string') {
            el = document.getElementById(el);
        }
        el.classList.remove('hide');
    }
    function hide(el) {
        if (typeof el === 'string') {
            el = document.getElementById(el);
        }
        el.classList.add('hide');
    }

    /// Show the upload form
    function showHideElement1(elementName) {
        var el = document.getElementById(elementName);
        if (el.className.indexOf('hide') > -1) {
            el.classList.remove('hide');
        } else {
            el.classList.add('hide1');
            setTimeout(function () { el.classList.remove('hide1'); el.classList.add('hide'); }, 300);
        }
    }
    /// Show the upload form
    function showHideElement(elementName, height) {
        height = (height === undefined ? '200px' : height);
        var el = document.getElementById(elementName);
        if ((el.style.height === '0px' || el.style.height === '') && height !== 0 && height !== '0px') {
            el.style.height = height;
            el.style.opacity = 1;
            walkTheDom(el, function(el) { if (el.style) {el.style.opacity = 1;} });
        } else {
            el.style.height = '0px';
            el.style.opacity = 0;
            walkTheDom(el, function(el) { if (el.style) {el.style.opacity = 0;} });
        }
        /*
        if (el.classList.contains('hide')) {
            el.classList.add('show');
            el.classList.remove('hide');
        } else {
            el.classList.add('hide');
            el.classList.remove('show');
            //setTimeout(function () { el.classList.remove('hide1'); el.classList.add('hide'); }, 300);
        }*/
    }

    function setOption(option, value) {
        if (Object.getOwnPropertyNames(user).length < 2) { return; }
        var o = {};
        o[option] = value;
        window.fetch('/option', {
            credentials: 'include',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(o)
        })
            .catch(function (ex) {
                showMessage(ex, 'setOption', 6);
            });
    }

    function timeUpdate(flick, time) {
        vidTimeTicks++;
        if (user.id === undefined || vidTimeTicks % 10 !== 0) {
            return;
        }
        if (time > flick.fileDetail.duration - 5) {
            time = 0;
        }
        window.fetch('/timeupdate/' + flick.id + '/' + time, {
            credentials: 'include',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .catch(function (ex) {
                showMessage(ex, 'timeUpdate', 6);
            });
    }

    function getViewerDimensions(sourceWidth, sourceHeight) {
        var w, h, tmp, dims = {}, widthHeightRatio;
        widthHeightRatio = sourceWidth / sourceHeight;
        w = Math.max(document.documentElement.clientWidth/*, window.innerWidth*/ || 0);
        h = Math.max(document.documentElement.clientHeight/*, window.innerHeight*/ || 0);

        //showMessage(window.innerWidth, 'window.resize', 3);
        /*if (window.orientation === 90 || window.orientation === 270) {
            tmp = h;
            h = w;
            w = tmp;
        }*/
        dims.viewportWidth = w;
        dims.viewportHeight = h;
        if (h > w && w < 400) {
            //showMessage('a', 'dims', 3);
            dims.flickWidth = w;
            dims.flickHeight = dims.flickWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h > w && w >= 400 && w < 500) {
            //showMessage('b', 'dims', 3);
            dims.flickWidth = 400;
            dims.flickHeight = dims.flickWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h > w && w >= 500 && w < 800) {
            //showMessage('c', 'dims', 3);
            dims.flickWidth = 500;
            dims.flickHeight = dims.flickWidth / widthHeightRatio;
            dims.src = 'medium';
        } else if (h > w && w >= 800) {
            //showMessage('d', 'dims', 3);
            dims.flickWidth = 880;
            dims.flickHeight = dims.flickWidth / widthHeightRatio;
            dims.src = 'big';
        } else if (h <= w && w < 400) {
            //showMessage('e', 'dims', 3);
            dims.flickWidth = w;
            dims.flickHeight = dims.flickWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h <= w && w >= 400 && w < 500) {
            //showMessage('f', 'dims', 3);
            dims.flickWidth = 400;
            dims.flickHeight = dims.flickWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h <= w && w >= 500 && w < 900) {
            //showMessage('g', 'dims', 3);
            dims.flickWidth = 500;
            dims.flickHeight = dims.flickWidth / widthHeightRatio;
            dims.src = 'medium';
        } else if (h <= w && w >= 900) {
            //showMessage('h', 'dims', 3);
            dims.flickWidth = 880;
            dims.flickHeight = dims.flickWidth / widthHeightRatio;
            dims.src = 'big';
        } else {
            throw new Error('Unrecognised size');
        }
        return dims;
    }
    /** handler for the upload file. */
    function uploadFile() {
        var imgFileElement = document.getElementById('flickFile'),
            uploadContainer = document.getElementById('uploadContainer'),
            uploadProgress = document.getElementById('uploadProgress'),
            i,
            elList = [],
            imageData = new window.FormData();
        imageData.append(imgFileElement.name, imgFileElement.files[0]);
        walkTheDom(uploadContainer, function (node) {
            if (node.className && node.className.indexOf('uploadContainer') > -1) {
                elList.push(node);
            }
        });
        for (i = 0; i < elList.length; i++) {
            if (elList[i].name && elList[i].type === 'checkbox') {
                imageData.append(elList[i].name, elList[i].checked);
            } else if (elList[i].name) {
                imageData.append(elList[i].name, elList[i].value);
            }
        }

        uploadProgress.classList.remove('hide');
        uploadProgress.max = 1;
        var xhr = new XMLHttpRequest();
        addListener(xhr.upload, 'progress', false, function (ev) {
            uploadProgress.value = (ev.loaded / ev.total) ;
        });
        addListener(xhr, 'readystatechange', false, function (ev) {
            if (xhr.readyState == 4) {
                if (xhr.status === 202) {
                    document.getElementById('uploadForm').reset();
                    showMessage(xhr.responseText, 'uploadFile.msg', 5);
                    uploadProgress.classList.add('hide');
                } else {
                    showMessage(xhr.responseText, 'uploadFile.error', 6);
                    uploadProgress.classList.add('hide');
                }
            }
        });
        xhr.open('PUT', '/upload/aa', true);
        //xhr.setRequestHeader("X-FILENAME", file.name);
        xhr.send(imageData);


/*        window.fetch('/upload/aa', {
            method: 'PUT',
            credentials: 'include',
            body: imageData
        })
            .then(function (res) { return res.text(); })
            .then(function (txt) {
                if (txt.substring(0, 5) === 'Error') {
                    showMessage(txt, 'uploadFile.error', 7);
                } else {
                    document.getElementById('uploadForm').reset();
                    showMessage(txt, 'uploadFile.msg', 5);
                }
            })
            .catch(function (ex) { showMessage(ex, 'uploadFile', 10); });
    */
    }

    /// Handler for the then flicks are clicked
    function showFlick(vid) {
        var opts, i, flkDims, vidDetailElement, flickText, flickContainer, editData,
            vidPublicElement, vidPublicCheck, vidDirectLinkElement, vidDirectLinkCheck;
        document.getElementById('flickList').classList.add('hide');
        flickContainer = document.getElementById('flickContainer');

        flickContainer.classList.remove('hide');
        clearInterval(intervalCheckEncoded);

        function btnEditClick(ev) {
            var btn = ev.target;
            if (btn.value === 'Edit') {
                document.getElementById('flickName').contentEditable = true;
                document.getElementById('flickName').classList.add('editable');
                document.getElementById('flickDescription').contentEditable = true;
                document.getElementById('flickDescription').classList.add('editable');
                document.getElementById('flickTags').contentEditable = true;
                document.getElementById('flickTags').classList.add('editable');
                show(document.getElementById('flickTags'));
                document.getElementById('flickPublic').classList.add('editable');
                show(document.getElementById('flickPublic'));
                document.getElementById('flickDirectLink').classList.add('editable');
                show(document.getElementById('flickDirectLink'));
                btn.value = 'Save';
            } else {
                document.getElementById('flickName').contentEditable = false;
                document.getElementById('flickName').classList.remove('editable');
                document.getElementById('flickDescription').contentEditable = false;
                document.getElementById('flickDescription').classList.remove('editable');
                document.getElementById('flickTags').contentEditable = false;
                document.getElementById('flickTags').classList.remove('editable');
                hide(document.getElementById('flickTags'));
                document.getElementById('flickPublic').classList.remove('editable');
                hide(document.getElementById('flickPublic'));
                document.getElementById('flickDirectLink').classList.remove('editable');
                hide(document.getElementById('flickDirectLink'));
                editData = {
                    id: vid,
                    name: document.getElementById('flickName').textContent,
                    description: document.getElementById('flickDescription').textContent,
                    tags: document.getElementById('flickTags').textContent,
                    public: document.getElementById('flickPublicCheck').checked,
                    directLink: document.getElementById('flickDirectLinkCheck').checked
                };
                btn.value = 'Edit';
                window.fetch('/editflick', {
                    method: 'POST',
                    credentials: 'include',
                    body: JSON.stringify(editData),
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (json) {
                        if (json.All !== 'OK') {
                            showMessage(json.error, 'showFlick.btnEditClick.save', 10);
                        }
                    })
                    .catch(function (ex) {
                        console.log('Error');
                        showMessage(ex, 'showFlick.btnEditClick.save.1', 10);
                    });
            }
        }
        function btnEdit() {
            var btn = document.createElement('input');
            btn.type = 'button';
            btn.value = 'Edit';
            addListener(btn, 'click', true, btnEditClick);
            return btn;
        }

        function btnShowCopy() {
            var btn = document.createElement('input');
            btn.type = 'button';
            btn.value = 'Send';
            btn.id = 'btnShowCopy';
            addListener(btn, 'click', true, function (ev) {
                if (ev.target.value === 'Send') {
                    document.getElementById('copyFlickPanel').classList.remove('hide');
                }
            });
            return btn;
        }

        function copyFlickClick(ev) {
            var body = {};
            body.id = ev.target.id.split('_')[1];
            walkTheDom(ev.target.parentNode, function (node) {
                if (node.name && node.type === 'text') {
                    body[node.name] = node.value;
                }
            });

            window.fetch('/copy', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify(body),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    if (json.All !== 'OK') {
                        showMessage(json.error, 'showFlick.copyFlickClick', 10);
                    } else {
                        showMessage('Received at destination', 'showFlick.copyFlickClick', 5);
                        document.getElementById('copyFlickPanel').classList.add('hide');
                    }
                })
                .catch(function (ex) {
                    console.log('Error');
                    showMessage(ex, 'showFlick.copyFlickClick.1', 10);
                });
        }
        function copyFlick(vid) {
            var form, btn, dest, uname, pwd;
            btn = document.createElement('input');
            btn.type = 'button';
            btn.value = 'Send';
            btn.id = 'copyFlick_' + vid;
            addListener(btn, 'click', true, copyFlickClick);

            dest = document.createElement('input');
            dest.type = 'text';
            dest.name = 'destination';
            dest.placeholder = 'Destination server';

            uname = document.createElement('input');
            uname.type = 'text';
            uname.name = 'username';
            uname.placeholder = 'Destination username';

            pwd = document.createElement('input');
            pwd.type = 'text';
            pwd.name = 'password';
            pwd.placeholder = 'Destination password';

            form = document.createElement('div');
            form.className = 'hide';
            form.id = 'copyFlickPanel';
            form.appendChild(dest);
            form.appendChild(uname);
            form.appendChild(pwd);
            form.appendChild(btn);

            return form;
        }

        function btnShowPermissions() {
            var btn = document.createElement('input');
            btn.type = 'button';
            btn.value = 'Permissions';
            btn.id = 'btnShowPermissions';
            addListener(btn, 'click', true, function (ev) {
                if (ev.target.value === 'Permissions') {
                    document.getElementById('permissionsPanel').classList.remove('hide');
                }
            });
            return btn;
        }
        function permissionsAddClick(ev) {
            var body = {};
            body.id = ev.target.id.split('_')[1];
            body.searchTerm = permissionPanelInput.value;
            window.fetch('/flickuser', {
                method: 'PUT',
                credentials: 'include',
                body: JSON.stringify(body),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    if (json.All !== 'OK') {
                        showMessage(json.error, 'showFlick.permissionsAddClick', 10);
                    } else {
                        showMessage('Received at destination', 'showFlick.permissionsAddClick', 5);
                        document.getElementById('permissionsPanel').classList.add('hide');
                    }
                })
                .catch(function (ex) {
                    console.log('Error');
                    showMessage(ex, 'showFlick.permissionsAddClick.1', 10);
                });
        }
        function permissionsPanel(vid) {
            var form, btn, dest, uname, pwd;
            btn = document.createElement('input');
            btn.type = 'button';
            btn.value = 'Send';
            btn.id = 'permissions_' + vid;
            addListener(btn, 'click', true, permissionsAddClick);

            dest = document.createElement('input');
            dest.type = 'text';
            dest.name = 'user';
            dest.id = 'permissionPanelInput';
            dest.placeholder = 'Users';

            form = document.createElement('div');
            form.className = 'hide';
            form.id = 'permissionsPanel';
            form.appendChild(dest);
            form.appendChild(btn);

            return form;
        }
        function permissionsItem(userId, email, username) {
            var form, btn, dest, uname, pwd;
            btn = document.createElement('input');
            btn.type = 'button';
            btn.value = 'Send';
            btn.id = 'permissions_' + vid;
            addListener(btn, 'click', true, permissionsSaveClick);

            dest = document.createElement('input');
            dest.type = 'text';
            dest.name = 'users';
            dest.placeholder = 'Users';

            form = document.createElement('div');
            form.className = 'hide';
            form.id = 'permissionsPanel';
            form.appendChild(dest);
            form.appendChild(btn);

            return form;
        }



        function rating(flickId, currentValue) {
            var star, ratingPanel = document.createElement('div'),
                container = document.createElement('div');
            container.className = 'ratingContainer';
            ratingPanel.className = 'rating';
            for (i = 5; i > 0; i--) {
                star = document.createElement('i');
                if (currentValue >= i) {
                    star.className = 'fa fa-star';
                } else if (currentValue < i && currentValue > (i - 1)) {
                    star.className = 'fa fa-star-half-o ';
                } else {
                    star.className = 'fa fa-star-o';
                }
                star.id = "rating_" + i;
                ratingPanel.appendChild(star);
            }
            container.appendChild(ratingPanel);

            addListener(container, 'click', true, function (ev) {
                var newRating = ev.target.id.split('_')[1];
                window.fetch('/rating/' + flickId + '/' + newRating, {
                    credentials: 'include',
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (json) {
                        if (json.All !== 'OK') {
                            showMessage(json.error, 'showFlick.rating.save', 7);
                        }
                        var tmpNode = ev.target.parentNode.parentNode.parentNode;
                        tmpNode.removeChild(ev.target.parentNode.parentNode);
                        tmpNode.appendChild(rating(flickId, newRating));
                    })
                    .catch(function (ex) {
                        showMessage(ex, 'timeUpdate', 6);
                    });
            });

            return container;
        }

        function setFlickDetail() {
            if (currentFlickDetail.fileDetail && currentFlickDetail.fileDetail.width) {
                flkDims = getViewerDimensions(currentFlickDetail.fileDetail.width, currentFlickDetail.fileDetail.height);
            } else {
                flkDims = getViewerDimensions(800, 600);
            }
            flickContainer.innerHTML = '<video id="flick" poster="/thumb/' + vid + '/' + flkDims.src + '" data-setup="{}"  class="video-js vjs-default-skin" >' +
                    '<source src="/flick/' + vid + '/' + flkDims.src + '.mp4?r=' + (new Date()).getTime() + '" type="video/mp4"></source>' +
                    '<source src="/flick/' + vid + '/' + flkDims.src + '.webm?r=' + (new Date()).getTime() + '" type="video/webm"></source>' +
                    '<source src="/flick/' + vid + '/' + flkDims.src + '.ogv?r=' + (new Date()).getTime() + '" type="video/ogg"></source>' +
                    '</video>' +
                    '<div ></div>';
            opts = {
                'controls': true,
                'autoplay': false,
                'preload': 'auto',
                'width': flkDims.flickWidth,
                'height': flkDims.flickHeight
            };
            vjs = videojs(document.getElementById('flick'), opts, function () { });
            if (currentFlickDetail.currentTime) {
                vjs.currentTime(currentFlickDetail.currentTime);
            }
            vjs.on('error', function (err) { showMessage(err.message, 'showFlick.setFlickDetail.vjs.error', 10); });
            vjs.one('play', function () {
                window.fetch('/playFlick/' + vid, {
                    credentials: 'include',
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                })
                    .then(function (response) {
                        return response.json();
                    });
            });
            vjs.on('volumechange', function (ev) { user.options.volume = ev.target.volume; setOption('volume', ev.target.volume); });
            vjs.on('timeupdate', function () { timeUpdate(currentFlickDetail, vjs.currentTime()); });

            if (user.options && user.options.volume) {
                //vjs.volume(user.options.volume);
            }

            flickText = document.createElement('div');
            flickText.id = 'flickInfo';
            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'flickName';
            vidDetailElement.className = 'flickTextItem';
            vidDetailElement.title = 'Flick name';
            vidDetailElement.textContent = currentFlickDetail.name;
            flickText.appendChild(vidDetailElement);

            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'flickDescription';
            vidDetailElement.className = 'flickTextItem';
            vidDetailElement.title = 'Flick description';
            vidDetailElement.textContent = currentFlickDetail.description;
            flickText.appendChild(vidDetailElement);

            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'flickTags';
            vidDetailElement.className = 'flickTextItem';
            vidDetailElement.title = 'Flick tags';
            vidDetailElement.textContent = currentFlickDetail.tags;
            hide(vidDetailElement);
            flickText.appendChild(vidDetailElement);

            vidPublicElement = document.createElement('div');
            vidPublicElement.id = 'flickPublic';
            vidPublicElement.className = 'flickTextItem';
            vidPublicElement.textContent = 'Public';
            vidPublicCheck = document.createElement('input');
            vidPublicCheck.id = 'flickPublicCheck';
            vidPublicCheck.type = 'checkbox';
            vidPublicCheck.name = 'public';
            vidPublicCheck.checked = currentFlickDetail.isPublic;
            hide(vidPublicElement);
            vidPublicElement.appendChild(vidPublicCheck);
            flickText.appendChild(vidPublicElement);

            vidDirectLinkElement = document.createElement('div');
            vidDirectLinkElement.id = 'flickDirectLink';
            vidDirectLinkElement.className = 'flickTextItem';
            vidDirectLinkElement.textContent = 'Allow direct link';
            vidDirectLinkCheck = document.createElement('input');
            vidDirectLinkCheck.id = 'flickDirectLinkCheck';
            vidDirectLinkCheck.type = 'checkbox';
            vidDirectLinkCheck.name = 'directLink';
            vidDirectLinkCheck.checked = currentFlickDetail.isDirectLinkable;
            hide(vidDirectLinkElement);
            vidDirectLinkElement.appendChild(vidDirectLinkCheck);
            flickText.appendChild(vidDirectLinkElement);

            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'flickRunCount';
            vidDetailElement.className = 'flickTextItem';
            vidDetailElement.textContent = 'Played ' + (currentFlickDetail.playCount || 0) + ' time' + (currentFlickDetail.playCount === 1 ? '' : 's');
            flickText.appendChild(vidDetailElement);

            if (user.id !== undefined && (currentFlickDetail.userId === user.id || user.isSysAdmin === true)) {
                flickText.appendChild(btnEdit());
                flickText.appendChild(btnShowPermissions());
                flickText.appendChild(btnShowCopy());

            }
            //console.log(currentFlickDetail);
            flickText.appendChild(rating(vid, currentFlickDetail.rating));
            flickText.appendChild(permissionsPanel(vid));
            flickText.appendChild(copyFlick(vid));
            flickContainer.appendChild(flickText);
        }

        for (i = 0; i < flickListMaster.length; i++) {
            if (flickListMaster[i].id === vid) {
                currentFlickDetail = flickListMaster[i];
                break;
            }
        }

        if (currentFlickDetail) {
            setFlickDetail();
        } else {
            window.fetch('/flickdetail/' + vid, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    if (json.error) {
                        showMessage(json.error, 'showFlick.fetchFlickDetail', 10);
                    } else {
                        currentFlickDetail = json;
                        setFlickDetail();
                    }
                })
                .catch(function (ex) {
                    console.log('Error');
                    showMessage(ex.message, 'showFlick.fetchFlickDetail1', 10);
                });
        }
    }

    function showFlickOnLoad(vid) {

        window.history.replaceState({method: 'showFlick', vid: vid}, 'Play flick', window.location.href );
        showFlick(vid);
    }
                

    /// Print the flick list tothe browser.
    function listFlicksShow(vids) {
        //console.log(list);
        var j, list, flickList, vidFrag, vidContent, vidName, vidNameText,  vidDelete;
        list = vids.data;
        flickList = document.getElementById('flickList');
        while (flickList.firstChild) {
            flickList.removeChild(flickList.firstChild);
        }
        if (list === undefined) { return; }
        vidFrag = document.createDocumentFragment();
        list.forEach(function (vid, i) {
            var vidContainer, vidThumbContainer, vidThumb, vidLoadingThumb, vidFooter, vidDescription, pressTimer;
            vidContainer = document.createElement('div');
            var vidContainerText = document.createTextNode(' ');
            vidContent = document.createElement('div');
            vidLoadingThumb = document.createElement('i');
            vidThumbContainer = document.createElement('div');
            vidThumb = document.createElement('img');
            vidName = document.createElement('span');
            vidFooter = document.createElement('div');
            vidNameText = document.createTextNode(vid.name);
            vidDescription = document.createElement('span');
            //vidDescriptionText = document.createTextNode('');
            vidDescription.innerHTML = vid.description;
            vidDelete = document.createElement('i');
            //vidDeleteText = document.createTextNode('X');

            vidContainer.className = 'vidContainer';
            vidContent.className = 'vidContent';
            //vidLoadingThumb.className = 'vidLoadingThumb';
            vidLoadingThumb.className = 'vidLoadingThumb fa fa-spinner fa-pulse fa-5x';
            vidThumbContainer.className = 'vidThumbContainer hide1';
            vidThumb.className = 'vidThumb';
            vidFooter.className = 'vidFooter';
            vidName.className = 'vidName';
            vidDelete.className = 'fa fa-trash-o vidDelete';
            //vidLoadingThumb.src = loadingImage.src;
            vidThumb.src = '/thumb/' + vid.id + '/thumb';
            addListener(vidThumb, 'error', false, function () { vidThumb.src = '/img/missing.png'; });
            addListener(vidThumb, 'load', false, function () {
            //vidThumb.addEventListener('load', 
                // Unhide the loaded image (slowly) and then remove the placeholder.
                vidThumbContainer.classList.remove('hide1');
                vidThumbContainer.parentNode.removeChild(vidThumbContainer.parentNode.children[0]);
            });

            vidDescription.className = 'vidDescription';

            vidName.appendChild(vidNameText);
            vidContent.appendChild(vidLoadingThumb);
            vidThumbContainer.appendChild(vidThumb);
            vidContent.appendChild(vidThumbContainer);
            vidFooter.appendChild(vidName);
            vidContent.appendChild(vidFooter);
           // vidDescription.appendChild(vidDescriptionText);

            vidContainer.appendChild(vidContainerText);
            vidContainer.appendChild(vidContent);
            vidContainer.appendChild(vidDescription);

            //vidDelete.appendChild(vidDeleteText);
            if (vid.userId === user.id || user.isSysAdmin === true) {
                vidContainer.appendChild(vidDelete);

            }
            vidFrag.appendChild(vidContainer);

            function vidContainerClick() {
                var vidName, currentState = window.history.state || {};
                vidName = vid.name || '-';
                vidName = vidName.replace(' ', '_');
                currentState.method = 'listFlicks';
                currentState.scrollTop = document.body.scrollTop;
                currentState.page = vids.page;
                currentState.limit = vids.limit;
                currentState.search = vids.search;
                window.history.replaceState(currentState, 'List flick', '');
                window.history.pushState({method: 'showFlick', vid: vid.id}, 'Show flick', '/' + vidName + '/' + vid.id);
                showFlick(vid.id);
            }
            if (vid.isEncoded === true) {
                /*addListener(vidContainer, 'click', true, 
                //vidContainer.onclick = 
                    function () {
                        var currentState = window.history.state || {};
                        currentState.method = 'listFlicks';
                        currentState.scrollTop = document.body.scrollTop;
                        currentState.page = vid.page;
                        currentState.limit = vid.limit;
                        currentState.search = vid.search;
                        window.history.replaceState(currentState, 'List flick', '');
                        window.history.pushState({method: 'showFlick', vid: vid._id}, 'Play flick', '/' + vid._id);
                        showFlick(vid._id);
                });*/
                var longPress;
                addListener(vidContainer, 'mousedown', true, function (ev) {
                    longPress = undefined;
                    pressTimer = setTimeout(function () {
                        longPress = ev.target;
                        //console.log(ev.target);
                        longPress.classList.add('hide1');
                    }, 500);
                });
                addListener(vidContainer, 'mouseout', false, function () {
                    clearTimeout(pressTimer);
                    if (longPress) {
                        longPress.classList.remove('hide1');
                    }
                });
                addListener(vidContainer, 'mouseup', true, function (ev) {
                    clearTimeout(pressTimer);
                    if (longPress) {
                        longPress.classList.remove('hide1');
                    }
                    if (longPress === undefined && ev.button === 0) { vidContainerClick(); }
                });
            }
            addListener(vidDelete, 'mouseup', true,
            //vidDelete.onclick = 
                function (e) {
                    clearTimeout(pressTimer);
                    deleteFlick(vid.id);
                    flickList.removeChild(vidContainer);
                    for (j = 0; j < flickListMaster.length; j++) {
                        if (flickListMaster[j].id === vid.id) {
                            flickListMaster.splice(j, 1);
                            break;
                        }
                    }
                    e.stopPropagation();
                });

            if (i % 10 === 0) {
                flickList.appendChild(vidFrag);
                vidFrag = document.createDocumentFragment();
            }
        });
        flickList.appendChild(vidFrag);

        var nextPrev, nextPage, prevPage;
        nextPrev = document.createElement('div');
        nextPage = document.createElement('span');
        prevPage = document.createElement('span');
        nextPage.textContent = 'Next';
        prevPage.textContent = 'Previous';
        nextPrev.id = 'nextPrev';
        nextPage.className = 'nextPrev';
        prevPage.className = 'nextPrev';
        addListener(nextPage, 'click', true, function () {vids.page++; listFlicks(vids.page , vids.limit, vids.search); });
        addListener(prevPage, 'click', true, function () {vids.page--; listFlicks(vids.page, vids.limit, vids.search); });

        if (vids.page > 0) {
            nextPrev.appendChild(prevPage);
        }
        if (vids.count > ((vids.page + 1) * vids.limit)) {
            nextPrev.appendChild(nextPage);
        }
        flickList.appendChild(nextPrev);
    }

    /// Get flicks from the server and display them
    function listFlicks(page, limit, search) {
        var i, flick, flickList, flickContainer, newFlickPopup;
        page = page || 0;
        limit = limit || 10;
        search = search || '-';
        newFlickCount = 0;
        currentFlickDetail = undefined;
        flickList = document.getElementById('flickList');
        flickList.classList.remove('hide');
        document.getElementById('flickListUnencoded').classList.add('hide');
        flickContainer = document.getElementById('flickContainer');
        flickContainer.classList.add('hide');
        while (flickContainer.firstChild) {
            flickContainer.removeChild(flickContainer.firstChild);
        }
        flick = document.getElementById('flick');
        if (flick !== null) {
            videojs(flick).dispose();
        }
        newFlickPopup = document.getElementsByClassName('newFlickPopup');
        for (i = 0; i < newFlickPopup.length; i++) {
            newFlickPopup[i].parentNode.removeChild(newFlickPopup[i]);
        }

        clearInterval(intervalCheckEncoded);
        /// If we have already loaded the data from the server then reuse it.
        if (flickListMaster.length > 0) {
            /// If the master list and the number of elements don't match then start again
            if (flickList.children.length !== flickListMaster.length) {
                listFlicksShow(flickListMaster);
            }
        } else {
            window.fetch('/flicklist/' + page + '/' + limit + '/' + search, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    if (json.error !== undefined) {
                        showMessage(json.error, 'listUnencoded.fetchFlickList', 6);
                    } else if (Array.isArray(json.data)) {
                        flickListMaster = json;
                        listFlicksShow(flickListMaster);
                    } else {
                        showMessage('Non array type returned.', 'listtFlicks.fetchFlickList', 6);
                    }
                })
                .catch(function (ex) {
                    showMessage(ex, 'listtFlicks.fetchFlickList1', 10);
                });
        }
    }

    function watchForNewFlicks() {
        /// Check the browser supports EventSource.  If it's IE then the user has to refresh manually.
        if (window.EventSource !== undefined) {
            newFlickEvents = new window.EventSource('/newflick');
            addListener(newFlickEvents, 'newFlick', false, function () {
            //newFlickEvents.addEventListener('newFlick',  function () {
                var pop = document.createElement('div');
                newFlickCount++;
                pop.className = 'newFlickPopup';
                pop.innerHTML = '<p>There are ' + newFlickCount + ' new flicks</p>';

                addListener(pop, 'click', true, function () {
                //pop.addEventListener('click', function () {
                    window.history.pushState({method: 'listFlicks'}, 'List flick', '/');
                    listFlicks(0, settings.flickListPageLength);
                });

                document.body.appendChild(pop);
                setTimeout(function () { pop.parentNode.removeChild(pop); }, 6000);
            });
        }
    }

    /// Get flicks from the server and display them
    function listUnencoded(page, limit) {
        var flick, flickList, flickContainer;
        currentFlickDetail = undefined;
        flickList = document.getElementById('flickList');
        flickList.classList.remove('hide');
        document.getElementById('flickListUnencoded').classList.add('hide');
        flickContainer = document.getElementById('flickContainer');
        flickContainer.classList.add('hide');
        while (flickContainer.firstChild) {
            flickContainer.removeChild(flickContainer.firstChild);
        }

        flick = document.getElementById('flick');
        if (flick !== null) {
            videojs(flick).dispose();
        }
        function getUnencoded() {
            window.fetch('/flicklistunencoded/' + page + '/' + limit, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    if (json.error !== undefined) {
                        showMessage(json.error, 'listUnencoded.getUnencoded', 6);
                    } else if (Array.isArray(json.data)) {
                        listFlicksShow(json);
                    } else {
                        showMessage('Non array type returned.', 'listUnencoded.getUnencoded', 6);
                    }
                })
                .catch(function (ex) {
                    showMessage(ex, 'listUnencoded.getUnencoded1', 6);
                });
        }
        getUnencoded();
        clearInterval(intervalCheckEncoded);
        intervalCheckEncoded = setInterval(getUnencoded, 5000);
    }

    function deleteFlick(vid) {
        window.fetch('/flick/' + vid, {
            credentials: 'include',
            method: 'DELETE'
        })
            .catch(function (ex) {
                showMessage(ex, 'deleteFlick.fetch', 6);
            });
    }

    function unDeleteFlick(vid) {
        window.fetch('/undelete/' + vid, {
            credentials: 'include',
            method: 'POST'
        })
            .catch(function (ex) {
                showMessage(ex, 'undeleteFlick.fetch', 6);
            });
    }

    function addUserHandler(ev) {
        var i, el, readyToSend = true, newUser = {};
        for (i = 0; i < ev.target.parentNode.childNodes.length; i++) {
            el = ev.target.parentNode.childNodes[i];
            if (el.type === 'text') {
                newUser[el.name] = el.value;
                if (el.value.length < 2) {
                    readyToSend = false;
                    showMessage(el.name + ' is required.', 'addUserHandler', 5);
                }
                if (el.name === 'emailAddress' && /\S+@\S+\.\S+/.test(el.value) === false) {
                    readyToSend = false;
                    showMessage('Email should be an email address.', 'addUserHandler', 5);
                }
            } else if (el.type === 'checkbox') {
                newUser[el.name] = el.checked;
            } else if (el.type === 'password') {
                newUser.password = el.value;
                if (el.value.length < 6) {
                    readyToSend = false;
                    showMessage('Password must me 6 characters or more.', 'addUserHandler', 5);
                }
            }
        }
        if (!readyToSend) { return; }
        window.fetch('/user', {
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
                    showMessage(json.error, 'addUserHandler.fetchUser', 6);
                } else if (json.reply) {
                    showMessage(json.reply, 'addUserHandler.fetchUser1', 7);
                    showHideElement('createAccountContainer', 0);
                    document.getElementById('username').value = newUser.username;
                } else {
                    showMessage('Unexpected response', 'addUserHandler.fetchUser2', 10);
                }
            })
            .catch(function (ex) {
                showMessage(ex.message, 'addUserHandler.fetchUser3', 10);
            });
    }

    function showUploadContainer() {
        showHideElement('uploadContainer');
    }

    /// Show the create account form
    function showCreateAccount() {
        showHideElement('createAccountContainer');
    }
    function previewFile() {
        // Works but hits processor and so UI.
        //var thumbVidSrc = document.getElementById('thumbVidSrc');
        var thumbVid = document.getElementById('thumbVid');

        var thumbVidCanvas = document.getElementById('thumbVidCanvas');
        var file    = document.getElementById('flickFile').files[0];
        var reader  = new FileReader();

        reader.onloadend = function () {
            thumbVid.src = reader.result;
        };
        thumbVid.oncanplay = function () {
            thumbVidCanvas.getContext('2d').drawImage(thumbVid, 0, 0, thumbVid.width, thumbVid.height);
        };

        if (file) {
            reader.readAsDataURL(file);
        } else {
            thumbVid.src = '';
        }
    }

    function cookieCheck() {
        if (getCookie('cookieConsent') === 'true' && document.getElementById('cookieBanner') !== null) {
            document.getElementById('cookieBanner').className = 'hide';
        }
    }
    function cookieAccept() {
        document.getElementById('cookieBanner').className = 'hide';
        setCookie('cookieConsent', 'true', 365);
    }

    function closeInfoPanel() {
        document.getElementById('infoContainer').className = 'hide';
        setCookie('closeInfoPanel', 'true', 365);
    }
    /// signin
    function postSignin() {
        if (Object.getOwnPropertyNames(user).length > 0) {
            if (!user.options) { user.options = {}; }
            if (user.options.volume && vjs) {
                vjs.volume(user.options.volume);
            }

            showHideElement('createAccountContainer', 0);
            document.getElementById('loggedinContainer').style.display = 'inline-block';
            document.getElementById('signinContainer').style.display = 'none';
            document.getElementById('headerBarUserName').textContent  = 'Hello ' + user.givenName;
            if (user.gravatarUrl) {
                document.getElementById('headerBarAvatar').src  = user.gravatarUrl;
            }
            
            document.getElementById('message').textContent  = '';
            listFlicksShow(flickListMaster);
            /// Dopn't show the upload button in <=IE9
            if (window.FormData === undefined) {
                document.getElementById('showUploadContainer').style.display = 'none';
            }
            if (user.isConfirmed !== true) {
                document.getElementById('showUploadContainer').style.display = 'none';
            }
            
        }
    }
    function signin() {
        window.fetch('/signin', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            })
        })
            .then(function (response) {
                //if (response.status === 401) { return {}; }
                return response.json();
            })
            .then(function (json) {
                if (json.error) {
                    showMessage(json.error, 'signin.fetchSignin', 7);
                } else {
                    //(Object.getOwnPropertyNames(json).length > 0) {
                    user = json;
                    postSignin();
                }
            })
            .catch(function (ex) {
                showMessage(ex, 'signin.fetchSignin1',  6);
            });
    }
    function signinCheck() {
        window.fetch('/signin', {
            method: 'GET',
            credentials: 'include', // or same-origin
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .then(function (response) {
                if (response.status !== 200) { return {}; }
                return response.json();
            })
            .then(function (json) {
                if (Object.getOwnPropertyNames(json).length > 0) {
                    user = json;
                    postSignin();
                }
            })
            .catch(function (ex) {
                showMessage(ex, 'signinCheck.fetchsignin',  6);
                //document.getElementById('message').textContent = ex;
            });
    }

    function signout() {
        user = {};
        document.getElementById('loggedinContainer').style.display = 'none';
        document.getElementById('signinContainer').style.display = 'inline-block';
        document.getElementById('showUploadContainer').style.display = 'inline-block';
        document.getElementById('message').textContent  = '';
        document.getElementById('headerBarUserName').textContent  = '';

        window.fetch('/signin', {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .catch(function (ex) {
                showMessage(ex, 'signout.fetchsignin',  6);
            });
    }

    /** Rudimentary speed test */
    function downloadSpeedTest() {
        var startTime, endTime, duration, bitsLoaded = 3422856, speed, download = new Image();
        download.onload = function () {
            endTime = (new Date()).getTime();
            duration = (endTime - startTime) / 1000;
            speed = bitsLoaded / duration / 1024 / 1024;
            if (speed < 1) {
                speed = (speed * 1.8).toFixed(2);  // Seems to be out by just under half
                showMessage('The internet speed between you and us is slow (' + speed + ' Mbps) so these flicks may not play smoothly.', 'downloadSpeedTest', 7);
            }
        };
        startTime = (new Date()).getTime();
        download.src = '/img/random.jpg?n=' + startTime;
    }

    /// Check to see if the browser supports HTML5 vieo, returns boolean
    function supportsFlick() {
        return !!document.createElement('flick').canPlayType;
    }
    /// Checks the browser is suported and then runs the callback.
    function checkFeatures(callback) {
        /*if (window.FormData === undefined || supportsFlick() !== true) {
            document.getElementById('body').innerHTML = '<p>Your browser is not supported.  i-flicks is supported by all modern browsers.  It doesn\'t work on old versions of Internet Explorer or old mobile browsers.</p>';
            return;
        }*/

        /// IE9 check. It just crashes badly in IE8 and below.
        if (window.FormData === undefined) {
            var d = document.createElement('div');
            d.style.position = 'fixed';
            d.style.top = '0px';
            d.style.width = '100%';
            d.style.backgroundColor = '#FFFF99';
            d.innerText = 'Some features will not work in your browser version. i-flicks works in all modern browsers.  '+
                'It doesn\'t work on old versions of Internet Explorer or very old mobile browsers.';

            document.getElementById('body').appendChild(d);
        }
        callback();
    }

    function searchSubmit (ev) {
        if (ev) { ev.preventDefault(); }
        var searchTerm = document.getElementById('search').value.trim();
        if (searchTerm === undefined || searchTerm === null || searchTerm.length === 0) {return;}
        window.history.pushState({method: 'listFlicks', search: searchTerm}, 'Search flick', '/');
        listFlicks(0, settings.flickListPageLength, searchTerm);
    }

    /// Setup the page.  Checks the browser is supported and then loads the page.
    function start() {
        checkFeatures(function () {
            addListener('submitUploadNewFlick', 'click', true, uploadFile);
            addListener('submitSignin', 'click', true, signin);
            addListener('submitSignout', 'click', true, signout);
            addListener('submitSearch', 'click', true, searchSubmit);
            addListener('search', 'keydown', false, function (ev) {
                if (!ev) { ev = window.event; }
                // Enter is pressed
                if (ev.keyCode == 13) { searchSubmit (); }
            });

            addListener('closeInfoPanel', 'click', true, closeInfoPanel);
            addListener('submitCookieAccept', 'click', true, cookieAccept);
            addListener('showUploadContainer', 'click', true, showUploadContainer);
            addListener('showCreateAccount', 'click', true, showCreateAccount);
            addListener('submitCreateAccount', 'click', true, addUserHandler);
            addListener('showFlickList', 'click', true, function () {
                window.history.pushState({method: 'listFlicks'}, 'List flick', '/');
                listFlicks(0, settings.flickListPageLength);
            });
            addListener('showUnencodedFlickList', 'click', true, function () {
                window.history.pushState({method: 'listUnencoded'}, 'List unencoded flicks', '/');
                listUnencoded(0, settings.flickListPageLength);
            });
            /// forward and back button handler.
            addListener(window, 'popstate', true, function (event) {
                //console.log(event.state);
                if (event.state.method === 'showFlick') {
                    showFlick(event.state.vid);
                } else if (event.state.method === 'listFlicks') {
                    listFlicks(event.state.page, event.state.limit, event.state.search);
                    if (event.state.scrollTop !== undefined && event.state.scrollTop > 0) {
                        window.scroll(event.state.scrollTop, 0);
                    }
                } else if (event.state.method === 'search') {
                    listFlicks(event.state.page, event.state.limit, event.state.search);
                    if (event.state.scrollTop !== undefined && event.state.scrollTop > 0) {
                        window.scroll(event.state.scrollTop, 0);
                    }
                }
            });
            /// handle rotation on mobile devices
            addListener(window, 'resize', true, function () {
                var flkDims, currentTime, isPaused;
                if (currentFlickDetail !== undefined && currentFlickDetail.fileDetail && currentFlickDetail.fileDetail.width && currentOrientation !== window.orientation) {
                    currentOrientation = window.orientation;
                    flkDims = getViewerDimensions(currentFlickDetail.fileDetail.width, currentFlickDetail.fileDetail.height);
                    currentTime = vjs.currentTime();
                    isPaused = vjs.paused();
                    vjs.dimensions(flkDims.flickWidth, flkDims.flickHeight);
                    vjs.src([{type: 'flick/mp4', src: '/flick/' + currentFlickDetail.id + '/' + flkDims.src + '.mp4?r=' + (new Date()).getTime() },
                            {type: 'flick/webm', src: '/flick/' + currentFlickDetail.id + '/' + flkDims.src + '.webm?r=' + (new Date()).getTime() }
                        ]);
                    vjs.currentTime(currentTime);
                    if (!isPaused) {
                        vjs.play();
                    }
                }
            });
            signinCheck();
            watchForNewFlicks();
            listFlicks(0, settings.flickListPageLength);
            // no need for testing.  
            // downloadSpeedTest();
        });
        cookieCheck();
    }
    /*if (document.addEventListener !== undefined) {
        document.addEventListener('DOMContentLoaded', function () {
            start();
        });
    } else {
        start();
    }*/
    start();

    return {
        showFlickOnLoad: showFlickOnLoad
    };
}({}));