import "./index.css";
import { useState } from "react";
import { TableBuilder } from "./components/TableBuilder";
import { TableCanvas } from "./components/TableCanvas";
import { GuestManager } from "./components/GuestManager";
import { PrintView } from "./components/PrintView";
import { FloorPlanPicker } from "./components/FloorPlanPicker";
import { useAuth } from "./hooks/useAuth";
import { usePlannerFloorPlan } from "./hooks/PlannerContext";
import type { SelectedItem } from "./lib/types";
import { MapPin, Users, Printer, LogIn, LogOut, Loader2, ArrowLeft, Cloud, CloudOff } from "lucide-react";

type Tab = "floorplan" | "guests" | "print";

export function App() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const { currentFloorPlanId, currentFloorPlanName, setCurrentFloorPlan, isSaving, lastSaved } = usePlannerFloorPlan();
  const [activeTab, setActiveTab] = useState<Tab>("floorplan");
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-md text-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Table Planner</h1>
            <p className="text-muted-foreground">
              Build floor plans, manage guests, and print seating charts.
              Sign in to save your work.
            </p>
          </div>
          <button
            onClick={login}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (!currentFloorPlanId) {
    return <FloorPlanPicker />;
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "floorplan", label: "Floor Plan", icon: <MapPin className="w-4 h-4" /> },
    { id: "guests", label: "Guests", icon: <Users className="w-4 h-4" /> },
    { id: "print", label: "Print", icon: <Printer className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-5 max-w-[1800px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentFloorPlan(null)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
              title="Back to floor plans"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{currentFloorPlanName || "Table Planner"}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                {isSaving ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 animate-pulse" />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5" />
                    <span>Not saved yet</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex border rounded-lg overflow-hidden bg-muted/30">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 border-l pl-3">
              <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                {user?.name}
              </span>
              <button
                onClick={logout}
                className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div style={{ height: "calc(100vh - 120px)" }}>
          {activeTab === "floorplan" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
              <div className="lg:col-span-3 xl:col-span-3 overflow-y-auto pr-1">
                <TableBuilder
                  selectedItem={selectedItem}
                  onSelect={setSelectedItem}
                />
              </div>
              <div className="lg:col-span-9 xl:col-span-9">
                <TableCanvas
                  selectedItem={selectedItem}
                  onSelectItem={setSelectedItem}
                />
              </div>
            </div>
          )}

          {activeTab === "guests" && <GuestManager />}

          {activeTab === "print" && <PrintView />}
        </div>
      </div>
    </div>
  );
}

export default App;
