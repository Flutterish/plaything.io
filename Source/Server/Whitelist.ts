import { User } from "./User";
import bcrypt from 'bcryptjs';
import { Device } from "./Device";
import { DeviceList } from "./DeviceList.js";
import { Reactive } from "./Reactive.js";
import { Room } from "./Room";

var nextUID = 0;
function makeUserSync ( nick: string, pass: string, devices: Device[] = [] ): User {
    return {
        nickname: nick,
        passwordHash: bcrypt.hashSync( pass ),
        allowedDevices: devices,
        accent: new Reactive<string>( '#ff79c6' ),
        lastActive: 0,
        isActive: new Reactive<boolean>( false ),
        room: new Reactive<Room | undefined>( undefined ),
        UID: nextUID++
    };
}

export async function getUser ( nickname: string ): Promise<User | undefined> {
    return WhitelistedUsers[ nickname.toLowerCase() ];
}

export async function verifyUser ( user: User, pass: string ) {
    return user.passwordHash == undefined 
        ? false 
        : await bcrypt.compare( pass, user.passwordHash );
}

export const AllowAnonymousAccess: boolean = true;
export const AnonymousPermitedDevices: Device[] = [
    DeviceList.sample1,
    DeviceList.sample2,
    DeviceList.sample3
];
export function MakeAnonUser ( nickname: string ): User {
    return {
        nickname: nickname,
        isAnon: true,
        allowedDevices: AnonymousPermitedDevices,
        accent: new Reactive<string>( '#ff79c6' ),
        lastActive: 0,
        isActive: new Reactive<boolean>( false ),
        room: new Reactive<Room | undefined>( undefined ),
        UID: nextUID++
    };
}

export const WhitelistedUsers: { [nickname: string]: User } = [
    makeUserSync( 'Peri', 'password12345', AnonymousPermitedDevices )
].reduce( (obj, next) => {
    obj[next.nickname.toLowerCase()] = next;
    return obj;
}, {} as { [nickname: string]: User } );