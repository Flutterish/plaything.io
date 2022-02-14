import type { API } from '@Server/Api'

export type SocketHeartbeat = {
    type: 'connection-error'
};

const worker = this as unknown as Omit<Worker, 'postMessage'> & {
    postMessage: ( message: API.Response | SocketHeartbeat ) => void
};

var socket = new WebSocket( 'ws://' + location.host );
var socketQueue: string[] = [];
socket.addEventListener( 'open', () => {
    for ( const msg of socketQueue ) {
        socket.send( msg );
    }
    socketQueue = [];

    socket.addEventListener( 'message', msg => {
        var parsed = JSON.parse( msg.data ) as API.Response;

        worker.postMessage( parsed );
    } );
} );
socket.addEventListener( 'error', err => {
    worker.postMessage( { type: 'connection-error' } );
} );

function socketRequest ( msg: API.Request ) {
    if ( socket.readyState == WebSocket.OPEN ) {
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