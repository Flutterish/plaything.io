import { Reactive } from "./Reactive.js";
import { SessionKey } from './Session';

export type PoolSubscription<Tsession> = {
    unsubscribe: () => any,
    ReactTo: <Treactive>( 
        get: (session: Tsession) => Reactive<Treactive>,
        react: (session: Tsession, value: Treactive) => any
    ) => PoolSubscription<Tsession>
};

export function CreateSessionSubscription<Tsession> (
    sessionPool: {
        entryAdded: { addEventListener: (fn: typeof added) => any, removeEventListener: (fn: typeof added) => any },
        entryRemoved: { addEventListener: (fn: typeof removed) => any, removeEventListener: (fn: typeof removed) => any },
        getAll: () => Readonly<{[Key: SessionKey]: Tsession }>
    },
    added: ( session: Tsession, scan?: true ) => any,
    removed: ( session: Tsession ) => any
): PoolSubscription<Tsession> {
    function entryAdded ( session: Tsession, scan?: true ) {
        added( session, scan );
    }
    
    function entryRemoved ( session: Tsession ) {
        removed( session );
    }
    
    function unsubscribe () {
        sessionPool.entryAdded.removeEventListener( entryAdded );
        sessionPool.entryRemoved.removeEventListener( entryRemoved );
    }
    
    sessionPool.entryAdded.addEventListener( entryAdded );
    sessionPool.entryRemoved.addEventListener( entryRemoved );
    
    var all = sessionPool.getAll();
    for ( const key in all ) {
        added( all[key], true );
    }

    function reactToFactory () {
        return <Treactive>( 
            get: (session: Tsession) => Reactive<Treactive>,
            react: (session: Tsession, value: Treactive) => any
        ) => {
            const reactives = new Map<Tsession, Reactive<Treactive>>();

            var chainAdded = added;
            var selfAdded: typeof added = (session, scan) => {
                var reactive = new Reactive<Treactive>( get( session ) );
                reactives.set( session, reactive );
                reactive.AddOnValueChanged( v => react( session, v ) );
            }
            added = (session, scan) => {
                selfAdded( session, scan );
                chainAdded( session, scan );
            }

            var chainRemoved = removed;
            removed = (session) => {
                var reactive = reactives.get( session );
                reactive?.RemoveEvents();
                reactives.delete( session );
                chainRemoved( session );
            };

            var all = sessionPool.getAll();
            for ( const key in all ) {
                selfAdded( all[key], true );
            }

            return {
                unsubscribe: () => {
                    for ( const k of reactives ) {
                        k[1].RemoveEvents();
                    }
                    reactives.clear();
                    unsubscribe();
                },
                ReactTo: reactToFactory()
            }
        };
    }

    return {
        unsubscribe: unsubscribe,
        ReactTo: reactToFactory()
    };
}