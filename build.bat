cd Source/Server
call tsc
cd ../WebWorkers
call tsc
call tsc --p tsconfig.build.json
cd ../Files
call tsc
cd ../..
call node cleanup.js
cd Build
call node Server.js