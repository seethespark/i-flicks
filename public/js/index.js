/** This is the master i-flicks object which controls uploads, playing and editing videos
 */
window.iflicks = (function iflicks(settings) {
    'use strict';
    var vidTimeTicks = 0, intervalCheckEncoded, newVideoEvents, vjs, newVideoCount, previousDisplayedPage,
        currentVideoDetail, currentOrientation, user = {}, videoListMaster = [], messages = [], loadingImage = new Image();
    settings.videoListPageLength = settings.videoListPageLength || 10;
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
        el.classList.remove('hide');
    }
    function hide(el) {
        el.classList.add('hide');
    }

        /// Show the upload form
    function showHideElement(elementName) {
        var el = document.getElementById(elementName);
        if (el.className.indexOf('hide') > -1) {
            el.classList.remove('hide');
        } else {
            el.classList.add('hide1');
            setTimeout(function () { el.classList.remove('hide1'); el.classList.add('hide'); }, 300);
        }
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

    function timeUpdate(video, time) {
        vidTimeTicks++;
        if (user.id === undefined || vidTimeTicks % 10 !== 0) {
            return;
        }
        if (time > video.fileDetail.duration - 5) {
            time = 0;
        }
        window.fetch('/timeupdate/' + video._id + '/' + time, {
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
            dims.videoWidth = w;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h > w && w >= 400 && w < 500) {
            //showMessage('b', 'dims', 3);
            dims.videoWidth = 400;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h > w && w >= 500 && w < 800) {
            //showMessage('c', 'dims', 3);
            dims.videoWidth = 500;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'medium';
        } else if (h > w && w >= 800) {
            //showMessage('d', 'dims', 3);
            dims.videoWidth = 880;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'big';
        } else if (h <= w && w < 400) {
            //showMessage('e', 'dims', 3);
            dims.videoWidth = w;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h <= w && w >= 400 && w < 500) {
            //showMessage('f', 'dims', 3);
            dims.videoWidth = 400;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h <= w && w >= 500 && w < 900) {
            //showMessage('g', 'dims', 3);
            dims.videoWidth = 500;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'medium';
        } else if (h <= w && w >= 900) {
            //showMessage('h', 'dims', 3);
            dims.videoWidth = 880;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'big';
        } else {
            throw new Error('Unrecognised size');
        }
        return dims;
    }
    /** handler for the upload file. */
    function uploadFile() {
        var imgFileElement = document.getElementById('videoFile'),
            uploadContainer = document.getElementById('uploadContainer'),
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
            imageData.append(elList[i].name, elList[i].value);
        }
        window.fetch('/upload/aa', {
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
    }

    /// Handler for the then videos are clicked
    function showVideo(vid) {
        var opts, i, vidDims, vidDetailElement, videoText, videoContainer, editData,
            vidPublicElement, vidPublicCheck, vidDirectLinkElement, vidDirectLinkCheck;
        document.getElementById('videoList').classList.add('hide');
        videoContainer = document.getElementById('videoContainer');

        videoContainer.classList.remove('hide');
        clearInterval(intervalCheckEncoded);

        function btnEditClick(ev) {
            var btn = ev.target;
            if (btn.value === 'Edit') {
                document.getElementById('videoName').contentEditable = true;
                document.getElementById('videoName').classList.add('editable');
                document.getElementById('videoDescription').contentEditable = true;
                document.getElementById('videoDescription').classList.add('editable');
                document.getElementById('videoTags').contentEditable = true;
                document.getElementById('videoTags').classList.add('editable');
                show(document.getElementById('videoTags'));
                document.getElementById('videoPublic').classList.add('editable');
                show(document.getElementById('videoPublic'));
                document.getElementById('videoDirectLink').classList.add('editable');
                show(document.getElementById('videoDirectLink'));
                btn.value = 'Save';
            } else {
                document.getElementById('videoName').contentEditable = false;
                document.getElementById('videoName').classList.remove('editable');
                document.getElementById('videoDescription').contentEditable = false;
                document.getElementById('videoDescription').classList.remove('editable');
                document.getElementById('videoTags').contentEditable = false;
                document.getElementById('videoTags').classList.remove('editable');
                hide(document.getElementById('videoTags'));
                document.getElementById('videoPublic').classList.remove('editable');
                hide(document.getElementById('videoPublic'));
                document.getElementById('videoDirectLink').classList.remove('editable');
                hide(document.getElementById('videoDirectLink'));
                editData = {
                    id: vid,
                    name: document.getElementById('videoName').textContent,
                    description: document.getElementById('videoDescription').textContent,
                    tags: document.getElementById('videoTags').textContent,
                    public: document.getElementById('videoPublicCheck').checked,
                    directLink: document.getElementById('videoDirectLinkCheck').checked
                };
                btn.value = 'Edit';
                window.fetch('/editvideo', {
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
                            showMessage(json.error, 'showVideo.btnEditClick.save', 10);
                        }
                    })
                    .catch(function (ex) {
                        console.log('Error');
                        showMessage(ex, 'showVideo.btnEditClick.save.1', 10);
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
                        showMessage(json.error, 'showVideo.copyFlickClick', 10);
                    } else {
                        showMessage('Received at destination', 'showVideo.copyFlickClick', 5);
                        document.getElementById('copyFlickPanel').classList.add('hide');
                    }
                })
                .catch(function (ex) {
                    console.log('Error');
                    showMessage(ex, 'showVideo.copyFlickClick.1', 10);
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

        function rating(videoId, currentValue) {
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
                window.fetch('/rating/' + videoId + '/' + newRating, {
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
                            showMessage(json.error, 'showVideo.rating.save', 7);
                        }
                        var tmpNode = ev.target.parentNode.parentNode.parentNode;
                        tmpNode.removeChild(ev.target.parentNode.parentNode);
                        tmpNode.appendChild(rating(videoId, newRating));
                    })
                    .catch(function (ex) {
                        showMessage(ex, 'timeUpdate', 6);
                    });
            });

            return container;
        }

        function setVideoDetail() {
            if (currentVideoDetail.fileDetail && currentVideoDetail.fileDetail.width) {
                vidDims = getViewerDimensions(currentVideoDetail.fileDetail.width, currentVideoDetail.fileDetail.height);
            } else {
                vidDims = getViewerDimensions(800, 600);
            }

            videoContainer.innerHTML = '<video id="video" poster="/thumb/' + vid + '/' + vidDims.src + '" data-setup="{}"  class="video-js vjs-default-skin" >' +
                    '<source src="/video/' + vid + '/' + vidDims.src + '.mp4?r=' + (new Date()).getTime() + '" type="video/mp4"></source>' +
                    '<source src="/video/' + vid + '/' + vidDims.src + '.webm?r=' + (new Date()).getTime() + '" type="video/webm"></source>' +
                    '<source src="/video/' + vid + '/' + vidDims.src + '.ogv?r=' + (new Date()).getTime() + '" type="video/ogg"></source>' +
                    '</video>' +
                    '<div ></div>';
            opts = {
                'controls': true,
                'autoplay': false,
                'preload': 'auto',
                'width': vidDims.videoWidth,
                'height': vidDims.videoHeight
            };
            vjs = videojs(document.getElementById('video'), opts, function () { });
            if (currentVideoDetail.currentTime) {
                vjs.currentTime(currentVideoDetail.currentTime);
            }
            vjs.on('error', function (err) { showMessage(err.message, 'showVideo.setVideoDetail.vjs.error', 10); });
            vjs.one('play', function () {
                window.fetch('/playVideo/' + vid, {
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
            vjs.on('timeupdate', function () { timeUpdate(currentVideoDetail, vjs.currentTime()); });

            if (user.options && user.options.volume) {
                vjs.volume(user.options.volume);
            }

            videoText = document.createElement('div');
            videoText.id = 'videoInfo';
            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'videoName';
            vidDetailElement.className = 'videoTextItem';
            vidDetailElement.title = 'Video name';
            vidDetailElement.textContent = currentVideoDetail.name;
            videoText.appendChild(vidDetailElement);

            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'videoDescription';
            vidDetailElement.className = 'videoTextItem';
            vidDetailElement.title = 'Video description';
            vidDetailElement.textContent = currentVideoDetail.description;
            videoText.appendChild(vidDetailElement);

            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'videoTags';
            vidDetailElement.className = 'videoTextItem';
            vidDetailElement.title = 'Video tags';
            vidDetailElement.textContent = currentVideoDetail.tags;
            hide(vidDetailElement);
            videoText.appendChild(vidDetailElement);

            vidPublicElement = document.createElement('div');
            vidPublicElement.id = 'videoPublic';
            vidPublicElement.className = 'videoTextItem';
            vidPublicElement.textContent = 'Public';
            vidPublicCheck = document.createElement('input');
            vidPublicCheck.id = 'videoPublicCheck';
            vidPublicCheck.type = 'checkbox';
            vidPublicCheck.name = 'public';
            vidPublicCheck.checked = currentVideoDetail.public;
            hide(vidPublicElement);
            vidPublicElement.appendChild(vidPublicCheck);
            videoText.appendChild(vidPublicElement);

            vidDirectLinkElement = document.createElement('div');
            vidDirectLinkElement.id = 'videoDirectLink';
            vidDirectLinkElement.className = 'videoTextItem';
            vidDirectLinkElement.textContent = 'Allow direct link';
            vidDirectLinkCheck = document.createElement('input');
            vidDirectLinkCheck.id = 'videoDirectLinkCheck';
            vidDirectLinkCheck.type = 'checkbox';
            vidDirectLinkCheck.name = 'directLink';
            vidDirectLinkCheck.checked = currentVideoDetail.directLink;
            hide(vidDirectLinkElement);
            vidDirectLinkElement.appendChild(vidDirectLinkCheck);
            videoText.appendChild(vidDirectLinkElement);

            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'videoRunCount';
            vidDetailElement.className = 'videoTextItem';
            vidDetailElement.textContent = 'Played ' + currentVideoDetail.playCount + ' time' + (currentVideoDetail.playCount === 1 ? '' : 's');
            videoText.appendChild(vidDetailElement);

            if (user.id !== undefined && (currentVideoDetail.userId === user.id || user.isSysAdmin === true)) {
                videoText.appendChild(btnEdit());
                videoText.appendChild(btnShowCopy());

            }
            //console.log(currentVideoDetail);
            videoText.appendChild(rating(vid, currentVideoDetail.rating));
            videoText.appendChild(copyFlick(vid));
            videoContainer.appendChild(videoText);
        }

        for (i = 0; i < videoListMaster.length; i++) {
            if (videoListMaster[i]._id === vid) {
                currentVideoDetail = videoListMaster[i];
                break;
            }
        }

        if (currentVideoDetail) {
            setVideoDetail();
        } else {
            window.fetch('/videodetail/' + vid, {
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
                        showMessage(json.error, 'showVideo.fetchVideoDetail', 10);
                    } else {
                        currentVideoDetail = json;
                        setVideoDetail();
                    }
                })
                .catch(function (ex) {
                    console.log('Error');
                    showMessage(ex.message, 'showVideo.fetchVideoDetail1', 10);
                });
        }
    }

    function showVideoOnLoad(vid) {

        window.history.replaceState({method: 'showVideo', vid: vid}, 'Play video', window.location.href );
        showVideo(vid);
    }
                

    /// Print the video list tothe browser.
    function listVideosShow(vids) {
        //console.log(list);
        var j, list, videoList, vidFrag, vidContent, vidName, vidNameText,  vidDelete;
        list = vids.data;
        videoList = document.getElementById('videoList');
        while (videoList.firstChild) {
            videoList.removeChild(videoList.firstChild);
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
            vidThumb.src = '/thumb/' + vid._id + '/thumb';
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
                console.log(vid);
                vidName = vidName.replace(' ', '_');
                currentState.method = 'listVideos';
                currentState.scrollTop = document.body.scrollTop;
                currentState.page = vids.page;
                currentState.limit = vids.limit;
                currentState.search = vids.search;
                window.history.replaceState(currentState, 'List video', '');
                window.history.pushState({method: 'showVideo', vid: vid._id}, 'Show video', '/' + vidName + '/' + vid._id);
                showVideo(vid._id);
            }
            if (vid.encoded === true) {
                /*addListener(vidContainer, 'click', true, 
                //vidContainer.onclick = 
                    function () {
                        var currentState = window.history.state || {};
                        currentState.method = 'listVideos';
                        currentState.scrollTop = document.body.scrollTop;
                        currentState.page = vid.page;
                        currentState.limit = vid.limit;
                        currentState.search = vid.search;
                        window.history.replaceState(currentState, 'List video', '');
                        window.history.pushState({method: 'showVideo', vid: vid._id}, 'Play video', '/' + vid._id);
                        showVideo(vid._id);
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
                    deleteVideo(vid._id);
                    videoList.removeChild(vidContainer);
                    for (j = 0; j < videoListMaster.length; j++) {
                        if (videoListMaster[j]._id === vid._id) {
                            videoListMaster.splice(j, 1);
                            break;
                        }
                    }
                    e.stopPropagation();
                });

            if (i % 10 === 0) {
                videoList.appendChild(vidFrag);
                vidFrag = document.createDocumentFragment();
            }
        });
        videoList.appendChild(vidFrag);

        var nextPrev, nextPage, prevPage;
        nextPrev = document.createElement('div');
        nextPage = document.createElement('span');
        prevPage = document.createElement('span');
        nextPage.textContent = 'Next';
        prevPage.textContent = 'Previous';
        nextPrev.id = 'nextPrev';
        nextPage.className = 'nextPrev';
        prevPage.className = 'nextPrev';
        addListener(nextPage, 'click', true, function () {vids.page++; listVideos(vids.page , vids.limit, vids.search); });
        addListener(prevPage, 'click', true, function () {vids.page--; listVideos(vids.page, vids.limit, vids.search); });

        if (vids.page > 0) {
            nextPrev.appendChild(prevPage);
        }
        if (vids.count > ((vids.page + 1) * vids.limit)) {
            nextPrev.appendChild(nextPage);
        }
        videoList.appendChild(nextPrev);
    }

    /// Get videos from the server and display them
    function listVideos(page, limit, search) {
        var i, video, videoList, videoContainer, newVideoPopup;
        page = page || 0;
        limit = limit || 10;
        search = search || '-';
        newVideoCount = 0;
        currentVideoDetail = undefined;
        videoList = document.getElementById('videoList');
        videoList.classList.remove('hide');
        document.getElementById('videoListUnencoded').classList.add('hide');
        videoContainer = document.getElementById('videoContainer');
        videoContainer.classList.add('hide');
        while (videoContainer.firstChild) {
            videoContainer.removeChild(videoContainer.firstChild);
        }
        video = document.getElementById('video');
        if (video !== null) {
            videojs(video).dispose();
        }
        newVideoPopup = document.getElementsByClassName('newVideoPopup');
        for (i = 0; i < newVideoPopup.length; i++) {
            newVideoPopup[i].parentNode.removeChild(newVideoPopup[i]);
        }

        clearInterval(intervalCheckEncoded);
        /// If we have already loaded the data from the server then reuse it.
        if (videoListMaster.length > 0) {
            /// If the master list and the number of elements don't match then start again
            if (videoList.children.length !== videoListMaster.length) {
                listVideosShow(videoListMaster);
            }
        } else {
            window.fetch('/videolist/' + page + '/' + limit + '/' + search, {
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
                    if (Array.isArray(json.data)) {
                        videoListMaster = json;
                        listVideosShow(videoListMaster);
                    } else {
                        showMessage('Non array type returned.', 'listtVideos.fetchVideoList', 6);
                    }
                })
                .catch(function (ex) {
                    showMessage(ex, 'listtVideos.fetchVideoList1', 10);
                });
        }
    }

    function watchForNewVideos() {
        /// Check the browser supports EventSource.  If it's IE then the user has to refresh manually.
        if (window.EventSource !== undefined) {
            newVideoEvents = new window.EventSource('/newvideo');
            addListener(newVideoEvents, 'newVideo', false, function () {
            //newVideoEvents.addEventListener('newVideo',  function () {
                var pop = document.createElement('div');
                newVideoCount++;
                pop.className = 'newVideoPopup';
                pop.innerHTML = '<p>There are ' + newVideoCount + ' new videos</p>';

                addListener(pop, 'click', true, function () {
                //pop.addEventListener('click', function () {
                    window.history.pushState({method: 'listVideos'}, 'List video', '/');
                    listVideos(0, settings.videoListPageLength);
                });

                document.body.appendChild(pop);
                setTimeout(function () { pop.parentNode.removeChild(pop); }, 6000);
            });
        }
    }

    /// Get videos from the server and display them
    function listUnencoded(page, limit) {
        var video, videoList, videoContainer;
        currentVideoDetail = undefined;
        videoList = document.getElementById('videoList');
        videoList.classList.remove('hide');
        document.getElementById('videoListUnencoded').classList.add('hide');
        videoContainer = document.getElementById('videoContainer');
        videoContainer.classList.add('hide');
        while (videoContainer.firstChild) {
            videoContainer.removeChild(videoContainer.firstChild);
        }

        video = document.getElementById('video');
        if (video !== null) {
            videojs(video).dispose();
        }
        function getUnencoded() {
            window.fetch('/videolistunencoded/' + page + '/' + limit, {
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
                    if (Array.isArray(json.data)) {
                        listVideosShow(json);
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

    function deleteVideo(vid) {
        window.fetch('/video/' + vid, {
            credentials: 'include',
            method: 'DELETE'
        })
            .catch(function (ex) {
                showMessage(ex, 'deleteVideo.fetch', 6);
            });
    }

    function unDeleteVideo(vid) {
        window.fetch('/undelete/' + vid, {
            credentials: 'include',
            method: 'POST'
        })
            .catch(function (ex) {
                showMessage(ex, 'undeleteVideo.fetch', 6);
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
            } else if (el.type === 'checkbox') {
                newUser[el.name] = el.checked;
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
                    showHideElement('createAccountContainer');
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
        var file    = document.getElementById('videoFile').files[0];
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
        setCookie('cookieConsent', 'true', 1);
    }

    function closeInfoPanel() {
        document.getElementById('infoContainer').className = 'hide';
        setCookie('closeInfoPanel', 'true', 1);
    }
    /// Login
    function postLogin() {
        if (Object.getOwnPropertyNames(user).length > 0) {

            if (!user.options) { user.options = {}; }
            if (user.options.volume && vjs) {
                vjs.volume(user.options.volume);
            }

            document.getElementById('loggedinContainer').style.display = 'inline-block';
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('headerBarUserName').textContent  = 'Hello ' + user.forename;
            document.getElementById('message').textContent  = '';
            listVideosShow(videoListMaster);
            /// Dopn't show the upload button in <=IE9
            if (window.FormData === undefined) {
                document.getElementById('showUploadContainer').style.display = 'none';
            }
            
        }
    }
    function login() {
        window.fetch('/login', {
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
                    showMessage(json.error, 'login.fetchLogin', 7);
                } else {
                    //(Object.getOwnPropertyNames(json).length > 0) {
                    user = json;
                    postLogin();
                }
            })
            .catch(function (ex) {
                showMessage(ex, 'login.fetchLogin1',  6);
            });
    }
    function loginCheck() {
        window.fetch('/login', {
            method: 'GET',
            credentials: 'include', // or same-origin
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .then(function (response) {
                if (response.status === 401) { return {}; }
                return response.json();
            })
            .then(function (json) {
                if (Object.getOwnPropertyNames(json).length > 0) {
                    user = json;
                    postLogin();
                }
            })
            .catch(function (ex) {
                showMessage(ex, 'loginCheck.fetchLogin',  6);
                //document.getElementById('message').textContent = ex;
            });
    }

    function logout() {
        user = {};
        document.getElementById('loggedinContainer').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'inline-block';
        document.getElementById('showUploadContainer').style.display = 'inline-block';
        document.getElementById('message').textContent  = '';
        document.getElementById('headerBarUserName').textContent  = '';

        window.fetch('/login', {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .catch(function (ex) {
                showMessage(ex, 'logout.fetchLogin',  6);
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
                showMessage('The internet speed between you and us is slow (' + speed + ' Mbps) so these videos may not play smoothly.', 'downloadSpeedTest', 7);
            }
        };
        startTime = (new Date()).getTime();
        download.src = '/img/random.jpg?n=' + startTime;
    }

    /// Check to see if the browser supports HTML5 vieo, returns boolean
    function supportsVideo() {
        return !!document.createElement('video').canPlayType;
    }
    /// Checks the browser is suported and then runs the callback.
    function checkFeatures(callback) {
        /*if (window.FormData === undefined || supportsVideo() !== true) {
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
        window.history.pushState({method: 'listVideos', search: searchTerm}, 'Search video', '/');
        listVideos(0, settings.videoListPageLength, searchTerm);
    }

    /// Setup the page.  Checks the browser is supported and then loads the page.
    function start() {
        checkFeatures(function () {
            addListener('submitUploadNewVideo', 'click', true, uploadFile);
            addListener('submitLogin', 'click', true, login);
            addListener('submitLogout', 'click', true, logout);
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
            addListener('showVideoList', 'click', true, function () {
                window.history.pushState({method: 'listVideos'}, 'List video', '/');
                listVideos(0, settings.videoListPageLength);
            });
            addListener('showUnencodedVideoList', 'click', true, function () {
                window.history.pushState({method: 'listUnencoded'}, 'List unencoded videos', '/');
                listUnencoded(0, settings.videoListPageLength);
            });
            /// forward and back button handler.
            addListener(window, 'popstate', true, function (event) {
                //console.log(event.state);
                if (event.state.method === 'showVideo') {
                    showVideo(event.state.vid);
                } else if (event.state.method === 'listVideos') {
                    listVideos(event.state.page, event.state.limit, event.state.search);
                    if (event.state.scrollTop !== undefined && event.state.scrollTop > 0) {
                        window.scroll(event.state.scrollTop, 0);
                    }
                } else if (event.state.method === 'search') {
                    listVideos(event.state.page, event.state.limit, event.state.search);
                    if (event.state.scrollTop !== undefined && event.state.scrollTop > 0) {
                        window.scroll(event.state.scrollTop, 0);
                    }
                }
            });
            /// handle rotation on mobile devices
            addListener(window, 'resize', true, function () {
                var vidDims, currentTime, isPaused;
                if (currentVideoDetail !== undefined && currentVideoDetail.fileDetail && currentVideoDetail.fileDetail.width && currentOrientation !== window.orientation) {
                    currentOrientation = window.orientation;
                    vidDims = getViewerDimensions(currentVideoDetail.fileDetail.width, currentVideoDetail.fileDetail.height);
                    currentTime = vjs.currentTime();
                    isPaused = vjs.paused();
                    vjs.dimensions(vidDims.videoWidth, vidDims.videoHeight);
                    vjs.src([{type: 'video/mp4', src: 'video/' + currentVideoDetail._id + '/' + vidDims.src + '.mp4?r=' + (new Date()).getTime() },
                            {type: 'video/webm', src: 'video/' + currentVideoDetail._id + '/' + vidDims.src + '.webm?r=' + (new Date()).getTime() }
                        ]);
                    vjs.currentTime(currentTime);
                    if (!isPaused) {
                        vjs.play();
                    }
                }
            });
            loginCheck();
            watchForNewVideos();
            listVideos(0, settings.videoListPageLength);
            downloadSpeedTest();
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
        showVideoOnLoad: showVideoOnLoad
    };
}({}));