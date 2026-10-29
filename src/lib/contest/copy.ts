/**
 * Copy for the Submit confirmation. It lives outside the component so the
 * promise the participant is agreeing to can be tested without a browser, the
 * same way the organizer's Start and End confirmations are (ticket 08).
 */
export function submitConfirmationText(): string {
  return "Submitting ends your contest and cannot be undone. The last autosaved code of every problem is frozen as your submission, and you cannot return to the editor.";
}

/**
 * The one line a strike adds to the counter. The counter itself is permanent;
 * this is the transient explanation, so a participant who alt-tabs knows why
 * the number moved.
 */
export function strikeMessage(strikes: number, limit: number): string {
  return `Strike ${strikes} of ${limit}. Leaving fullscreen or losing focus costs a strike.`;
}

/**
 * The refusal a write from a displaced session returns. It names what happened,
 * because "try again" would invite exactly the retry that cannot work.
 */
export function sessionSupersededMessage(): string {
  return "A newer session took over. This window is read-only.";
}

/**
 * The whole explanation the older tab shows (SPEC §10: "Newest session wins;
 * older goes read-only and is logged"). It is one string so every surface that
 * explains the handover cannot drift.
 */
export function sessionTakeoverText(): string {
  return "You opened the contest in another tab, so that tab is now the live one. This tab is read-only: Run, Submit, and autosave are closed. Your latest code is still saved and is waiting in the newer tab. Holding the event open twice costs one strike.";
}
