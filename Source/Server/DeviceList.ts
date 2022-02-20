import { Device, ButtonInstance, SliderInstance } from "./Device.js";

export const DeviceList: { [name: string]: Device } = {
    sample1: {
        ID: 'sample-device-0',
        name: 'Device A',
        controls: [
            new ButtonInstance({
                type: 'button',
                label: 'On/Off'
            }, false)
        ]
    },
    sample2: {
        ID: 'sample-device-1',
        name: 'Device B',
        controls: [
            new SliderInstance({
                type: 'slider',
                orientation: 'vertical',
                label: 'Juice Me',
                range: [0, 100],
                notches: 11
            }, 0),
            new SliderInstance({
                type: 'slider',
                orientation: 'vertical',
                label: 'Squeeze Me',
                range: [0, 100],
                notches: 11
            }, 0),
            new SliderInstance({
                type: 'slider',
                orientation: 'vertical',
                label: 'Buy Me',
                range: [0, 100],
                notches: 11
            }, 0)
        ]
    },
    sample3: {
        ID: 'sample-device-2',
        name: 'Device C',
        controls: [
            new ButtonInstance({
                type: 'button',
                label: 'On/Off'
            }, true),
            new SliderInstance({
                type: 'slider',
                orientation: 'vertical',
                label: 'Power',
                range: [0, 100],
                notches: 11
            }, 0)
        ]
    }
};