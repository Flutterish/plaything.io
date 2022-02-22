import { API } from '@Server/Api';
import { mainBody, onMainBody } from './Body.js';
import { goToControlPage } from './Control.js';
import { goToLoginPage } from './Login.js';
import { goToPage, PageState } from './Pages.js';
import { heartbeatHandlers, isLoggedIn, sockets } from './Session.js';
import { createTemplate } from './Utils.js';

var devicesPage: HTMLElement | undefined = undefined;
export async function goToDevicesPage () {
    if ( !isLoggedIn() ) {
        goToLoginPage();
        return;    
    }

    await goToPage( 'devices', 'devices.part' );
}

export async function loadDevicesPage ( state: PageState ) {
    await onMainBody();

    var template = createTemplate( state.html );
    devicesPage = template.childNodes[0] as HTMLElement;

    var listing = devicesPage.querySelector( '.listing' ) as HTMLElement;
    var usersList = devicesPage.querySelector( '#users' ) as HTMLElement;

    sockets.request<API.SubscribeDevices>( { type: 'subscibe-devices' } ).then( res => {
        var nothingText: Text | undefined;
        var devicesById: { [id: string]: HTMLElement } = {};
        var deviceCount = 0;

        function addDevice ( device: API.DeviceID ) {
            deviceCount++;
            nothingText?.remove();
            nothingText = undefined;

            var div = document.createElement( 'div' );
            div.classList.add( 'device' );
            div.innerText = device.name;
            listing.appendChild( div );
            devicesById[device.id] = div;

            div.addEventListener( 'click', () => {
                goToControlPage( device.id );
            } );
        }

        function removeDevice ( id: string ) {
            deviceCount--;
            devicesById[id].remove();
            delete devicesById[id];

            if ( deviceCount == 0 ) {
                listing.append( nothingText = document.createTextNode( 'Nothing!' ) );
            }
        }

        for ( const device of res.devices ) {
            addDevice( device );
        }

        if ( deviceCount == 0 ) {
            listing.append( nothingText = document.createTextNode( 'Nothing!' ) );
        }

        heartbeatHandlers.deviceUpdate = res => {
            if ( res.kind == 'added' ) {
                addDevice( res.device );
            }
            else if ( res.kind == 'removed' ) {
                removeDevice( res.deviceId );
            }
        };
    } );

    var nooneText: Text | undefined;
    var usercount = 0;
    var users: { [uid: number]: [HTMLElement, Text, HTMLElement] } = {};
    function addUser ( nick: string, location: string, uid: number, accent: string ) {
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

export function destroyDevices () {
    devicesPage?.remove();
    devicesPage = undefined;
}