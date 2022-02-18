export type Listener<T> = (event: T) => any;
export type RemoveListener<T> = () => any;

export type Event<T> = {
    addEventListener: (listener: Listener<T>) => any,
    removeEventListener: (listener: Listener<T>) => any,
    addOnce: (listener: Listener<T>) => any,
    addOnceWhen: (predicate: (event: T) => boolean, listener: Listener<T>) => RemoveListener<T>
};

export function CreateEvent<T> () {
    type Listener = (event: T) => any;
    var listeners: Listener[] = [];
    var once: Listener[] = [];

    var iface = {
        addEventListener: (listener: Listener) => {
            listeners.push( listener );
        },
        removeEventListener: (listener: Listener) => {
            var index = listeners.indexOf( listener );
            if ( index != -1 ) {
                listeners.splice( index, 1 );
            }
        },
        addOnce: (listener: Listener) => {
            once.push( listener );
        },
        addOnceWhen: (predicate: (event: T) => boolean, listener: Listener) => {
            function waiter (e: T) {
                if ( predicate( e ) )
                    listener( e );
                else
                    iface.addOnce( waiter );
            }

            iface.addOnce( waiter );

            return () => {
                let index = once.indexOf( waiter );
                if ( index != -1 ) {
                    once.splice( index, 1 );
                }
            };
        }
    };

    var trigger = (event: T) => {
        for ( const l of [...listeners] ) {
            l( event );
        }
        var o = once;
        once = [];
        for ( const l of o ) {
            l( event );
        }
    };

    return [iface, trigger] as [iface: Event<T>, trigger: typeof trigger];
}