global.iflicks_settings = require('./settings');

module.exports = function (grunt) {
    grunt.initConfig({
        concurrent: {
            //compress: ['less', 'concat', 'uglify'],
            start: {
                tasks: ['mochaTest', 'watch'],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/**/*.js']
            }
        },
        jshint: {
            // define the files to lint
            files: ['public/js/index.js'],
            // configure JSHint (documented at http://www.jshint.com/docs/)
            options: {
                // more options here if you want to override JSHint defaults
                /*globals: {
                    jQuery: true,
                    document: true,
                    console: true,
                    module: true,
                    $: true,
                    window: true,
                    browser: true,
                    setInterval: true,
                    clearTimeout: true,
                    setTimeout: true,
                    location: true,
                    strict: true
                }*/
            }
        },
        uglify: {
            my_target: {
                files: {
                    'public/js/index.min.js': ['public/js/index.js'],
                    'public/js/toolbox.min.js': ['public/js/toolbox.js']
                }
            }
        },
        cssmin: {
            add_banner: {
                options: {
                    banner: '/* My minified css file */'
                },
                files: {
                    'public/css/white.min.css': ['public/css/layout.css', 'public/css/white.css'],
                    'public/css/black_yellow.min.css': ['public/css/layout.css', 'public/css/black_yellow.css'],
                    'public/css/toolbox.min.css': ['public/css/toolbox.css']
                }
            }
        },
        jsdoc : {
            dist : {
                src: ['app.js', 'routes/*.js', 'models/*.js', 'lib/*.js', 'public/js/*.js', 'README.md'],
                options: {
                    destination: 'doc',
                    configure: '.jsdoc'
                }
            }
        },
        watch: {
            files: ['routes/**/*.*',
                'lib/**/*.*',
                'views/**/*.*',
                '!**/dist/**'
            ]//, // ignore dist folder
            //tasks: ['concurrent:compress']
        }
    });
    // Dependencies
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-jsdoc');

    // Run tests
    grunt.registerTask('test', ['mochaTest']);


    // Default tasks
    //grunt.registerTask('default', ['concurrent:start']);
    grunt.registerTask('default', ['jshint', 'mochaTest', 'uglify', 'cssmin', 'jsdoc']);
};

