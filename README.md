**i-flicks**
===================

**Video sharing** website and application. 

----------

Overview
--------

This software is incomplete.  It works but still needs plenty of work.  
i-flickls pulls together several components to give a full, open source video sharing application.  

i-flicks is intended for small teams or individuals who want a stand alone video presentation system.  It will work with a few hundred or low thousands of videos and a handful of concurrent viewers.  

Getting started
---------------

> You should be able to get i-flicks up and running with no programming experience but you will find a basic understanding of Javascript and Node.js useful.

### tl;dr  
Create a Node app and pass the i-flicks object to the HTTP server then start the app.

	var settings = {
	    ffmpegPath: '/usr/bin/ffmpeg',
	    ffprobePath:  '/usr/bin/ffprobe',
	    flvMetaPath:  '/usr/bin/flvmeta',
	 };
	var http = require('http');
	var server = http.createServer(require('./i-flicks/app')(settings));

	server.listen(3000, function() {
		var addr = this.address();
		console.log('i-flicks server is listening on %s:%d', addr.address, addr.port);
	});


 > node app.js 

### Detailed install
**Ubuntu Linux**

Install Node.js, NPM ImageMagick, Git and FLVMeta.

	curl -sL https://deb.nodesource.com/setup | sudo bash -

	or

	curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash -

	sudo apt-get install nodejs -y

	sudo apt-get install git -y

	sudo apt-get install graphicsmagick -y

	sudo apt-get install flvmeta -y

Install FFmpeg

	sudo add-apt-repository ppa:mc3man/trusty-media

	sudo apt-get update

	sudo apt-get dist-upgrade  ?? not really required ??

	sudo apt-get install ffmpeg -y
> **Note:** because of licencing restrictions, you can get better sound quality and browser compatibility by compiling FFmpeg from source.  i-flicks works with the standard download.

**Windows**
The default settings and latest installs of the following packages should all work.

* Download and install [Node.js](https://nodejs.org/) (this will install NPM too)  

* Download and install [Git](https://git-scm.com/downloads)

* Download and install [GraphicsMagick ](http://www.graphicsmagick.org/download.html)

* Download and install [FLVMeta](http://www.flvmeta.com/)

* Download and install [FFMpeg](https://www.ffmpeg.org/download.html)

**For all operating systems**
Create a folder for your new project on your computer and move to that folder.  
run: 

~~npm install i-flicks~~ coming soon

	git clone https://github.com/seethespark/i-flicks.git  
	cd i-flicks  
	npm install
	cd views  
	mv runOnce.done.hbs runOnce.hbs *OR* rename runOnce.done.hbs runOnce.hbs  
	cd ..
		
Create a node application, create a "settings" object with paths to the software installed above and require i-flicks....  
For example, add this to a file called app.js

	var settings = {
	    ffmpegPath: '/usr/bin/ffmpeg',
	    ffprobePath:  '/usr/bin/ffprobe',
	    flvMetaPath:  '/usr/bin/flvmeta',
	    databasePath: '',
	    uploadPath: '/var/uploads',
	    mediaPath: '/var/uploads',
	    sessionSecret: 'enter your secret here',
	    env: 'production', // development or production. 
  		css: 'white.css' // white.css or black_yellow.css

	 };
	var iflicks = require('i-flicks')(settings);
	var http = require('http');
	var server = http.createServer(iflicks);

	server.listen(3000, function() {
		var addr = this.address();
		console.log('i-flicks server is listening on %s:%d', addr.address, addr.port);
	});


run:  
node app.js

Open a browser and navigate to http://localhost:3000

**How to listen on port 80**  
Node.js requires elevated privileges or root access to listen on port 80 or 443.  It isn't a good idea to do this and so something needs to forward requests to port 80 onto the Node.js port.  IPTables or Nginx both work. 
IPTables is quicker to setup as it is installed on most Linux distrubutions.  Nginx works on Windows and Linux and adds a bit more flexibility.

**What about io.js, HTTPS, SPDY or HTTP2?**  
i-flicks works with other io.js amd alternative HTTP modules.  None have been production tested but all work when tested as a Friday afternoon bit of fun.

Settings
--------
The settings object options are as follows:

Setting	 | Default	| Purpose
-------- | --------	| ---------
databasePath	| ""	| Path to database file storage.  Defaults to nothing and so uses the root of your application.
ffmpegPath | "/"	| Path to the ffmpeg executable. For example, 'C:/Program Files/ffmpeg/bin/ffmpeg.exe' (note the forward slashes) or '/usr/bin/ffmpeg')
ffprobePath	| "/"	| Path to the ffprobe executable
flvMetaPath	| "/"	| Path to the FLVMeta executable
maxFFmpegInatances	| 1	| Number of copies of FFmpeg to run at once.  If the encoding server only runs FFmpeg and has lots of processor cores then this can be high, otherwise leave it at 1 or 2.
uploadPath	| "/"	| Where to store uploaded files
mediaPath	| "/"	| Where to store encoded media files
statsDServer | undefined	| If you have a StatsD server then i-flicks can log various metrics to it.
statsDDebug	| undefined		| StatsD debug flag.
statsDPrefix	| undefined	| Text prefix for statsD log metric names.
cssPath | undefined	| Absolute path to a file used to override the default stylesheet.
css | white.css 	| Built in style skins.  Values are white.css and black_yellow.css.
env	| development	| Environment variable.  Overrides NODE_ENV for this application.  If not set then uses NODE_ENV.  Values are development and production.
mailgunKey	| undefined	| If using [MailGun](https://www.mailgin.com/) (free option available) then this is the key provided.
mailgunDomain	| undefined	| Mailgun domain.
gmailUsername	| undefined	| If using GMail then this is the username used to logon to GMail.  Note that GMail is only suitable for small volumes of mail and Google may block the account.  It is not the recommended option but it is an easy one to get started.
gmailPassword	| undefined	| If using GMail then this is the password used to logon to GMail.
mailFrom	| me@example.com	| From address used when sending emails.

More
--------
If you use i-flicks or would like to see a specific feature please drop contact@i-flicks.com an email.  We would love to hear what you are doing.