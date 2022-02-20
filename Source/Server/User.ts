import { Device } from "./Device";
import { CreateEvent } from "./Events.js";
import { Reactive, CreateReactiveAggregate, ReactiveAggregate } from "./Reactive.js";
import { ManagedPool, SubscribeablePool } from './Subscription';
import { Room } from './Room';

export type User = {
    nickname: string,
    UID: number,
    isAnon?: boolean,
    passwordHash?: string,
    allowedDevicePools: ManagedPool<SubscribeablePool<Device>>,
    allowedDevices: SubscribeablePool<Device>,
    accent: Reactive<string>,
    theme?: string,
    room: Reactive<Room | undefined>,

    lastActive: number,
    isActive: Reactive<boolean>
};

export class UserSession {
    readonly user: User;
    
    constructor ( user: User ) {
        this.user = user;
    }
    
    lastActive: number = Date.now();
    isActive: Reactive<boolean> = new Reactive<boolean>( true );
}

export type HasUser = { user: User };
export function CreateUserPool<Tsession extends HasUser = HasUser> ( sessions: SubscribeablePool<Tsession> ) {
    var users: { [uid: number]: {user: User, sessions: Tsession[]} } = {};

    var [entryAddedEvent, entryAddedTrigger] = CreateEvent<User>();
    var [entryRemovedEvent, entryRemovedTrigger] = CreateEvent<User>();

    function sessionAdded ( session: Tsession ) {
        if ( users[ session.user.UID ] == undefined ) {
            users[ session.user.UID ] = {
                user: session.user,
                sessions: [ session ]
            };

            entryAddedTrigger( session.user );
        }
        else {
            users[ session.user.UID ].sessions.push( session );
        }
    }
    function sessionRemoved ( session: Tsession ) {
        users[ session.user.UID ].sessions.splice( users[ session.user.UID ].sessions.indexOf( session ), 1 );
        if ( users[ session.user.UID ].sessions.length == 0 ) {
            delete users[ session.user.UID ];
            entryRemovedTrigger( session.user );
        }
    }

    sessions.entryAdded.addEventListener( sessionAdded );
    sessions.entryRemoved.addEventListener( sessionRemoved );

    for ( const i of sessions.getValues() ) {
        sessionAdded( i );
    }

    return {
        entryAdded: entryAddedEvent,
        entryRemoved: entryRemovedEvent,
        getValues: () => Object.values( users ).map( x => x.user ),
        unsubscribe: () => {
            sessions.entryAdded.removeEventListener( sessionAdded );
            sessions.entryRemoved.removeEventListener( sessionRemoved );
        }
    }
}

export type HasUserActivity = { user: User, isActive: Reactive<boolean> };
export function CreateActiveUserPool<Tsession extends HasUserActivity = HasUserActivity> ( sessions: SubscribeablePool<Tsession> ) {
    var users: { [uid: number]: ReactiveAggregate<boolean> } = {};
    var activeUsers: { [uid: number]: User } = {};

    var [entryAddedEvent, entryAddedTrigger] = CreateEvent<User>();
    var [entryRemovedEvent, entryRemovedTrigger] = CreateEvent<User>();

    function sessionAdded ( session: Tsession ) {
        if ( users[ session.user.UID ] == undefined ) {
            var aggregate = CreateReactiveAggregate<boolean>( values => values.some( x => x.Value ) );
            users[ session.user.UID ] = aggregate;
            
            aggregate.reactive.AddOnValueChanged( v => {
                if ( v ) {
                    activeUsers[ session.user.UID ] = session.user;
                    entryAddedTrigger( session.user );
                }
                else {
                    delete activeUsers[ session.user.UID ];
                    entryRemovedTrigger( session.user );
                }
            } );
        }

        users[ session.user.UID ].add( session.isActive );
    }
    function sessionRemoved ( session: Tsession ) {
        var aggregate = users[ session.user.UID ];
        aggregate.remove( session.isActive );

        if ( aggregate.getSources().length == 0 ) {
            delete users[ session.user.UID ];
        }
    }

    sessions.entryAdded.addEventListener( sessionAdded );
    sessions.entryRemoved.addEventListener( sessionRemoved );

    for ( const i of sessions.getValues() ) {
        sessionAdded( i );
    }

    return {
        entryAdded: entryAddedEvent,
        entryRemoved: entryRemovedEvent,
        getValues: () => Object.values( activeUsers ),
        unsubscribe: () => {
            sessions.entryAdded.removeEventListener( sessionAdded );
            sessions.entryRemoved.removeEventListener( sessionRemoved );
        }
    }
}