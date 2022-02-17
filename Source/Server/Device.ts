import { Reactive } from './Reactive.js';

export type Device = {
    ID: number,
    name: string,
    controls: AnyControlInstance[]
};

export namespace Control {
    export type Button = {
        label?: string,
        type: 'button'
    }

    export type Slider = {
        label?: string,
        type: 'slider',
        orientation: 'vertical',
        range: [from: number, to: number]
        notches: number
    }

    export type Any = Button | Slider
};

export abstract class ControlInstance<T extends Control.Any, Tvalue> {
    readonly Prototype: T;
    readonly State: Reactive<Tvalue>;

    constructor ( proto: T, value: Tvalue ) {
        this.Prototype = proto;
        this.State = new Reactive<Tvalue>( value );
    }

    abstract TrySet ( value: any ): any
}

export type AnyControlInstance = ControlInstance<Control.Any, any>;
export class ButtonInstance extends ControlInstance<Control.Button, boolean> {
    TrySet ( value: any ) {
        if ( typeof value === 'boolean' ) {
            this.State.Value = value;
        }
    }
};
export class SliderInstance extends ControlInstance<Control.Slider, number> {
    TrySet ( value: any ) {
        if ( typeof value === 'number' ) {
            var from = Math.min( ...this.Prototype.range );
            var to = Math.max( ...this.Prototype.range );
            this.State.Value = Math.max( Math.min( value, to ), from );
        }
    }
};