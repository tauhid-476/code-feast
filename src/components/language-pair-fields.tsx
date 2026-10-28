import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LANGUAGE_LABELS, type Language } from "@/lib/languages";

export type StarterPairDraft = {
  starterCode: string;
  harnessCode: string;
};

/**
 * The two editable halves of one language. Both are plain textareas: the
 * Harness is authored by hand exactly like the Starter Code, never generated
 * and never read-only.
 */
export function LanguagePairFields({
  language,
  value,
  onChange,
}: {
  language: Language;
  value: StarterPairDraft;
  onChange: (patch: Partial<StarterPairDraft>) => void;
}) {
  const label = LANGUAGE_LABELS[language];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`starter-${language}`}>Starter Code</FieldLabel>
        <FieldDescription>
          The whole file a participant opens for {label}, including the signed
          function.
        </FieldDescription>
        <Textarea
          id={`starter-${language}`}
          value={value.starterCode}
          onChange={(event) => onChange({ starterCode: event.target.value })}
          spellCheck={false}
          autoComplete="off"
          className="mono min-h-56 resize-y text-[0.8rem] leading-relaxed"
          placeholder={`// The complete ${label} file, with the function to complete.`}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`harness-${language}`}>Harness</FieldLabel>
        <FieldDescription>
          Hidden from participants and appended to their code at run time. It
          parses stdin and calls their function.
        </FieldDescription>
        <Textarea
          id={`harness-${language}`}
          value={value.harnessCode}
          onChange={(event) => onChange({ harnessCode: event.target.value })}
          spellCheck={false}
          autoComplete="off"
          className="mono min-h-56 resize-y text-[0.8rem] leading-relaxed"
          placeholder={`// The ${label} snippet appended after the participant's code.`}
        />
      </Field>
    </div>
  );
}
