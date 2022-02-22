import { loadControlPage } from './Control.js';
import { loadDevicesPage } from './Devices.js';
import { goToLoginPage, loadLoginPage } from './Login.js';
import { ComponentName, isLoggedIn, request } from './Session.js';

export type PageState = {
    type: 'login' | 'devices' | 'control',
    html: string,
    params: any[]
};

export async function loadPage ( state: PageState ) {
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

export async function goToPage ( type: PageState['type'], component: ComponentName, ...params: any[] ) {
    var res = await request( component );
    var state: PageState = { type: type, html: res, params: params };
    window.history.pushState( state, '', type );
    await loadPage( state );
}

// TODO a system to manage pages