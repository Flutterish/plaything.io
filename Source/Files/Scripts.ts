import type { API } from '@Server/Api'
import type { Control } from '@Server/Device';
import type { Theme } from '@Server/Themes'
import { Reactive } from './Reactive.js';
import { sockets, logIn, logOut, isLoggedIn, heartbeatHandlers, request, cachedGet, userNickname, Reconnected, Connected, LoggedOut, ComponentName } from './Session.js';
import { computeSharedControlLayout } from './ShareLayout.js';

LoggedOut.push( goToLoginPage );
Connected.push( goToLoginPage );
Reconnected.push( () => {
    loadCouldPreferences();
    goToDevicesPage();
} );

function flexFont ( parent: HTMLElement ) {
    for ( const div of parent.querySelectorAll( '.font-icon' ) ) {
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
    servername.addEventListener( 'click', () => goToDevicesPage() );
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
    controlPageRemoved?.();
    controlPageRemoved = undefined;
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

var controlPageRemoved: (() => any) | undefined = undefined;
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
    var controlList = template.querySelector( '#control-list' ) as HTMLElement;
    var cursors = template.querySelector( '#cursors' ) as HTMLElement;
    var topbar = mainBody!.querySelector( '.topbar-left' ) as HTMLElement;
    var chevron = document.createElement( 'i' );
    chevron.classList.add( 'fa-solid' );
    chevron.classList.add( 'fa-chevron-right' );
    chevron.style.transform = 'scale(0.6)';
    var deviceName = document.createTextNode( '' );
    topbar.appendChild( chevron );
    topbar.appendChild( deviceName );

    var xOffset = 0;
    var yOffset = 0;
    var normalWidth = 0;
    var normalHeight = 0;

    var controlUpdate: ((res: Extract<API.HeartbeatControlRoomUpdate, {kind: 'control-modified'}>) => any) | undefined = undefined;
    var repositionControls: (() => any) | undefined = undefined;
    var repositionCursors: (() => any) | undefined = undefined;
    function windowResized () {
        repositionControls?.();
        repositionCursors?.();
        flexFont( share );
    }

    window.addEventListener( 'resize', windowResized );
    controlPageRemoved = () => {
        window.removeEventListener( 'resize', windowResized );
        sockets.message<API.MessageLeaveRoom>( { type: 'leave-room' } );
        deviceName.remove();
        chevron.remove();
    };

    sockets.request<API.RequestDeviceInfo>( { type: 'device-info', deviceId: id } ).then( res => {
        if ( res.result == 'not found' ) {
            console.error( 'Requested device info was not found' );
            return;
        }

        deviceName.nodeValue = res.name;

        function createButton ( control: Control.Button, id: number ) {
            var button = document.createElement( 'div' );
            button.classList.add( 'control-button' );
            if ( control.label != undefined ) {
                var label = document.createElement( 'div' );
                label.classList.add( 'control-label' );
                label.innerText = control.label;
                button.appendChild( label );
            }
            var inner = document.createElement( 'div' );
            inner.classList.add( 'button-inner' );
            inner.classList.add( 'button' );
            inner.classList.add( 'font-icon' );
            reactsById.set( id, inner );
            button.appendChild( inner );
            var icon = document.createElement( 'i' );
            icon.classList.add( 'fa-solid' );
            icon.classList.add( 'fa-power-off' );
            inner.appendChild( icon );

            return button;
        }
        function createSlider ( control: Control.Slider, id: number ) {
            var slider = document.createElement( 'div' );
            slider.classList.add( 'control-slider' );
            if ( control.label != undefined ) {
                var label = document.createElement( 'div' );
                label.classList.add( 'control-label' );
                label.innerText = control.label;
                slider.appendChild( label );
            }
            var bar = document.createElement( 'div' );
            bar.classList.add( 'bar' );
            slider.appendChild( bar );
            var fill = document.createElement( 'div' );
            fill.classList.add( 'bar-fill' );
            slider.appendChild( fill );
            var notches = document.createElement('div' );
            notches.classList.add( 'notches' );
            for ( let i = control.notches - 1; i >= 0; i-- ) {
                var notch = document.createElement( 'div' );
                var notchLabel = document.createElement( 'div' );
                notchLabel.innerText = (control.range[0] + ( control.range[1] - control.range[0] ) * ( i / (control.notches - 1) )).toFixed( 0 );
                notch.appendChild( notchLabel );
                var notchVisual = document.createElement( 'div' );
                notchVisual.classList.add( 'notch' );
                notch.appendChild( notchVisual );
                notches.appendChild( notch );
            }
            slider.appendChild( notches );
            var handle = document.createElement( 'div' );
            handle.classList.add( 'handle' );
            reactsById.set( id, handle );
            slider.appendChild( handle );

            return slider;
        }

        const controls = res.controls;
        const boundsByControl = new Map<Control.Any, HTMLElement>();
        const reactsById = new Map<number, HTMLElement>()
        const activeById = new Map<number, boolean>()
        const hoverById = new Map<number, boolean>()
        let i = 0;
        for ( const control of controls ) {
            const id = i;
            let itemBounds = control.type == 'button'
                ? createButton( control, id )
                : createSlider( control, id );
                
            boundsByControl.set( control, itemBounds );
            controlList.appendChild( itemBounds );
            var react = reactsById.get( id );
            activeById.set( id, false );
            hoverById.set( id, false );

            react?.addEventListener( 'pointerenter', e => {
                hoverById.set( id, true );
                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, active: activeById.get(id)!, hovered: true } );
            } );
            react?.addEventListener( 'pointerleave', e => {
                hoverById.set( id, false );
                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, active: activeById.get(id)!, hovered: false } );
            } );
            function pointerUp () {
                activeById.set( id, false );
                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, active: false, hovered: hoverById.get(id)! } );
                window.removeEventListener( 'pointerup', pointerUp );
            }
            react?.addEventListener( 'pointerdown', e => {
                activeById.set( id, true );
                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, active: true, hovered: hoverById.get(id)! } );
                window.addEventListener( 'pointerup', pointerUp );
            } );
            react?.addEventListener( 'dragend', pointerUp );
            i++;
        }

        var bounds = share;
        bounds.style.position = 'absolute';
        // bounds.style.backgroundColor = 'red';

        function updateLayout () {
            var width = window.innerWidth - 32;
            var height = window.innerHeight - 50 - 32;
            
            var layout = computeSharedControlLayout( {
                width: width,
                height: height
            }, controls );

            normalWidth = layout.normalWidth;
            normalHeight = layout.normalHeight;
            xOffset = 16 + ( width - layout.width ) / 2;
            yOffset = 16;
    
            bounds.style.width = layout.width + 'px';
            bounds.style.height = layout.height + 'px';
            bounds.style.left = xOffset + 'px';
            bounds.style.top = yOffset + 'px';
        
            for ( const control of layout.items ) {
                let itemBounds = boundsByControl.get( control.control )!;
                itemBounds.style.position = 'absolute';
                itemBounds.style.width = control.width + 'px';
                itemBounds.style.height = control.height + 'px';
                itemBounds.style.left = 16 + control.x - xOffset + 'px';
                itemBounds.style.top = 16 + control.y - yOffset + 'px';
            }

            share.style.fontSize = (layout.width / 800) + 'rem';
        }

        updateLayout();
        flexFont( share );
        repositionControls = updateLayout;
        controlUpdate = res => {
            var control = res.control;
            var item = reactsById.get( res.control.controlId );

            if ( item != undefined ) {
                if ( control.active ) {
                    item.classList.add( 'active' );
                    item.classList.remove( 'hover' );
                }
                else if ( control.hovered ) {
                    item.classList.add( 'hover' );
                    item.classList.remove( 'active' );
                }
                else {
                    item.classList.remove( 'active' );
                    item.classList.remove( 'hover' );
                }
            }
        };
    } );
    sockets.request<API.RequestJoinControlRoom>( { type: 'join-control', deviceId: id } ).then( res => {
        if ( res.result != 'ok' ) {
            return;
        }
        
        const cursorsByUser: { [uid: number]: [el: HTMLElement, user: API.ControlRoomUser] } = {};
        function layoutUser ( uid: number ) {
            var data = cursorsByUser[ uid ];
            var cursor = data[0];
            var x = data[1].x;
            var y = data[1].y;

            cursor.style.position = 'absolute';
            cursor.style.top = yOffset + y * normalHeight - 5 + 'px';
            cursor.style.left = xOffset + x * normalWidth - ( data[1].pointer == 'pointer' ? 5 : 0 ) + 'px';
        }

        function addUser ( user: API.ControlRoomUser ) {
            var cursor = document.createElement( 'div' );
            cursor.classList.add( 'cursor' );
            var icon = document.createElement( 'i' );
            icon.classList.add( 'fa-solid' );
            icon.classList.add( 'fa-arrow-pointer' );
            cursor.appendChild( icon );
            var nametag = document.createElement( 'div' );
            nametag.classList.add( 'cursor-name' );
            cursor.appendChild( nametag );
            cursors.appendChild( cursor );
            cursorsByUser[ user.uid ] = [cursor, user];

            updateUser( user );
        }
        function updateUser ( user: API.ControlRoomUser ) {
            var data = cursorsByUser[ user.uid ];
            data[1] = user;
            var cursor = data[0];
            cursor.style.setProperty('--user-color', user.accent );
            var nametag = cursor.querySelector( '.cursor-name' ) as HTMLElement;
            nametag.innerText = user.nickname;
            var icon = cursor.querySelector( 'i' ) as HTMLElement;

            icon.classList.remove( 'fa-arrow-pointer', 'fa-hand-pointer' );
            if ( user.pointer == 'default' ) {
                icon.classList.add( 'fa-arrow-pointer' );
            }
            else if ( user.pointer == 'pointer' ) {
                icon.classList.add( 'fa-hand-pointer' );
            }
            layoutUser( user.uid );
        }
        function removeUser ( uid: number ) {
            var data = cursorsByUser[ uid ];
            data[0].remove();
            delete cursorsByUser[ uid ];
        }

        repositionCursors = () => {
            for ( const key in cursorsByUser ) {
                layoutUser( key as unknown as number );
            }
        };

        for ( const user of res.users ) {
            addUser( user );
        }
        
        heartbeatHandlers.roomUpdate = res => {
            if ( res.kind == 'user-joined' ) {
                addUser( res.user );
            }
            else if ( res.kind == 'user-updated' ) {
                updateUser( res.user );
            }
            else if ( res.kind == 'user-left' ) {
                removeUser( res.uid );
            }
            else if ( res.kind == 'control-modified' ) {
                controlUpdate?.( res );
            }
        };

        controlPage!.addEventListener( 'pointermove', e => {
            var sharebounds = share.getBoundingClientRect();
            var style = getComputedStyle(e.target as HTMLElement).cursor || 'default';
            sockets.message<API.MessageMovedPointer>( { 
                type: 'moved-pointer', 
                cursorStyle: (style == 'grab' || style == 'pointer') ? 'pointer' : 'default', 
                x: (e.clientX - sharebounds.x) / normalWidth, 
                y: (e.clientY - sharebounds.y) / normalHeight 
            } );
        } );
    } );

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