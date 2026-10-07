import { describe, expect, it } from "vitest";
import { runWithLimit } from "../src/lib/pool";

describe("runWithLimit", () => {
  it("never exceeds the limit and returns results in input order", async () => {
    let active = 0;
    let maximum = 0;
    const completed: number[] = [];
    const tasks = Array.from({ length: 9 }, (_, index) => async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, index === 0 ? 25 : 1));
      completed.push(index);
      active--;
      return index;
    });
    const results = await runWithLimit(tasks, 3);
    expect(maximum).toBe(3);
    expect(active).toBe(0);
    expect(completed[0]).not.toBe(0);
    expect(results).toEqual(tasks.map((_, index) => ({ status: "fulfilled", value: index })));
  });
  it("isolates rejected and synchronously throwing tasks", async () => {
    const results = await runWithLimit([
      async () => 1,
      async () => { throw new Error("failure"); },
      () => { throw new Error("sync failure"); },
      async () => 4
    ], 2);
    expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(results[1]?.status).toBe("rejected");
    expect(results[2]?.status).toBe("rejected");
    expect(results[3]).toEqual({ status: "fulfilled", value: 4 });
  });
  it("handles an empty task list and a limit greater than the task count", async () => {
    expect(await runWithLimit([], 3)).toEqual([]);
    expect(await runWithLimit([async () => "one"], 9)).toEqual([{ status: "fulfilled", value: "one" }]);
  });
  it.each([0, -1, 1.5, Infinity])("rejects invalid limits: %s", async (limit) => {
    await expect(runWithLimit([], limit)).rejects.toThrow("positive integer");
  });
});
