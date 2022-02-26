# plaything.io
An interactive remote control panel for various devices.

plaything.io is a locally hosted service that allows you to interactively control devices in a realtime multiuser room.
The service is hosted as a server on the computer of the person who shares devices. This means you need to configure your network for it to work outside of the LAN network.
You will be able to see other users' cursors and the controls being interacted with in real time. You can also send text messages in rooms by right clicking or holding on mobile devices.

https://user-images.githubusercontent.com/40297338/155054012-9be3990c-e108-4a12-840b-2f0398f89810.mp4

## Supported devices
### buttplug.io
plaything.io suports [buttplug.io](https://buttplug.io) devices out of the box.
The currently auto-generated control schemes are:
* Vibrator - on/off button + power slider
  
### Custom devices
If you wish to control something else, the API is very developer-friendly.
Out of the box, you will have access to these control elements:
* Power Button
* Vertical Slider

## Setup
Currently, there are no prebuild releases. Instead you will need to clone this repository.
First thing you will need to do is install node.js dependencies. Simply run `npm install --also=dev` to install all dependencies.
You will also need the typescript compiler `tsc` and `dotnet build` with the `.NET 5.0` SDK.
### Configuration
* Port: `8080` by default. You can change it in `Source/Server/Server.ts`. The server uses `8081` internally, and you cant use it unless you change it in `Source/Server/Server.ts @ CreateButtplugServer`.
* Server Name: `untitled-server` by default. You can change it in `Source/Server/Server.ts`. This field will be `development-server` if a `.dev` file exists in the `Build` folder
* Anonymous Access: `true` by default. You can change it in `Source/Server/Whitelist.ts`
* Devices Shared With Anonymous Users: `[buttplugServer.devices]` by default. You can change it in `Source/Server/Whitelist.ts @ MakeAnonUser | AnonymousPermitedDevices`. This field has an example list that will be used if a `.dev` file exists in the `Build` folder.
* Authenticated Users: `[]` by default. You can change it in `Source/Server/Whitelist.ts @ createWhitelist`. This field has an example list that will be used if a `.dev` file exists in the `Build` folder

### Running the server
To run the server, run the `build.bat` file. This will create a `Build` folder where your server lives. It will also automatically start it.
If your server is already built, you can simply go into the `Build` folder and `node Server.js`

### Connecting devices
To connect `buttplug.io` devices, build and run `Source/Buttplug.io/Integration.sln`. It will automatically connect 

### Configuring the network
If you havent port-forwarded the port your server runs on, you will only be able to connect to it from LAN.
To test if you can connect to it, on Linux type `ifconfig` in the terminal and on Windows `ipconfig` in cmd. Find an address that looks roughly like this: `192.168.X.X`
In a web browser, connect to `http://192.168.X.X:port` where `port` is the port you set. If you didnt, its `8080`.
You should see a login panel. You will be able to connect to this address from all devices in your LAN.

Now we need to port-forward the port on your router. If you do not have access to your router, you will not be able to do this.
Usually you will be able to find port-forwarding in a tab called "Port Forwarding" or "Applications".
If the tab is simply called "Port Forwarding", you will usually be able to add a new rule with these 5 settings:
* Protocol
* WAN (or extenal) Address
* LAN (or internal) Address
* WAN port
* LAN port

Protocol should be "TCP and UDP".
The WAN address can be left blank in most cases. If it cant, type "whatsmyip" into a web browser and copy that address there.
The LAN address is the address you found in `ifconfig`/`ipconfig`.
The LAN port is the port the server is listening on. `8080` by default.
The WAN port is the port people from outside will connect to. You can set it to `80` or the same as the LAN port, or whatever you fancy.
Sometimes there will also be an "enable" toggle. Make sure it is enabled.
Add the rule.

If the tab is "Applications", the configuration is mostly the same, except the fields might be split up across multiple tabs.

Turn off your public firewall temporarily to test if the port forward works.
You should be able to connect to `http://ip:wan port` where ip is the address you saw in "whatsmyip" and the port is the WAN port you set.

Turn your firewall back on. If you try connecting to that address again, it should fail.
Now you will need to add an exception for the LAN port you just configured. You will need to add an inbound rule for the port and allow it.

Now you should be able to connect to the address again, and so should anyone in the world, as long as the server is running.

## Contributing and developing
Please refer to the wiki for info about the codebase
