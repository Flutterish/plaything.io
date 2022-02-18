import { Event } from "./Events.js";
import { Reactive } from "./Reactive.js";
import { Socket } from './Socket';

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
    entryAdded: Event<Tsession>,
    entryRemoved: Event<Tsession>,
    getValues: () => Readonly<Array<Tsession>>
}

export function CreatePoolSubscription<Tsession> (
    sessionPool: SubscribeablePool<Tsession>,
    added: AddedListener<Tsession>,
    removed: RemovedListener<Tsession>,
    options?: {
        ignoreExistingEntries?: boolean,
        ignore?: (v: Tsession) => boolean
    }
): PoolSubscription<Tsession> {
    function entryAdded ( session: Tsession, scan?: true ) {
        if ( !(options?.ignoreExistingEntries && scan) && options?.ignore?.( session ) != true )
            added( session, scan );
    }
    
    function entryRemoved ( session: Tsession ) {
        if ( options?.ignore?.( session ) != true )
            removed( session );
    }
    
    var unsubscribe = () => {
        sessionPool.entryAdded.removeEventListener( entryAdded );
        sessionPool.entryRemoved.removeEventListener( entryRemoved );
    }
    
    sessionPool.entryAdded.addEventListener( entryAdded );
    sessionPool.entryRemoved.addEventListener( entryRemoved );
    
    for ( const s of sessionPool.getValues() ) {
        entryAdded( s, true );
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
                reactive?.UnbindAll();
                reactives.delete( session );
                chainRemoved( session );
            };

            for ( const s of sessionPool.getValues() ) {
                if ( options?.ignore?.( s ) != true )
                    selfAdded( s, true );
            }

            var chainUnsubscribe = unsubscribe;
            unsubscribe = () => {
                for ( const k of reactives ) {
                    k[1].RemoveEvents();
                    k[1].UnbindAll();
                }
                reactives.clear();
                chainUnsubscribe();
            }

            return {
                unsubscribe: unsubscribe,
                ReactTo: reactToFactory()
            }
        };
    }

    return {
        unsubscribe: unsubscribe,
        ReactTo: reactToFactory()
    };
}

export function CreateWebsocketSubscriptionManager () {
    const keys = Symbol('keys');
    var wsMap = new Map<Socket, {[keys]: number, [key: string]: () => any}>();

    var manager = {
        canSubscribe: (ws: Socket | undefined, name: string): ws is Socket => {
            return ws != undefined && !manager.subscriptionExists( ws, name );
        },
        subscriptionExists: (ws: Socket, name: string) => {
            var map = wsMap.get( ws );
            return map != undefined && map[name] != undefined;
        },
        createSubscription: (ws: Socket, name: string, unsub: () => any) => {
            if ( !wsMap.has( ws ) ) {
                wsMap.set( ws, { [keys]: 0 } );
            }

            var map = wsMap.get( ws )!;
            if ( map[name] != undefined ) {
                throw `Can only have one ws subscription of type '${name}'`;
            }
            map[keys]++;
            function remove () {
                delete map[name];
                map[keys]--;
                if ( map[keys] == 0 ) {
                    wsMap.delete( ws );
                }
                ws.raw.removeEventListener( 'close', remove );
                unsub();
            }

            map[name] = remove;
            ws.raw.addEventListener( 'close', remove );
        },
        removeSubscription: (ws: Socket, name: string) => {
            var map = wsMap.get( ws );
            if ( map != undefined && map[name] != undefined ) {
                map[name]();
            }
        }
    };

    return manager;
}