import { User } from "./User";
import bcrypt from 'bcryptjs';

function makeUserSync ( nick: string, pass: string ): User {
    return {
        nickname: nick,
        passwordHash: bcrypt.hashSync( pass )
    };
}

export const AllowAnonymousAccess: boolean = false;
export const WhitelistedUsers: { [nickname: string]: User } = [
    makeUserSync( 'Peri', 'password12345' )
].reduce( (obj, next) => {
    obj[next.nickname.toLowerCase()] = next;
    return obj;
}, {} as { [nickname: string]: User } );

export async function getUser ( nickname: string ): Promise<User | undefined> {
    return WhitelistedUsers[ nickname.toLowerCase() ];
}

export async function verifyUser ( user: User, pass: string ) {
    return await bcrypt.compare( pass, user.passwordHash );
}