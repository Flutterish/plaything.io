import { WebSocket, WebSocketServer } from 'ws';
import { AnyControlInstance, ButtonInstance, SliderInstance, Device } from './Device.js';
import { CreatePool } from './Subscription.js';
import { SubscribeablePool } from './Subscription';
import { LogWithSource } from './Logger.js';

type Socket = ReturnType<typeof WrapSocket>;

function WrapSocket ( ws: WebSocket ) {
    return {
        send: <T extends ButtplugAPI.Heartbeat>( msg: T ) => {
            ws.send( JSON.stringify( msg ) );
        },
        raw: ws
    };
}

export function CreateButtplugServer ( port: number ) {
    const pool = CreatePool<Device>();
    var server = new WebSocketServer( {
        port: port
    } );

    var hasProvider = false;
    var devicesById: { [id: number]: Device } = {};
    server.addListener( 'connection', (socket, req) => {
        if ( hasProvider ) {
            socket.close();
        }
        else {
            var ws = WrapSocket( socket );
            hasProvider = true;
            LogWithSource( 'Buttplug.io', `Provider connected at ${req.socket.remoteAddress}` );
            socket.addEventListener( 'message', e => {
                var data = JSON.parse( e.data.toString() ) as ButtplugAPI.Message;

                if ( data.type == 'device-added' ) {
                    LogWithSource( 'Buttplug.io', 'Device detected:', data );
                    pool.add( createDevice( data.device, ws ) );
                }
                else if ( data.type == 'device-removed' ) {
                    LogWithSource( 'Buttplug.io', 'Device disconnected:', data );
                }
                
            } );
            socket.addEventListener( 'close', e => {
                LogWithSource( 'Buttplug.io', `Provider disconnected at ${req.socket.remoteAddress}` );
                pool.clear();
                hasProvider = false;
            } );
        }
    } );

    return {
        devices: pool as SubscribeablePool<Device>
    };
}

function createDevice ( data: ButtplugAPI.ButtplugDevice, ws: Socket ): Device {
    var device = {
        ID: `buttplug.io-device-${data.index}`,
        name: data.name,
        controls: []
    } as Device;

    if ( data.allowedMessages.StopDeviceCmd != undefined && data.allowedMessages.VibrateCmd != undefined ) {
        device.controls = createVibrator( data, ws );
    }

    return device;
}

function createVibrator ( data: ButtplugAPI.ButtplugDevice, ws: Socket ): AnyControlInstance[] {
    var powerButton = new ButtonInstance( {
        type: 'button',
        label: 'On/Off'
    }, false );

    var powerSlider = new SliderInstance( {
        type: 'slider',
        orientation: 'vertical',
        label: 'Power',
        notches: 11,
        range: [0, 100]
    }, 0 );

    powerButton.State.AddOnValueChanged( v => {
        if ( v ) {
            ws.send<ButtplugAPI.HeartbeatVibrate>( { type: 'vibrate', index: data.index, speed: powerSlider.State.Value / 100 } );
        }
        else {
            ws.send<ButtplugAPI.HeartbeatPowerOff>( { type: 'power-off', index: data.index } )
        }
    }, true );
    powerSlider.State.AddOnValueChanged( v => {
        if ( powerButton.State.Value ) {
            ws.send<ButtplugAPI.HeartbeatVibrate>( { type: 'vibrate', index: data.index, speed: v / 100 } );
        }
    } );

    return [powerButton, powerSlider];
}

export namespace ButtplugAPI {
    export type MessageAttributeType = 
        'VibrateCmd' | 'RotateCmd' | 'LinearCmd' | 'StopDeviceCmd'
        | 'RawReadCmd' | 'RawWriteCmd' | 'RawSubscribeCmd' | 'RawUnsubscribeCmd'
        | 'BatteryLevelCmd' | 'RssilevelCmd'
    export type ButtplugDevice = {
        name: string,
        index: number,
        allowedMessages: { [Key in MessageAttributeType]?: {
            featureCount: number,
            stepCount: number[],
            maxDuration: number[],
            endpoints: number[]
        } }
    }
    
    export type MessageDeviceAdded = {
        type: 'device-added',
        device: ButtplugDevice
    }
    export type MessageDeviceRemoved = {
        type: 'device-removed',
        index: number
    }

    type MessageTypes = MessageDeviceAdded | MessageDeviceRemoved
    export type Message = Extract<MessageTypes, { type: string }>

    export type HeartbeatPowerOff = {
        type: 'power-off',
        index: number
    }
    export type HeartbeatVibrate = {
        type: 'vibrate',
        index: number
    } & ({
        speed: number
    } | {
        speeds: number[]
    } | {
        speedByFeature: { [index: number]: number }
    })

    type HeartbeatTypes = HeartbeatPowerOff | HeartbeatVibrate;
    export type Heartbeat = Extract<HeartbeatTypes, { type: string }>
}