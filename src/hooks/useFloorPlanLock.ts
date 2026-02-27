import { useState, useEffect, useCallback, useRef } from "react";
import { api, type FloorPlanLock } from "@/lib/api";

const HEARTBEAT_INTERVAL = 60000; // 60 seconds

export function useFloorPlanLock(floorPlanId: string | null) {
  const [lockStatus, setLockStatus] = useState<FloorPlanLock | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [hasLock, setHasLock] = useState(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback((fpId: string) => {
    clearHeartbeat();
    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        await api.refreshLockHeartbeat(fpId);
      } catch (err) {
        console.error("Failed to refresh lock heartbeat:", err);
        // If heartbeat fails, the lock might have expired
        clearHeartbeat();
        setHasLock(false);
      }
    }, HEARTBEAT_INTERVAL);
  }, [clearHeartbeat]);

  const acquireLock = useCallback(async () => {
    if (!floorPlanId) return false;

    try {
      const lock = await api.acquireLock(floorPlanId);
      setLockStatus(lock);
      setHasLock(true);
      setIsLocked(false);
      startHeartbeat(floorPlanId);
      return true;
    } catch (err: any) {
      console.error("Failed to acquire lock:", err);

      // If locked by another user, get the lock status
      if (err.message?.includes("locked by another user")) {
        try {
          const status = await api.getLockStatus(floorPlanId);
          if (status.locked && status.lock) {
            setLockStatus(status.lock);
            setIsLocked(true);
            setHasLock(false);
          }
        } catch (statusErr) {
          console.error("Failed to get lock status:", statusErr);
        }
      }
      return false;
    }
  }, [floorPlanId, startHeartbeat]);

  const releaseLock = useCallback(async () => {
    if (!floorPlanId || !hasLock) return;

    clearHeartbeat();
    try {
      await api.releaseLock(floorPlanId);
      setLockStatus(null);
      setHasLock(false);
      setIsLocked(false);
    } catch (err) {
      console.error("Failed to release lock:", err);
    }
  }, [floorPlanId, hasLock, clearHeartbeat]);

  const checkLockStatus = useCallback(async () => {
    if (!floorPlanId) return;

    try {
      const status = await api.getLockStatus(floorPlanId);
      if (status.locked && status.lock) {
        setLockStatus(status.lock);
        setIsLocked(true);
        setHasLock(false);
      } else {
        setLockStatus(null);
        setIsLocked(false);
        setHasLock(false);
      }
    } catch (err) {
      console.error("Failed to check lock status:", err);
    }
  }, [floorPlanId]);

  // Check lock status on mount and when floor plan changes
  useEffect(() => {
    if (floorPlanId) {
      checkLockStatus();
    } else {
      setLockStatus(null);
      setIsLocked(false);
      setHasLock(false);
      clearHeartbeat();
    }
  }, [floorPlanId, checkLockStatus, clearHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHeartbeat();
    };
  }, [clearHeartbeat]);

  return {
    lockStatus,
    isLocked,
    hasLock,
    acquireLock,
    releaseLock,
    checkLockStatus,
  };
}
