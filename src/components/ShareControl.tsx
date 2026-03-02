import { useState, useEffect } from "react";
import { api, type OrganizationWithRole } from "@/lib/api";
import { Share2, Building2, UserCircle, ChevronDown, Loader2, Link2, Copy, X, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface ShareControlProps {
  floorPlanId: string;
  currentOrgId?: string;
  currentOrgName?: string;
  isPersonal: boolean;
  isCreator: boolean;
  onShare?: () => void;
}

export function ShareControl({
  floorPlanId,
  currentOrgId,
  currentOrgName,
  isPersonal,
  isCreator,
  onShare,
}: ShareControlProps) {
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (showDropdown) {
      fetchOrganizations();
      fetchShareToken();
    }
  }, [showDropdown]);

  const fetchShareToken = async () => {
    try {
      const res = await api.getShareToken(floorPlanId);
      setShareToken(res.token);
    } catch {
      // ignore
    }
  };

  const handleCreateToken = async () => {
    setTokenLoading(true);
    try {
      const res = await api.createShareToken(floorPlanId);
      setShareToken(res.token);
    } catch (err) {
      console.error("Failed to create share token:", err);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRevokeToken = async () => {
    if (!confirm("Revoke the public link? Anyone with this link will lose access.")) return;
    setTokenLoading(true);
    try {
      await api.revokeShareToken(floorPlanId);
      setShareToken(null);
    } catch (err) {
      console.error("Failed to revoke share token:", err);
    } finally {
      setTokenLoading(false);
    }
  };

  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : null;

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const orgs = await api.listOrganizations();
      setOrganizations(orgs);
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    }
  };

  const handleShare = async (orgId: string) => {
    setLoading(true);
    try {
      await api.shareFloorPlan(floorPlanId, orgId);
      setShowDropdown(false);
      onShare?.();
      alert("Floor plan shared successfully!");
    } catch (err) {
      console.error("Failed to share floor plan:", err);
      alert("Failed to share floor plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async () => {
    if (!confirm("Make this floor plan personal? It will no longer be shared with the organization.")) {
      return;
    }

    setLoading(true);
    try {
      await api.unshareFloorPlan(floorPlanId);
      setShowDropdown(false);
      onShare?.();
      alert("Floor plan is now personal!");
    } catch (err) {
      console.error("Failed to unshare floor plan:", err);
      alert("Failed to unshare floor plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Only show to creator
  if (!isCreator) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
        title={isPersonal ? "Share with organization" : "Sharing settings"}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPersonal ? (
          <>
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </>
        ) : (
          <>
            <Building2 className="w-4 h-4" />
            <span className="max-w-[100px] truncate">{currentOrgName}</span>
          </>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full mt-1 w-72 bg-background border rounded-lg shadow-lg z-50 py-1">
            {isPersonal ? (
              <>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  Share with organization
                </div>
                {organizations.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    No organizations yet
                  </div>
                ) : (
                  organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleShare(org.id)}
                      disabled={loading}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50 text-left"
                    >
                      <Building2 className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 truncate">{org.name}</div>
                    </button>
                  ))
                )}
              </>
            ) : (
              <>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  Currently shared with
                </div>
                <div className="px-3 py-2 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{currentOrgName}</span>
                </div>
                <div className="border-t my-1" />
                <button
                  onClick={handleUnshare}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50 text-left"
                >
                  <UserCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Make Personal</span>
                </button>
              </>
            )}

            {/* Public Link Section */}
            <div className="border-t my-1" />
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
              Public link
            </div>
            {shareToken && shareUrl ? (
              <div className="px-3 pb-2 space-y-2">
                <div className="flex items-center gap-1">
                  <div className="flex-1 text-xs bg-muted/50 rounded px-2 py-1.5 truncate font-mono">
                    {shareUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 hover:bg-muted rounded transition-colors flex-shrink-0"
                    title="Copy link"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-green-600">Copied!</p>
                )}
                <div className="flex justify-center py-1">
                  <QRCodeSVG value={shareUrl} size={100} level="M" />
                </div>
                <button
                  onClick={handleRevokeToken}
                  disabled={tokenLoading}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  Revoke public link
                </button>
              </div>
            ) : (
              <div className="px-3 pb-2">
                <button
                  onClick={handleCreateToken}
                  disabled={tokenLoading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-muted/50 hover:bg-muted rounded transition-colors disabled:opacity-50"
                >
                  {tokenLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  Create public link
                </button>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Anyone with the link can view (read-only)
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
