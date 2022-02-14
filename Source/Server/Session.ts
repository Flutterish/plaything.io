type SessionKey = string;

function nextKey () {
    var charset = 'qwertyuiopasdfghjklzxcvbnm1234567890-=+_[{]}';
    let key = '';
    for ( let i = 0; i < 256; i++ ) {
        key += charset[ Math.floor( Math.random() * charset.length ) ];
    }

    return key;
}

export default function CreateSessionPool<T> ( name: string ) {
    var sessions: { [key: SessionKey]: T } = {};

    function generateSession ( data: T ) {
        do {
            var key = nextKey();
        }
        while ( sessions[key] != undefined );
        sessions[key] = data;

        return key;
    }

    return {
        name: name,
        createSession: generateSession,
        sessionExists: ( key: SessionKey ) => sessions[key] != undefined,
        getSession: (( key: SessionKey ) => sessions[key]) as (key: SessionKey) => T | undefined,
        destroySession: ( key: SessionKey ) => delete sessions[key]
    };
};