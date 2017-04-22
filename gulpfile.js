var gulp = require('gulp'),
    path = require('path'),
    jasmine = require('gulp-jasmine'),
    reporters = require('jasmine-reporters'),
    stylish = require('jshint-stylish'),
    browserSync = require("browser-sync").create(),
    runSequence = require('run-sequence'),
    del = require('del'),
    args = require('yargs').argv,
    exec = require('child_process').exec,
    thunkify = require('callback-sequence'),
    $ = require('gulp-load-plugins')();


/**
 * Utility function that takes in an error, makes the OS beep and
 * prints the error to the console
 */
var onError = function(error) {
    $.gutil.beep();
    $.gutil.log(error.message);
    browserSync.notify(error.message);
    this.emit('end');
    process.exit(2);
};


function execute(command, callback){
    exec(command, function(error, stdout, stderr){ callback(stdout); });
};

var getConfig = function() {
    return require('./package.json');
}


var development = $.environments.development;
var production  = $.environments.production;



// initialise file path store
var PATHS = {};

PATHS.ROOT       = '.';
PATHS.SRC_DIR    = path.join(PATHS.ROOT, 'src');
PATHS.DIST_DIR   = path.join('public');
PATHS.TMP        = path.join(PATHS.SRC_DIR, 'tmp');
PATHS.CSS_SRC    = path.join(PATHS.SRC_DIR, 'stylesheets');
PATHS.CSS_DST    = path.join(PATHS.DIST_DIR, 'css');
PATHS.JS_SRC     = path.join(PATHS.SRC_DIR, 'scripts');
PATHS.JS_DST     = path.join(PATHS.DIST_DIR, 'js');
PATHS.IMAGES_SRC = path.join(PATHS.SRC_DIR, 'img');
PATHS.IMAGES_DST = path.join(PATHS.DIST_DIR, 'img');

PATHS.REPOSITORY = 'https://github.com/GabrieleRomeo/taskRunners.git'

// Versioning pattern
var VERSIONING = '?v=@version@';



/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

                             GENERAL TASKS

 NOTE: Tasks which begin with an underscore are considered private and they
       shouldn't be start by hand

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/
gulp.task('test', function() {
    getGitOrigin();
    //console.log(config.version);
});

gulp.task('_sass', function(callback) {
  return $.rubySass(PATHS.CSS_SRC + '/main.scss', {sourcemap: true})
    .pipe($.autoprefixer('last 2 version'))
    .pipe($.sourcemaps.write())
    .on('error', onError)
    .pipe(gulp.dest(PATHS.CSS_SRC))
});

gulp.task('_minify-styles', function(callback) {
  return gulp.src(['**/*.css', '!**/*min.css'], {cwd: PATHS.CSS_SRC})
    .pipe($.rename({suffix: '.min'}))
    .pipe(development($.sourcemaps.init()))
    .pipe($.cssnano())
    .pipe(development($.sourcemaps.write()))
    .pipe(production($.size({ showFiles: true })))
    .on('error', onError)
    .pipe(development(gulp.dest(PATHS.CSS_SRC)))
    .pipe(production(gulp.dest(PATHS.CSS_DST)))
    .pipe(browserSync.stream());
});

gulp.task('_lint', function (callback) {
  return gulp.src(['**/*.js'], {cwd: PATHS.JS_SRC})
    .pipe($.jshint('.jshintrc'))
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.jshint.reporter('fail'))
    .on('error', onError);
});

gulp.task('_jasmine', function (callback) {
  return gulp.src(path.join(PATHS.JS_DST, 'main.min.js'))
        .pipe($.jasmineBrowser.specRunner())
        .on('error', onError);
});

gulp.task('_minify-scripts', function(callback) {
  return gulp.src(['**/*.js'], {cwd: PATHS.JS_SRC})
    .pipe($.concat('main.js'))
    .pipe(gulp.dest(PATHS.TMP))
    .pipe(development($.sourcemaps.init()))
    .pipe($.rename({suffix: '.min'}))
    .pipe($.uglify())
    .pipe(production($.size({ showFiles: true })))
    .on('error', onError)
    .pipe(development($.sourcemaps.write()))
    .pipe(development(gulp.dest(PATHS.JS_SRC)))
    .pipe(production(gulp.dest(PATHS.JS_DST)));
});

gulp.task('_minify-html', function(callback) {
    return gulp.src(path.join(PATHS.DIST_DIR, '**/*.html'))
            .pipe($.versionAppend(['html', 'js', 'css']))
            .pipe($.htmlmin({collapseWhitespace: true}))
            .pipe(gulp.dest(PATHS.DIST_DIR));
});

gulp.task('_copy-html-to-dist', function(callback) {

    return gulp.src(path.join(PATHS.SRC_DIR, '**/*.html'))
           .pipe($.replace(/stylesheets/g, 'css'))
           .on('error', onError)
           .pipe(gulp.dest(PATHS.DIST_DIR));
});

gulp.task('_images', function(callback) {
  return gulp.src(['**/*.{png,gif,jpg}'], {cwd: PATHS.IMAGES_SRC})
    .pipe($.cache($.imagemin({
        optimizationLevel: 5,
        progressive: true,
        interlaced: true }
    )))
    .on('error', onError)
    .pipe(gulp.dest(PATHS.IMAGES_DST))
    .pipe($.notify({ message: 'Images task complete' }));
});


/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                               VERSIONING TASKS
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


gulp.task('_bump', function (callback) {

    /// <summary>
    /// It bumps revisions
    /// Usage:
    /// 1. gulp bump: bumps the package.json and bower.json to the next minor revision.
    ///   i.e. from 0.1.1 to 0.1.2
    /// 2. gulp bump --version 1.1.1 : bumps/sets the package.json and bower.json to the
    ///    specified revision.
    /// 3. gulp bump --type major       : bumps 1.0.0
    ///    gulp bump --type minor       : bumps 0.1.0
    ///    gulp bump --type patch       : bumps 0.0.2
    ///    gulp bump --type prerelease  : bumps 0.0.1-2
    /// </summary>

    var type = args.type;
    var version = args.version;
    var options = {};

    if (version) {
        options.version = version;
    } else {
        options.type = type;
    }


    return gulp
        .src([path.join(PATHS.ROOT, 'package.json')])
        .pipe($.bump(options))
        .pipe(gulp.dest(PATHS.ROOT));
});

gulp.task('_add-versioning-tags', function(callback) {
    return gulp.src(path.join(PATHS.DIST_DIR, '**/*.html'))
           .pipe($.replace(/\.css/g, '.css' + VERSIONING))
           .pipe($.replace(/\.js/g, '.js' + VERSIONING))
           .on('error', onError)
           .pipe(gulp.dest(PATHS.DIST_DIR));
});

/*******************************************************************************
*
*                              RELEASE TASKS
*
*******************************************************************************/

gulp.task('pre-release', function(callback) {

    // Create and switch to the release branch

    var config = getConfig();

    var branchName = 'release-' + config.version;

    $.git.checkout(branchName, {args:'-b', '--track':'develop'}, function (err) {
        if (err) throw err;
    });
});

gulp.task('_checkout-master', function(callback) {

    $.git.checkout('master', function (err) {

        if (err) { throw err; }

        callback();
    });
});

gulp.task('_checkout-develop', function(callback) {

    $.git.checkout('develop', function (err) {

        if (err) { throw err; }

        callback();
    });
});

gulp.task('_release-merge', function(callback) {

    var config = getConfig();
    var vers   = config.version;
    var relBr  = 'release-' + vers;

    $.git.merge(relBr, {args: '--no-ff' }, function(err) {

        if (err) { throw err; }

        callback();
    });
});

gulp.task('_release', function(callback) {

    runSequence('_checkout-master',
                '_release-merge',
                '_checkout-develop',
                '_release-merge');

});






/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                                  SERVER
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


gulp.task('server', function() {

    var baseDir = production() ? PATHS.DIST_DIR : PATHS.SRC_DIR;

    browserSync.init({
        server: {
            baseDir: baseDir + '/'
        }
    });

    if (development) {

        // Watch .scss files
        gulp.watch(path.join(PATHS.CSS_SRC, '**/*.scss'), ['build-styles']);

        // Watch .js files
        gulp.watch(path.join(PATHS.JS_SRC, '**/*.js'), ['build-scripts', function() {
            browserSync.reload();
        }]);


        gulp.watch(baseDir + '/*.html').on('change', browserSync.reload);
    }
});



/*******************************************************************************
*
*                              BUILD TASKS
*
*******************************************************************************/


gulp.task('build-clean', function(callback) {
    return del([PATHS.CSS_DST,
                PATHS.JS_DST,
                PATHS.IMAGES_DST]);
});

gulp.task('build-scripts', function(callback) {
    runSequence('_lint', '_minify-scripts', '_jasmine', callback);
});

gulp.task('build-styles', function(callback) {
    runSequence('_sass', '_minify-styles', callback);
});


gulp.task('default', function(callback) {

    runSequence('build-clean',
                ['build-styles', 'build-scripts'],
                '_images',
                '_copy-html-to-dist',
                'server',
                callback);
});

