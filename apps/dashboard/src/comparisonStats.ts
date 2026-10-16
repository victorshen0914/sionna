import type { Config, Run, User } from "./data";
export const palette = [
  "#47dfca",
  "#6e9dff",
  "#d59bff",
  "#ffbc70",
  "#f18eb0",
  "#94cd7d",
  "#66c5ef",
  "#d6c170",
];
export const colorFor = (index: number) => palette[index % palette.length];
export type Metric = "rsrp" | "sinr" | "mcs" | "rank" | "ibler" | "throughput";
export const metrics: Record<Metric, { label: string; unit: string }> = {
  rsrp: { label: "RSRP", unit: "dBm" },
  sinr: { label: "SINR", unit: "dB" },
  mcs: { label: "MCS", unit: "" },
  rank: { label: "Rank", unit: "" },
  ibler: { label: "IBLER", unit: "%" },
  throughput: { label: "用户吞吐量", unit: "Mbps" },
};
export const parameters: Record<keyof Config, string> = {
  frequency: "载波频率 / GHz",
  bandwidth: "系统带宽 / MHz",
  isd: "站间距 / m",
  users: "用户数量",
  rows: "垂直阵子行数",
  cols: "水平阵子列数",
  group: "每通道垂直阵子数",
  power: "扇区总功率 / dBm",
  tilt: "电下倾角 / °",
  slots: "仿真时隙数",
  spacing: "阵子间距 / λ",
  noise: "噪声系数 / dB",
  target: "目标首次传输错误率 / %",
  seed: "随机种子",
  scenario: "传播场景",
  scheduler: "调度算法",
  csi: "信道信息",
};
export const average = (values: (number | null)[]): number | null => {
  const valid = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
};
export function valueFor(user: User, metric: Metric): number | null {
  if (metric === "rsrp") return user.rsrp;
  const samples = user.samples.filter(
    (s) => !["mcs", "rank", "ibler"].includes(metric) || s.scheduled,
  );
  return average(
    samples.map((s) =>
      metric === "ibler" ? Number(s.error) * 100 : s[metric],
    ),
  );
}
export function quantile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    pos = (sorted.length - 1) * p,
    lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
export function summary(run: Run, cell: number) {
  const users = run.users.filter((u) => !cell || u.cell === cell),
    result: Record<string, number | null> = {};
  for (const metric of Object.keys(metrics) as Metric[])
    result[metric] = average(users.map((u) => valueFor(u, metric)));
  const rates = users
    .map((u) => valueFor(u, "throughput"))
    .filter((v): v is number => v !== null);
  for (const [key, p] of [
    ["p5", 0.05],
    ["p50", 0.5],
    ["p95", 0.95],
  ] as const)
    result[key] = quantile(rates, p);
  return result;
}
export function delta(
  value: number | null,
  base: number | null,
  unit: string,
  relative = false,
) {
  if (value === null || base === null) return "—";
  const diff = value - base;
  if (unit === "dBm") unit = "dB";
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}${unit === "%" ? " 个百分点" : unit ? " " + unit : ""}${relative ? (base === 0 ? " · 百分比 —" : ` · ${(diff / base) * 100 >= 0 ? "+" : ""}${((diff / base) * 100).toFixed(1)}%`) : ""}`;
}
export function cdfValues(run: Run, cell: number, metric: Metric) {
  const x = run.users
    .filter((u) => !cell || u.cell === cell)
    .map((u) => valueFor(u, metric))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  return { x, y: x.map((_, i) => (i + 1) / x.length) };
}
export function series(run: Run, cell: number, uid: number, metric: Metric) {
  const users = run.users.filter(
    (u) => (!cell || u.cell === cell) && (!uid || u.id === uid),
  );
  const slots = [
    ...new Set(users.flatMap((u) => u.samples.map((s) => s.slot))),
  ].sort((a, b) => a - b);
  const lookup = users.map((u) => ({
    user: u,
    bySlot: new Map(u.samples.map((s) => [s.slot, s])),
  }));
  return {
    x: slots,
    y: slots.map((slot) =>
      average(
        lookup.map(({ user, bySlot }) => {
          const s = bySlot.get(slot);
          if (!s) return null;
          if (metric === "rsrp") return user.rsrp;
          if (["mcs", "rank", "ibler"].includes(metric) && !s.scheduled)
            return null;
          return metric === "ibler" ? Number(s.error) * 100 : s[metric];
        }),
      ),
    ),
  };
}
export const csv = (rows: unknown[][]) =>
  "\uFEFF" +
  rows
    .map((row) =>
      row
        .map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"')
        .join(","),
    )
    .join("\r\n");
