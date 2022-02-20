import { WebSocketServer } from 'ws';

export function CreateButtplugServer ( port: number ) {
    var server = new WebSocketServer( {
        port: port
    } );

    server.addListener( 'connection', (ws, req) => {
        server.close();
        console.log( req.socket.address() );
        ws.addEventListener( 'message', e => {
            console.log( e.data );
        } );
        ws.addEventListener( 'close', e => {

        } );
    } );

    return {

    };
}