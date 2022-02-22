import { goToDevicesPage } from './Devices.js';
import { goToLoginPage } from './Login.js';
import { loadPage } from './Pages.js';
import { request, Reconnected, Connected, LoggedOut } from './Session.js';
import { accent, currentTheme, loadCouldPreferences, loadWrapper } from './Settings.js';

LoggedOut.push( goToLoginPage );
Connected.push( goToLoginPage );
Reconnected.push( () => {
    loadCouldPreferences();
    goToDevicesPage();
} );

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