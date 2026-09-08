import { TrafficService } from "./traffic.service.js";

const traffic = new TrafficService();

console.log("Normal traffic:");

console.log(
  traffic.getAdjustedTravelTime(
    5,
    "N1",
    "N2"
  )
);

traffic.setTrafficState(
  "N1",
  "N2",
  "MODERATE"
);

console.log("Moderate traffic:");

console.log(
  traffic.getAdjustedTravelTime(
    5,
    "N1",
    "N2"
  )
);

traffic.setTrafficState(
  "N1",
  "N2",
  "HEAVY"
);

console.log("Heavy traffic:");

console.log(
  traffic.getAdjustedTravelTime(
    5,
    "N1",
    "N2"
  )
);

traffic.setTrafficState(
  "N1",
  "N2",
  "BLOCKED"
);

console.log("Blocked road:");

console.log(
  traffic.getAdjustedTravelTime(
    5,
    "N1",
    "N2"
  )
);