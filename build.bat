cd Source/Server
call tsc
cd ../Files
call tsc
cd ../..
call node cleanup.js
cd Build
call node Server.js