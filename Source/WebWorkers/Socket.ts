import type { API } from '@Server/Api'

export type SocketHeartbeat = {
    type: 'reconnected'
} | {
    type: 'connection-error',
    message: any
} | API.Heartbeat;

const worker = this as unknown as Omit<Worker, 'postMessage'> & {
    postMessage: ( message: API.Response | SocketHeartbeat ) => void
};

var socketQueue: string[] = [];
var socket: WebSocket | undefined = undefined;
var wasConnected = false;

function connect () {
    socket = new WebSocket( 'ws://' + location.host );

    socket.addEventListener( 'open', () => {
        if ( wasConnected ) {
            worker.postMessage( { type: 'reconnected' } );
        }
        wasConnected = true;

        for ( const msg of socketQueue ) {
            socket!.send( msg );
        }
        socketQueue = [];
    } );

    socket.addEventListener( 'close', e => {
        socket = undefined;
        setTimeout( connect, 5000 );
    } );

    socket.addEventListener( 'message', msg => {
        try {
            var parsed = JSON.parse( msg.data ) as API.Response;
            worker.postMessage( parsed );
        }
        catch ( e ) {
            worker.postMessage( { type: 'connection-error', message: e } );
        }
    } );

    socket.addEventListener( 'error', err => {
        worker.postMessage( { type: 'connection-error', message: err } );
    } );
}
connect();

function socketRequest ( msg: API.Request ) {
    if ( socket?.readyState == WebSocket.OPEN ) {
        socket.send( JSON.stringify( msg ) );
    }
    else {
        socketQueue.push( JSON.stringify( msg ) );
    }
}

onmessage = function ( message ) {
    var data = message.data as API.Request;

    socketRequest( data );
};