import express from 'express';
import { AllowAnonymousAccess, getUser, MakeAnonUser, verifyUser } from './Whitelist.js';
import CreateSessionPool from './Session.js';
import { WebSocketServer, WebSocket } from 'ws';
import { API, RequestResponseMap, Uncertain } from './Api';
import { FreeLogFile, Log, LogConnection, LogUser, LogWithSource } from './Logger.js';
import { User, CreateUserPool, UserSession, CreateActiveUserPool } from './User.js';
import { SessionKey } from './Session';
import { PoolSubscription, CreatePoolSubscription, SubscribeablePool } from './Subscription.js';
import { Room, CreateRoom, RoomSession } from './Room.js';
import { RoomControlInstance } from './Room';

const app = express();
const port = 8080;
const serverName = 'sample-server';
// sessions - a singe user can have multiple sessions
const loginSessions = CreateSessionPool<UserSession>( 'login pool' );
// all unique users with at least one session
const loggedInUsers = CreateUserPool( loginSessions );
// ones with at least one active session
const activeUsers = CreateActiveUserPool( loginSessions );

const roomsByDeviceId: { [id: number]: Room & { activePool: SubscribeablePool<User> } } = {};

activeUsers.entryAdded.addEventListener( user => {
    user.lastActive = Date.now();
    user.isActive.Value = true;

    LogUser( user, `is active` );
} );
activeUsers.entryRemoved.addEventListener( user => {
    user.lastActive = Date.now();
    user.isActive.Value = false;

    LogUser( user, `is no longer active` );
} );

// TODO we will need to abstract this away
// NOTE these also need to be connected to a session or a user because they can be cancelled by say leaving a room with a http request which wouldnt cancel it
const wsSessions = new Map<WebSocket, SessionKey>();
const wsUserSubscriptions = new Map<WebSocket, PoolSubscription<User>>();
const wsRoomSubscriptions = new Map<WebSocket, PoolSubscription<User>>();
const wsControlSubscriptions = new Map<WebSocket, PoolSubscription<RoomControlInstance>>();
function getSessionKey ( ws?: WebSocket, falllback?: SessionKey ) {
    return ( ws == undefined ? undefined : wsSessions.get( ws ) ) ?? falllback;
}

setInterval( () => {
    var now = Date.now();
    for ( const key in loginSessions.getAll() ) {
        var session = loginSessions.getSession( key )!;

        // TODO if a websocket exists on this connection, it is active
        if ( session.isActive.Value && session.lastActive + 20 * 1000 < now )
            session.isActive.Value = false;

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
        LogConnection( req.ip, 'in', { path: req.path, query: req.query } );
        var error: API.Error = {
            error: 'incorrect API call'
        };
        res.setHeader( 'content-type', 'application/json' );
        LogConnection( req.ip, 'out', error );
        res.send( JSON.stringify( error ) );
        res.end();
        return;
    }

    if ( request.type in ApiHandlers ) LogConnection( req.ip, 'in', request );
    res.setHeader( 'content-type', 'application/json' );
    var data = await processRequest( request );
    if ( data != undefined ) {
        LogConnection( req.ip, 'out', data );
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
    LogConnection( address, 'in', `Client established a websocket` );

    ws.addEventListener( 'close', e => {
        LogConnection( address, 'in', `Closed a websocket connection because:`, e.reason || '<no reason provided>' );
        var key = wsSessions.get( ws );
        if ( key != undefined ) {
            loginSessions.getSession( key )!.isActive.Value = false;
        }
        wsSessions.delete( ws );
        wsUserSubscriptions.get( ws )?.unsubscribe();
        wsUserSubscriptions.delete( ws );
        wsRoomSubscriptions.get( ws )?.unsubscribe();
        wsRoomSubscriptions.delete( ws );
        wsControlSubscriptions.get( ws )?.unsubscribe();
        wsControlSubscriptions.delete( ws );
        FreeLogFile( address );
    } );
    ws.addEventListener( 'error', err => {
        LogConnection( address, 'in', `Error on connection:`, err.message );
    } );
    ws.addEventListener( 'message', msg => {
        var str = msg.data.toString();
        try {
            var data = JSON.parse( str );
            if ( data.type in ApiHandlers ) LogConnection( address, 'in', data );

            if ( typeof data !== 'object' || typeof data.type !== 'string' ) {
                var r = {
                    error: 'Invalid request',
                    id: data?.id
                };
                ws.send( JSON.stringify( r ) );
                LogConnection( address, 'out', r );
            }
            else {
                processRequest( data, ws ).then( res => {
                    if ( res != undefined ) {
                        ws.send( JSON.stringify( res ) );
                        LogConnection( address, 'out', res );
                    }
                } );
            }
        }
        catch {
            LogConnection( address, 'in', str );
            var r = {
                error: 'Invalid request',
                id: data?.id
            };
            ws.send( JSON.stringify( r ) );
            LogConnection( address, 'out', r );
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
            var session = loginSessions.getSession( key )!;
            session.lastActive = session.user.lastActive = Date.now();
            session.isActive.Value = session.user.isActive.Value = true;
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
    'server-information': async req => {
        return {
            name: serverName
        };
    },

    'login-information': async req => {
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

    'reconnect': async (req, ws) => {
        var isValid = isSessionValid( req.sessionKey );
        if ( ws != undefined && isValid )
            wsSessions.set( ws, req.sessionKey! );

        return {
            value: isValid
        }
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

    'subscibe-devices': SessionHandler( async ( session, req, ws ) => {
        return {
            result: 'ok',
            devices: session.user.allowedDevices.map( x => ({ name: x.name, id: x.ID }) )
        }
        // TODO heartbeat-devices when this goes reactive
    } ),

    'subscibe-users': SessionHandler( async ( session, req, ws ) => {
        if ( ws != undefined && !wsUserSubscriptions.has( ws ) ) {
            function addOrUpdate ( user: User, kind: 'added' | 'updated' ) {
                ws!.send( JSON.stringify( {
                    type: 'heartbeat-users',
                    kind: kind,
                    user: { uid: user.UID, nickname: user.nickname, location: user.room.Value?.name ?? serverName, accent: user.accent.Value }
                } as API.HeartbeatUsers ) );
            }

            function remove ( user: User ) {
                ws!.send( JSON.stringify( {
                    type: 'heartbeat-users',
                    kind: 'removed',
                    uid: user.UID
                } as API.HeartbeatUsers ) );
            }

            wsUserSubscriptions.set( ws, CreatePoolSubscription<User>(
                activeUsers,
                ( user, scan ) => { if ( !scan && user != session.user ) addOrUpdate( user, 'added' ) },
                ( user ) => { if ( user != session.user ) remove( user ) }
            ).ReactTo( user => user.accent, ( user, value ) => {
                if ( user != session.user ) addOrUpdate( user, 'updated' )
            } ).ReactTo( user => user.room, ( user, value ) => {
                if ( user != session.user ) addOrUpdate( user, 'updated' )
            } ) );
        }

        return {
            result: 'ok',
            users: activeUsers.getValues().filter( x => x != session.user )
                .map( x => ({ nickname: x.nickname, location: x.room.Value?.name ?? serverName, uid: x.UID, accent: x.accent.Value }) )   
        }
    } ),

    'save-prefereces': SessionHandler( async ( session, req, ws ) => {
        if ( typeof req.accent === 'string' )
            session.user.accent.Value = req.accent;

        if ( typeof req.theme === 'string' )
            session.user.theme = req.theme;

        return { result: true };
    } ),

    'load-preferences': SessionHandler( async ( session, req, ws ) => {
        return {
            result: 'ok',
            accent: session.user.accent.Value,
            theme: session.user.theme
        };
    } ),

    'device-info': SessionHandler( async ( session, req, ws ) => {
        var index = session.user.allowedDevices.findIndex( x => x.ID == req.deviceId );

        if ( index == -1 ) {
            return {
                result: 'not found'
            }
        }
        else {
            var device = session.user.allowedDevices[ index ];
            return {
                result: 'ok',
                name: device.name,
                controls: device.controls.map( x => x.Prototype )
            }
        }
    } ),

    'join-control': SessionHandler( async ( session, req, ws ) => {
        var index = session.user.allowedDevices.findIndex( x => x.ID == req.deviceId );
        if ( index == -1 ) {
            return {
                result: 'device not found'
            }
        }
        else {
            var device = session.user.allowedDevices[ index ];
            var room = roomsByDeviceId[ device.ID ];
            if ( room == undefined ) {
                roomsByDeviceId[ device.ID ] = room = CreateRoom( device.name, device.controls );

                room.entryRemoved.addEventListener( () => {
                    if ( room.getValues().length == 0 ) {
                        delete roomsByDeviceId[ device.ID ];
                    }
                } );
            }

            if ( session.user.room.Value != undefined && session.user.room.Value != room ) {
                session.user.room.Value.leave( session.user );
                session.user.room.Value = undefined;
            }

            if ( session.user.room.Value == room || room.join( session.user ) ) {
                session.user.room.Value = room;
                if ( ws != undefined ) {
                    wsRoomSubscriptions.get( ws )?.unsubscribe();
                    wsRoomSubscriptions.delete( ws );
                    wsControlSubscriptions.get( ws )?.unsubscribe();
                    wsControlSubscriptions.delete( ws );

                    function joinOrUpdate ( user: User, kind: 'user-joined' | 'user-updated' ) {
                        var session = room.getSession( user )!;
                        ws!.send( JSON.stringify( {
                            type: 'hearthbeat-control-room',
                            kind: kind,
                            user: { uid: user.UID, nickname: user.nickname, accent: user.accent.Value, x: session.position.Value[0], y: session.position.Value[1], pointer: session.cursorStyle.Value }
                        } as API.HeartbeatControlRoomUpdate ) )
                    }

                    wsRoomSubscriptions.set( ws, CreatePoolSubscription<User>( 
                        room.activePool,
                        (user, scan) => { if ( !scan && user != session.user ) joinOrUpdate( user, 'user-joined' ) },
                        user => { if ( user != session.user ) ws.send( JSON.stringify( {
                            type: 'hearthbeat-control-room',
                            kind: 'user-left',
                            uid: user.UID
                        } as API.HeartbeatControlRoomUpdate ) ) }
                    ).ReactTo( 
                        x => x.accent, 
                        (user, v) => { if ( user != session.user ) joinOrUpdate( user, 'user-updated' ) }
                    ).ReactTo(
                        x => room.getSession( x )!.position,
                        (user, v) => { if ( user != session.user ) joinOrUpdate( user, 'user-updated' ) }
                    ).ReactTo(
                        x => room.getSession( x )!.cursorStyle,
                        (user, v) => { if ( user != session.user ) joinOrUpdate( user, 'user-updated' ) }
                    ) );

                    function sendUpdate ( control: RoomControlInstance ) {
                        ws!.send( JSON.stringify( {
                            type: 'hearthbeat-control-room',
                            kind: 'control-modified',
                            control: { controlId: control.id, state: control.control.State.Value, hovered: control.isHovered.Value, active: control.isActive.Value }
                        } as API.HeartbeatControlRoomUpdate ) );
                    }

                    wsControlSubscriptions.set( ws, CreatePoolSubscription<RoomControlInstance>(
                        room.controls,
                        (control, scan) => {},
                        (control) => {}
                    ).ReactTo( 
                        x => x.isHovered,
                        control => sendUpdate( control )
                    ).ReactTo( 
                        x => x.isActive,
                        control => sendUpdate( control )
                    ).ReactTo(
                        x => x.control.State,
                        control => sendUpdate( control )
                    ) );
                }
    
                return {
                    result: 'ok',
                    users: room.getSessions().filter( x => x.user != session.user && x.isActive.Value )
                        .map( x => ({ uid: x.user.UID, nickname: x.user.nickname, accent: x.user.accent.Value, x: x.position.Value[0], y: x.position.Value[1], pointer: x.cursorStyle.Value }) ),
                    controls: room.controls.getValues()
                        .map( x => ({ active: x.isActive.Value, hovered: x.isHovered.Value, controlId: x.id, state: x.control.State.Value } ) )
                }
            }
            else {
                return {
                    result: 'cant join room'
                }
            }
        }
    } )
};

function SessionHandler<Treq extends API.SessionRequest, Tres> ( code: (session: UserSession, req: Treq, ws?: WebSocket) => Promise<Tres> ): (( req: Treq, ws?: WebSocket ) => Promise<Tres | API.InvalidSession>) {
    return async (req, ws) => {
        var key = getSessionKey( ws, req.sessionKey );
        if ( isSessionValid( key ) ) {
            return await code( loginSessions.getSession( key )!, req, ws );
        }
        else return {
            'result': 'session not found'
        }
    }
}

const MessageHandlers: {
    [Key in API.Message['type']]: (req: Uncertain<Extract<API.Message, { type: Key }>>, ws?: WebSocket) => Promise<unknown>
} = {
    'alive': async (req, ws) => { },

    'moved-pointer': SessionHandler( async ( session, req, ws ) => {
        var room = session.user.room.Value;
        
        if ( room != undefined ) {
            room.handleUserMovedPointer( session.user, req );
        }
    } ),

    'modified-control': SessionHandler( async ( session, req, ws ) => {
        var room = session.user.room.Value;
        
        if ( room != undefined ) {
            room.handleUserModifiedControl( session.user, req );
        }
    } ),

    'leave-room': SessionHandler( async ( session, req, ws ) => {
        var room = session.user.room.Value;
        
        if ( room != undefined ) {
            room.leave( session.user );
            session.user.room.Value = undefined;
            if ( ws != undefined ) {
                wsRoomSubscriptions.get( ws )?.unsubscribe();
                wsRoomSubscriptions.delete( ws );
                wsControlSubscriptions.get( ws )?.unsubscribe();
                wsControlSubscriptions.delete( ws );
            }
        }
    } ),
};