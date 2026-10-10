import { partitionText, segmentText } from "../../src/core/partition.js";

describe("partitionText", () => {
  it("partitions canonical ABCDEFGH examples", () => {
    expect(partitionText("ABCDEFGH", 1).map((part) => part.text)).toEqual(["ABCDEFGH"]);
    expect(partitionText("ABCDEFGH", 2).map((part) => part.text)).toEqual(["ABCD", "EFGH"]);
    expect(partitionText("ABCDEFGH", 3).map((part) => part.text)).toEqual(["ABC", "DEF", "GH"]);
    expect(partitionText("ABCDEFGH", 4).map((part) => part.text)).toEqual(["AB", "CD", "EF", "GH"]);
  });

  it("partitions Thai graphemes and emoji without splitting clusters", () => {
    const family = "👨‍👩‍👧‍👦";
    const sample = `ก้${family}ข`;
    const expected = Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(sample), ({ segment }) => segment);
    expect(segmentText(sample)).toEqual(expected);
    expect(segmentText(sample)).toEqual(["ก้", family, "ข"]);
    expect(partitionText(sample, 3).map((part) => part.text)).toEqual(expected);
  });

  it("preserves spaces and newlines", () => {
    const source = "  alpha\nbeta \n  ";
    expect(partitionText(source, 3).map((part) => part.text).join("")).toBe(source);
  });

  it("returns normal empty allocations when recipients exceed units", () => {
    const slices = partitionText("ABCDEFGH", 9);
    expect(slices).toHaveLength(9);
    expect(slices.map((part) => part.text)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", ""]);
    expect(slices[8]).toEqual({ start: 8, length: 0, text: "" });
  });

  it("returns one zero-length slice per recipient for empty text", () => {
    expect(partitionText("", 3)).toEqual([
      { start: 0, length: 0, text: "" },
      { start: 0, length: 0, text: "" },
      { start: 0, length: 0, text: "" },
    ]);
  });

  it("rejects invalid recipient counts", () => {
    for (const count of [0, -1, 1.5]) {
      expect(() => partitionText("text", count)).toThrow(RangeError);
    }
  });
});
