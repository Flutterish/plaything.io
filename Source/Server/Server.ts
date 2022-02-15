import express from 'express';
import { AllowAnonymousAccess, getUser, MakeAnonUser, verifyUser } from './Whitelist.js';
import CreateSessionPool from './Session.js';
import { WebSocketServer, WebSocket } from 'ws';
import { API, RequestResponseMap, Uncertain } from './Api';
import { FreeLogFile, LogConnecction } from './Logger.js';
import { UserSession } from './User.js';
import { SessionKey } from './Session';
import { Reactive } from './Reactive.js';

const app = express();
const port = 8080;
const serverName = 'sample-server';
const loginSessions = CreateSessionPool<UserSession>( 'login pool' );
const wsSessions = new Map<WebSocket, SessionKey>();
function getSessionKey ( ws?: WebSocket, falllback?: SessionKey ) {
    return ( ws == undefined ? undefined : wsSessions.get( ws ) ) ?? falllback;
}

setInterval( () => {
    var now = Date.now();
    for ( const key in loginSessions.getAll() ) {
        var session = loginSessions.getSession( key )!;

        session.isActive.Value = session.lastActive + 20 * 1000 > now;
        if ( session.lastActive + 24 * 60 * 60 * 1000 < now ) {
            loginSessions.destroySession( key );
        }
    }
}, 30 * 1000 );

const files = express.static( './../Files', { index: 'main', extensions: ['html'] } );
app.get( '/api/*', async (req, res) => {
    var path = req.path.split( '/' );
    var request: any;
    if ( path.length == 3 ) {
        request = {
            ...req.query,
            type: path[2]
        };
    }
    else if ( path.length == 4 ) {
        request = {
            ...req.query,
            sessionKey: path[2],
            type: path[3]
        };
    }
    else {
        LogConnecction( req.ip, 'in', { path: req.path, query: req.query } );
        var error: API.Error = {
            error: 'incorrect API call'
        };
        res.setHeader( 'content-type', 'application/json' );
        LogConnecction( req.ip, 'out', error );
        res.send( JSON.stringify( error ) );
        res.end();
        return;
    }

    if ( request.type in ApiHandlers ) LogConnecction( req.ip, 'in', request );
    res.setHeader( 'content-type', 'application/json' );
    var data = await processRequest( request );
    if ( data != undefined ) {
        LogConnecction( req.ip, 'out', data );
        res.send( JSON.stringify( data ) );
    }
    res.end();
} );
app.use( '/', files );
app.get( '/*', (req, res) => {
    req.url = '/bootstrap';
    files( req, res, () => {
        res.statusCode = 404;
        res.end();
    } );
} );

const wss = new WebSocketServer({ noServer: true });
wss.addListener( 'connection', (ws, req) => {
    var address = req.socket.remoteAddress ?? '???';
    LogConnecction( address, 'in', `Client established a websocket` );

    ws.addEventListener( 'close', e => {
        LogConnecction( address, 'in', `Closed a websocket connection because:`, e.reason || '<no reason provided>' );
        wsSessions.delete( ws );
        FreeLogFile( address );
    } );
    ws.addEventListener( 'error', err => {
        LogConnecction( address, 'in', `Error on connection:`, err.message );
    } );
    ws.addEventListener( 'message', msg => {
        var str = msg.data.toString();
        try {
            var data = JSON.parse( str );
            if ( data.type in ApiHandlers ) LogConnecction( address, 'in', data );

            if ( typeof data !== 'object' || typeof data.type !== 'string' ) {
                var r = {
                    error: 'Invalid request',
                    id: data?.id
                };
                ws.send( JSON.stringify( r ) );
                LogConnecction( address, 'out', r );
            }
            else {
                processRequest( data, ws ).then( res => {
                    if ( res != undefined ) {
                        ws.send( JSON.stringify( res ) );
                        LogConnecction( address, 'out', res );
                    }
                } );
            }
        }
        catch {
            LogConnecction( address, 'in', str );
            var r = {
                error: 'Invalid request',
                id: data?.id
            };
            ws.send( JSON.stringify( r ) );
            LogConnecction( address, 'out', r );
        }
    } );
} );

const server = app.listen( port, () => {
	console.log( `Listening on port ${port}` );
} );

server.on( 'upgrade', (req, ws, head) => {
    wss.handleUpgrade( req, ws, head, ws => {
        wss.emit( 'connection', ws, req );
    } );
} );

function isNullOrEmpty ( str?: string ): str is '' | undefined {
    return typeof str !== 'string' || str.length == 0;
}

function isSessionValid ( key?: string ): key is string {
    return !isNullOrEmpty( key ) && loginSessions.sessionExists( key );
}


async function processRequest (req: (API.Request & { id?: number }) | API.Message, ws?: WebSocket): Promise<(API.Response & { id?: number } | void)> {
    if ( ws != undefined || 'sessionKey' in req ) {
        var key = getSessionKey( ws, (req as any).sessionKey );
        if ( isSessionValid( key ) ) {
            loginSessions.getSession( key )!.lastActive = Date.now();
            loginSessions.getSession( key )!.isActive.Value = true;
        }
    }

    if ( req.type in MessageHandlers ) {
        // @ts-ignore
        var handler = MessageHandlers[req.type] as (req: API.Message, ws?: WebSocket) => Promise<void>;
        await handler( req as API.Message, ws );
    }
    else if ( req.type in ApiHandlers ) {
        // @ts-ignore
        var handler = ApiHandlers[req.type] as (req: API.Request, ws?: WebSocket) => Promise<API.Response>;
        // @ts-ignore
        var val = await handler( req, ws ) as API.Response & { id?: number };
        // @ts-ignore
        val.id = req.id;

        return val;
    }
    else {
        return {
            error: 'Invalid request type',
            // @ts-ignore
            id: req.id
        };
    }
}

const ApiHandlers: {
    [Key in API.Request['type']]: (req: Uncertain<Extract<API.Request, { type: Key }>>, ws?: WebSocket) => Promise<RequestResponseMap[Key]>
} = {
    'loginInformation': async req => {
        return { anonymousAllowed: AllowAnonymousAccess };
    },

    'login': async (req, ws) => {
        if ( isNullOrEmpty( req.nickname ) ) {
            return { 
                result: 'invalid',
                reason: (isNullOrEmpty( req.password ) && !AllowAnonymousAccess) ? 'nickname and password required' : 'nickname required'
            };
        }

        if ( isNullOrEmpty( req.password ) ) {
            if ( !AllowAnonymousAccess ) {
                return { 
                    result: 'invalid',
                    reason: 'password required'
                };
            }
            else {
                var key = loginSessions.createSession( new UserSession( MakeAnonUser( req.nickname ) ) );

                if ( ws != undefined )
                    wsSessions.set( ws, key );

                return {
                    result: 'ok',
                    sessionKey: key
                };
            }
        }

        var user = await getUser( req.nickname );
        if ( user == undefined ) {
            return { 
                result: 'invalid',
                reason: 'invalid credentials'
            };
        }
        else {
            if ( await verifyUser( user, req.password ) ) {
                var key = loginSessions.createSession( new UserSession( user ) );

                if ( ws != undefined )
                    wsSessions.set( ws, key );

                return {
                    result: 'ok',
                    sessionKey: key
                };
            }
            else {
                return { 
                    result: 'invalid',
                    reason: 'invalid credentials'
                };
            }
        }
    },

    'serverInformation': async req => {
        return {
            name: serverName
        };
    },

    'logout': async (req, ws) => {
        var key = getSessionKey( ws, req.sessionKey );

        if ( isSessionValid( key ) ) {
            loginSessions.destroySession( key );
            
            if ( ws != undefined )
                wsSessions.delete( ws );

            return {
                result: 'ok'
            }
        }
        else return {
            result: 'session not found'
        }
    },

    'reconnect': async (req, ws) => {
        var isValid = isSessionValid( req.sessionKey );
        if ( ws != undefined && isValid )
            wsSessions.set( ws, req.sessionKey! );

        return {
            value: isValid
        }
    },

    'subscibeDevices': async (req, ws) => {
        var key = getSessionKey( ws, req.sessionKey );

        if ( isSessionValid( key ) ) {
            var session = loginSessions.getSession( key )!;
            return {
                result: 'ok',
                devices: session.user.allowedDevices.map( x => x.name )
            }
            // TODO heartbeat-devices when this goes reactive
        }
        else return {
            result: 'session not found'
        }
    },

    'subscibeUsers': async (req, socket) => {
        var key = getSessionKey( socket, req.sessionKey );

        if ( isSessionValid( key ) ) {
            var session = loginSessions.getSession( key )!;
            
            if ( socket != undefined ) {
                let ws = socket;
                let reactives: { [uid: number]: Reactive<boolean> } = {};

                function added ( s: UserSession ) {
                    var reactive = new Reactive<boolean>( s.isActive );
                    reactives[ s.user.UID ] = reactive;
                    reactive.AddOnValueChanged( activityChanged( s ), true );
                }
                function removed ( s: UserSession ) {
                    if ( s.user == session.user ) {
                        loginSessions.entryAdded.removeEventListener( added );
                        loginSessions.entryRemoved.removeEventListener( removed );
                        return;
                    }

                    var data: API.HeartbeatUsers = {
                        type: 'heartbeat-users',
                        kind: 'removed',
                        uid: s.user.UID
                    };
                    ws.send( JSON.stringify( data ) );
                    delete reactives[ s.user.UID ];
                }

                function activityChanged ( s: UserSession ) {
                    return (v: boolean) => {
                        if ( v ) {
                            var data: API.HeartbeatUsers = {
                                type: 'heartbeat-users',
                                kind: 'added',
                                user: { nickname: s.user.nickname, location: serverName, uid: s.user.UID }
                            };
                            ws.send( JSON.stringify( data ) );
                        }
                        else {
                            var data: API.HeartbeatUsers = {
                                type: 'heartbeat-users',
                                kind: 'removed',
                                uid: s.user.UID
                            };
                            ws.send( JSON.stringify( data ) );
                        }
                    };
                }

                for ( const s of Object.values( loginSessions.getAll() ).filter( x => x.user != session.user ) ) {
                    var reactive = new Reactive<boolean>( s.isActive );
                    reactives[ s.user.UID ] = reactive;
                    reactive.AddOnValueChanged( activityChanged( s ) );
                }

                loginSessions.entryAdded.addEventListener( added );
                loginSessions.entryRemoved.addEventListener( removed );
            }

            return {
                result: 'ok',
                users: Object.values( loginSessions.getAll() ).filter( x => x.user != session.user && x.isActive.Value )
                    .map( x => ({ nickname: x.user.nickname, location: serverName, uid: x.user.UID }) )   
            }
        }
        else return {
            result: 'session not found'
        }
    }
};

const MessageHandlers : {
    [Key in API.Message['type']]: (req: Uncertain<Extract<API.Message, { type: Key }>>, ws?: WebSocket) => Promise<void>
} = {
    'alive': async (req, ws) => { }
};