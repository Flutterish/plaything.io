export function CreateEvent<T> () {
    type Listener = (event: T) => any;
    var listeners: Listener[] = [];

    var iface = {
        addEventListener: (listener: Listener) => {
            listeners.push( listener );
        },
        removeEventListener: (listener: Listener) => {
            var index = listeners.indexOf( listener );
            if ( index != -1 ) {
                listeners.splice( index, 1 );
            }
        }
    };

    var trigger = (event: T) => {
        for ( const l of [...listeners] ) {
            l( event );
        }
    };

    return [iface, trigger] as [iface: typeof iface, trigger: typeof trigger];
}