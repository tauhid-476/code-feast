import { describe, expect, it } from "vitest";
import { formatVariableValue } from "@/lib/problems/format";

describe("formatVariableValue", () => {
  it("formats space-separated numbers as array", () => {
    expect(formatVariableValue("2 7 11 15", "nums")).toBe("[2, 7, 11, 15]");
    expect(formatVariableValue("2 7 11 15")).toBe("[2, 7, 11, 15]");
  });

  it("formats comma-separated numbers as array", () => {
    expect(formatVariableValue("2, 7, 11, 15", "nums")).toBe("[2, 7, 11, 15]");
    expect(formatVariableValue("3,2,4", "nums")).toBe("[3, 2, 4]");
  });

  it("leaves already bracketed array as is", () => {
    expect(formatVariableValue("[3,4,5,6]", "nums")).toBe("[3,4,5,6]");
    expect(formatVariableValue("[2, 7, 11, 15]")).toBe("[2, 7, 11, 15]");
  });

  it("formats single number for scalar parameter", () => {
    expect(formatVariableValue("9", "target")).toBe("9");
    expect(formatVariableValue("7", "target")).toBe("7");
    expect(formatVariableValue("42", "k")).toBe("42");
    expect(formatVariableValue("-5", "val")).toBe("-5");
  });

  it("formats single number as array if parameter is known array", () => {
    expect(formatVariableValue("5", "nums")).toBe("[5]");
    expect(formatVariableValue("0", "arr")).toBe("[0]");
  });

  it("formats strings with quotes", () => {
    expect(formatVariableValue("()", "s")).toBe('"()"');
    expect(formatVariableValue("()[]{}", "s")).toBe('"()[]{}"');
    expect(formatVariableValue("(]", "s")).toBe('"(]"');
    expect(formatVariableValue("hello", "word")).toBe('"hello"');
    expect(formatVariableValue("()")).toBe('"()"');
  });

  it("leaves already quoted strings as is", () => {
    expect(formatVariableValue('"()"', "s")).toBe('"()"');
    expect(formatVariableValue("'test'", "s")).toBe("'test'");
  });

  it("formats multi-line numbers as 2D array", () => {
    expect(formatVariableValue("0 1\n1 2\n2 0", "edges")).toBe(
      "[[0, 1], [1, 2], [2, 0]]",
    );
  });

  it("handles boolean and null literals", () => {
    expect(formatVariableValue("true", "flag")).toBe("true");
    expect(formatVariableValue("false", "flag")).toBe("false");
    expect(formatVariableValue("null", "node")).toBe("null");
  });

  it("handles empty strings", () => {
    expect(formatVariableValue("", "s")).toBe('""');
    expect(formatVariableValue("", "nums")).toBe("[]");
    expect(formatVariableValue(null)).toBe("");
  });
});
