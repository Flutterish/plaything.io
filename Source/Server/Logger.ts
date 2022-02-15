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

export function Log ( ...args: any[] ) {
    console.log( `[${new Date()}]:`, ...args.map( x => process( x ) ) );
}

export function LogConnecction ( who: string, direction: 'in' | 'out', ...args: any[] ) {
    console.log( `[${new Date()}]:`, who, direction == 'in' ? '-->' : '<--', ...args.map( x => process( x ) ) );
}