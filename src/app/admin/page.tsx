import { ButtonLink, Card } from "@/components/ui";
import { getDb } from "@/db";
import { dayAfterThanksgiving } from "@/lib/dates";
import { getCurrentEvent, getEventBowlers, getRoundSummaries, MAX_ROUNDS } from "@/server/events";
import { listPeople } from "@/server/people";
import { BowlersPicker } from "./BowlersPicker";
import { CreateEventForm, EventSettingsForm } from "./EventForms";
import { RoundsList } from "./RoundsList";

export default async function AdminHome() {
  const db = await getDb();
  const event = await getCurrentEvent(db);
  const thisYear = new Date().getFullYear();

  if (!event || event.year < thisYear) {
    return (
      <>
        <h1 className="text-3xl font-bold">Set up Turkey Bowl {thisYear}</h1>
        <Card title="Create this year's event">
          <CreateEventForm defaultName={`Turkey Bowl ${thisYear}`} defaultDate={dayAfterThanksgiving(thisYear)} />
        </Card>
        {event && <p className="text-bark/60">Last event: {event.name}. People carry over automatically.</p>}
      </>
    );
  }

  const [people, bowlers, rounds] = await Promise.all([
    listPeople(db),
    getEventBowlers(db, event.id),
    getRoundSummaries(db, event.id),
  ]);

  return (
    <>
      <h1 className="text-3xl font-bold">{event.name}</h1>

      <Card title={`Who's bowling (${bowlers.length})`} actions={<ButtonLink href="/admin/people" variant="secondary">Manage people</ButtonLink>}>
        {people.length === 0 ? (
          <p className="text-bark/60">Add people first, then tap them here to include them.</p>
        ) : (
          <BowlersPicker people={people} bowlingIds={bowlers.map((b) => b.id)} />
        )}
      </Card>

      <Card title="Rounds">
        <RoundsList rounds={rounds} bowlerCount={bowlers.length} maxRounds={MAX_ROUNDS} />
      </Card>

      <Card title="Settings">
        <EventSettingsForm event={event} />
      </Card>
    </>
  );
}
