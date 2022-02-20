import { User } from "./User";
import bcrypt from 'bcryptjs';
import { Device } from "./Device";
import { Reactive } from "./Reactive.js";
import { Room } from "./Room";
import { CreateNestedPool, CreatePool, SubscribeablePool } from './Subscription.js';
import { buttplugServer } from "./Server.js";
import { TestDeviceList } from "./DeviceList.js";
import fs from 'fs';

var nextUID = 0;
function makeUserSync ( nick: string, pass?: string, ...devicePools: SubscribeablePool<Device>[] ): User {
    var devicesPool = CreatePool<SubscribeablePool<Device>>( [AnonymousPermitedDevices, ...devicePools] );
    return {
        nickname: nick,
        passwordHash: pass == undefined ? undefined : bcrypt.hashSync( pass ),
        isAnon: pass == undefined,
        allowedDevicePools: devicesPool,
        allowedDevices: CreateNestedPool( devicesPool ),
        accent: new Reactive<string>( '#ff79c6' ),
        lastActive: 0,
        isActive: new Reactive<boolean>( false ),
        room: new Reactive<Room | undefined>( undefined ),
        UID: nextUID++
    };
}

export async function getUser ( nickname: string ): Promise<User | undefined> {
    return GetWhitelist()[ nickname.toLowerCase() ];
}

export async function verifyUser ( user: User, pass: string ) {
    return user.passwordHash == undefined 
        ? false 
        : await bcrypt.compare( pass, user.passwordHash );
}

export const AllowAnonymousAccess: boolean = true;
export const AnonymousPermitedDevices = CreatePool<Device>( 
    fs.existsSync( '.dev' ) 
    ? Object.values( TestDeviceList ) 
    : [] 
);

export function MakeAnonUser ( nickname: string ): User {
    return makeUserSync( nickname, undefined, buttplugServer.devices );
}

function createWhitelist () {
    var users = fs.existsSync( '.dev' ) ? [
        makeUserSync( 'Peri', 'password12345', buttplugServer.devices )
    ] : [
        
    ]

    return users.reduce( (obj, next) => {
        obj[next.nickname.toLowerCase()] = next;
        return obj;
    }, {} as { [nickname: string]: User } );
}

var whitelistedUsers: { [nickname: string]: User };
export function GetWhitelist () {
    if ( whitelistedUsers == undefined ) {
        whitelistedUsers = createWhitelist();
    }

    return whitelistedUsers;
}