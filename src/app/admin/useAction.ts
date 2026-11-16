"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./actions";

/** Run server actions from buttons, tracking pending state and the last error. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  function run(action: () => Promise<ActionResult>) {
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }
  return { pending, error, run };
}
