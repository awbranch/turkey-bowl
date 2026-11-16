"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button, ErrorText, Field, inputClass } from "@/components/ui";
import { savePersonAction } from "../actions";

type Props = {
  person?: { id: number; name: string; nickname: string | null; birthdate: string };
  /** Show the "bowling this year" checkbox (new people only). */
  eventName?: string;
  onSaved?: () => void;
};

export function PersonForm({ person, eventName, onSaved }: Props) {
  const [state, action, pending] = useActionState(savePersonAction, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    if (!person) form.current?.reset();
    onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={form} action={action} className="grid gap-4 sm:grid-cols-[2fr_1.5fr_1.5fr_auto] sm:items-end">
      {person && <input type="hidden" name="id" value={person.id} />}
      <Field label="Name">
        <input name="name" defaultValue={person?.name} required maxLength={40} className={inputClass} autoComplete="off" />
      </Field>
      <Field label="Nickname (optional)">
        <input name="nickname" defaultValue={person?.nickname ?? ""} maxLength={30} className={inputClass} autoComplete="off" />
      </Field>
      <Field label="Birth date">
        <input name="birthdate" type="date" defaultValue={person?.birthdate} required className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : person ? "Save" : "Add"}
      </Button>
      {!person && eventName && (
        <label className="flex items-center gap-3 sm:col-span-4">
          <input type="checkbox" name="addToEvent" defaultChecked className="size-6 accent-cranberry" />
          <span>Bowling in {eventName}</span>
        </label>
      )}
      <div className="sm:col-span-4">
        <ErrorText>{state.error}</ErrorText>
      </div>
    </form>
  );
}
