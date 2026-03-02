import { AlertTriangle, RefreshCw } from "lucide-react";

interface ConflictBannerProps {
  onReload: () => void;
}

export function ConflictBanner({ onReload }: ConflictBannerProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">
            This floor plan was updated by someone else
          </p>
          <p className="text-xs mt-0.5">
            Your changes could not be saved. Reload to get the latest version.
          </p>
        </div>
        <button
          onClick={onReload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reload
        </button>
      </div>
    </div>
  );
}
