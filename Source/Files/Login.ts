import { destroyMain } from './Body.js';
import { goToDevicesPage } from './Devices.js';
import { goToPage, PageState } from './Pages.js';
import { cachedGet, invite, logIn } from './Session.js';
import { loadCouldPreferences } from './Settings.js';
import { createTemplate } from './Utils.js';

var loginPage: HTMLElement | undefined = undefined;
export async function goToLoginPage ( ...messages: string[] ) {
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

export async function loadLoginPage ( state: PageState ) {
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
        if ( invite != '' ) {
            var small = document.createElement( 'small' );
            small.innerText = `\nInvite: `;
            var spoiler = document.createElement( 'div' );
            spoiler.classList.add( 'spoiler' );
            spoiler.innerText = '#' + invite;
            small.appendChild( spoiler );
            serverName.appendChild( small );
        }
    } );

    cachedGet( 'login-information' ).then( info => {
        if ( info.anonymousAllowed ) {
            passLabel.setAttribute( 'title', 'Password is not required. You can log in anonymously with a blank password' );
        }
        else {
            passLabel.innerText += '*';
            passLabel.setAttribute( 'title', 'Password is required' );
        }

        if ( info.inviteRequired && invite == '' ) {
            messages.innerHTML = `
                <i class="fa-solid fa-skull"></i>
                <div>You will not be able to join</div>
                <div>An invite link is required to join this server</div>
            `;
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
            else if ( res.reason == 'invite required' ) {
                if ( invite == '' ) {
                    messages.innerHTML += '<div>An invite link is required to join this server</div>';
                }
                else {
                    messages.innerHTML += '<div>Your invite link is invalid</div>';
                }
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

export function destroyLogin () {
    if ( loginPage != undefined ) {
        loginPage.remove();
        loginPage = undefined;
    }
}