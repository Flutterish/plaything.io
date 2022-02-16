export class Reactive<T> {
    private value: T;

    constructor ( value: T | Reactive<T> ) {
        if ( value instanceof Reactive ) {
            this.value = value.Value;

            this.BindTo( value );
        }
        else this.value = value;
    }

    get Value (): T {
        return this.value;
    }

    set Value ( value: T ) {
        if ( value == this.value ) return;

        this.changeValue( value, this );
    }

    private changeValue ( value: T, source: Reactive<T> ) {
        var prev = this.value;
        this.value = value;

        for ( let i = 0; i < this.bindees.length; i++ ) {
            var bindee = this.bindees[i].deref();
            if ( bindee == undefined ) {
                this.bindees.splice( i--, 1 );
            }
        }

        for ( const ref of [...this.bindees] ) {
            var bindee = ref.deref();
            if ( bindee != source )
                bindee!.changeValue( value, this );
        }

        if ( value == this.value ) {
            for ( const listener of [...this.valueChanged] ) {
                listener( value, prev );
            }
        }
    }

    AddOnValueChanged ( listener: (value: T, oldValue: T) => any, fireNow?: boolean ) {
        this.valueChanged.push( listener );
        if ( fireNow )
            listener( this.value, this.value );
    }
    RemoveOnValueChanged ( listener: (value: T, oldValue: T) => any ) {
        var index = this.valueChanged.indexOf( listener );
        if ( index != -1 ) {
            this.valueChanged.splice( index, 1 );
        }
    }
    private valueChanged: ((value: T, oldValue: T) => any)[] = [];

    RemoveEvents () {
        this.valueChanged = [];
    }
    UnbindAll () {
        for ( const b of [...this.bindees] ) {
            var bindee = b.deref();
            if ( bindee != undefined ) {
                this.UnbindFrom( bindee );
            }
        }
    }

    private bindees: WeakRef<Reactive<T>>[] = [];
    private self: WeakRef<Reactive<T>> = new WeakRef<Reactive<T>>( this );

    BindTo ( other: Reactive<T> ) {
        this.bindees.push( other.self );
        other.bindees.push( this.self );

        this.Value = other.Value;
    }
    UnbindFrom ( other : Reactive<T> ) {
        var index = this.bindees.indexOf( other.self );
        if ( index != -1 ) this.bindees.splice( index );
        index = other.bindees.indexOf( this.self );
        if ( index != -1 ) other.bindees.splice( index );
    }
}

export type ReactiveAggregate<Tin, Tout = Tin> = {
    add: (source: Reactive<Tin>) => any,
    remove: (source: Reactive<Tin>) => any,
    getSources: () => Reactive<Tin>[],
    reactive: Reactive<Tout>
};
export function CreateReactiveAggregate<Tin, Tout = Tin> ( fn: (sources: Reactive<Tin>[], newValue?: Tin, oldValue?: Tin) => Tout ): ReactiveAggregate<Tin, Tout> {
    const sources: Reactive<Tin>[] = [];

    var output = new Reactive<Tout>( fn( sources ) );

    function changed ( newValue?: Tin, oldValue?: Tin ) {
        output.Value = fn( sources, newValue, oldValue );
    }

    return {
        add: (source: Reactive<Tin>) => {
            sources.push( source );
            source.AddOnValueChanged( changed );
            changed( source.Value, undefined );
        },
        remove: (source: Reactive<Tin>) => {
            var index = sources.indexOf( source );
            if ( index != -1 ) {
                source.RemoveOnValueChanged( changed );
                sources.splice( index );
                changed( undefined, source.Value );
            }
        },
        getSources: () => sources,
        reactive: output
    };
}