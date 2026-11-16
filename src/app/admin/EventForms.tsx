"use client";

import { useActionState } from "react";
import { Button, ErrorText, Field, inputClass } from "@/components/ui";
import { createEventAction, updateEventAction } from "./actions";

export function CreateEventForm({ defaultName, defaultDate }: { defaultName: string; defaultDate: string }) {
  const [state, action, pending] = useActionState(createEventAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
      <Field label="Event name">
        <input name="name" defaultValue={defaultName} required className={inputClass} />
      </Field>
      <Field label="Date">
        <input name="date" type="date" defaultValue={defaultDate} required className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create event"}
      </Button>
      <div className="sm:col-span-3">
        <ErrorText>{state.error}</ErrorText>
      </div>
    </form>
  );
}

export function EventSettingsForm({ event }: { event: { name: string; date: string; streakTieLimit: number } }) {
  const [state, action, pending] = useActionState(updateEventAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
      <Field label="Event name">
        <input name="name" defaultValue={event.name} required className={inputClass} />
      </Field>
      <Field label="Date">
        <input name="date" type="date" defaultValue={event.date} required className={inputClass} />
      </Field>
      <Field label="Streak tie limit">
        <input
          name="streakTieLimit"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          defaultValue={event.streakTieLimit}
          required
          className={inputClass}
        />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : state.ok ? "Saved ✓" : "Save"}
      </Button>
      <p className="text-sm text-bark/60 sm:col-span-4">
        If more than this many bowlers tie for a streak prize, the prize is skipped and noted in the MC wrap-up.
      </p>
      <div className="sm:col-span-4">
        <ErrorText>{state.error}</ErrorText>
      </div>
    </form>
  );
}
