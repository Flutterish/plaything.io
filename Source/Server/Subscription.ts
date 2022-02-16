import { Reactive } from "./Reactive.js";

export type PoolSubscription<Tsession> = {
    unsubscribe: () => any,
    ReactTo: <Treactive>( 
        get: (session: Tsession) => Reactive<Treactive>,
        react: (session: Tsession, value: Treactive) => any
    ) => PoolSubscription<Tsession>
};

export type AddedListener<Tsession> = ( session: Tsession, scan?: true ) => any;
export type RemovedListener<Tsession> = ( session: Tsession ) => any;

export type SubscribeablePool<Tsession> = {
    entryAdded: { addEventListener: (fn: AddedListener<Tsession>) => any, removeEventListener: (fn: AddedListener<Tsession>) => any },
    entryRemoved: { addEventListener: (fn: RemovedListener<Tsession>) => any, removeEventListener: (fn: RemovedListener<Tsession>) => any },
    getValues: () => Readonly<Array<Tsession>>
}

export function CreatePoolSubscription<Tsession> (
    sessionPool: SubscribeablePool<Tsession>,
    added: AddedListener<Tsession>,
    removed: RemovedListener<Tsession>
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
    
    for ( const s of sessionPool.getValues() ) {
        added( s, true );
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

            for ( const s of sessionPool.getValues() ) {
                selfAdded( s, true );
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