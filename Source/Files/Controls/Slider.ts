import type { API } from '@Server/Api';
import type { Control } from '@Server/Device';
import { ControlVisual } from '../Control';
import { sockets } from '../Session';

export function createSlider ( control: Control.Slider, id: number, state: number ): ControlVisual {
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
        notchLabel.classList.add( 'notch-label' );
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
    slider.appendChild( handle );

    let value = state;
    function updateVisual () {
        slider.style.setProperty( '--value', ((value - control.range[0]) / (control.range[1] - control.range[0])).toString() );
    }

    function drag ( e: PointerEvent ) {
        var bound = slider.getBoundingClientRect();
        var style = getComputedStyle( notches );
        var padding = Number.parseFloat( style.paddingTop );
        var y = 1 - (e.clientY - bound.top - padding) / (bound.height - padding * 2);
        y = Math.max( Math.min( y, 1 ), 0 );
        value = control.range[0] + y * ( control.range[1] - control.range[0] );
        sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, state: value, timestamp: Date.now() } );
        updateVisual();
    }
    function dragEnd () {
        window.removeEventListener( 'pointermove', drag );
        window.removeEventListener('pointerup', dragEnd );
    }
    handle.addEventListener( 'pointerdown', e => {
        window.addEventListener( 'pointermove', drag );
        window.addEventListener('pointerup', dragEnd );
    } );

    updateVisual();

    return {
        element: slider,
        setValue: v => {
            value = v;
            updateVisual();
        },
        hoverActiveElement: handle
    }
}