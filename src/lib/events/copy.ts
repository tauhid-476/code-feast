/**
 * Copy for the clock confirmations. It lives outside the page so the promise
 * the organizer is agreeing to can be tested without a browser.
 */

export function startConfirmationText(
  participants: number,
  durationMinutes: number,
): string {
  const waiting =
    participants === 0
      ? "Nobody has joined yet."
      : participants === 1
        ? "1 participant is waiting."
        : `${participants} participants are waiting.`;

  return `${waiting} Starting now sets the deadline ${durationMinutes} minutes from now and freezes the problem set.`;
}

export function endConfirmationText(): string {
  return "Ending now moves the deadline to this moment and locks every participant out. Their saved work stays frozen for review, and the event cannot be restarted.";
}
