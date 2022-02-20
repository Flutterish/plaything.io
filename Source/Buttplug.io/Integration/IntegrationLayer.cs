using Buttplug;
using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using System.Threading.Tasks;

namespace Integration {
	public class IntegrationLayer {
		public readonly string Name;
		uint port;

		public IntegrationLayer ( string name, uint port = 8081 ) {
			Name = name;
			this.port = port;
			client = new( name );
			ws = new ClientWebSocket();
		}

		readonly ButtplugClient client;
		readonly ClientWebSocket ws;
		ConcurrentQueue<object> wsMessages = new();

		async Task connect () {
			var address = $"ws://localhost:{port}";
			Console.WriteLine( $"Connecting WebSocket ({address})..." );
			await ws.ConnectAsync( new Uri( address ), new() );
			Console.WriteLine( "Connected WebSocket!" );
		}

		async Task keepWebsocketAlive () {
			var serializerOptions = new JsonSerializerOptions {
				IncludeFields = true,
				DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,
				PropertyNamingPolicy = JsonNamingPolicy.CamelCase
			};

			while ( true ) {
				if ( ws.State is not WebSocketState.Open ) {
					await connect();
				}

				while ( wsMessages.TryDequeue( out var message ) ) {
					var data = JsonSerializer.SerializeToUtf8Bytes( message, serializerOptions );
					await ws.SendAsync( data, WebSocketMessageType.Text, true, new() );
				}
				await Task.Delay( 10 );
			}
		}

		public async Task Run () {
			Console.WriteLine( "Setting up embedded client..." );
			await client.ConnectAsync( new ButtplugEmbeddedConnectorOptions() );
			_ = keepWebsocketAlive();

			client.DeviceAdded += ( sender, args ) => {
				var device = args.Device;
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
