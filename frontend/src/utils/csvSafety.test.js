import { describe, expect, it } from "vitest";
import { escapeCsvValue, neutralizeCsvFormulaValue } from "./csvSafety";

describe("csvSafety", () => {
  it.each([
    ["=HYPERLINK(\"http://bad\")", "'=HYPERLINK(\"http://bad\")"],
    ["+cmd|'/C calc'!A0", "'+cmd|'/C calc'!A0"],
    ["-2+3", "'-2+3"],
    ["@SUM(1,2)", "'@SUM(1,2)"],
    ["  =1+1", "'  =1+1"],
  ])("neutralizes spreadsheet formula values: %s", (input, expected) => {
    expect(neutralizeCsvFormulaValue(input)).toBe(expected);
  });

  it("escapes quotes after formula neutralization", () => {
    expect(escapeCsvValue('=HYPERLINK("http://bad")')).toBe('"\'=HYPERLINK(""http://bad"")"');
  });
});
