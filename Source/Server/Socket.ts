import WebSocket from 'ws';
import { API } from './Api';

export type Socket = ReturnType<typeof WrapSocket>;

export function WrapSocket ( ws: WebSocket ) {
    return {
        send: <T extends API.Response | API.Heartbeat>( msg: T ) => {
            ws.send( JSON.stringify( msg ) );
        },
        raw: ws
    };
}