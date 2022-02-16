import { Device } from "./Device";
import { CreateEvent } from "./Events.js";
import { Reactive } from "./Reactive.js";
import { SubscribeablePool, CreatePoolSubscription } from './Subscription.js';

export type User = {
    nickname: string,
    UID: number,
    passwordHash?: string,
    allowedDevices: Device[],
    accent: Reactive<string>,
    theme?: string,

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

    var subscription = CreatePoolSubscription( 
        sessions,
        sessionAdded,
        session => {
            users[ session.user.UID ].sessions.splice( users[ session.user.UID ].sessions.indexOf( session ), 1 );
            if ( users[ session.user.UID ].sessions.length == 0 ) {
                delete users[ session.user.UID ];
                entryRemovedTrigger( session.user );
            }
        }
    );

    for ( const i of sessions.getValues() ) {
        sessionAdded( i );
    }

    return {
        entryAdded: entryAddedEvent,
        entryRemoved: entryRemovedEvent,
        getValues: () => Object.values( users ).map( x => x.user ),
        unsubscribe: subscription.unsubscribe
    }
}