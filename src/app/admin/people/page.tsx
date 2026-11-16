import { Card } from "@/components/ui";
import { getDb } from "@/db";
import { ageOn } from "@/lib/dates";
import { getCurrentEvent } from "@/server/events";
import { listPeople } from "@/server/people";
import { PersonForm } from "./PersonForm";
import { PersonRow } from "./PersonRow";

export default async function PeoplePage() {
  const db = getDb();
  const [people, event] = await Promise.all([listPeople(db), getCurrentEvent(db)]);

  return (
    <>
      <h1 className="text-3xl font-bold">People</h1>
      <Card title="Add a person">
        <PersonForm eventName={event?.name} />
      </Card>
      <Card title={`Everyone (${people.length})`}>
        {people.length === 0 ? (
          <p className="text-bark/60">Nobody yet. Add the family above.</p>
        ) : (
          <ul className="divide-y divide-bark/10">
            {people.map((p) => (
              <PersonRow key={p.id} person={p} age={event ? ageOn(p.birthdate, event.date) : null} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
