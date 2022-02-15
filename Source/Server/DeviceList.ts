import type { Device } from "./Device";

export const DeviceList: { [name: string]: Device } = {
    sample1: {
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
        name: 'Device B',
        controls: [
            {
                type: 'slider',
                orientation: 'vertical',
                label: 'Power',
                value: 0,
                range: [0, 100]
            }
        ]
    },
    sample3: {
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
                range: [0, 100]
            }
        ]
    }
};