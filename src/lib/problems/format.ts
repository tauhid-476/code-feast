/**
 * Formats a variable value for participant-facing UI display, presenting inputs
 * with proper data structure identifiers (e.g. array brackets `[2, 7, 11, 15]`,
 * string quotes `"()"`, numbers `9`, booleans `true`) matching platforms like
 * LeetCode and NeetCode.
 */

const STRING_PARAM_REGEX =
  /^(s|t|str|string|word|pattern|text|sentence|haystack|needle|query|prefix|suffix|char)$/i;

const ARRAY_PARAM_REGEX =
  /^(nums|arr|array|list|edges|intervals|points|matrix|grid|board|temperatures|height|heights|candidates|coins|digits|costs|prices|words)$/i;

export function formatVariableValue(
  value: string | undefined | null,
  paramName?: string,
): string {
  if (value === undefined || value === null) {
    return "";
  }

  const trimmed = value.trim();
  const name = paramName?.trim();

  // If empty string:
  if (trimmed === "") {
    if (name && ARRAY_PARAM_REGEX.test(name)) {
      return "[]";
    }
    return '""';
  }

  // 1. Explicit string parameter name (e.g. `s`, `t`, `str`, `pattern`, `text`)
  if (name && STRING_PARAM_REGEX.test(name)) {
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed;
    }
    return JSON.stringify(trimmed);
  }

  // 2. Already bracketed as an array: `[...]`
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }

  // 3. Already an object: `{...}`
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  // 4. Already quoted string: `"..."` or `'...'`
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed;
  }

  // 5. Boolean and null literals
  if (
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "null" ||
    trimmed === "undefined"
  ) {
    return trimmed;
  }

  // 6. Check known array parameter name (e.g. `nums`, `arr`, `edges`, or plural ending in 's')
  const isLikelyArrayParam =
    Boolean(name) &&
    (ARRAY_PARAM_REGEX.test(name!) ||
      (name!.endsWith("s") &&
        !/^(status|pass|process|class|radius|bias|canvas|is|has)$/i.test(
          name!,
        )));

  // 7. Check for multi-line numeric or grid data (e.g. matrix / edges)
  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    const isAllNumericLines = lines.every((line) => {
      const tokens = line.split(/[\s,]+/).filter(Boolean);
      return (
        tokens.length > 0 &&
        tokens.every((t) => /^-?\d+(\.\d+)?$/.test(t))
      );
    });

    if (isAllNumericLines) {
      const formattedRows = lines.map((line) => {
        const tokens = line.split(/[\s,]+/).filter(Boolean);
        return `[${tokens.join(", ")}]`;
      });
      return `[${formattedRows.join(", ")}]`;
    }
  }

  // 8. Numbers (single or sequence)
  const numberTokens = trimmed.split(/[\s,]+/).filter(Boolean);
  const areAllNumbers =
    numberTokens.length > 0 &&
    numberTokens.every((t) => /^-?\d+(\.\d+)?$/.test(t));

  if (areAllNumbers) {
    // If it's a single number and NOT an explicit array parameter name
    if (numberTokens.length === 1 && !isLikelyArrayParam) {
      return trimmed;
    }
    // Multiple numbers or explicitly an array parameter (e.g. `nums = 5` or `nums = 2 7 11 15`)
    return `[${numberTokens.join(", ")}]`;
  }

  // 9. If parameter is likely an array, but tokens were strings/words:
  if (isLikelyArrayParam) {
    const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
    if (tokens.length > 1) {
      const formatted = tokens.map((t) =>
        (t.startsWith('"') && t.endsWith('"')) ||
        (t.startsWith("'") && t.endsWith("'"))
          ? t
          : JSON.stringify(t),
      );
      return `[${formatted.join(", ")}]`;
    }
  }

  // 10. Fallback: If it's not a number, not a boolean, not an array -> it's a string!
  return JSON.stringify(trimmed);
}
