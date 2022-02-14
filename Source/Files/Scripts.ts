import type { API } from '@Server/Api'
import type { SocketHeartbeat } from './WebWorkers/Socket';

export const Workers = {
    get: <Treq extends { id: number } = { id: number }, Tres extends { id: number } = { id: number }, Theartbeat = undefined>( name: string, defaultHandler?: (data: Theartbeat) => any ) => {
        var worker = new Worker( name );
        var callbacks: { [id: number]: [(data: any) => any, (err: any) => any] } = {};
        var id = 0;

        worker.onmessage = msg => {
            if ( msg.data.id == undefined || callbacks[msg.data.id] == undefined ) {
                defaultHandler?.( msg.data as Theartbeat );
            }
            else {
                callbacks[msg.data.id][0]( msg.data );
                delete callbacks[msg.data.id];
            }
        };
        worker.onerror = msg => {
            console.error( msg );
        };
        worker.onmessageerror = msg => {
            console.error( msg );
        };

        return {
            request: <Trequest extends Treq = Treq, Tresponse extends Tres = Tres>( data: Omit<Trequest, 'id'> ): Promise<Omit<Tresponse, 'id'>> => {
                return new Promise( (res, rej) => {
                    (data as Trequest).id = id;
                    callbacks[id++] = [res, rej];
                    worker.postMessage( data );
                } );
            }
        };
    }
};

function request ( path: string, cb: (res: string) => any ) {
    const request = new XMLHttpRequest();
    request.onload = function() {
        cb( this.responseText );
    }
    request.open( 'GET', path, true );
    request.send();
}

var flexFont = function () {
    for ( const div of document.getElementsByClassName( 'font-icon' ) ) {
        var style = window.getComputedStyle( div );
        var height = Number.parseFloat( style.height );
        var pt = Number.parseFloat( style.paddingTop );
        var pb = Number.parseFloat( style.paddingBottom );
        (div as HTMLElement).style.fontSize = ( height - pt - pb ) + 'px'; 
    }
};

window.addEventListener( 'load', flexFont );
window.addEventListener( 'resize', flexFont );

type PageState = {
    type: 'login',
    html: string
};

const sockets = Workers.get<API.Request, API.Response, SocketHeartbeat>( 'WebWorkers/Socket.js', heartbeat => {

} );

window.addEventListener( 'load', () => {
    request( 'login.part', res => {
        var state: PageState = { type: 'login', html: res };
        window.history.pushState( state, '', 'login');
        loadPage( state );
    } );
} );

function loadPage ( state: PageState ) {
    if ( state.type == 'login' ) {
        loadLoginPage( state );
    }
}

async function loadLoginPage ( state: PageState ) {
    document.body.innerHTML = state.html;

    var passLabel = document.getElementById( 'pass-label' )!;
    var nickLabel = document.getElementById( 'nickname-label' )!;
    var pass = document.getElementById( 'pass' )!;
    var nick = document.getElementById( 'nickname' )!;

    var info = await sockets.request<API.RequestLoginInfo, API.ResponseLoginInfo>( { type: 'loginInformation' } );
    if ( info.anonymousAllowed ) {
        passLabel.setAttribute( 'title', 'Password is not required. You can log in anonymously with a blank password' );
    }
    else {
        passLabel.innerText += '*';
        passLabel.setAttribute( 'title', 'Password is required' );
    }

    nickLabel.innerText += '*';
    nickLabel.setAttribute( 'title', 'Nickname is required' );
}