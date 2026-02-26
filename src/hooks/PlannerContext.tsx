import { createContext, useContext } from "react";
import { useGuests } from "./useGuests";
import { useTables } from "./useTables";
import { useLabels } from "./useLabels";

type GuestsState = ReturnType<typeof useGuests>;
type TablesState = ReturnType<typeof useTables>;
type LabelsState = ReturnType<typeof useLabels>;

interface PlannerContextValue {
  guests: GuestsState;
  tables: TablesState;
  labels: LabelsState;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const guests = useGuests();
  const tables = useTables();
  const labels = useLabels();

  return (
    <PlannerContext.Provider value={{ guests, tables, labels }}>
      {children}
    </PlannerContext.Provider>
  );
}

function usePlannerContext() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlannerContext must be used inside PlannerProvider");
  return ctx;
}

export function usePlannerGuests() {
  return usePlannerContext().guests;
}

export function usePlannerTables() {
  return usePlannerContext().tables;
}

export function usePlannerLabels() {
  return usePlannerContext().labels;
}
