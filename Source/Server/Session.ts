import { CreateEvent } from "./Events.js";

export type SessionKey = string;

function nextKey () {
    var charset = 'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890-=_';
    let key = '';
    for ( let i = 0; i < 64; i++ ) {
        key += charset[ Math.floor( Math.random() * charset.length ) ];
    }

    return key;
}

export default function CreateSessionPool<Tdata> ( name?: string ) {
    var sessions: { [key: SessionKey]: Tdata } = {};

    var [entryAddedEvent, entryAddedTrigger] = CreateEvent<Tdata>();
    var [entryRemovedEvent, entryRemovedTrigger] = CreateEvent<Tdata>();

    function generateSession ( data: Tdata ) {
        do {
            var key = nextKey();
        }
        while ( sessions[key] != undefined );
        sessions[key] = data;

        entryAddedTrigger( data );

        return key;
    }

    // TODO expire sessions
    var pool = {
        name: name,
        createSession: generateSession,
        sessionExists: ( key: SessionKey ) => sessions[key] != undefined,
        getSession: ( key: SessionKey ): Tdata | undefined => sessions[key],
        destroySession: ( key: SessionKey ) => {
            var data = sessions[key];
            if ( data != undefined ) {
                delete sessions[key];
                entryRemovedTrigger( data );
            }
        },
        getAll: (): Readonly<typeof sessions> => sessions,
        entryAdded: entryAddedEvent,
        entryRemoved: entryRemovedEvent,

        WithIndex: <Tindex>( fn: (data: Tdata) => Tindex ) => {
            var index = new Map<Tindex, SessionKey>();

            return {
                name: name,
                getAll: pool.getAll,
                createSession: ( data: Tdata ) => {
                    var key = pool.createSession( data );
                    index.set( fn( data ), key );
                    return key;
                },
                sessionExists: pool.sessionExists,
                indexExists: ( key: Tindex ) => index.has( key ),
                getSession: pool.getSession,
                getIndexed: ( key: Tindex ): Tdata | undefined => {
                    var k = index.get( key );
                    if ( k == undefined ) return undefined;
                    return pool.getSession( k );
                },
                getIndex: ( key: Tindex ): SessionKey | undefined => index.get( key ),
                destroySession: ( key: SessionKey ) => {
                    var session = pool.getSession( key );
                    if ( session == undefined ) return;
                    index.delete( fn( session ) );
                    pool.destroySession( key );
                },
                destroyIndex: ( key: Tindex ) => {
                    var session = index.get( key );
                    if ( session == undefined ) return;
                    index.delete( key );
                    pool.destroySession( session );
                },
                entryAdded: pool.entryAdded,
                entryRemoved: pool.entryRemoved
            };
        }
    };

    return pool;
};