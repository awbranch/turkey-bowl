"use client";

import { Button, ErrorText } from "@/components/ui";
import { finishRoundAction, reopenRoundAction, startRoundAction } from "../../../actions";
import { useAction } from "../../../useAction";

export function RoundControls({ roundNumber, status }: { roundNumber: number; status: "setup" | "bowling" | "done" }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "setup" && (
          <Button disabled={pending} onClick={() => run(() => startRoundAction(roundNumber))}>
            ▶ Start round {roundNumber}
          </Button>
        )}
        {status === "bowling" && (
          <Button
            disabled={pending}
            onClick={() => {
              if (confirm(`Finish round ${roundNumber}? Scorers won't be able to enter scores after this.`)) {
                run(() => finishRoundAction(roundNumber));
              }
            }}
          >
            ✓ Finish round {roundNumber}
          </Button>
        )}
        {status === "done" && (
          <Button variant="secondary" disabled={pending} onClick={() => run(() => reopenRoundAction(roundNumber))}>
            Reopen round {roundNumber}
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
