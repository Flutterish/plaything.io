import type { API } from '@Server/Api'

export type SocketHeartbeat = {
    type: 'connection-error' | 'reconnected'
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
        var parsed = JSON.parse( msg.data ) as API.Response;

        worker.postMessage( parsed );
    } );

    socket.addEventListener( 'error', err => {
        worker.postMessage( { type: 'connection-error' } );
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