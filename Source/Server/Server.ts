import express from 'express';
import { AllowAnonymousAccess, WhitelistedUsers } from './Whitelist.js';
import CreateSessionPool from './Session.js';
import { UserSession } from './Users';
import WebSocket, { WebSocketServer } from 'ws';
import { API } from './Api';

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
    var address = req.socket.remoteAddress;
    console.log( `Client established a websocket: '${address}'` );

    ws.addEventListener( 'close', e => {
        console.log( `Closed a websocket connection with: '${address}' because '${e.reason || '<no reason provided>'}'` );
    } );
    ws.addEventListener( 'error', err => {
        console.log( `Error on connection with '${address}': ${err.message}` );
    } );
    ws.addEventListener( 'message', msg => {
        var data = JSON.parse( msg.data.toString() );
        if ( typeof data !== 'object' || typeof data.id !== 'number' || typeof data.type !== 'string' ) {
            ws.send( JSON.stringify( {
                error: 'Invalid request',
                id: data?.id
            } ) );
        }
        else {
            processAPIRequest( data as API.Request ).then( res => {
                ws.send( JSON.stringify( res ) );
            } );
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

async function processAPIRequest ( req: API.Request ): Promise<API.Response> {
    if ( req.type == 'loginInformation' ) {
        return processAPIRequestLoginInformation( req );
    }
    else {
        return {
            error: 'Invalid request type',
            id: req.id
        };
    }
}

function processAPIRequestLoginInformation ( req: API.RequestLoginInfo ): API.ResponseLoginInfo {
    return {
        anonymousAllowed: AllowAnonymousAccess,
        id: req.id
    };
}