import type { API, DistributiveOmit, RequestResponseMap } from '@Server/Api'
import { SessionKey } from '@Server/Session';
import type { Theme } from '@Server/Themes'
import type { SocketHeartbeat } from '@WebWorkers/Socket';

const Workers = {
    get: <Treq extends { id: number } = { id: number }, Tres extends { id: number } = { id: number }, Theartbeat = void>( name: string, defaultHandler?: (data: Theartbeat) => any ) => {
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
            },

            mapRequests: <Tprop extends string, Treqq extends { [Key in Tprop]: string } & Treq, Tmap extends { [Key in Treqq[Tprop]]: Tres }>() => {
                return {
                    request: <Trequest extends Treqq>( data: Omit<Trequest, 'id'> ): Promise<DistributiveOmit<Tmap[Trequest[Tprop]], 'id'>> => {
                        return new Promise( (res, rej) => {
                            (data as Trequest).id = id;
                            callbacks[id++] = [res, rej];
                            worker.postMessage( data );
                        } );
                    },
                };
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

function requestAsync ( path: string ): Promise<string> {
    return new Promise( (res, rej) => {
        request( path, res );
    } );
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
    type: 'login' | 'devices',
    html: string
};

type HeartbeatHandlers = {
    userList?: (e: API.HeartbeatUsers) => any
};
const heartbeatHandlers: HeartbeatHandlers = {};
const sockets = Workers.get<API.Request, API.Response, SocketHeartbeat>( 'WebWorkers/Socket.js', heartbeat => {
    if ( heartbeat.type == 'reconnected' ) {
        if ( sessionKey != undefined ) {
            sockets.request<API.RequestSessionReconnect>( { type: 'reconnect', sessionKey: sessionKey } ).then( res => {
                if ( !res.value ) {
                    cleanSessionInfo();
                    goToLoginPage( 'Session invalidated' );
                }
            } );
        }
    }
    else if ( heartbeat.type == 'heartbeat-users' ) {
        heartbeatHandlers.userList?.( heartbeat );
    }
    else {
        console.log( heartbeat );
    }
} ).mapRequests<'type', API.Request, RequestResponseMap>();

window.addEventListener( 'load', async () => {
    request( 'wrapper.part', res => {
        loadWrapper( res );
    } );

    var theme = localStorage.getItem( 'theme' );
    if ( theme != null ) {
        setTheme( theme );
    }

    setAccent( localStorage.getItem( 'accent' ) ?? accent );

    var key = localStorage.getItem( 'session_key' );
    if ( key != null && (await sockets.request<API.RequestSessionReconnect>( { type: 'reconnect', sessionKey: key } )).value ) {
        userNickname = localStorage.getItem( 'nickname' );
        sessionKey = key;
        goToDevicesPage();
    }
    else {
        goToLoginPage();
    }
} );

function createTemplate ( data: string ): HTMLElement {
    var root = document.createElement( 'div' );
    root.innerHTML = data;
    
    return root;
}

function waitFor ( el: HTMLElement, event: keyof HTMLElementEventMap ): Promise<void> {
    return new Promise( res => {
        function fun () {
            el.removeEventListener( event, fun );
            res();
        }
        el.addEventListener( event, fun );
    } );
}

type RequestCache = {
    loginInformation: DistributiveOmit<API.ResponseLoginInfo, 'id'>,
    serverInformation: DistributiveOmit<API.ResponseServerInfo, 'id'>
};
const cache: Partial<RequestCache> = {};
async function cachedGet<T extends keyof RequestCache> ( type: T ): Promise<RequestCache[T]> {
    // @ts-ignore
    return cache[type] ??= await sockets.request( { type: type } );
}

var loginPage: HTMLElement | undefined = undefined;
var mainBody: HTMLElement | undefined = undefined;
var devicesPage: HTMLElement | undefined = undefined;
var wrapper: HTMLElement | undefined = undefined;
var optionsOverlay: HTMLElement | undefined = undefined;
var isOverlayInDom = false;
var isOverlayOpen = false;

async function loadPage ( state: PageState ) {
    if ( state.type == 'login' ) {
        await loadLoginPage( state );
    }
    else if ( state.type == 'devices' ) {
        await loadDevicesPage( state );
    }
}

var userNickname: string | undefined | null;
var sessionKey: SessionKey | undefined | null;
function logOut () {
    if ( sessionKey != undefined ) {
        sockets.request<API.RequestLogout>( { type: 'logout' } );
        cleanSessionInfo();
        goToLoginPage();
    }
}
function cleanSessionInfo () {
    userNickname = undefined;
    sessionKey = undefined;
    localStorage.removeItem( 'session_key' );
    localStorage.removeItem( 'nickname' );
}
async function goToLoginPage ( ...messages: string[] ) {
    request( 'login.part', async res => {
        var state: PageState = { type: 'login', html: res };
        window.history.pushState( state, '', 'login' );
        await loadPage( state );
        if ( loginPage != undefined && messages.length > 0 ) {
            var info = loginPage.querySelector( '#info' ) as HTMLElement;
            info.innerHTML = `
                <i class="fa-solid fa-skull"></i>
            `;
            for ( const msg of messages ) {
                var div = document.createElement( 'div' );
                div.innerText = msg;
                info.appendChild( div );
            }
        }
    } );
}
async function loadLoginPage ( state: PageState ) {
    if ( mainBody != undefined ) {
        mainBody.remove();
        mainBody = undefined;
    }

    var template = createTemplate( state.html );

    var passLabel = template.querySelector( '#pass-label' ) as HTMLLabelElement;
    var nickLabel = template.querySelector( '#nickname-label' ) as HTMLLabelElement;
    var pass = template.querySelector( '#pass' ) as HTMLInputElement;
    var nick = template.querySelector( '#nickname' ) as HTMLInputElement;
    var submit = template.querySelector( '#login' ) as HTMLButtonElement;
    var serverName = template.querySelector( '.top-label' ) as HTMLElement;
    var messages = template.querySelector( '#info' )!;

    loginPage = template.childNodes[0] as HTMLElement;
    document.body.prepend( loginPage );

    cachedGet( 'serverInformation' ).then( res => {
        serverName.innerText = 'plaything.io / ' + res.name;
    } );

    cachedGet( 'loginInformation' ).then( info => {
        if ( info.anonymousAllowed ) {
            passLabel.setAttribute( 'title', 'Password is not required. You can log in anonymously with a blank password' );
        }
        else {
            passLabel.innerText += '*';
            passLabel.setAttribute( 'title', 'Password is required' );
        }
    } );

    nickLabel.innerText += '*';
    nickLabel.setAttribute( 'title', 'Nickname is required' );

    submit.onclick = async () => {
        var nickname = nick.value;
        var password = pass.value;

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
            goToDevicesPage();
        }
        else {
            messages.innerHTML = `
                <i class="fa-solid fa-skull"></i>
                <div>Could not log in</div>
            `;

            if ( res.reason == 'nickname and password required' ) {
                messages.innerHTML += '<label for="nickname">The <abbr>nickname</abbr> field is required</label>';
                messages.innerHTML += '<label for="pass">The <abbr>password</abbr> field is required</label>';
            }
            else if ( res.reason == 'nickname required' ) {
                messages.innerHTML += '<label for="nickname">The <abbr>nickname</abbr> field is required</label>';
            }
            else if ( res.reason == 'password required' ) {
                messages.innerHTML += '<label for="pass">The <abbr>password</abbr> field is required</label>';
            }
            else if ( res.reason == 'invalid credentials' ) {
                messages.innerHTML += '<div>Invalid credentials</div>';
            }
        }
    };

    nick.onkeydown = pass.onkeydown = e => {
        if ( e.key.toLowerCase() == 'enter' ) {
            e.preventDefault();
            submit.click();
        }
    }
}

function loadWrapper ( html: string ) {
    var template = createTemplate( html );

    var optionsButton = template.querySelector( '#options-button' ) as HTMLDivElement;

    wrapper = template.childNodes[0] as HTMLElement;
    document.body.appendChild( wrapper );

    optionsButton.addEventListener( 'click', openOptionsOverlay );
}

async function openOptionsOverlay () {
    if ( optionsOverlay == undefined ) {
        var template = createTemplate( await requestAsync( 'optionsOverlay.part' ) );
        optionsOverlay = template.childNodes[0] as HTMLElement;

        optionsOverlay.addEventListener( 'click', e => {
            if ( e.target != optionsOverlay ) return;

            closeOptionsOverlay();
        } );

        window.addEventListener( 'keydown', e => {
            if ( isOverlayOpen && e.key.toLowerCase() == 'escape' ) {
                closeOptionsOverlay();
            }
        } )
    }

    if ( !isOverlayInDom ) {
        document.body.appendChild( optionsOverlay );
        isOverlayInDom = true;
        updateOptionsOverlay();
    }

    if ( !isOverlayOpen ) {
        isOverlayOpen = true;
        setTimeout( () => optionsOverlay?.classList.add( 'open' ), 10 );
    }
}

function closeOptionsOverlay () {
    if ( !isOverlayOpen ) return;

    isOverlayOpen = false;
    setTimeout( () => optionsOverlay?.classList.remove( 'open' ), 10 );
}

var currentTheme = 'dracula';
var availableThemes: Theme[] = [
    { name: 'Dracula', id: 'dracula', description: 'The default dark theme' },
    { name: 'Cherry', id: 'cherry', description: 'A colorful light theme' },
    { name: 'Light', id: 'light', description: 'The default light theme' },
];
function setTheme ( theme: string ) {
    document.body.setAttribute( 'theme', currentTheme = theme );
    localStorage.setItem( 'theme', currentTheme );
}

var accent = '#ff79c6';
function setAccent ( newAccent: string ) {
    document.body.style.setProperty( '--accent', accent = newAccent );
    localStorage.setItem( 'accent', accent );
}

function updateOptionsOverlay () {
    var list = optionsOverlay!.querySelector( '.options' ) as HTMLElement;
    var saved = optionsOverlay!.querySelector( '#settings-saved' ) as HTMLElement;

    saved.innerText = 'your settings are saved locally'; // your settings are saved on the cloud

    list.innerHTML = '';
    function addTheme () {
        var divLabel = document.createElement( 'div' );
        var divControl = document.createElement( 'div' );

        divLabel.innerHTML = `<label for="theme">Theme</label>`;
        
        var select = document.createElement( 'select' );
        select.name = 'theme';
        select.id = 'theme';
        for ( const theme of availableThemes ) {
            var option = document.createElement( 'option' );
            option.value = theme.id;
            option.title = theme.description;
            option.innerText = theme.name;
            if ( theme.id == currentTheme ) {
                option.selected = true;
            }
            select.appendChild( option );
        }
        divControl.appendChild( select );
        select.addEventListener( 'change', () => setTheme( select.value ) );

        list.appendChild( divLabel );
        list.appendChild( divControl );
    }

    function addAccent () {
        var divLabel = document.createElement( 'div' );
        var divControl = document.createElement( 'div' );

        divLabel.innerHTML = `<label for="accent">Accent Colour</label>`;
        divLabel.title = 'the colour of your cursor and the accent colour of the website';

        var colorSelect = document.createElement( 'input' );
        colorSelect.type = 'color';
        colorSelect.name = 'accent';
        colorSelect.id = 'accent';
        colorSelect.value = accent;
        divControl.appendChild( colorSelect );
        colorSelect.addEventListener( 'change', () => setAccent( colorSelect.value ) );

        list.appendChild( divLabel );
        list.appendChild( divControl );
    }

    addTheme();
    addAccent();
}

function isLoggedIn () {
    return sessionKey != undefined;
}

async function goToDevicesPage () {
    if ( !isLoggedIn() ) {
        goToLoginPage();
        return;    
    }

    request( 'devices.part', res => {
        var state: PageState = { type: 'devices', html: res };
        window.history.pushState( state, '', 'devices' );
        loadPage( state );
    } );
}
async function onMainBody () {
    if ( mainBody == undefined ) {
        await loadMainBody( await requestAsync( 'main.part' ) );
    }
}
async function loadMainBody ( html: string ) {
    if ( loginPage != undefined ) {
        loginPage.remove();
        loginPage = undefined;
    }

    var template = createTemplate( html );
    mainBody = template.childNodes[0] as HTMLElement;

    var nickname = mainBody.querySelector( '#nickname' ) as HTMLElement;
    var servername = mainBody.querySelector( '#server-name' ) as HTMLElement;
    var logout = mainBody.querySelector( '#logout' ) as HTMLButtonElement;

    nickname.innerText = userNickname!;
    cachedGet( 'serverInformation' ).then( res => {
        servername.innerText = res.name;
    } );
    logout.addEventListener( 'click', () => logOut() );

    document.body.prepend( mainBody );
}

async function loadDevicesPage ( state: PageState ) {
    await onMainBody();

    var template = createTemplate( state.html );
    devicesPage = template.childNodes[0] as HTMLElement;

    var listing = devicesPage.querySelector( '.listing' ) as HTMLElement;
    var usersList = devicesPage.querySelector( '#users' ) as HTMLElement;

    sockets.request<API.SubscribeDevices>( { type: 'subscibeDevices' } ).then( res => {
        if ( res.result == 'ok' ) {
            for ( const device of res.devices ) {
                var div = document.createElement( 'div' );
                div.classList.add( 'device' );
                div.innerText = device;
                listing.appendChild( div );
            }
        }

        if ( res.result != 'ok' || res.devices.length == 0 ) {
            listing.append( 'Nothing!' );
        }
    } );

    var nooneText: Text | undefined;
    var usercount = 0;
    var users: { [uid: number]: [HTMLElement, Text, HTMLElement] } = {};
    function addUser ( nick: string, location: string, uid: number ) {
        if ( nooneText != undefined ) {
            nooneText.remove();
            nooneText = undefined;
        }

        var b = document.createElement( 'b' );
        b.innerText = nick;
        var text = document.createTextNode( ` @ ${location}` );
        var br = document.createElement( 'br' );

        usersList.append( b, text, br );
        users[ uid ] = [b, text, br];
        usercount++;
    }
    function removeUser ( uid: number ) {
        var [b, text, br] = users[ uid ];
        b.remove();
        text.remove();
        br.remove();

        delete users[ uid ];
        usercount--;

        if ( usercount == 0 ) {
            usersList.append( nooneText = document.createTextNode( 'No one!' ) );
        }
    }
    function updateUser ( uid: number, location: string ) {
        var [b, text, br] = users[ uid ];
        text.nodeValue = ` @ ${location}`;
    }

    heartbeatHandlers.userList = e => {
        if ( e.kind == 'added' ) {
            addUser( e.user.nickname, e.user.location, e.user.uid );
        }
        else if ( e.kind == 'updated' ) {
            updateUser( e.user.uid, e.user.location );
        }
        else if ( e.kind == 'removed' ) {
            removeUser( e.uid );
        }
    };
    sockets.request<API.SubscribeUsers>( { type: 'subscibeUsers' } ).then( res => {
        if ( res.result == 'ok' ) {
            for ( const user of res.users ) {
                addUser( user.nickname, user.location, user.uid );
            }
        }

        if ( res.result != 'ok' || res.users.length == 0 ) {
            usersList.append( nooneText = document.createTextNode( 'No one!' ) );
        }
    } );

    mainBody!.appendChild( devicesPage );
}