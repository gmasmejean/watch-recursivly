var os = require('os'),
    fs = require('fs');

module.exports = os.platform() === 'linux' ? watchFallback : fs.watch;

function watchFallback( path, ...args ){
    let opts,
        callback,
        isDirectory = fs.statSync( path ).isDirectory();

    if( typeof args[0] === 'function' ){
        callback = args[0];
    }else if( typeof args[0] !== 'function' && typeof args[1] === 'function' ){
        opts = args[0];
        callback = args[1];
    }

    if( typeof opts === 'object' && opts.recursive && isDirectory ){
        return watch( path, opts, callback );
    }else{
        return fs.watch.apply( fs, arguments );
    }
}

function watch( path, opts, callback ){
    var original_path = path+(path.slice(-1)==='/'?'':'/'),
        watchers = {};

    _watch( original_path, opts, callback );
    return { close: close };

    function _watch( path, opts, callback ){
        // WATCH PASSED PATH...
        watchers[ path ] = fs.watch( path, opts, _callback.bind(undefined, path ) );
        // SCAN DIRECTORY ...

        fs.readdir(path, function(err, files){
            if( err )
                return;

            files.forEach( file => {
                fs.stat( path+file, (err, stats) => {
                    if( err )
                        return;

                    if( stats.isDirectory() ){
                        _watch( path+file+'/', opts, callback );
                    }
                });
            });
        });
    }

    function _callback( path, evt, name ){
        if( name ){
            callback( evt, path.slice( original_path.length )+name );
            // IF A FILE/DIR APPEARS/DISAPPEARS => WATCH NEW DIR OR UNWATCH REMOVED DIR.
            if( evt === 'rename' && name ){
                let filepath = path+name;
                fs.stat( filepath, (err, stats) => {
                    if( err && err.code === 'ENOENT' && watchers[ filepath ] ){
                        watchers[ filepath ].close();
                        delete watchers[ filepath ];
                    }else if( stats && !watchers[ filepath ] && stats.isDirectory() ){
                        _watch( filepath+'/', opts, callback );
                    }
                });
            }
        }
    }

    function close(){
        Object.keys(watchers).forEach( key => watchers[key].close() );
    }
}
