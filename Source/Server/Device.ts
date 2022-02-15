export type Device = {
    name: string,
    controls: Control.Any[]
};

export namespace Control {
    export type Button = {
        label?: string,
        type: 'button',
        value: boolean
    }

    export type Slider = {
        label?: string,
        type: 'slider',
        orientation: 'vertical',
        range: [from: number, to: number],
        value: number
    }

    export type Any = Button | Slider
};