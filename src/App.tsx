import "./index.css";
import { useState } from "react";
import { TableBuilder } from "./components/TableBuilder";
import { TableCanvas } from "./components/TableCanvas";
import { GuestManager } from "./components/GuestManager";
import { PrintView } from "./components/PrintView";
import type { SelectedItem } from "./lib/types";
import { MapPin, Users, Printer } from "lucide-react";

type Tab = "floorplan" | "guests" | "print";

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("floorplan");
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "floorplan", label: "Floor Plan", icon: <MapPin className="w-4 h-4" /> },
    { id: "guests", label: "Guests", icon: <Users className="w-4 h-4" /> },
    { id: "print", label: "Print", icon: <Printer className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-5 max-w-[1800px]">
        {/* Header + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl font-bold">Table Planner</h1>
            <p className="text-muted-foreground text-sm">
              Build your floor plan, manage guests, and print seating charts
            </p>
          </div>
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
        </div>

        {/* Tab content */}
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
