import type { Device } from "./Device";

export const DeviceList: { [name: string]: Device } = {
    sample1: {
        ID: 0,
        name: 'Device A',
        controls: [
            {
                type: 'button',
                label: 'On/Off',
                value: false
            }
        ]
    },
    sample2: {
        ID: 1,
        name: 'Device B',
        controls: [
            {
                type: 'slider',
                orientation: 'vertical',
                label: 'Power',
                value: 0,
                range: [0, 100],
                notches: 5
            }
        ]
    },
    sample3: {
        ID: 2,
        name: 'Device C',
        controls: [
            {
                type: 'button',
                label: 'On/Off',
                value: false
            },
            {
                type: 'slider',
                orientation: 'vertical',
                label: 'Power',
                value: 0,
                range: [0, 100],
                notches: 11
            }
        ]
    }
};