using Buttplug;
using Integration.Heartbeats;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Websocket.Client;

namespace Integration {
	public class IntegrationLayer {
		public readonly string Name;
		uint port;

		public IntegrationLayer ( string name, uint port = 8081 ) {
			Name = name;
			this.port = port;
			client = new( name );
		}

		readonly ButtplugClient client;
		WebsocketClient? ws;
		ConcurrentQueue<object> wsMessages = new();
		Dictionary<uint, ButtplugClientDevice> devicesByIndex = new();

		async Task keepWebsocketAlive () {
			var address = $"ws://localhost:{port}";
			Console.WriteLine( $"Connecting WebSocket ({address})..." );
			ws = new WebsocketClient( new Uri( address ) );
			ws.ReconnectTimeout = null;
			await ws.Start();
			Console.WriteLine( "Connected WebSocket!" );
			listenToCommands( ws );

			var serializerOptions = new JsonSerializerOptions {
				IncludeFields = true,
				DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,
				PropertyNamingPolicy = JsonNamingPolicy.CamelCase
			};

			while ( true ) {
				while ( wsMessages.TryDequeue( out var message ) ) {
					ws.Send( JsonSerializer.Serialize( message, serializerOptions ) );
				}
				await Task.Delay( 10 );
			}
		}

		void listenToCommands ( WebsocketClient ws ) {
			var serializerOptions = new JsonSerializerOptions {
				IncludeFields = true,
				DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,
				PropertyNamingPolicy = JsonNamingPolicy.CamelCase
			};

			ws.MessageReceived.Subscribe( data => {
				var msg = JsonSerializer.Deserialize<HeartbeatType>( data.Text, serializerOptions );
				if ( msg?.Type is null ) {
					return;
				}

				var type = msg.Type;
				if ( type == PowerOff.Type ) {
					var command = JsonSerializer.Deserialize<PowerOff>( data.Text, serializerOptions )!;
					if ( devicesByIndex.TryGetValue( command.Index, out var device ) ) {
						device.SendStopDeviceCmd();
					}
				}
				else if ( type == Vibrate.Type ) {
					var command = JsonSerializer.Deserialize<Vibrate>( data.Text, serializerOptions )!;
					if ( devicesByIndex.TryGetValue( command.Index, out var device ) ) {
						if ( command.SpeedsByFeature != null ) {
							device.SendVibrateCmd( command.SpeedsByFeature );
						}
						else if ( command.Speeds != null ) {
							device.SendVibrateCmd( command.Speeds );
						}
						else {
							device.SendVibrateCmd( command.Speed ?? 0 );
						}
					}
				}
			} );
		}

		public async Task Run () {
			Console.WriteLine( "Setting up embedded client..." );
			await client.ConnectAsync( new ButtplugEmbeddedConnectorOptions() );
			_ = keepWebsocketAlive();

			client.DeviceAdded += ( sender, args ) => {
				var device = args.Device;
				devicesByIndex.Add( device.Index, device );
				Console.WriteLine( $"Device added: {device.Name}" );
				Console.WriteLine( $"Index: {device.Index}" );
				Console.WriteLine( "Supported features:" );
				foreach ( var (type, attributes) in device.AllowedMessages ) {
					Console.WriteLine( $"\tType: {type}" );
					Console.WriteLine( $"\tFeatures: {attributes.FeatureCount}" );
					foreach ( var duration in attributes.MaxDuration ) {
						Console.WriteLine( $"\t\tMax duration: {duration}" );
					}
					foreach ( var steps in attributes.StepCount ) {
						Console.WriteLine( $"\t\tSteps: {steps}" );
					}
				}

				wsMessages.Enqueue( new { Type = "device-added", Device = device } );
			};
			client.DeviceRemoved += ( sender, args ) => {
				var device = args.Device;
				devicesByIndex.Remove( device.Index );
				Console.WriteLine( $"Device removed: {device.Name}" );

				wsMessages.Enqueue( new { Type = "device-removed", Index = device.Index } );
			};

			Console.WriteLine( "Starting scan..." );
			await client.StartScanningAsync();
			Console.WriteLine( "OK, scan started" );

			while ( true ) {
				await Task.Delay( -1 );
			}
		}
	}
}
