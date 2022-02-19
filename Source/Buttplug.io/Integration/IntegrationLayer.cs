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
				Console.WriteLine( $"Device added: ${args.Device.Name}" );
			};
			client.DeviceRemoved += ( sender, args ) => {
				Console.WriteLine( $"Device removed: ${args.Device.Name}" );
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
