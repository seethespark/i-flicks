var settings = {};

settings.databasePath = ''; /// Note: this needs the trailing slash if it is used.
settings.uploadPath = 'C:/Nick/Mercurial/nodejs/iflicks/uploads';
settings.mediaPath = 'C:/Nick/Mercurial/nodejs/iflicks/uploads';
settings.ffmpegPath = 'C:/program Files/ffmpeg/bin/ffmpeg.exe';
settings.ffprobePath = 'C:/program Files/ffmpeg/bin/ffprobe.exe';
settings.flvMetaPath = 'C:/program Files/ffmpeg/bin/flvmeta.exe';

settings.maxFFmpegInatances = 1;
settings.runOnce = true;

module.exports = settings;