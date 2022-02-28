import fs from 'fs';
import namor from 'namor';

export const UseInvites = fs.existsSync( '.dev' )
 ? false
 : true;
 
export function GenerateInvite (): string {
    return namor.generate({ words: 3, saltLength: 0, separator: '-' });
}