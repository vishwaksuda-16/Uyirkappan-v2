export type TrafficState =
  | "NORMAL"
  | "MODERATE"
  | "HEAVY"
  | "BLOCKED";

export interface TrafficCondition {
  edgeKey: string;
  state: TrafficState;
  multiplier: number;
}