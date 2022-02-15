import express from 'express';
import { AllowAnonymousAccess, AnonymousPermitedDevices, getUser, verifyUser, WhitelistedUsers } from './Whitelist.js';
import CreateSessionPool from './Session.js';
import { WebSocketServer, WebSocket } from 'ws';
import { API, RequestResponseMap, Uncertain, DistributiveOmit } from './Api';
import { LogConnecction } from './Logger.js';
import { UserSession } from './User.js';

const app = express();
const port = 8080;
const serverName = 'sample-server';
const loginSessions = CreateSessionPool<UserSession>( 'login pool' );

const files = express.static( './../Files', { index: 'main', extensions: ['html'] } );
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
    } );
    ws.addEventListener( 'error', err => {
        LogConnecction( address, 'in', `Error on connection:`, err.message );
    } );
    ws.addEventListener( 'message', msg => {
        var str = msg.data.toString();
        try {
            var data = JSON.parse( str );
            LogConnecction( address, 'in', data );

            if ( typeof data !== 'object' || typeof data.id !== 'number' || typeof data.type !== 'string' ) {
                var r = {
                    error: 'Invalid request',
                    id: data?.id
                };
                ws.send( JSON.stringify( r ) );
                LogConnecction( address, 'out', r );
            }
            else {
                ApiHandlers.processRequest( data, ws ).then( res => {
                    ws.send( JSON.stringify( res ) );
                    LogConnecction( address, 'out', res );
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

const ApiHandlers: {
    [Key in API.Request['type']]: (req: Uncertain<DistributiveOmit<Extract<API.Request, { type: Key }>, 'id'>>, ws?: WebSocket) => Promise<DistributiveOmit<RequestResponseMap[Key], 'id'>>
} & { processRequest: (req: API.Request, ws?: WebSocket) => Promise<API.Response> } = {
    processRequest: async (req: API.Request, ws?: WebSocket): Promise<API.Response> => {
        if ( req.type in ApiHandlers ) {
            var handler = ApiHandlers[req.type] as (req: API.Request, ws?: WebSocket) => Promise<DistributiveOmit<API.Response, 'id'>>;
            var val = await handler( req, ws ) as API.Response;
            val.id = req.id;

            return val;
        }
        else {
            return {
                error: 'Invalid request type',
                id: req.id
            };
        }
    },

    'loginInformation': async req => {
        return { anonymousAllowed: AllowAnonymousAccess };
    },

    'login': async req => {
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
                var key = loginSessions.createSession( {
                    user: { nickname: req.nickname, allowedDevices: AnonymousPermitedDevices }
                } );

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
                var key = loginSessions.createSession( {
                    user: user
                } );
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

    'logout': async req => {
        if ( isSessionValid( req.sessionKey ) ) {
            loginSessions.destroySession( req.sessionKey );
            return {
                result: 'ok'
            }
        }
        else return {
            result: 'session not found'
        }
    },

    'sessionExists': async req => {
        return {
            value: isSessionValid( req.sessionKey )
        }
    },

    'subscibeDevices': async req => {
        if ( isSessionValid( req.sessionKey ) ) {
            var session = loginSessions.getSession( req.sessionKey )!;
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
        if ( isSessionValid( req.sessionKey ) ) {
            var session = loginSessions.getSession( req.sessionKey )!;
            
            if ( socket != undefined ) {
                let ws = socket;
                function added ( s: UserSession ) {
                    var data: API.HeartbeatUsers = {
                        type: 'heartbeat-users',
                        kind: 'added',
                        user: { nickname: s.user.nickname, location: serverName }
                    };
                    ws.send( JSON.stringify( data ) );
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
                        user: s.user.nickname
                    };
                    ws.send( JSON.stringify( data ) );
                }

                loginSessions.entryAdded.addEventListener( added );
                loginSessions.entryRemoved.addEventListener( removed );
            }

            return {
                result: 'ok',
                users: Object.values( loginSessions.getAll() ).filter( x => x.user != session.user ).map( x => ({ nickname: x.user.nickname, location: serverName }) )   
            }
            // TODO heartbeat-users when this goes reactive
        }
        else return {
            result: 'session not found'
        }
    }
};