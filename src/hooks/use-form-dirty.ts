"use client";

import { useCallback, useState } from "react";

function serialize(form: HTMLFormElement): string {
  return JSON.stringify([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
}

// Whether a form's named fields differ from what they held when it
// mounted, so an edit form's Save stays disabled until something changes.
// Pass `attach` as the form's ref and `onInput` as its onInput. A dialog
// remounts its form on every open, which takes a fresh snapshot. Values
// kept in state outside the form (a Select, a map pin) are compared by the
// caller.
export function useFormDirty() {
  const [initial, setInitial] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const attach = useCallback((form: HTMLFormElement | null) => {
    const snapshot = form ? serialize(form) : null;
    setInitial(snapshot);
    setCurrent(snapshot);
  }, []);
  const onInput = (event: React.FormEvent<HTMLFormElement>) => setCurrent(serialize(event.currentTarget));
  return { attach, onInput, dirty: current !== initial };
}
