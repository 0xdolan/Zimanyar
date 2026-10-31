import { readFixture } from "@zimanyar/data/node";
import { expect } from "vitest";

/** Fixtures are written with sorted keys, and key order has no meaning here. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1)))
      : item,
  );

/** Compare every line of a fixture, and report how many differ with the first few cases. */
export function expectParity<T>(
  name: string,
  check: (record: T) => { actual: unknown; expected: unknown },
): void {
  const records = readFixture<T>(name);
  expect(records.length).toBeGreaterThan(0);
  const wrong: unknown[] = [];
  let total = 0;
  for (const record of records) {
    total++;
    const { actual, expected } = check(record);
    if (canonical(actual) !== canonical(expected)) wrong.push({ record, actual, expected });
  }
  expect({ name, total, wrong: wrong.length, first: wrong.slice(0, 3) }).toEqual({
    name,
    total,
    wrong: 0,
    first: [],
  });
}
