import "server-only";
import { requestBridge, BridgeUnavailableError } from "@/lib/minecraft/bridge";
import {
  isFreshNetworkStatus,
  unavailableNetworkStatus,
  type NetworkStatus,
} from "@/lib/network-status";

export async function getNetworkStatus(): Promise<NetworkStatus> {
  try {
    const payload = await requestBridge<unknown>("networkStatus");
    if (!isFreshNetworkStatus(payload))
      return unavailableNetworkStatus("stale");
    return payload;
  } catch (error) {
    return unavailableNetworkStatus(
      error instanceof BridgeUnavailableError &&
        error.message.includes("not configured")
        ? "not_configured"
        : "request_failed",
    );
  }
}
