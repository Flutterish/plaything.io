using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Integration.Heartbeats {
	public class Vibrate {
		public const string Type = "vibrate";
		public uint Index;

		public double? Speed;
		public double[]? Speeds;
		public Dictionary<uint, double>? SpeedsByFeature;
	}
}
