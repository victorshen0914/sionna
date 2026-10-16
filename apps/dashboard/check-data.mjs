import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(
  new URL("./src/data.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { generate, defaults, validate, mean } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const a = generate(defaults, 1),
  b = generate(defaults, 2);
assert.deepEqual(a.users, b.users, "固定种子必须复现用户与时隙记录");
assert.equal(
  validate({ ...defaults, group: 5 }),
  "垂直阵子行数必须能被每通道阵子数整除",
);
assert.ok(validate({ ...defaults, slots: NaN }));
assert.equal(validate(defaults), null);
for (const u of a.users) {
  assert.ok(u.ibler === null || (u.ibler >= 0 && u.ibler <= 100));
  assert.equal(u.throughput, mean(u.samples.map((s) => s.throughput)));
  for (const s of u.samples) {
    assert.ok(Number.isInteger(s.mcs) && s.mcs >= 0 && s.mcs <= 28);
    assert.ok([1, 2].includes(s.rank));
    if (!s.scheduled || s.error) assert.equal(s.throughput, 0);
  }
}
console.log(
  "PASS: reproducibility, validation, metric consistency, discrete values",
);
const statsSource = fs.readFileSync(
  new URL("./src/comparisonStats.ts", import.meta.url),
  "utf8",
);
const statsCode = ts.transpileModule(statsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { summary, delta, series, cdfValues, valueFor, quantile, csv } =
  await import(
    "data:text/javascript;base64," + Buffer.from(statsCode).toString("base64")
  );
const inactive = {
  ...a.users[0],
  samples: a.users[0].samples.map((s) => ({
    ...s,
    scheduled: false,
    throughput: 0,
    error: false,
  })),
};
const emptyRun = { ...a, users: [inactive] };
assert.equal(valueFor(inactive, "mcs"), null);
assert.equal(valueFor(inactive, "rank"), null);
assert.equal(valueFor(inactive, "ibler"), null);
assert.equal(valueFor(inactive, "throughput"), 0);
assert.equal(summary(emptyRun, 0).mcs, null);
assert.equal(summary(a, 99).sinr, null);
assert.deepEqual(cdfValues(emptyRun, 0, "mcs"), { x: [], y: [] });
assert.equal(delta(5, 0, "Mbps", true), "+5.00 Mbps · 百分比 —");
assert.equal(delta(12, 10, "%"), "+2.00 个百分点");
assert.equal(delta(-90, -95, "dBm"), "+5.00 dB");
assert.equal(delta(null, 5, "dB"), "—");
assert.equal(quantile([0, 100], 0.05), 5);
const short = generate({ ...defaults, slots: 10 }, 3);
assert.equal(series(short, 0, 0, "throughput").x.length, 10);
assert.equal(series(a, 0, 0, "throughput").x.length, 100);
assert.equal(series(a, 99, 0, "throughput").x.length, 0);
assert.ok(series(emptyRun, 0, 0, "mcs").y.every((v) => v === null));
const distribution = cdfValues(a, 0, "sinr");
assert.equal(distribution.y.at(-1), 1);
assert.ok(
  distribution.x.every((v, i) => i === 0 || v >= distribution.x[i - 1]),
);
const snapshot = structuredClone(a.config);
summary(a, 0);
assert.deepEqual(a.config, snapshot);
assert.equal(csv([["name", 'a,"b"']]), '\uFEFF"name","a,""b"""');
console.log(
  "PASS: empty transmissions, empty filters, zero baseline, percentiles, unequal slots, CDF, CSV",
);
