import { Eye } from "lucide-react";
import type { FloorPlanPresence } from "@/lib/api";

interface PresenceBannerProps {
  editors: FloorPlanPresence[];
}

export function PresenceBanner({ editors }: PresenceBannerProps) {
  if (editors.length === 0) return null;

  const names = editors
    .map((e) => e.userEmail || "Someone")
    .join(", ");

  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
        <Eye className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">
          <span className="font-medium">{names}</span>
          {editors.length === 1 ? " is" : " are"} also viewing this floor plan
        </p>
      </div>
    </div>
  );
}
