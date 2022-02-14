import { User } from "./User";
import bcrypt from 'bcryptjs';

function makeUser ( nick: string, pass: string ): User {
    var salt = bcrypt.genSaltSync();
    var hash = bcrypt.hashSync( pass, salt );

    return {
        nickname: nick,
        salt: salt,
        passwordHash: hash
    };
}

export const AllowAnonymousAccess: boolean = false;
export const WhitelistedUsers: { [nickname: string]: User } = [
    makeUser( 'Peri', 'password12345' )
].reduce( (obj, next) => {
    obj[next.nickname] = next;
    return obj;
}, {} as { [nickname: string]: User } );