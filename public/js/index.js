/** This is the master i-flicks object which controls uploads, playing and editing videos
 */
window.iflicks = (function iflicks() {
    'use strict';
    var intervalCheckEncoded, newVideoEvents, vjs, user = {}, videoListMaster = [], messages = [];
    user.options = {};

    function walkTheDom(node, f){
        f(node);
        node = node.firstChild;
            while(node)
            {
                walkTheDom(node, f);
                node = node.nextSibling;
            }
    }


    /** Attempt to detect touch devices. This isn't 100% accurate but helps improve the experience. **/
    function isTouchDevice() {
        return ('ontouchstart' in window || navigator.MaxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
    }

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

    //function getCookie(k) { return (document.cookie.match('(^|; )' + k + '=([^;]*)') || 0)[2]; }

    function setOption(option, value) {
        var o = {};
        o[option] = value;
        window.fetch('option', {
            credentials: 'include',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(o)
        })
            .catch(function (ex) {
                showMessage(ex, 6);
            });
    }

    function getViewerDimensions(sourceWidth, sourceHeight) {
        var w, h, dims = {}, widthHeightRatio;
        widthHeightRatio = sourceWidth / sourceHeight;
        w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        dims.viewportWidth = w;
        dims.viewportHeight = h;
        if (h > w && w < 400) {
            dims.videoWidth = w * 0.95;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h > w && w >= 400 && w < 500) {
            dims.videoWidth = 400;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'medium';
        } else if (h > w && w >= 500 && w < 800) {
            dims.videoWidth = 500;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'medium';
        } else if (h > w && w >= 800) {
            dims.videoWidth = 800;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'big';
        } else if (h <= w && w < 400) {
            dims.videoWidth = w * 0.95;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'small';
        } else if (h <= w && w >= 400 && w < 500) {
            dims.videoWidth = 400;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'medium';
        } else if (h <= w && w >= 500 && w < 900) {
            dims.videoWidth = 500;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'medium';
        } else if (h <= w && w >= 900) {
            dims.videoWidth = 880;
            dims.videoHeight = dims.videoWidth / widthHeightRatio;
            dims.src = 'big';
        } else {
            throw new Error('Unrecognised size');
        }
        console.log(dims);
        return dims;
    }
    /** handler for the upload file. */
    function uploadFile(ev) {
        var imgFileElement = document.getElementById('videoFile'),
            uploadContainer = document.getElementById('uploadContainer'),
            imageData = new window.FormData(),
            elList = [], i;
        imageData.append(imgFileElement.name, imgFileElement.files[0]);
        walkTheDom(uploadContainer, function(node) {
            if (node.className && node.className.indexOf('uploadContainer') > -1) {
                elList.push(node);
            }
        });
        for (i = 0; i < elList.length; i++) {
            imageData.append(elList[i].name, elList[i].value);
        }
        window.fetch('upload/aa', {
            method: 'PUT',
            credentials: 'include',
            body: imageData
        })
            .then(function (res) { return res.text(); })
            .then(function (txt) { showMessage(txt, 6); })
            .catch(function (ex) { showMessage(ex, 10); });
    }

    /// Handler for the then videos are clicked
    function playVideo(vid) {
        var opts, i, vidDetail, vidDims, vidDetailElement, videoText, videoContainer, editData;
        $('#videoList').hide();
        videoContainer = document.getElementById('videoContainer');

        videoContainer.classList.remove('hide');
        clearInterval(intervalCheckEncoded);

        function btnEditClick() {
            var btn = this;
            if (btn.value === 'Edit') {
                document.getElementById('videoName').contentEditable = true;
                document.getElementById('videoName').className = 'editable';
                document.getElementById('videoDescription').contentEditable = true;
                document.getElementById('videoDescription').className = 'editable';
                btn.value = 'Save';
            } else {
                document.getElementById('videoName').contentEditable = false;
                document.getElementById('videoName').className = undefined;
                document.getElementById('videoDescription').contentEditable = false;
                document.getElementById('videoDescription').className = undefined;
                editData = {
                    id: vid,
                    name: document.getElementById('videoName').textContent,
                    description: document.getElementById('videoDescription').textContent
                };
                btn.value = 'Edit';
                window.fetch('editvideo', {
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
                            showMessage(json.error, 10);
                        }
                    })
                    .catch(function (ex) {
                        console.log('Error');
                        showMessage(ex, 10);
                    });
            }
        }
        function btnEdit() {
            var btn = document.createElement('input');
            btn.type = 'button';
            btn.value = 'Edit';
            btn.addEventListener('click', btnEditClick);
            return btn;
        }

        function setVideoDetail(vidDetaill) {
            if (vidDetaill.fileDetail && vidDetaill.fileDetail.width) {
                vidDims = getViewerDimensions(vidDetaill.fileDetail.width, vidDetaill.fileDetail.height);
            } else {
                vidDims = getViewerDimensions(800, 600);
            }

            videoContainer.innerHTML = '<video id="video" poster="thumb/' + vid + '" data-setup="{}"  class="video-js vjs-default-skin" >' +
                    '<source src="video/' + vid + '/' + vidDims.src + '.mp4" type="video/mp4"></source>' +
                    '<source src="video/' + vid + '/' + vidDims.src + '.webm" type="video/webm"></source>' +
                    //'<source src="video/' + vid + '/' + vidDims.src + '.ogv" type="video/ogg"></source>' +
                    '</video>' +
                    '<div ></div>';
            opts = {
                "controls": true,
                "autoplay": false,
                "preload": "auto",
                "width": vidDims.videoWidth,
                "height": vidDims.videoHeight
            };
            vjs = videojs(document.getElementById('video'), opts, function () { });
            vjs.one('play', function () { window.fetch('playVideo/' + vid, { credentials: 'include', type: 'POST' })
                .then(function (response) {
                    return response.json();
                });
            });
            vjs.on('volumechange', function (ev) { user.options.volume = ev.target.volume; setOption('volume', ev.target.volume); });

            if (user.options && user.options.volume) {
                vjs.volume(user.options.volume);
            }

            videoText = document.createElement('div');
            videoText.id = 'videoInfo';
            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'videoName';
            vidDetailElement.textContent = vidDetaill.name;
            videoText.appendChild(vidDetailElement);
            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'videoDescription';
            vidDetailElement.textContent = vidDetaill.description;
            videoText.appendChild(vidDetailElement);
            vidDetailElement = document.createElement('div');
            vidDetailElement.id = 'videoRunCount';
            vidDetailElement.textContent = 'Played ' + vidDetaill.playCount;
            videoText.appendChild(vidDetailElement);

            if (user.id !== undefined && (vidDetaill.userId === user.id || user.isSysAdmin === true)) {
                videoText.appendChild(btnEdit());
            }
            videoContainer.appendChild(videoText);
        }

        for (i = 0; i < videoListMaster.length; i++) {
            if (videoListMaster[i]._id === vid) {
                vidDetail = videoListMaster[i];
                break;
            }
        }

        if (vidDetail) {
            setVideoDetail(vidDetail);
        } else {
            window.fetch('videodetail/' + vid, {
                    credentials: 'include', 
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    } })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    if (json.error) {
                        showMessage(json.error, 20);
                    } else {
                        setVideoDetail(json);
                    }
                })
                .catch(function (ex) {
                    console.log('Error');
                    showMessage(ex, 10);
                });
        }
    }

    /// Print the video list tothe browser.
    function listVideosShow(list) {
        var j, videoList, vidFrag, vidContent, vidName, vidNameText,  vidDelete, vidDeleteText;
        videoList = document.getElementById('videoList');
        while (videoList.firstChild) {
            videoList.removeChild(videoList.firstChild);
        }
        vidFrag = document.createDocumentFragment();
        list.forEach(function (vid, i) {
            var vidContainer, vidThumb, vidDescription, vidDescriptionText;
            vidContainer = document.createElement('div');
            vidContent = document.createElement('div');
            vidThumb = document.createElement('img');
            vidName = document.createElement('span');
            vidNameText = document.createTextNode(vid.name);
            vidDescription = document.createElement('span');
            vidDescriptionText = document.createTextNode(vid.description);
            vidDelete = document.createElement('span');
            vidDeleteText = document.createTextNode('X');

            vidContainer.className = 'vidContainer';
            vidContent.className = 'vidContent';
            vidThumb.className = 'vidThumb';
            vidName.className = 'vidName';
            vidDelete.className = 'vidDelete';
            vidThumb.src = 'thumb/' + vid._id;

            vidDescription.className = 'vidDescription';


            vidName.appendChild(vidNameText);
            vidContent.appendChild(vidThumb);
            vidContent.appendChild(vidName);
            vidDescription.appendChild(vidDescriptionText);

            vidContainer.appendChild(vidContent);
            vidContainer.appendChild(vidDescription);
            //$(vidDescription).hide();

            vidDelete.appendChild(vidDeleteText);
            if (vid.userId === user.id || user.isSysAdmin === true) {
                vidContent.appendChild(vidDelete);

            }
            vidFrag.appendChild(vidContainer);

            vidContainer.onclick = function () {
                var currentState = window.history.state || {};
                currentState.method = 'listVideos';
                currentState.scrollTop = document.body.scrollTop;
                window.history.replaceState(currentState, "List video", "");
                window.history.pushState({method: 'playVideo', vid: vid._id}, "Play video", "/" + vid._id);
                playVideo(vid._id);
            };
            /*vidDiv.onmouseover = function (ev) {
                vidDescription.className = 'vidDescriptionShow';
                console.log(vidDescription);
            };
            vidDiv.onmouseout = function (ev) {
                vidDescription.className = 'vidDescriptionHide';
            };*/
            vidDelete.onclick = function (e) {
                deleteVideo(vid._id);
                videoList.removeChild(vidContainer);
                for (j = 0; j < videoListMaster.length; j++) {
                    if (videoListMaster[j]._id === vid._id) {
                        videoListMaster.splice(j, 1);
                        break;
                    }
                }
                e.stopPropagation();
            };

            if (i % 10 === 0) {
                videoList.appendChild(vidFrag);
                vidFrag = document.createDocumentFragment();
            }
        });
        videoList.appendChild(vidFrag);
    }

    /// Get videos from the server and display them
    function listVideos() {
        $('#videoList').show();
        $('#videoListUnencoded').hide();
        var videoContainer = document.getElementById('videoContainer');
        videoContainer.classList.add('hide');
        while (videoContainer.firstChild) {
            videoContainer.removeChild(videoContainer.firstChild);
        }
        //$("#videoContainer").hide();
        if ($("#video").get(0)) {
            videojs($("#video").get(0)).dispose();
        }
        //$("#videoContainer").empty();
        clearInterval(intervalCheckEncoded);
        /// If we have already loaded the data from the server then reuse it.
        if (videoListMaster.length > 0) {
            /// If the master list and the number of elements don't match then start again
            if ($('#videoList').length !== videoListMaster.length) {
                listVideosShow(videoListMaster);
            }
        } else {
            window.fetch('videolist', {
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
                    if (Array.isArray(json)) {
                        videoListMaster = json;
                        listVideosShow(videoListMaster);
                    } else {
                        showMessage('Non array type returned.', 6);
                    }
                })
                .catch(function (ex) {
                    showMessage(ex, 10);
                });

            /*$.getJSON('videolist')
                .done(function (json) {
                    if (Array.isArray(json)) {
                        videoListMaster = json;
                        listVideosShow(videoListMaster);
                    } else {
                        console.log('Non array type returned.');
                    }
                })
                .fail(function (xhr) {
                    console.log(xhr);
                });*/
        }
    }

    function watchForNewVideos() {
        /// Check the browser supports EventSource.  If it's IE then the user has to refresh manually.
        if (window.EventSource !== undefined) {
            newVideoEvents = new window.EventSource('newvideo');
            newVideoEvents.addEventListener('newVideo',  function () {
                window.fetch('videolist', {
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
                        if (Array.isArray(json)) {
                            videoListMaster = json;
                            listVideosShow(videoListMaster);
                        } else {
                            showMessage('Non array type returned.', 6);
                        }
                    })
                    .catch(function (ex) {
                        showMessage(ex, 10);
                    });
            });
        }
    }

        /// Print the video list tothe browser.
    function listUnencodedShow(list) {
        var videoList, vidFrag, vidDiv, vidThumb, vidName, vidNameText, vidProgress, vidProgressText;
        videoList = document.getElementById('videoListUnencoded');
        while (videoList.firstChild) {
            videoList.removeChild(videoList.firstChild);
        }
        vidFrag = document.createDocumentFragment();
        list.forEach(function (vid, i) {
            vidDiv = document.createElement('div');
            vidThumb = document.createElement('img');
            vidName = document.createElement('span');
            vidNameText = document.createTextNode(vid.name);
            vidProgress = document.createElement('span');
            if (vid.encodeProgress === undefined) {
                vidProgressText = document.createTextNode('Encoding not started.');
            } else {
                vidProgressText = document.createTextNode(Math.round(vid.encodeProgress) + ' %');
            }
            vidDiv.className = 'vidDiv';
            vidThumb.className = 'vidThumb';
            vidName.className = 'vidName';
            vidProgress.className = 'vidName';
            vidThumb.src = 'thumb/' + vid._id;

            vidFrag.appendChild(vidDiv);
            vidDiv.appendChild(vidThumb);
            vidName.appendChild(vidNameText);
            vidProgress.appendChild(vidProgressText);
            vidDiv.appendChild(vidName);
            vidDiv.appendChild(vidProgress);
            if (i % 10 === 0) {
                videoList.appendChild(vidFrag);
                vidFrag = document.createDocumentFragment();
            }
        });
        videoList.appendChild(vidFrag);
    }

    /// Get videos from the server and display them
    function listUnencoded() {
        var videoContainer;
        $('#videoListUnencoded').show();
        $('#videoList').hide();
        videoContainer = document.getElementById('videoContainer');
        videoContainer.classList.add('hide');
        //$("#videoContainer").hide();
        if ($("#video").get(0)) {
            videojs($("#video").get(0)).dispose();
        }
        function getUnencoded() {
            window.fetch('videolistunencoded', {
                credentials: 'include'
            })
                .then(function (response) {
                    return response.json();
                })
                .then(function (json) {
                    if (Array.isArray(json)) {
                        listUnencodedShow(json);
                    } else {
                        showMessage('Non array type returned.', 6);
                    }
                })
                .catch(function (ex) {
                    showMessage(ex, 6);
                });
        }
        getUnencoded();
        intervalCheckEncoded = setInterval(getUnencoded, 5000);
    }

    function deleteVideo(vid) {
        window.fetch('video/' + vid, {
            credentials: 'include',
            method: 'DELETE'
        })
            .catch(function (ex) {
                showMessage(ex, 6);
            });
        /*$.ajax({
            url: 'video/' + vid,
            type: 'DELETE',
        })
            .done(function (res) {
                console.log(res);
            })
            .fail(function (jqxhr, textStatus, error) {
                var err = textStatus + ', ' + error;
                console.log(err);
            });*/
    }

    function unDeleteVideo(vid) {
        $.ajax({
            url: 'undelete/' + vid,
            credentials: 'include',
            type: 'POST',
        })
            .done(function (res) {
                console.log(res);
            })
            .fail(function (jqxhr, textStatus, error) {
                var err = textStatus + ', ' + error + jqxhr;
                console.log(err);
            });
    }

    /// Show the upload form
    function showUploadContainer() {
        $('#uploadContainer').toggle('medium');
        /*var uploadContainer = document.getElementById('uploadContainer');

        if (uploadContainer.style.display === 'inline-block' && uploadContainer.style.height <= 0) {
            uploadContainer.style.display = 'none';
        } else if (uploadContainer.style.display === 'none' && heightChange === undefined) {
            uploadContainer.style.display = 'inline-block';
            uploadContainer.style.height = uploadContainer.style.height + 10;
            setTimeout(showUploadContainer, 30, 10);
        }*/
    }
    function previewFile() {
        // Works but hits processor and so UI.
        var thumbVidSrc = document.getElementById('thumbVidSrc');
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
            thumbVid.src = "";
        }
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
            document.getElementById('showUploadContainer').style.display = 'inline-block';
            document.getElementById('headerBarUserName').textContent  = 'Hello ' + user.forename;
            document.getElementById('message').textContent  = '';
            listVideosShow(videoListMaster);
        }
    }
    function login() {
        window.fetch('login', {
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
                showMessage(ex, 6);
            });
    }
    function loginCheck() {
        window.fetch('login', {
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
                showMessage(ex, 6);
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

        window.fetch('login', {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .catch(function (ex) {
                showMessage(ex, 6);
            });
    }


    /// Check to see if the browser supports HTML5 vieo, returns boolean
    function supportsVideo() {
        return !!document.createElement('video').canPlayType;
    }
    /// Checks the browser is suported and then runs the callback.
    function checkFeatures(callback) {
        if (window.FormData === undefined || supportsVideo() !== true) {
            document.getElementById('body').innerHTML = '<p>Your browser is not supported.</p>';
            return;
        }
        callback();
    }

    /// Setup the page.  Checks the browser is supported and then loads the page.
    function start() {
        checkFeatures(function () {
            document.getElementById('submitUploadNewVideo').onclick = uploadFile;
            ///document.getElementById('videoFile').onchange = previewFile; // Works but hits processor ans so UI.
            document.getElementById('submitLogin').onclick = login;
            document.getElementById('submitLogout').onclick = logout;
            document.getElementById('showUploadContainer').onclick = showUploadContainer;
            document.getElementById('showVideoList').onclick = function () {
                //window.history.replaceState(currentState, "Show video", "");
                window.history.pushState({method: 'listVideos', vid: vid._id}, "List video", "/");
                listVideos();
            };
            document.getElementById('showUnencodedVideoList').onclick = function () {
                //window.history.replaceState(currentState, "Show video", "");
                window.history.pushState({method: 'listUnencoded'}, "List unencoded videos", "/");
                listUnencoded();
            };

            /// forward and back button handler.
            window.addEventListener('popstate', function (event) {
                console.log(event.state.method);
                if (event.state.method === 'playVideo') {
                    playVideo(event.state.vid);
                } else if (event.state.method === 'listVideos') {
                    listVideos();
                    if (event.state.scrollTop !== undefined && event.state.scrollTop > 0) {
                        window.scroll(event.state.scrollTop, 0);
                    }
                }
                //updateContent(event.state);
            });
            loginCheck();
            watchForNewVideos();
            listVideos();
        });
    }
    if (document.addEventListener !== undefined) {
        document.addEventListener('DOMContentLoaded', function () {
            start();
        });
    } else {
        start();
    }
    start();

    return {
        playVideo: playVideo
    };
}());