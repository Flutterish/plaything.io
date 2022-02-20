import express from 'express';
import { AllowAnonymousAccess, getUser, MakeAnonUser, verifyUser } from './Whitelist.js';
import CreateSessionPool from './Session.js';
import { WebSocketServer } from 'ws';
import { Socket, WrapSocket } from './Socket.js';
import { API, RequestResponseMap, Uncertain } from './Api';
import { FreeLogFile, LogConnection, LogUser } from './Logger.js';
import { User, CreateUserPool, UserSession, CreateActiveUserPool } from './User.js';
import { SessionKey } from './Session';
import { CreatePoolSubscription, SubscribeablePool, CreateWebsocketSubscriptionManager } from './Subscription.js';
import { Room, CreateRoom } from './Room.js';
import { RoomControlInstance } from './Room';
import { CreateButtplugServer } from './Buttplug.Api.js';

const app = express();
const port = 8080;
const serverName = 'sample-server';
// sessions - a singe user can have multiple sessions
const loginSessions = CreateSessionPool<UserSession>( 'login pool' );
// all unique users with at least one session
const loggedInUsers = CreateUserPool( loginSessions );
// ones with at least one active session
const activeUsers = CreateActiveUserPool( loginSessions );

const roomsByDeviceId: { [id: string]: Room & { activePool: SubscribeablePool<User> } } = {};
export const buttplugServer = CreateButtplugServer( 8081 );

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

const wsSessions = new Map<Socket, SessionKey>();
const wsSubscriptions = CreateWebsocketSubscriptionManager();
function getSessionKey ( ws?: Socket, fallback?: SessionKey ) {
    return ( ws == undefined ? undefined : wsSessions.get( ws ) ) ?? fallback;
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
        res.send( error );
        res.end();
        return;
    }

    if ( request.type in ApiHandlers ) LogConnection( req.ip, 'in', request );
    res.setHeader( 'content-type', 'application/json' );
    var data = await processRequest( request );
    if ( data != undefined ) {
        LogConnection( req.ip, 'out', data );
        res.send( data );
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

    var socket = WrapSocket( ws );
    ws.addEventListener( 'close', e => {
        LogConnection( address, 'in', `Closed a websocket connection because:`, e.reason || '<no reason provided>' );
        var key = wsSessions.get( socket );
        if ( key != undefined ) {
            loginSessions.getSession( key )!.isActive.Value = false;
        }
        wsSessions.delete( socket );
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
                socket.send( r );
                LogConnection( address, 'out', r );
            }
            else {
                processRequest( data, socket ).then( res => {
                    if ( res != undefined ) {
                        socket.send( res );
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
            socket.send( r );
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


async function processRequest (req: (API.Request & { id?: number }) | API.Message, ws?: Socket): Promise<(API.Response & { id?: number } | void)> {
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
        var handler = MessageHandlers[req.type] as (req: API.Message, ws?: Socket) => Promise<void>;
        await handler( req as API.Message, ws );
    }
    else if ( req.type in ApiHandlers ) {
        // @ts-ignore
        var handler = ApiHandlers[req.type] as (req: API.Request, ws?: Socket) => Promise<API.Response>;
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
    [Key in API.Request['type']]: (req: Uncertain<Extract<API.Request, { type: Key }>>, ws?: Socket) => Promise<RequestResponseMap[Key]>
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
        if ( wsSubscriptions.canSubscribe( ws, 'devices' ) ) {
            var subscription = CreatePoolSubscription( 
                session.user.allowedDevices,
                device => ws.send<API.HeartbeatDevices>( {
                    type: 'heartbeat-devices',
                    kind: 'added',
                    device: { name: device.name, id: device.ID }
                } ),
                device => ws.send<API.HeartbeatDevices>( {
                    type: 'heartbeat-devices',
                    kind: 'removed',
                    deviceId: device.ID
                } ), 
                {
                    ignoreExistingEntries: true
                }
            );

            wsSubscriptions.createSubscription( ws, 'devices', subscription.unsubscribe );
        }

        return {
            result: 'ok',
            devices: session.user.allowedDevices.getValues().map( x => ({ name: x.name, id: x.ID }) )
        }
    } ),

    'subscibe-users': SessionHandler( async ( session, req, ws ) => {
        if ( wsSubscriptions.canSubscribe( ws, 'users' ) ) {
            function addOrUpdate ( user: User, kind: 'added' | 'updated' ) {
                ws!.send( {
                    type: 'heartbeat-users',
                    kind: kind,
                    user: { uid: user.UID, nickname: user.nickname, location: user.room.Value?.name ?? serverName, accent: user.accent.Value }
                } );
            }

            function remove ( user: User ) {
                ws!.send( {
                    type: 'heartbeat-users',
                    kind: 'removed',
                    uid: user.UID
                } );
            }

            var subscription = CreatePoolSubscription<User>(
                activeUsers,
                user => addOrUpdate( user, 'added' ),
                user => remove( user ), {
                    ignoreExistingEntries: true,
                    ignore: user => user == session.user
                }
            ).ReactTo( 
                user => user.accent, 
                user => addOrUpdate( user, 'updated' )
            ).ReactTo( 
                // TODO hide if the user doenst have access to it
                user => user.room,   
                user => addOrUpdate( user, 'updated' )
            );

            wsSubscriptions.createSubscription( ws, 'users', subscription.unsubscribe );
        }

        return {
            result: 'ok',
            users: activeUsers.getValues().filter( x => x != session.user )
                .map( x => ({ nickname: x.nickname, location: x.room.Value?.name ?? serverName /* TODO hide if the user doenst have access to it */, uid: x.UID, accent: x.accent.Value }) )   
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
        var device = session.user.allowedDevices.getValues().find( x => x.ID == req.deviceId );

        if ( device == undefined ) {
            return {
                result: 'not found'
            }
        }
        else {
            return {
                result: 'ok',
                name: device.name,
                controls: device.controls.map( x => x.Prototype ),
                values: device.controls.map( x => x.State.Value )
            }
        }
    } ),

    'join-control': SessionHandler( async ( session, req, ws ) => {
        var device = session.user.allowedDevices.getValues().find( x => x.ID == req.deviceId );

        if ( device == undefined ) {
            return {
                result: 'device not found'
            }
        }
        else {
            var room = roomsByDeviceId[ device.ID ];
            if ( room == undefined ) {
                roomsByDeviceId[ device.ID ] = room = CreateRoom( device.name, device.controls );

                room.entryRemoved.addEventListener( () => {
                    if ( room.getValues().length == 0 ) {
                        delete roomsByDeviceId[ device!.ID ];
                    }
                } );
            }

            if ( session.user.room.Value != undefined && session.user.room.Value != room ) {
                session.user.room.Value.leave( session.user );
                session.user.room.Value = undefined;
            }

            if ( session.user.room.Value == room || room.join( session.user ) ) {
                session.user.room.Value = room;
                // TODO disconnect from room if device is removed
                if ( wsSubscriptions.canSubscribe( ws, 'control-room' ) ) {
                    function joinOrUpdate ( user: User, kind: 'user-joined' | 'user-updated' ) {
                        var session = room.getSession( user )!;
                        ws!.send( {
                            type: 'hearthbeat-control-room',
                            kind: kind,
                            user: { uid: user.UID, nickname: user.nickname, accent: user.accent.Value, x: session.position.Value[0], y: session.position.Value[1], pointer: session.cursorStyle.Value }
                        } )
                    }

                    var roomSubscription = CreatePoolSubscription<User>( 
                        room.activePool,
                        user => joinOrUpdate( user, 'user-joined' ),
                        user => ws.send( {
                            type: 'hearthbeat-control-room',
                            kind: 'user-left',
                            uid: user.UID
                        } ), {
                            ignoreExistingEntries: true,
                            ignore: user => user == session.user
                        }
                    ).ReactTo( 
                        x => x.accent, 
                        user => joinOrUpdate( user, 'user-updated' )
                    ).ReactTo(
                        x => room.getSession( x )!.position,
                        user => joinOrUpdate( user, 'user-updated' )
                    ).ReactTo(
                        x => room.getSession( x )!.cursorStyle,
                        user => joinOrUpdate( user, 'user-updated' )
                    );

                    function sendUpdate ( control: RoomControlInstance ) {
                        ws!.send( {
                            type: 'hearthbeat-control-room',
                            kind: 'control-modified',
                            control: { controlId: control.id, state: control.control.State.Value, hovered: control.isHovered.Value, active: control.isActive.Value }
                        } );
                    }

                    var controlSubscription = CreatePoolSubscription<RoomControlInstance>(
                        room.controls,
                        () => {},
                        () => {}
                    ).ReactTo( 
                        x => x.isHovered,
                        control => sendUpdate( control )
                    ).ReactTo( 
                        x => x.isActive,
                        control => sendUpdate( control )
                    ).ReactTo(
                        x => x.control.State,
                        control => sendUpdate( control )
                    );

                    function messageSubscription ( data: [user: User, msg: API.MessageSentText] ) {
                        if ( data[0] == session.user ) return;

                        ws!.send<API.HeartbeatControlRoomUpdate>( {
                            type: 'hearthbeat-control-room',
                            kind: 'text-message',
                            data: data[1].message,
                            x: data[1].x,
                            y: data[1].y,
                            author: { uid: data[0].UID, nickname: data[0].nickname, accent: data[0].accent.Value }
                        } );
                    }
                    room.messageSent.addEventListener( messageSubscription );

                    var cancel = room.entryRemoved.addOnceWhen(
                        s => s.user == session.user,
                        s => {
                            console.log( 'unsubbed', s.user.nickname );
                            wsSubscriptions.removeSubscription( ws, 'control-room' )
                        }
                    );
                    wsSubscriptions.createSubscription( ws, 'control-room', () => {
                        roomSubscription.unsubscribe();
                        controlSubscription.unsubscribe();
                        room.messageSent.removeEventListener( messageSubscription );
                        cancel();
                    } );
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

function SessionHandler<Treq extends API.SessionRequest, Tres> ( code: (session: UserSession, req: Treq, ws?: Socket) => Promise<Tres> ): (( req: Treq, ws?: Socket ) => Promise<Tres | API.InvalidSession>) {
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
    [Key in API.Message['type']]: (req: Uncertain<Extract<API.Message, { type: Key }>>, ws?: Socket) => Promise<unknown>
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
        }
    } ),

    'sent-text': SessionHandler( async ( session, req, ws ) => {
        var room = session.user.room.Value;
        
        if ( room != undefined ) {
            room.handleUserSentMessage( session.user, req );
        }
    } ),
};