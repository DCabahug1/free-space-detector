"use client";

import { useState } from "react";

// Drag and drop reordering for a short list, with the browser's own drag
// events (mouse and trackpad; touch screens reorder with the keyboard
// buttons the lists offer instead). Returns per-item props and the id the
// drag is hovering over, for a drop line. The upper half of a row drops
// before it, the lower half after it, so the last position is reachable.
// onReorder gets the new id order.
export function useDragReorder(ids: string[], onReorder: (next: string[]) => void) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);

  function drop(target: string, after: boolean) {
    if (!dragging || dragging === target) return;
    const next = ids.filter((id) => id !== dragging);
    next.splice(next.indexOf(target) + (after ? 1 : 0), 0, dragging);
    onReorder(next);
  }

  function lowerHalf(e: React.DragEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY > rect.top + rect.height / 2;
  }

  function itemProps(id: string) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        setDragging(id);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const after = lowerHalf(e);
        if (over?.id !== id || over.after !== after) setOver({ id, after });
      },
      onDragLeave: () => {
        if (over?.id === id) setOver(null);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        drop(id, lowerHalf(e));
        setDragging(null);
        setOver(null);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
      },
    };
  }

  // Keyboard and touch fallback: move an item one step.
  function move(id: string, delta: -1 | 1) {
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    onReorder(next);
  }

  return {
    itemProps,
    move,
    dragging,
    over: dragging ? (over?.id ?? null) : null,
    // True when the drop line belongs under the hovered row.
    overAfter: dragging ? (over?.after ?? false) : false,
  };
}
