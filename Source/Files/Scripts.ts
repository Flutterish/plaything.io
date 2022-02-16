import type { API } from '@Server/Api'
import type { Theme } from '@Server/Themes'
import { Reactive } from './Reactive.js';
import { sockets, logIn, logOut, isLoggedIn, heartbeatHandlers, request, cachedGet, userNickname, Reconnected, Connected, LoggedOut, ComponentName } from './Session.js';

LoggedOut.push( goToLoginPage );
Connected.push( goToLoginPage );
Reconnected.push( () => {
    loadCouldPreferences();
    if ( loginPage != undefined ) {
        goToDevicesPage();
    }
} );

window.addEventListener( 'load', flexFont );
window.addEventListener( 'resize', flexFont );
function flexFont () {
    for ( const div of document.getElementsByClassName( 'font-icon' ) ) {
        var style = window.getComputedStyle( div );
        var height = Number.parseFloat( style.height );
        var pt = Number.parseFloat( style.paddingTop );
        var pb = Number.parseFloat( style.paddingBottom );
        (div as HTMLElement).style.fontSize = ( height - pt - pb ) + 'px'; 
    }
};

window.addEventListener( 'load', async () => {
    currentTheme.Value = localStorage.getItem( 'theme' ) ?? currentTheme.Value;
    accent.Value = localStorage.getItem( 'accent' ) ?? accent.Value;

    request( 'wrapper.part' ).then( res => {
        loadWrapper( res );
    } );
} );

window.addEventListener( 'popstate', e => {
    loadPage( e.state );
} )

function createTemplate ( data: string ): HTMLElement {
    var root = document.createElement( 'div' );
    root.innerHTML = data;
    
    return root;
}

var wrapper: HTMLElement | undefined = undefined;
function loadWrapper ( html: string ) {
    var template = createTemplate( html );

    var optionsButton = template.querySelector( '#options-button' ) as HTMLDivElement;

    wrapper = template.childNodes[0] as HTMLElement;
    document.body.appendChild( wrapper );

    optionsButton.addEventListener( 'click', openOptionsOverlay );
}

var optionsOverlay: HTMLElement | undefined = undefined;
var optionTheme: Reactive<string> | undefined;
var optionAccent: Reactive<string> | undefined;
var isOverlayOpen = false;
async function openOptionsOverlay () {
    if ( optionsOverlay == undefined ) {
        var template = createTemplate( await request( 'optionsOverlay.part' ) );
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

        document.body.appendChild( optionsOverlay );
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
function updateOptionsOverlay () {
    var list = optionsOverlay!.querySelector( '.options' ) as HTMLElement;
    var saved = optionsOverlay!.querySelector( '#settings-saved' ) as HTMLElement;

    localSaved = () => saved.innerText = 'your settings are saved locally';
    cloudSaved = () => saved.innerText = 'your settings are saved on the cloud'
    saved.innerText = 'your settings are saved locally';

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
            select.appendChild( option );
        }
        divControl.appendChild( select );
        optionTheme = new Reactive<string>( currentTheme );
        optionTheme.AddOnValueChanged( v => select.value = v, true );
        select.addEventListener( 'change', () => {
            optionTheme!.Value = select.value;
            cloudSaveTheme( select.value );
        } );

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
        divControl.appendChild( colorSelect );
        optionAccent = new Reactive<string>( accent );
        optionAccent.AddOnValueChanged( v => colorSelect.value = v, true );
        colorSelect.addEventListener( 'change', () => {
            optionAccent!.Value = colorSelect.value;
            cloudSaveAccent( colorSelect.value )
        } );

        list.appendChild( divLabel );
        list.appendChild( divControl );
    }

    addTheme();
    addAccent();
}

type PageState = {
    type: 'login' | 'devices' | 'control',
    html: string,
    params: any[]
};
async function loadPage ( state: PageState ) {
    if ( state.type == 'login' ) {
        await loadLoginPage( state );
    }
    else {
        if ( !isLoggedIn() ) {
            await goToLoginPage( `You're not logged in enough to do that` );
        }
        else if ( state.type == 'devices' ) {
            await loadDevicesPage( state );
        }
        else if ( state.type == 'control' ) {
            await loadControlPage( state );
        }
        else {
            console.error( `Tried to go to '${state.type}', but no such page exists` );
        }
    }
}
async function goToPage ( type: PageState['type'], component: ComponentName, ...params: any[] ) {
    var res = await request( component );
    var state: PageState = { type: type, html: res, params: params };
    window.history.pushState( state, '', type );
    await loadPage( state );
}

var loginPage: HTMLElement | undefined = undefined;
async function goToLoginPage ( ...messages: string[] ) {
    await goToPage( 'login', 'login.part' );
    
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
}
async function loadLoginPage ( state: PageState ) {
    destroyLogin();
    destroyMain();

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

    cachedGet( 'server-information' ).then( res => {
        serverName.innerText = 'plaything.io / ' + res.name;
    } );

    cachedGet( 'login-information' ).then( info => {
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

        var res = await logIn( nickname, password );

        if ( res.result == 'ok' ) {
            goToDevicesPage();
            loadCouldPreferences();
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
function destroyLogin () {
    if ( loginPage != undefined ) {
        loginPage.remove();
        loginPage = undefined;
    }
}

var mainBody: HTMLElement | undefined = undefined;
async function loadMainBody ( html: string ) {
    destroyLogin();
    destroyMain();

    var template = createTemplate( html );
    mainBody = template.childNodes[0] as HTMLElement;

    var nickname = mainBody.querySelector( '#nickname' ) as HTMLElement;
    var servername = mainBody.querySelector( '#server-name' ) as HTMLElement;
    var logout = mainBody.querySelector( '#logout' ) as HTMLButtonElement;

    nickname.innerText = userNickname!;
    cachedGet( 'server-information' ).then( res => {
        servername.innerText = res.name;
    } );
    logout.addEventListener( 'click', () => logOut() );

    document.body.prepend( mainBody );
}
async function onMainBody () {
    if ( mainBody == undefined ) {
        await loadMainBody( await request( 'main.part' ) );
    }

    devicesPage?.remove();
    devicesPage = undefined;
    controlPage?.remove();
    controlPage = undefined;
}
function destroyMain () {
    if ( mainBody != undefined ) {
        mainBody.remove();

        mainBody = undefined;
        devicesPage = undefined;
        controlPage = undefined;
    }
}

var devicesPage: HTMLElement | undefined = undefined;
async function goToDevicesPage () {
    if ( !isLoggedIn() ) {
        goToLoginPage();
        return;    
    }

    await goToPage( 'devices', 'devices.part' );
}
async function loadDevicesPage ( state: PageState ) {
    await onMainBody();

    var template = createTemplate( state.html );
    devicesPage = template.childNodes[0] as HTMLElement;

    var listing = devicesPage.querySelector( '.listing' ) as HTMLElement;
    var usersList = devicesPage.querySelector( '#users' ) as HTMLElement;

    sockets.request<API.SubscribeDevices>( { type: 'subscibe-devices' } ).then( res => {
        for ( const device of res.devices ) {
            var div = document.createElement( 'div' );
            div.classList.add( 'device' );
            div.innerText = device.name;
            listing.appendChild( div );

            div.addEventListener( 'click', () => {
                goToControlPage( device.id );
            } );
        }

        if ( res.devices.length == 0 ) {
            listing.append( 'Nothing!' );
        }
    } );

    var nooneText: Text | undefined;
    var usercount = 0;
    var users: { [uid: number]: [HTMLElement, Text, HTMLElement] } = {};
    function addUser ( nick: string, location: string, uid: number, accent: string ) {
        if ( users[ uid ] != undefined ) {
            updateUser( uid, location, accent );
            return;
        }

        if ( nooneText != undefined ) {
            nooneText.remove();
            nooneText = undefined;
        }

        var b = document.createElement( 'b' );
        b.innerText = nick;
        b.style.setProperty( '--accent', accent );
        var text = document.createTextNode( ` @ ${location}` );
        var br = document.createElement( 'br' );

        usersList.append( b, text, br );
        users[ uid ] = [b, text, br];
        usercount++;
    }
    function removeUser ( uid: number ) {
        if ( users[ uid ] == undefined )
            return;

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
    function updateUser ( uid: number, location: string, accent: string ) {
        if ( users[ uid ] == undefined )
            return;

        var [b, text, br] = users[ uid ];
        text.nodeValue = ` @ ${location}`;
        b.style.setProperty( '--accent', accent );
    }

    heartbeatHandlers.userList = e => {
        if ( e.kind == 'added' ) {
            addUser( e.user.nickname, e.user.location, e.user.uid, e.user.accent );
        }
        else if ( e.kind == 'updated' ) {
            updateUser( e.user.uid, e.user.location, e.user.accent );
        }
        else if ( e.kind == 'removed' ) {
            removeUser( e.uid );
        }
    };
    sockets.request<API.SubscribeUsers>( { type: 'subscibe-users' } ).then( res => {
        for ( const user of res.users ) {
            addUser( user.nickname, user.location, user.uid, user.accent );
        }

        if ( res.users.length == 0 ) {
            usersList.append( nooneText = document.createTextNode( 'No one!' ) );
        }
    } );

    mainBody!.appendChild( devicesPage );
}

var controlPage: HTMLElement | undefined = undefined;
async function goToControlPage ( id: number ) {
    if ( !isLoggedIn() ) {
        goToLoginPage();
        return;    
    }

    await goToPage( 'control', 'control.part', id );
}
async function loadControlPage ( state: PageState ) {
    await onMainBody();

    var id = state.params[0] as number;

    var template = createTemplate( state.html );
    controlPage = template.childNodes[0] as HTMLElement;

    var share = template.querySelector( '.share' ) as HTMLElement;
    var controls = template.querySelector( '.control-list' ) as HTMLElement;

    mainBody!.appendChild( controlPage );
}

var cloudSaved: () => any | undefined;
var localSaved: () => any | undefined;

var currentTheme = new Reactive<string>( 'dracula' );
currentTheme.AddOnValueChanged( v => {
    document.body.setAttribute( 'theme', v )
    localStorage.setItem( 'theme', v );
} );
var availableThemes: Theme[] = [
    { name: 'Dracula', id: 'dracula', description: 'The default dark theme' },
    { name: 'Cherry', id: 'cherry', description: 'A colorful light theme' },
    { name: 'Light', id: 'light', description: 'The default light theme' },
];
function cloudSaveTheme ( theme: string ) {
    localSaved?.();
    currentTheme.Value = theme;
    if ( isLoggedIn() ) {
        sockets.request<API.RequestSavePreferences>( { type: 'save-prefereces', theme: theme } ).then( () => cloudSaved?.() );
    }
}

var accent = new Reactive<string>( '#ff79c6' );
accent.AddOnValueChanged( v => {
    document.body.style.setProperty( '--accent', v )
    localStorage.setItem( 'accent', v );
} );
function cloudSaveAccent ( newAccent: string ) {
    localSaved?.();
    accent.Value = newAccent;
    if ( isLoggedIn() ) {
        sockets.request<API.RequestSavePreferences>( { type: 'save-prefereces', accent: newAccent } ).then( () => cloudSaved?.() );
    }
}

async function loadCouldPreferences () {
    var prefs = await sockets.request<API.RequestLoadPreferences>( { type: 'load-preferences' } );
    if ( prefs.accent != undefined ) 
        accent.Value = prefs.accent;
    if ( prefs.theme != undefined ) 
        currentTheme.Value = prefs.theme;
}