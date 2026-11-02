

# legacy-ui → ui migration map

Read the target file in `src/components/ui/` before using it. Never guess its API.

## Button (ui/button.tsx)
- Variants: default→soft, secondary→muted, destructive→danger, outline→outline, ghost→ghost.
- Sizes: xs→sm, default→md, icon-xs / icon-sm→icon.
- `render={<a/>}` or `render={<Link/>}` → `asChild` with the link as the only child.
- `solid` adds an ArrowUpRight icon automatically. For submit buttons or
  non-navigation actions pass `iconRight={null}`. Use `solid` once per screen.
  Orange never fills a button.
- There is no loading prop. Keep `disabled` and the existing Spinner.
- Icons are auto-sized, so remove manual `size-4` and `data-icon`.

## Card (ui/card.tsx)
Exports only: Card, CardMedia, CardBody, CardTitle, CardText, CardFooter.
- CardHeader + CardTitle + CardDescription → CardBody containing CardTitle and CardText.
- CardText clamps to 2 lines. For long text add `className="line-clamp-none"`.
- CardContent → CardBody (it has p-4). CardFooter stays CardFooter.
- Drop the `size` prop.
- `Card` has glass blur and sits at 90% opacity on sm+. In the sober areas
  (contest workspace, review, problem editor, anything with forms) pass
  `className="backdrop-blur-none sm:opacity-100"`.

## Dialog (ui/dialog.tsx)
It is controlled and prop-based: `<Dialog open onClose title description role busy initialFocus>`.
There is no Trigger, Content, Header, Title, Description or Footer.
- Keep an `open` state, and make the trigger a Button with `onClick={() => setOpen(true)}`.
- `onOpenChange={setOpen}` → `onClose={() => setOpen(false)}`.
- DialogTitle / DialogDescription → the `title` / `description` props.
- DialogFooter → `<DialogActions>` inside the children.
- While a Server Action is pending pass `busy`, so Escape and the backdrop don't close it.
- It renders null when closed, so form state resets on close. Check each dialog still behaves.
- Destructive confirmations: use `ui/confirm-dialog.tsx` (read it first) or
  `Dialog role="alertdialog"` with `initialFocus` on the safe button.
  `ui/alert-dialog.tsx` is Base UI and is deleted at the end.

## Field (ui/field.tsx)
`<Field label hint error aside>` takes exactly ONE child element and injects
`id`, `aria-describedby` and `aria-invalid` into it.
- FieldGroup → `<div className="flex flex-col gap-4">`.
- FieldLabel / FieldDescription / inline error text → `label` / `hint` / `error` props.
- Remove manual `id` and `htmlFor` on the child (Field overwrites the id).
  Tests that query by label should still work. Run them.
- Radio or checkbox sets → `Fieldset legend hint error`.
- A custom child component must forward `id` and `aria-*` to a real element.

## Others (read the file first)
- Alert: `variant="destructive"` → `tone="danger"` (info | success | warning | danger).
  No AlertTitle, AlertDescription or AlertAction; compose per `references/components.md`.
- Badge: map to the nearest ChaiUI variant. Status semantics must stay clear
  in light and dark (live, locked, eliminated, etc.).
- Tooltip: no `delay` on the provider, no `render` on the trigger. Use `asChild`.
- Select: native `<select>`. `onValueChange(v)` → `onChange(e) => e.target.value`.
  Replace Trigger, Value, Content and Item with `<option>`s.
- Tabs, Table, Input, Textarea, Separator, Spinner: check the exports and replace sub-parts.

## Rules
- Change imports, JSX and classNames only. No logic, props, exports, server
  actions, `lib/`, `api/` or `use-contest-*` hooks.
- Semantic tokens only. No `space-y-*`, no `transition-all`.
- Anything that can't be mapped: leave it on `legacy-ui`, add `// TODO(ui-migrate): <reason>`, and list it in your report.