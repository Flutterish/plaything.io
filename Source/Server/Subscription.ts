import { Reactive } from "./Reactive.js";
import { SessionKey } from './Session';

export type PoolSubscription = {
    unsubscribe: () => any
};

export function CreateSessionSubscription<Tsession, Treactive> (
    sessionPool: {
        entryAdded: { addEventListener: (fn: typeof added) => any, removeEventListener: (fn: typeof added) => any },
        entryRemoved: { addEventListener: (fn: typeof removed) => any, removeEventListener: (fn: typeof removed) => any },
        getAll: () => Readonly<{[Key: SessionKey]: Tsession }>
    },
    added: ( session: Tsession, scan?: true ) => any,
    removed: ( session: Tsession ) => any,
    valueChanged: ( session: Tsession, value: Treactive ) => any,
    getReactive: ( session: Tsession ) => Reactive<Treactive>
): PoolSubscription {
    const reactives = new Map<Tsession, Reactive<Treactive>>();

    function entryAdded ( session: Tsession, scan?: true ) {
        var reactive = new Reactive<Treactive>( getReactive( session ) );
        reactives.set( session, reactive );
        reactive.AddOnValueChanged( v => valueChanged( session, v ) );
        added( session, scan );
    }
    
    function entryRemoved ( session: Tsession ) {
        var reactive = reactives.get( session );
        reactive?.RemoveEvents();
        reactives.delete( session );
        removed( session );
    }
    
    function unsubscribe () {
        sessionPool.entryAdded.removeEventListener( entryAdded );
        sessionPool.entryRemoved.removeEventListener( entryRemoved );
    
        for ( const k of reactives ) {
            k[1].RemoveEvents();
        }
        reactives.clear();
    }
    
    sessionPool.entryAdded.addEventListener( entryAdded );
    sessionPool.entryRemoved.addEventListener( entryRemoved );
    
    var all = sessionPool.getAll();
    for ( const key in all ) {
        added( all[key], true );
    }

    return {
        unsubscribe: unsubscribe
    };
}