import { useState, useEffect, useCallback, useMemo } from "react";
import { api, type FloorPlanSummary, type OrganizationWithRole } from "@/lib/api";
import { usePlannerFloorPlan } from "@/hooks/PlannerContext";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Loader2, LogOut, FolderOpen, Building2, Settings } from "lucide-react";
import { OrganizationManager } from "./OrganizationManager";

type FilterType = "all" | "personal" | string; // string for org IDs

export function FloorPlanPicker() {
  const { setCurrentFloorPlan } = usePlannerFloorPlan();
  const { user, logout } = useAuth();
  const [plans, setPlans] = useState<FloorPlanSummary[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [showOrgManager, setShowOrgManager] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [plansData, orgsData] = await Promise.all([
        api.listFloorPlans(),
        api.listOrganizations(),
      ]);
      setPlans(plansData);
      setOrganizations(orgsData);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter plans based on active filter
  const filteredPlans = useMemo(() => {
    if (activeFilter === "all") return plans;
    if (activeFilter === "personal") {
      return plans.filter((p) => p.isPersonal);
    }
    // Filter by organization ID
    return plans.filter((p) => p.organizationId === activeFilter);
  }, [plans, activeFilter]);

  // Count plans per filter
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: plans.length,
      personal: plans.filter((p) => p.isPersonal).length,
    };
    organizations.forEach((org) => {
      counts[org.id] = plans.filter((p) => p.organizationId === org.id).length;
    });
    return counts;
  }, [plans, organizations]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const plan = await api.createFloorPlan(newName.trim());
      setCurrentFloorPlan(plan.id, plan.name);
    } catch (err) {
      console.error("Failed to create floor plan:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this floor plan? This cannot be undone.")) return;
    try {
      await api.deleteFloorPlan(id);
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete floor plan:", err);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Table Planner</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user?.name}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded border"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            All ({filterCounts.all})
          </button>
          <button
            onClick={() => setActiveFilter("personal")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeFilter === "personal"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            Personal ({filterCounts.personal})
          </button>
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => setActiveFilter(org.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeFilter === org.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {org.name} ({filterCounts[org.id] || 0})
            </button>
          ))}
          <button
            onClick={() => setShowOrgManager(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border hover:bg-muted transition-colors whitespace-nowrap ml-auto"
            title="Manage Organizations"
          >
            <Settings className="w-4 h-4" />
            Organizations
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {activeFilter === "all"
              ? "All Floor Plans"
              : activeFilter === "personal"
              ? "Personal Floor Plans"
              : organizations.find((o) => o.id === activeFilter)?.name || "Floor Plans"}
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Floor Plan
          </button>
        </div>

        {showCreate && (
          <div className="border rounded-lg p-4 mb-4 bg-card">
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Floor plan name..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="border rounded-lg p-12 text-center text-muted-foreground bg-muted/20">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium mb-1">No floor plans in this filter</p>
            <p className="text-sm">
              {activeFilter === "personal"
                ? "Create your first personal floor plan to get started."
                : "No floor plans found for this filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPlans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setCurrentFloorPlan(plan.id, plan.name)}
                className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{plan.name}</p>
                    {plan.isPersonal ? (
                      <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                        Personal
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                        <Building2 className="w-3 h-3" />
                        {plan.organizationName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last updated {formatDate(plan.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    onClick={(e) => handleDelete(e, plan.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 rounded"
                    role="button"
                  >
                    <Trash2 className="w-4 h-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* OrganizationManager modal */}
        {showOrgManager && (
          <OrganizationManager
            onClose={() => {
              setShowOrgManager(false);
              fetchData(); // Refresh data when closing
            }}
          />
        )}
      </div>
    </div>
  );
}
