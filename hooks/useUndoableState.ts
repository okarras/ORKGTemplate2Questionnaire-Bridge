"use client";

import { useCallback, useState } from "react";

const MAX_HISTORY = 50;

/**
 * Hook for state that supports undo and redo.
 * Pushes current state to history before each update.
 */
export function useUndoableState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [history, setHistory] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), structuredClone(state)]);
    setFuture([]); // Clear redo stack on new change
  }, [state]);

  const update = useCallback(
    (updater: T | ((prev: T) => T)) => {
      pushHistory();
      setState(updater);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    const prev = history.at(-1);

    if (prev !== undefined) {
      setFuture((f) => [...f.slice(-(MAX_HISTORY - 1)), structuredClone(state)]);
      setState(structuredClone(prev));
      setHistory((h) => h.slice(0, -1));
    }
  }, [history, state]);

  const redo = useCallback(() => {
    const next = future.at(-1);

    if (next !== undefined) {
      setHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), structuredClone(state)]);
      setState(structuredClone(next));
      setFuture((f) => f.slice(0, -1));
    }
  }, [future, state]);

  const canUndo = history.length > 0;
  const canRedo = future.length > 0;

  return [state, update, { undo, redo, canUndo, canRedo }] as const;
}
