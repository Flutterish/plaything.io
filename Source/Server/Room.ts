import { Control, Device } from "./Device";
import { CreateEvent } from "./Events.js";
import { Reactive } from "./Reactive.js";
import { SubscribeablePool } from "./Subscription.js";
import { CreateActiveUserPool, User } from "./User.js";
import { API, Uncertain } from './Api';

export type Room = {
    name: string,
    join: (user: User) => boolean,
    leave: (user: User) => any,
    getSessions: () => RoomSession[],
    handleUserMovedPointer: (user: User, req: Uncertain<API.MessageMovedPointer>) => any,
    handleUserModifiedControl: (user: User, req: Uncertain<API.MessageModifiedControl>) => any,
    getSession: (user: User) => RoomSession | undefined
} & SubscribeablePool<RoomSession>

export type CursorType = 'default' | 'pointer';
export type RoomSession = {
    user: User,
    position: Reactive<[x: number, y: number]>,
    cursorStyle: Reactive<CursorType>,
    lastActive: number,
    isActive: Reactive<boolean>,
    isUserActive: Reactive<boolean>
}
export function CreateRoom ( name: string, controls: Control.Any[] ): Room & { activePool: SubscribeablePool<User> } {
    const roomSessionsByUser: { [uid: number]: RoomSession } = {};

    var [entryAddedEvent, entryAddedTrigger] = CreateEvent<RoomSession>();
    var [entryRemovedEvent, entryRemovedTrigger] = CreateEvent<RoomSession>();

    var room = {
        name: name,
        join: user => {
            if ( roomSessionsByUser[ user.UID ] != undefined ) {
                return false;
            }
            else {
                roomSessionsByUser[ user.UID ] = {
                    user: user,
                    position: new Reactive<[x: number, y: number]>([0, 0]),
                    cursorStyle: new Reactive<CursorType>( 'default' ),
                    lastActive: Date.now(),
                    isActive: new Reactive<boolean>( true ),
                    isUserActive: new Reactive<boolean>( user.isActive )
                };
                roomSessionsByUser[ user.UID ].isUserActive.AddOnValueChanged( v => {
                    if ( !v ) {
                        roomSessionsByUser[ user.UID ].isActive.Value = false;
                    }
                } );
                entryAddedTrigger( roomSessionsByUser[ user.UID ] );
                return true;
            }
        },
        leave: user => {
            var session = roomSessionsByUser[ user.UID ];
            if ( session == undefined ) {
                return;
            }
            session.isUserActive.RemoveEvents();
            session.isUserActive.UnbindAll();
            delete roomSessionsByUser[ user.UID ];
            entryRemovedTrigger( session );
        },
        getValues: () => Object.values( roomSessionsByUser ),
        getSessions: () => Object.values( roomSessionsByUser ),
        entryAdded: entryAddedEvent,
        entryRemoved: entryRemovedEvent,
        handleUserMovedPointer: (user, req) => {
            var session = roomSessionsByUser[ user.UID ];
            if ( session != undefined ) {
                session.lastActive = Date.now();
                session.isActive.Value = true;
            }

            if ( typeof req.x === 'number' && typeof req.y === 'number' ) {
                session.position.Value = [req.x, req.y];
            }

            if ( req.cursorStyle == 'default' || req.cursorStyle == 'pointer' ) {
                session.cursorStyle.Value = req.cursorStyle;
            }
        },
        handleUserModifiedControl: (user, req) => {
            var session = roomSessionsByUser[ user.UID ];
            if ( session != undefined ) {
                session.lastActive = Date.now();
                session.isActive.Value = true;
                // TODO set control
            }
        },
        getSession: user => roomSessionsByUser[ user.UID ]
    } as Room;

    var active = CreateActiveUserPool<RoomSession>( room );

    setInterval( () => {
        var now = Date.now();

        for ( const uid in roomSessionsByUser ) {
            var session = roomSessionsByUser[ uid ];
            if ( session.isActive.Value && session.lastActive + 10 * 1000 < now ) {
                session.isActive.Value = false;
            }
        }
    }, 10 * 1000 );

    return {
        ...room,
        activePool: active
    }
}