cd Source/Server
call tsc
cd ../WebWorkers
call tsc
call tsc --p tsconfig.build.json
cd ../Files
call tsc -noEmit
call ./../../node_modules/.bin/esbuild Scripts.ts --bundle --minify --outfile=./../../Files/Scripts.js
cd ../..
call node cleanup.js
cd Build
call node Server.js