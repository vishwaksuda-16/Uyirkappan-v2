import {
  TrafficCondition,
  TrafficState
} from "./traffic.types.js";

export class TrafficService {
  private conditions = new Map<string, TrafficCondition>();

  private readonly multipliers: Record<TrafficState, number> = {
    NORMAL: 1.0,
    MODERATE: 1.3,
    HEAVY: 2.0,
    BLOCKED: Infinity
  };

  setTrafficState(
    fromNodeId: string,
    toNodeId: string,
    state: TrafficState
  ): void {
    const edgeKey = this.createEdgeKey(
      fromNodeId,
      toNodeId
    );

    this.conditions.set(edgeKey, {
      edgeKey,
      state,
      multiplier: this.multipliers[state]
    });
  }

  getTrafficCondition(
    fromNodeId: string,
    toNodeId: string
  ): TrafficCondition {
    const edgeKey = this.createEdgeKey(
      fromNodeId,
      toNodeId
    );

    return (
      this.conditions.get(edgeKey) ?? {
        edgeKey,
        state: "NORMAL",
        multiplier: this.multipliers.NORMAL
      }
    );
  }

  getAdjustedTravelTime(
    baseTravelTimeMinutes: number,
    fromNodeId: string,
    toNodeId: string
  ): number {
    const condition = this.getTrafficCondition(
      fromNodeId,
      toNodeId
    );

    if (condition.state === "BLOCKED") {
      return Infinity;
    }

    return (
      baseTravelTimeMinutes *
      condition.multiplier
    );
  }

  private createEdgeKey(
    fromNodeId: string,
    toNodeId: string
  ): string {
    return `${fromNodeId}->${toNodeId}`;
  }
}