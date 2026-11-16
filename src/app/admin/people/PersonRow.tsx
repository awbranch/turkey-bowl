"use client";

import { useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { deletePersonAction } from "../actions";
import { useAction } from "../useAction";
import { PersonForm } from "./PersonForm";

type Person = { id: number; name: string; nickname: string | null; birthdate: string };

export function PersonRow({ person, age }: { person: Person; age: number | null }) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useAction();

  if (editing) {
    return (
      <li className="flex flex-col gap-2 py-4">
        <PersonForm person={person} onSaved={() => setEditing(false)} />
        <Button variant="ghost" className="self-start" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-40 flex-1">
        <p className="text-lg font-semibold">
          {person.name}
          {person.nickname && <span className="font-normal text-bark/60"> “{person.nickname}”</span>}
        </p>
        <p className="text-sm text-bark/60">
          {person.birthdate}
          {age !== null && ` · ${age} on the day`}
        </p>
      </div>
      <Button variant="secondary" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete ${person.name}?`)) run(() => deletePersonAction(person.id));
        }}
      >
        Delete
      </Button>
      {error && (
        <div className="w-full">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </li>
  );
}
