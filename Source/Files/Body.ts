import { destroyControls } from './Control.js';
import { goToDevicesPage } from './Devices.js';
import { destroyLogin } from './Login.js';
import { cachedGet, logOut, request, userNickname } from './Session.js';
import { createTemplate } from './Utils.js';
import { destroyDevices } from './Devices';

export var mainBody: HTMLElement | undefined = undefined;
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

export async function onMainBody () {
    if ( mainBody == undefined ) {
        await loadMainBody( await request( 'main.part' ) );
    }

    destroyDevices();
    destroyControls();
}

export function destroyMain () {
    if ( mainBody != undefined ) {
        mainBody.remove();
        mainBody = undefined;

        destroyDevices();
        destroyControls();
    }
}