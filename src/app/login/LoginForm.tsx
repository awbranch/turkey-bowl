"use client";

import { useActionState } from "react";
import { Button, ErrorText, Field, inputClass } from "@/components/ui";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <Field label="Admin passcode">
        <input name="passcode" type="password" autoComplete="current-password" autoFocus required className={inputClass} />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Log in"}
      </Button>
    </form>
  );
}
