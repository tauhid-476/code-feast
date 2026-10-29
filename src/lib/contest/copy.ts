/**
 * Copy for the Submit confirmation. It lives outside the component so the
 * promise the participant is agreeing to can be tested without a browser, the
 * same way the organizer's Start and End confirmations are (ticket 08).
 */
export function submitConfirmationText(): string {
  return "Submitting ends your contest and cannot be undone. The last autosaved code of every problem is frozen as your submission, and you cannot return to the editor.";
}
