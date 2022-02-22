import { API } from '@Server/Api';
import { Theme } from '@Server/Themes';
import { Reactive } from './Reactive.js';
import { isLoggedIn, request, sockets } from './Session.js';
import { createTemplate } from './Utils.js';

var wrapper: HTMLElement | undefined = undefined;
export function loadWrapper ( html: string ) {
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

var cloudSaved: () => any | undefined;
var localSaved: () => any | undefined;

export var currentTheme = new Reactive<string>( 'dracula' );
currentTheme.AddOnValueChanged( v => {
    document.body.setAttribute( 'theme', v )
    localStorage.setItem( 'theme', v );
} );
var availableThemes: Theme[] = [
    { name: 'Dracula', id: 'dracula', description: 'The default dark theme' },
    // { name: 'Cherry', id: 'cherry', description: 'A colorful light theme' },
    // { name: 'Light', id: 'light', description: 'The default light theme' },
];
function cloudSaveTheme ( theme: string ) {
    localSaved?.();
    currentTheme.Value = theme;
    if ( isLoggedIn() ) {
        sockets.request<API.RequestSavePreferences>( { type: 'save-prefereces', theme: theme } ).then( () => cloudSaved?.() );
    }
}

export var accent = new Reactive<string>( '#ff79c6' );
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

export async function loadCouldPreferences () {
    var prefs = await sockets.request<API.RequestLoadPreferences>( { type: 'load-preferences' } );
    if ( prefs.accent != undefined ) 
        accent.Value = prefs.accent;
    if ( prefs.theme != undefined ) 
        currentTheme.Value = prefs.theme;
}