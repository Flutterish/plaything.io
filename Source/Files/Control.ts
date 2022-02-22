import { API } from '@Server/Api';
import { Control } from '@Server/Device';
import { mainBody, onMainBody } from './Body.js';
import { goToLoginPage } from './Login.js';
import { goToPage, PageState } from './Pages.js';
import { heartbeatHandlers, isLoggedIn, sockets, userNickname } from './Session.js';
import { computeSharedControlLayout } from './ShareLayout.js';
import { createTemplate, fitFont } from './Utils.js';

export var controlPageRemoved: (() => any) | undefined = undefined;
var controlPage: HTMLElement | undefined = undefined;

export async function goToControlPage ( id: string ) {
    if ( !isLoggedIn() ) {
        goToLoginPage();
        return;    
    }

    await goToPage( 'control', 'control.part', id );
}

export async function loadControlPage ( state: PageState ) {
    await onMainBody();

    var id = state.params[0] as string;

    var template = createTemplate( state.html );
    controlPage = template.childNodes[0] as HTMLElement;

    var share = template.querySelector( '.share' ) as HTMLElement;
    var controlList = template.querySelector( '#control-list' ) as HTMLElement;
    var cursors = template.querySelector( '#cursors' ) as HTMLElement;
    var messagesContainer = template.querySelector( '#messages' ) as HTMLElement;
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
    var repositionMessages: (() => any) | undefined = undefined;
    function windowResized () {
        repositionControls?.();
        repositionCursors?.();
        repositionMessages?.();
        fitFont( share );
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

        function createButton ( control: Control.Button, id: number, state: boolean ) {
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

            setValueById.set( id, v => {
                value = v;
                updateVisual();
            } );

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
            return button;
        }
        function createSlider ( control: Control.Slider, id: number, state: number ) {
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
            reactsById.set( id, handle );
            slider.appendChild( handle );

            let value = state;
            function updateVisual () {
                slider.style.setProperty( '--value', ((value - control.range[0]) / (control.range[1] - control.range[0])).toString() );
            }

            setValueById.set( id, v => {
                value = v;
                updateVisual();
            } );

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

            return slider;
        }

        const controls = res.controls;
        const boundsByControl = new Map<Control.Any, HTMLElement>();
        const reactsById = new Map<number, HTMLElement>()
        const setValueById = new Map<number, (value: any) => any>()
        let i = 0;
        for ( const control of controls ) {
            const id = i;
            let itemBounds = control.type == 'button'
                ? createButton( control, id, res.values[id] )
                : createSlider( control, id, res.values[id] );
                
            boundsByControl.set( control, itemBounds );
            controlList.appendChild( itemBounds );
            var react = reactsById.get( id );
            let active = false;
            let hover = false;

            react?.addEventListener( 'pointerenter', e => {
                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, active: active, hovered: hover = true } );
            } );
            react?.addEventListener( 'pointerleave', e => {
                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, active: active, hovered: hover = false } );
            } );
            function pointerUp () {
                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, active: active = false, hovered: hover } );
                window.removeEventListener( 'pointerup', pointerUp );
            }
            react?.addEventListener( 'pointerdown', e => {
                sockets.message<API.MessageModifiedControl>( { type: 'modified-control', controlId: id, active: active = true, hovered: hover } );
                window.addEventListener( 'pointerup', pointerUp );
            } );
            react?.addEventListener( 'dragend', pointerUp );
            i++;
        }

        var bounds = share;
        bounds.style.position = 'absolute';
        // bounds.style.backgroundColor = 'red';

        function updateLayout () {
            var width = controlPage!.clientWidth - 32;
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
        fitFont( share );
        repositionControls = updateLayout;
        controlUpdate = res => {
            var control = res.control;
            var item = reactsById.get( res.control.controlId );
            setValueById.get( res.control.controlId )?.( res.control.state );

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
        var messages = new Set<{ msg: HTMLElement, x: number, y: number, uid: number }>();

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

            for ( const { msg, uid } of messages ) {
                if ( uid == user.uid ) {
                    msg.style.setProperty( '--user-color', user.accent );
                }
            }
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
            else if ( res.kind == 'text-message' ) {
                addMessage( res.x, res.y, res.author.uid, res.author.nickname, res.data, res.author.accent );
            }
        };

        function handlePointer ( e: PointerEvent ) {
            var sharebounds = share.getBoundingClientRect();
            var style = getComputedStyle(e.target as HTMLElement).cursor || 'default';
            sockets.message<API.MessageMovedPointer>( { 
                type: 'moved-pointer', 
                cursorStyle: (style == 'grab' || style == 'pointer') ? 'pointer' : 'default', 
                x: (e.clientX - sharebounds.x) / normalWidth, 
                y: (e.clientY - sharebounds.y) / normalHeight 
            } );
        }

        controlPage!.addEventListener( 'pointerdown', handlePointer );
        controlPage!.addEventListener( 'pointermove', handlePointer );
        controlPage!.addEventListener( 'pointerup', handlePointer );

        function createMessage ( nickname: string, data: string, accent?: string ) {
            var div = document.createElement( 'div' );
            div.classList.add( 'message' );
            var b = document.createElement( 'b' );
            div.appendChild( b );
    
            if ( data.trim() != '' ) {
                b.innerText = `${nickname}: `;
                div.appendChild( document.createTextNode( data.trim() ) );
            }
            else {
                b.innerText = nickname;
            }
    
            if ( accent != undefined ) {
                div.style.setProperty( '--user-color', accent );
            }
            return div;
        }
        function createOwnMessage () {
            var div = document.createElement( 'div' );
            div.classList.add( 'message' );
            div.tabIndex = -1;
            var b = document.createElement( 'b' );
            b.innerText = `${userNickname}: `;
            div.appendChild( b );
            var input = document.createElement( 'input' );
            input.type = 'text';
            input.placeholder = 'Type a message...';
            div.appendChild( input );
            var send = document.createElement( 'button' );
            var icon = document.createElement( 'i' );
            icon.classList.add( 'fa-solid', 'fa-share' );
            send.appendChild( icon );
            div.appendChild( send );
    
            return div;
        }
        function addMessage ( x: number, y: number, author: number, nickname: string, data: string, accent?: string ) {
            var msg = createMessage( nickname, data, accent );
            msg.style.top = yOffset + y * normalHeight + 'px';
            msg.style.left = xOffset + x * normalWidth + 'px';
            var obj = { msg, x, y, uid: author };
            messages.add( obj );
            messagesContainer.appendChild( msg );
            msg.classList.add( 'show' );
            setTimeout( () => {
                msg.classList.remove( 'show' );
                msg.classList.add( 'hide' );
                setTimeout( () => {
                    msg.remove();
                    messages.delete( obj );
                }, 2000 );
            }, Math.min( 2000 + 100 * data.length, 10 * 1000 ) );
        }
        function onContextMenu ( e: MouseEvent ) {
            var msg = createOwnMessage();
            var sharebounds = share.getBoundingClientRect();
            var x = (e.clientX - sharebounds.x) / normalWidth;
            var y = (e.clientY + 6 - sharebounds.y) / normalHeight;
            msg.style.top = yOffset + y * normalHeight + 'px';
            msg.style.left = xOffset + x * normalWidth + 'px';
            messagesContainer.appendChild( msg );
            var data = { msg, x, y, uid: -1 };
            messages.add( data );
    
            let focused = false;
            msg.querySelector( 'input' )!.focus();
            msg.addEventListener( 'focusin', e => {
                focused = true;
            } );
            msg.addEventListener( 'focusout', e => {
                focused = false;
                setTimeout( () => {
                    if ( !focused ) {
                        msg.remove();
                        messages.delete( data );
                    }
                }, 0 );
            } );
            function send () {
                var text = msg.querySelector( 'input' )!.value;
                msg.remove();
                messages.delete( data );
                addMessage( x, y, -1, userNickname!, text );
                sockets.message<API.MessageSentText>( { type: 'sent-text', message: text, x: x, y: y } );
            }
            msg.addEventListener( 'keydown', e => {
                if ( e.key.toLowerCase() == 'enter' ) {
                    send();
                }
            } );
            msg.querySelector( 'button' )!.addEventListener( 'click', send );
            e.preventDefault();
        }

        repositionMessages = () => {
            for ( const { msg, x, y } of messages ) {
                msg.style.top = yOffset + y * normalHeight + 'px';
                msg.style.left = xOffset + x * normalWidth + 'px';
            }
        };

        mainBody!.addEventListener( 'contextmenu', onContextMenu );
        var oldRemoved = controlPageRemoved;
        controlPageRemoved = () => {
            oldRemoved?.();
            mainBody?.removeEventListener( 'contextmenu', onContextMenu );
        }
    } );

    mainBody!.appendChild( controlPage );
}

export function destroyControls () {
    if ( controlPage != undefined ) {
        controlPage?.remove();
        controlPage = undefined;
        controlPageRemoved?.();
        controlPageRemoved = undefined;
    }
}