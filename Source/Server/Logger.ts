import fs from 'fs';

function generateCensor ( key: string ) {
    return '[LOGGING FORBIDDEN]';
}

const bannedKeys = [
    'password',
    'sessionkey'
];
function shouldCensor ( key: string ) {
    return bannedKeys.includes( key.toLowerCase() );
}

function process ( obj: any ): typeof obj {
    if ( typeof obj === 'object' ) {
        if ( Array.isArray( obj ) ) {
            let out = [];
            for ( const i of obj ) {
                out.push( process( i ) );
            }

            return out;
        }
        else {
            let out: typeof obj = {};
            for ( const key in obj ) {
                if ( obj[key] != undefined )
                    out[key] = shouldCensor( key ) ? generateCensor( key ) : process( obj[key] );
            }

            return out;
        }
    }
    else {
        return obj;
    }
}

if ( !fs.existsSync( './Logs/' ) )
    fs.mkdirSync( './Logs/' );

export function Log ( ...args: any[] ) {
    args = args.map( x => process( x ) );
    console.log( `[${new Date().toLocaleString()}]:`, ...args );

    saveLog( 'system', args.map( x => typeof x === 'object' ? JSON.stringify( x ) : x ).join( ' ' ) );
}

export function LogConnecction ( who: string, direction: 'in' | 'out', ...args: any[] ) {
    args = args.map( x => process( x ) );
    console.log( `[${new Date().toLocaleString()}]:`, who, direction == 'in' ? '-->' : '<--', ...args );

    saveLog( who, [who, direction == 'in' ? '-->' : '<--', ...args].map( x => typeof x === 'object' ? JSON.stringify( x ) : x ).join( ' ' ) );
}

var streams: { [source: string]: [stream: fs.WriteStream, timestamp: number] } = {};
function saveLog ( source: string, data: string ) {
    if ( streams[ source ] == undefined )
        streams[ source ] = [fs.createWriteStream( `./Logs/${source.replace( /:/g, '!' )}.log`, { encoding: 'utf-8', flags: 'a+' } ), Date.now()];
    
    streams[ source ][0].write( `[${new Date().toLocaleString()}]: ` + data + '\n' );
    streams[ source ][1] = Date.now();
}

export function FreeLogFile ( source: string ) {
    if ( streams[ source ] != undefined ) {
        var stream = streams[ source ][0];
        stream.close();
        delete streams[ source ];
    }
}

setInterval( () => {
    for ( const source in streams ) {
        if ( streams[ source ][1] < Date.now() - 1000 * 60 * 8 ) {
            FreeLogFile( source );
        }
    }
}, 1000 * 60 * 10 );