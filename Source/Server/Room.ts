import { AnyControlInstance, Control, Device } from "./Device";
import { CreateEvent, Event } from "./Events.js";
import { Reactive } from "./Reactive.js";
import { SubscribeablePool } from "./Subscription.js";
import { CreateActiveUserPool, User } from "./User.js";
import { API, Uncertain } from './Api';

export type RoomControlInstance = {
    id: number,
    control: AnyControlInstance,
    hoveredBy: Set<User>,
    isHovered: Reactive<boolean>,
    activeBy: Set<User>,
    isActive: Reactive<boolean>
}

export type Room = {
    name: string,
    join: (user: User) => boolean,
    leave: (user: User) => any,
    getSessions: () => RoomSession[],
    handleUserMovedPointer: (user: User, req: Uncertain<API.MessageMovedPointer>) => any,
    handleUserModifiedControl: (user: User, req: Uncertain<API.MessageModifiedControl>) => any,
    handleUserSentMessage: (user: User, req: Uncertain<API.MessageSentText>) => any,
    getSession: (user: User) => RoomSession | undefined,
    controls: SubscribeablePool<RoomControlInstance>,
    messageSent: Event<[user: User, message: API.MessageSentText]>,
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
export function CreateRoom ( name: string, controls: AnyControlInstance[] ): Room & { activePool: SubscribeablePool<User> } {
    const roomSessionsByUser: { [uid: number]: RoomSession } = {};

    var [entryAddedEvent, entryAddedTrigger] = CreateEvent<RoomSession>();
    var [entryRemovedEvent, entryRemovedTrigger] = CreateEvent<RoomSession>();
    var [messageSent, sendMessage] = CreateEvent<[user: User, message: API.MessageSentText]>();

    var instances = createControlInstances( controls );
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
            instances.setUserAction( user, undefined );
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
                instances.setUserAction( session.user, req );
            }
        },
        getSession: user => roomSessionsByUser[ user.UID ],
        controls: instances,
        messageSent: messageSent,
        handleUserSentMessage: (user, req) => {
            if ( roomSessionsByUser[ user.UID ] != undefined && typeof req.x === 'number' && typeof req.y === 'number' && typeof req.message === 'string' ) {
                sendMessage( [user, req as API.MessageSentText] );
            }
        }
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

function createControlInstances ( controls: AnyControlInstance[] ) {
    const controlsById: RoomControlInstance[] = [];
    const userTargets: Map<User, RoomControlInstance> = new Map()

    var [entryAddedEvent, entryAddedTrigger] = CreateEvent<RoomControlInstance>();
    var [entryRemovedEvent, entryRemovedTrigger] = CreateEvent<RoomControlInstance>();

    for ( let i = 0; i < controls.length; i++ ) {
        controlsById.push({
            control: controls[i],
            id: i,
            hoveredBy: new Set<User>(),
            activeBy: new Set<User>(),
            isHovered: new Reactive<boolean>( false ),
            isActive: new Reactive<boolean>( false )
        });
    }

    return {
        entryAdded: entryAddedEvent,
        entryRemoved: entryRemovedEvent,
        getValues: () => controlsById,
        setUserAction: (user: User, req?: Uncertain<API.MessageModifiedControl>) => {
            var oldTarget = userTargets.get( user );
            var newTarget = req?.controlId == undefined ? undefined : controlsById[ req.controlId ];
            
            if ( req?.active == true ) {
                oldTarget?.activeBy.delete( user );
                newTarget?.activeBy.add( user );
                if ( newTarget != undefined ) {
                    userTargets.set( user, newTarget );
                }
                else {
                    userTargets.delete( user );
                }
            }
            else if ( req?.active == false && oldTarget == newTarget ) {
                newTarget?.activeBy.delete( user );
                userTargets.delete( user );
            }

            if ( req?.hovered == true ) {
                newTarget?.hoveredBy.add( user );
            }
            else if ( req?.hovered == false ) {
                newTarget?.hoveredBy.delete( user );
            }

            if ( req == undefined ) {
                oldTarget?.activeBy.delete( user );
                oldTarget?.hoveredBy.delete( user );
                userTargets.delete( user );
            }

            if ( oldTarget != undefined ) {
                oldTarget.isActive.Value = oldTarget.activeBy.size != 0;
            }
            if ( newTarget != undefined ) {
                newTarget.isHovered.Value = newTarget.hoveredBy.size != 0;
                newTarget.isActive.Value = newTarget.activeBy.size != 0;

                newTarget.control.TrySet( req?.state );
            }
        }
    }
}