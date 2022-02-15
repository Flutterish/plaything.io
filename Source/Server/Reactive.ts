export class Reactive<T> {
    private value: T;

    constructor ( value: T | Reactive<T> ) {
        if ( value instanceof Reactive ) {
            this.value = value.Value;

            this.bindTo( value );
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

    private bindees: WeakRef<Reactive<T>>[] = [];
    private self: WeakRef<Reactive<T>> = new WeakRef<Reactive<T>>( this );

    bindTo ( other: Reactive<T> ) {
        this.bindees.push( other.self );
        other.bindees.push( this.self );

        this.Value = other.Value;
    }
}