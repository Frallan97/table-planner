import { createContext, useContext, useEffect, useRef, useCallback, useState } from "react";
import { useGuests } from "./useGuests";
import { useTables } from "./useTables";
import { useLabels } from "./useLabels";
import { useAuth } from "./useAuth";
import { api } from "@/lib/api";
import type { Table, Guest, FloorLabel } from "@/lib/types";

type GuestsState = ReturnType<typeof useGuests>;
type TablesState = ReturnType<typeof useTables>;
type LabelsState = ReturnType<typeof useLabels>;

interface Snapshot {
  tables: Table[];
  guests: Guest[];
  labels: FloorLabel[];
}

const MAX_UNDO = 50;

interface FloorPlanState {
  currentFloorPlanId: string | null;
  currentFloorPlanName: string | null;
  setCurrentFloorPlan: (id: string | null, name?: string | null) => void;
  isSaving: boolean;
  lastSaved: Date | null;
}

interface PlannerContextValue {
  guests: GuestsState;
  tables: TablesState;
  labels: LabelsState;
  undo: () => void;
  floorPlan: FloorPlanState;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 2000;

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const guestsHook = useGuests();
  const tablesHook = useTables();
  const labelsHook = useLabels();

  const [currentFloorPlanId, setCurrentFloorPlanId] = useState<string | null>(null);
  const [currentFloorPlanName, setCurrentFloorPlanName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const undoStackRef = useRef<Snapshot[]>([]);
  const isUndoingRef = useRef(false);
  const prevStateRef = useRef<Snapshot | null>(null);
  const isLoadingRef = useRef(false);

  const curTables = tablesHook.tables;
  const curGuests = guestsHook.guests;
  const curLabels = labelsHook.labels;

  // Undo stack tracking
  useEffect(() => {
    if (isUndoingRef.current) {
      isUndoingRef.current = false;
      prevStateRef.current = { tables: curTables, guests: curGuests, labels: curLabels };
      return;
    }

    if (prevStateRef.current) {
      const prev = prevStateRef.current;
      if (prev.tables !== curTables || prev.guests !== curGuests || prev.labels !== curLabels) {
        undoStackRef.current.push(prev);
        if (undoStackRef.current.length > MAX_UNDO) {
          undoStackRef.current.shift();
        }
      }
    }

    prevStateRef.current = { tables: curTables, guests: curGuests, labels: curLabels };
  }, [curTables, curGuests, curLabels]);

  const undo = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    isUndoingRef.current = true;
    tablesHook.setTables(snapshot.tables);
    guestsHook.setGuests(snapshot.guests);
    labelsHook.setLabels(snapshot.labels);
  }, [tablesHook.setTables, guestsHook.setGuests, labelsHook.setLabels]);

  // Ctrl+Z handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo]);

  // Load floor plan data from API
  const loadFloorPlan = useCallback(async (id: string) => {
    if (!isAuthenticated) return;
    isLoadingRef.current = true;
    try {
      const data = await api.getFloorPlan(id);
      tablesHook.setTables((data.tables || []) as Table[]);
      guestsHook.setGuests((data.guests || []) as Guest[]);
      labelsHook.setLabels((data.labels || []) as FloorLabel[]);
      undoStackRef.current = [];
      prevStateRef.current = null;
    } catch (err) {
      console.error("Failed to load floor plan:", err);
    } finally {
      // Delay clearing the loading flag so the initial data set doesn't trigger a save
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isLoadingRef.current = false;
        });
      });
    }
  }, [isAuthenticated, tablesHook.setTables, guestsHook.setGuests, labelsHook.setLabels]);

  const setCurrentFloorPlan = useCallback((id: string | null, name?: string | null) => {
    setCurrentFloorPlanId(id);
    setCurrentFloorPlanName(name ?? null);
    if (id) {
      loadFloorPlan(id);
    } else {
      tablesHook.setTables([]);
      guestsHook.setGuests([]);
      labelsHook.setLabels([]);
      undoStackRef.current = [];
      prevStateRef.current = null;
    }
  }, [loadFloorPlan, tablesHook.setTables, guestsHook.setGuests, labelsHook.setLabels]);

  // Debounced save to API
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDataRef = useRef<string>("");

  useEffect(() => {
    if (!isAuthenticated || !currentFloorPlanId || isLoadingRef.current) return;

    const dataStr = JSON.stringify({ tables: curTables, guests: curGuests, labels: curLabels });

    // Don't save if data hasn't changed
    if (dataStr === lastSavedDataRef.current) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await api.bulkSave(currentFloorPlanId, {
          tables: curTables,
          guests: curGuests,
          labels: curLabels,
        });
        lastSavedDataRef.current = dataStr;
        setLastSaved(new Date());
      } catch (err) {
        console.error("Failed to auto-save:", err);
      } finally {
        setIsSaving(false);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [curTables, curGuests, curLabels, currentFloorPlanId, isAuthenticated]);

  const floorPlanState: FloorPlanState = {
    currentFloorPlanId,
    currentFloorPlanName,
    setCurrentFloorPlan,
    isSaving,
    lastSaved,
  };

  return (
    <PlannerContext.Provider value={{ guests: guestsHook, tables: tablesHook, labels: labelsHook, undo, floorPlan: floorPlanState }}>
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

export function usePlannerUndo() {
  return usePlannerContext().undo;
}

export function usePlannerFloorPlan() {
  return usePlannerContext().floorPlan;
}
