import { readdir, lstatSync, readFile, writeFile } from 'fs';

function cleanup ( folder ) {
    readdir( folder, (_, entries) => {
        for ( let entry of entries ) {
            entry = folder + entry;
            if ( lstatSync( entry ).isDirectory() ) {
                cleanup( entry + '/' );
            }
            else {
                readFile( entry, 'utf-8', (err, data) => {
                    writeFile( entry, data.replace( /export {};/g, '' ), 'utf-8', () => {} );
                } );
            }
        }
    } );
}

cleanup( './Files/' );