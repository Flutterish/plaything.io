using System.Threading.Tasks;

namespace Integration {
	static class Program {
		static async Task Main () {
			var server = new IntegrationLayer( "Embedded" );
			await server.Run();
		}
	}
}
