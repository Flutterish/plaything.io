import type { API } from '@Server/Api';
import type { Control } from '@Server/Device';
import { ControlVisual } from '../Control';
import { sockets } from '../Session';

export function createButton ( control: Control.Button, id: number, state: boolean ): ControlVisual {
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
    button.appendChild( inner );
    var icon = document.createElement( 'i' );
    icon.classList.add( 'fa-solid' );
    icon.classList.add( 'fa-power-off' );
    inner.appendChild( icon );

    let value = state;
    function updateVisual () {
        if ( value ) {
            button.classList.remove( 'off' );
            button.classList.add( 'on' );
        }
        else {
            button.classList.remove( 'on' );
            button.classList.add( 'off' );
        }
    }

    inner.addEventListener( 'click', e => {
        value = !value;
        updateVisual();

        sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, state: value, timestamp: Date.now() } );
    } );
    let istouch = false;
    inner.addEventListener( 'mousedown', e => istouch = false );
    inner.addEventListener( 'touchstart', e => istouch = true );
    inner.addEventListener( 'contextmenu', e => {
        if ( istouch ) {
            function onUp () {
                value = !value;
                updateVisual();

                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, state: value, timestamp: Date.now() } );
                inner.removeEventListener( 'touchend', onUp );
            }
            inner.addEventListener( 'touchend', onUp );
            e.preventDefault();
            e.stopPropagation();
        }
    } );

    updateVisual();

    return {
        element: button,
        setValue: v => {
            value = v;
            updateVisual();
        },
        hoverActiveElement: inner
    };
}