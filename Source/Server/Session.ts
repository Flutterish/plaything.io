export type SessionKey = string;

function nextKey () {
    var charset = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890-=_';
    let key = '';
    for ( let i = 0; i < 64; i++ ) {
        key += charset[ Math.floor( Math.random() * charset.length ) ];
    }

    return key;
}

export default function CreateSessionPool<T> ( name: string ) {
    var sessions: { [key: SessionKey]: T } = {};

    function generateSession ( data: T ): [ key: SessionKey, session: T ] {
        do {
            var key = nextKey();
        }
        while ( sessions[key] != undefined );
        sessions[key] = data;

        return [key, data];
    }

    // TODO expire sessions
    return {
        name: name,
        createSession: generateSession,
        sessionExists: ( key: SessionKey ) => sessions[key] != undefined,
        getSession: (( key: SessionKey ) => sessions[key]) as (key: SessionKey) => T | undefined,
        destroySession: ( key: SessionKey ) => delete sessions[key]
    };
};