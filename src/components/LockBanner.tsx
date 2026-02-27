import { AlertCircle } from "lucide-react";
import type { FloorPlanLock } from "@/lib/api";

interface LockBannerProps {
  lock: FloorPlanLock;
}

export function LockBanner({ lock }: LockBannerProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">
            This floor plan is currently being edited
          </p>
          <p className="text-xs mt-0.5">
            {lock.userEmail ? (
              <>Locked by <span className="font-medium">{lock.userEmail}</span> at {formatTime(lock.lockedAt)}</>
            ) : (
              <>Locked by another user at {formatTime(lock.lockedAt)}</>
            )}
            {" • "}You can view but not edit until the lock is released.
          </p>
        </div>
      </div>
    </div>
  );
}
