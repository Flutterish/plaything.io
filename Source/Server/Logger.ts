function generateCensor () {
    var charset = '#$!@%^&*';
    let key = '';
    for ( let i = 0; i < 16; i++ ) {
        key += charset[ Math.floor( Math.random() * charset.length ) ];
    }

    return key;
}

function shouldCensor ( key: string ) {
    return key.toLowerCase() == 'password';
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
                out[key] = shouldCensor( key ) ? generateCensor() : process( obj[key] );
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