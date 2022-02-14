import express from 'express';
import { AllowAnonymousAccess, getUser, verifyUser, WhitelistedUsers } from './Whitelist.js';
import CreateSessionPool from './Session.js';
import { WebSocketServer } from 'ws';
import { API, RequestResponseMap, Uncertain, DistributiveOmit } from './Api';
import { LogConnecction } from './Logger.js';
import { UserSession } from './User.js';

const app = express();
const port = 8080;
const loginSessions = CreateSessionPool<UserSession>( 'login pool' );

const files = express.static( './../Files', { index: 'main', extensions: ['html'] } );
app.use( '/', files );
app.get( '/*', (req, res) => {
    req.url = '/main';
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
                ApiHandlers.processRequest( data ).then( res => {
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
    return str == undefined || str.length == 0;
}

const ApiHandlers: {
    [Key in API.Request['type']]: (req: Uncertain<Extract<API.Request, { type: Key }>>) => Promise<DistributiveOmit<RequestResponseMap[Key], 'id'>>
} & { processRequest: (req: API.Request) => Promise<API.Response> } = {
    processRequest: async (req: API.Request): Promise<API.Response> => {
        if ( req.type in ApiHandlers ) {
            var handler = ApiHandlers[req.type] as (req: API.Request) => Promise<DistributiveOmit<API.Response, 'id'>>;
            var val = await handler( req ) as API.Response;
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
                    nickname: req.nickname
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
                    nickname: req.nickname
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
    }
};