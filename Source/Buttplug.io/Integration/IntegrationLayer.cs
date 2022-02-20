using Buttplug;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Integration {
	public class IntegrationLayer {
		public readonly string Name;

		public IntegrationLayer ( string name ) {
			Name = name;
			client = new( name );
		}

		readonly ButtplugClient client;
		public async Task Run () {
			Console.WriteLine( "Setting up embedded client..." );
			await client.ConnectAsync( new ButtplugEmbeddedConnectorOptions() );

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
			};
			client.DeviceRemoved += ( sender, args ) => {
				var device = args.Device;
				Console.WriteLine( $"Device removed: {device.Name}" );
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
