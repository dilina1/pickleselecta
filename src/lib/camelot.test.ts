import {
  bpmGapPercent,
  camelotLabel,
  compatibility,
  keyName,
  scoreCandidate,
  toCamelot,
} from "./camelot";

describe("toCamelot", () => {
  it("maps known keys", () => {
    expect(camelotLabel(toCamelot(9, 0))).toBe("8A"); // A minor
    expect(camelotLabel(toCamelot(0, 1))).toBe("8B"); // C major
    expect(camelotLabel(toCamelot(1, 1))).toBe("3B"); // C# major
    expect(camelotLabel(toCamelot(0, 0))).toBe("5A"); // C minor
  });
  it("handles missing key", () => {
    expect(toCamelot(-1, 1)).toBeNull();
    expect(toCamelot(3, -1)).toBeNull();
    expect(keyName(-1, 1)).toBe("?");
    expect(keyName(9, 0)).toBe("A min");
  });
});

describe("compatibility", () => {
  const a8 = toCamelot(9, 0); // 8A
  it("detects each relation", () => {
    expect(compatibility(a8, toCamelot(9, 0))).toBe("same");
    expect(compatibility(a8, toCamelot(0, 1))).toBe("relative"); // 8B
    expect(compatibility(a8, toCamelot(4, 0))).toBe("adjacent"); // 9A (E min)
    expect(compatibility(a8, toCamelot(2, 0))).toBe("adjacent"); // 7A (D min)
    expect(compatibility(a8, toCamelot(7, 1))).toBe("diagonal"); // 9B (G maj)
    expect(compatibility(a8, toCamelot(11, 0))).toBe("boost"); // 10A (B min)
    expect(compatibility(a8, toCamelot(1, 0))).toBeNull(); // 12A
  });
  it("wraps around the wheel", () => {
    expect(compatibility(toCamelot(1, 0), toCamelot(8, 0))).toBe("adjacent"); // 12A -> 1A
  });
});

describe("bpm and score", () => {
  it("allows half/double time", () => {
    expect(bpmGapPercent(128, 64)).toBe(0);
    expect(bpmGapPercent(128, 256)).toBe(0);
    expect(bpmGapPercent(128, 132)).toBeCloseTo(3.125, 2);
  });
  it("rejects out of range", () => {
    expect(scoreCandidate("same", 7, 6)).toBe(-1);
    expect(scoreCandidate(null, 0, 6)).toBe(-1);
    expect(scoreCandidate("same", 2, 6)).toBeGreaterThan(
      scoreCandidate("adjacent", 0, 6)
    );
  });
});
