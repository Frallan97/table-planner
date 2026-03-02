import { useState, useEffect, useRef, useCallback } from "react";
import { api, type FloorPlanPresence } from "@/lib/api";

const HEARTBEAT_INTERVAL = 60000; // 60 seconds

export function useFloorPlanPresence(floorPlanId: string | null) {
  const [otherEditors, setOtherEditors] = useState<FloorPlanPresence[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const sendHeartbeat = useCallback(async () => {
    if (!floorPlanId) return;
    try {
      const others = await api.sendPresenceHeartbeat(floorPlanId);
      setOtherEditors(others);
    } catch (err) {
      console.error("Failed to send presence heartbeat:", err);
    }
  }, [floorPlanId]);

  useEffect(() => {
    if (!floorPlanId) {
      setOtherEditors([]);
      return;
    }

    // Send immediately on mount / floor plan change
    sendHeartbeat();

    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [floorPlanId, sendHeartbeat]);

  return { otherEditors };
}
