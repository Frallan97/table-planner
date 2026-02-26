import { useLocalStorage } from "./useLocalStorage";
import type { FloorLabel } from "@/lib/types";

export function useLabels() {
  const [labels, setLabels] = useLocalStorage<FloorLabel[]>(
    "tablePlanner_labels",
    []
  );

  const nextPosition = () => {
    const positions = [
      { x: 600, y: 100 },
      { x: 200, y: 100 },
      { x: 1000, y: 100 },
      { x: 600, y: 650 },
      { x: 200, y: 650 },
      { x: 1000, y: 650 },
    ];
    const idx = labels.length % positions.length;
    return { ...positions[idx] };
  };

  const addLabel = (text = "Label") => {
    const label: FloorLabel = {
      id: crypto.randomUUID(),
      text,
      position: nextPosition(),
      rotation: 0,
      width: 160,
      height: 50,
      fontSize: 14,
    };
    setLabels((prev) => [...prev, label]);
    return label.id;
  };

  const updateLabel = (id: string, updates: Partial<FloorLabel>) => {
    setLabels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  const deleteLabel = (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
  };

  const clearAllLabels = () => {
    setLabels([]);
  };

  return { labels, setLabels, addLabel, updateLabel, deleteLabel, clearAllLabels };
}
