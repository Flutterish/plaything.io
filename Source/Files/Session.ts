import type { SocketHeartbeat } from "@WebWorkers/Socket";
import type { API, RequestResponseMap } from "@Server/Api";
import type { SessionKey } from "@Server/Session";
import { Workers } from "./Workers.js";

export var userNickname: string | undefined | null;
var sessionKey: SessionKey | undefined | null;
function cleanSessionInfo () {
    userNickname = undefined;
    sessionKey = undefined;
    localStorage.removeItem( 'session_key' );
    localStorage.removeItem( 'nickname' );
}

export type HeartbeatHandlers = {
    userList?: (e: API.HeartbeatUsers) => any
};
export const heartbeatHandlers: HeartbeatHandlers = {};

export const LoggedOut: ((...messages: string[]) => any)[] = [];
function onLoggedOut ( ...messages: string[] ) {
    for ( const handler of [...LoggedOut] ) {
        handler( ...messages );
    }
}
export const Reconnected: (() => any)[] = [];
function onReconnected () {
    for ( const handler of [...Reconnected] ) {
        handler();
    }
}
export const Connected: (() => any)[] = [];
function onConnected () {
    for ( const handler of [...Connected] ) {
        handler();
    }
}

export const sockets = Workers.get<API.Request, API.Response, API.Message, SocketHeartbeat>( 'WebWorkers/Socket.js', heartbeat => {
    if ( heartbeat.type == 'reconnected' ) {
        if ( sessionKey != undefined ) {
            sockets.request<API.RequestSessionReconnect>( { type: 'reconnect', sessionKey: sessionKey } ).then( res => {
                if ( !res.value ) {
                    cleanSessionInfo();
                    onLoggedOut( 'Session invalidated' );
                }
            } );
        }
    }
    else if ( heartbeat.type == 'heartbeat-users' ) {
        heartbeatHandlers.userList?.( heartbeat );
    }
    else {
        console.log( 'Unhandled heartbeat:', heartbeat );
    }
}, (data, res, rej) => {
    if ( 'result' in data && data.result == 'session not found' ) {
        cleanSessionInfo();
        onLoggedOut( 'Session invalidated' );
        rej( 'session not found' );
    }
    else if ( 'error' in data ) {
        rej( data );
    }
    else {
        res( data );
    }
} ).mapRequests<'type', API.Request, {[Key in keyof RequestResponseMap]: Exclude<RequestResponseMap[Key], API.InvalidSession>}>();

export type RequestCache = {
    'login-information': API.ResponseLoginInfo,
    'server-information': API.ResponseServerInfo
};
const cache: Partial<RequestCache> = {};
export async function cachedGet<T extends keyof RequestCache> ( type: T ): Promise<RequestResponseMap[T]> {
    // @ts-ignore
    return cache[type] ??= await sockets.request( { type: type } );
}

export type ComponentName = `${'control' | 'devices' | 'login' | 'main' | 'optionsOverlay' | 'wrapper'}.part`
export function request ( path: ComponentName ): Promise<string> {
    return new Promise( (res, rej) => {
        const request = new XMLHttpRequest();
        request.onload = function() {
            res( this.responseText );
        }
        request.onerror = function () {
            rej();
        }
        request.open( 'GET', path, true );
        request.send();
    } );
}

export async function logOut () {
    if ( sessionKey != undefined ) {
        sockets.request<API.RequestLogout>( { type: 'logout' } );
        cleanSessionInfo();
        onLoggedOut();
        return true;
    }

    return false;
}

export async function logIn ( nickname: string, password?: string ) {
    var res = await sockets.request<API.RequestLogin>( {
        type: 'login',
        nickname: nickname,
        password: password
    } );

    if ( res.result == 'ok' ) {
        localStorage.setItem( 'session_key', res.sessionKey );
        localStorage.setItem( 'nickname', nickname );
        userNickname = nickname;
        sessionKey = res.sessionKey;
    }

    return res;
}

export function isLoggedIn () {
    return sessionKey != undefined;
}

window.addEventListener( 'load', async () => {
    var key = localStorage.getItem( 'session_key' );
    if ( key != null && (await sockets.request<API.RequestSessionReconnect>( { type: 'reconnect', sessionKey: key } )).value ) {
        userNickname = localStorage.getItem( 'nickname' );
        sessionKey = key;
        onReconnected();
    }
    else {
        onConnected();
    }

    setInterval( () => {
        if ( sessionKey != undefined ) {
            sockets.message<API.AliveAck>( { type: 'alive' } );
        }
    }, 10 * 1000 );
} );