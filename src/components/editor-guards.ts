import { blockedKindFor } from "@/lib/contest/anti-cheat";
import type { ViolationKind } from "@/lib/violations/kinds";

/**
 * Every route into the editor (SPEC §6), blocked in the browser:
 * Monaco's paste command, the keyboard shortcut, the DOM `paste` event, a drop,
 * a middle click, and the context menu. Copying out is untouched — there is no
 * copy or cut listener.
 *
 * The guards only prevent and report. Logging is the caller's, which is what
 * lets the same installer run under a fake editor in tests.
 */

export type GuardEvent = {
  type: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  button?: number;
  preventDefault(): void;
};

export type GuardedNode = {
  addEventListener(type: string, listener: (event: GuardEvent) => void): void;
  removeEventListener(
    type: string,
    listener: (event: GuardEvent) => void,
  ): void;
};

export type GuardDisposable = { dispose(): void };

export type GuardEditor = {
  addCommand(keybinding: number, handler: () => void): unknown;
  onKeyDown(
    listener: (event: { browserEvent: GuardEvent }) => void,
  ): GuardDisposable | void;
  onContextMenu(
    listener: (event: { event: { preventDefault(): void } }) => void,
  ): GuardDisposable | void;
  getDomNode(): GuardedNode | null;
};

export type InstallGuardsOptions = {
  editor: GuardEditor;
  /** The Monaco keybinding number for Ctrl/Cmd+V. */
  keybinding: number;
  report: (kind: ViolationKind) => void;
};

export function installEditorGuards({
  editor,
  keybinding,
  report,
}: InstallGuardsOptions): () => void {
  const disposables: GuardDisposable[] = [];

  // Monaco's own paste command is the shortcut's other half: replacing it is
  // what stops the browser's paste landing in the model. `addCommand` has no
  // removal API, which is fine because the command lives and dies with the
  // editor instance the guards are installed against.
  editor.addCommand(keybinding, () => report("paste_blocked"));

  const keyDown = editor.onKeyDown(({ browserEvent }) => {
    const kind = blockedKindFor(browserEvent);
    if (!kind) return;
    browserEvent.preventDefault();
    report(kind);
  });
  if (keyDown) disposables.push(keyDown);

  const contextMenu = editor.onContextMenu(({ event }) => {
    event.preventDefault();
    report("context_menu_blocked");
  });
  if (contextMenu) disposables.push(contextMenu);

  const node = editor.getDomNode();
  if (!node) return () => disposeAll(disposables);

  const listeners: Array<[string, (event: GuardEvent) => void]> = [
    [
      "paste",
      (event) => {
        event.preventDefault();
        report("paste_blocked");
      },
    ],
    [
      "drop",
      (event) => {
        event.preventDefault();
        report("paste_blocked");
      },
    ],
    [
      "dragover",
      (event) => {
        // Not a report: just tell the browser the editor is not a drop target.
        event.preventDefault();
      },
    ],
    [
      "mousedown",
      (event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        report("paste_blocked");
      },
    ],
    [
      "contextmenu",
      (event) => {
        event.preventDefault();
        report("context_menu_blocked");
      },
    ],
  ];

  for (const [type, listener] of listeners) node.addEventListener(type, listener);

  return () => {
    for (const [type, listener] of listeners) {
      node.removeEventListener(type, listener);
    }
    disposeAll(disposables);
  };
}

function disposeAll(disposables: GuardDisposable[]) {
  for (const disposable of disposables) disposable.dispose();
}
