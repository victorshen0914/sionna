export type Config = {
  frequency: number;
  bandwidth: number;
  isd: number;
  users: number;
  rows: number;
  cols: number;
  group: number;
  power: number;
  tilt: number;
  slots: number;
  spacing: number;
  noise: number;
  target: number;
  seed: number;
  scenario: string;
  scheduler: string;
  csi: string;
};
export const defaults: Config = {
  frequency: 3.5,
  bandwidth: 100,
  isd: 500,
  users: 30,
  rows: 12,
  cols: 8,
  group: 6,
  power: 53,
  tilt: 8,
  slots: 100,
  spacing: 0.5,
  noise: 7,
  target: 10,
  seed: 42,
  scenario: "UMa",
  scheduler: "PF",
  csi: "理想 CSI",
};
export type Sample = {
  slot: number;
  sinr: number;
  mcs: number;
  rank: number;
  throughput: number;
  scheduled: boolean;
  error: boolean;
};
export type User = {
  id: number;
  cell: number;
  x: number;
  y: number;
  rsrp: number;
  sinr: number;
  mcs: number;
  rank: number;
  ibler: number;
  throughput: number;
  samples: Sample[];
};
export type Run = {
  id: string;
  name: string;
  config: Config;
  users: User[];
  created: string;
  source: "demo";
};
export const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
export function generate(config: Config, index: number): Run {
  let seed = config.seed >>> 0;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const users = Array.from({ length: config.users }, (_, i) => {
    const angle = random() * 2 * Math.PI,
      r = Math.sqrt(random()) * config.isd * 0.55,
      base = 25 - (r / config.isd) * 45 + (random() - 0.5) * 8;
    const samples = Array.from({ length: config.slots }, (_, slot) => {
      const sinr = base + 3 * Math.sin(slot / 11 + i) + (random() - 0.5) * 5,
        scheduled = random() < 0.55,
        mcs = Math.max(0, Math.min(28, Math.round((sinr + 8) * 0.75))),
        rank = sinr > 18 ? 2 : 1,
        error = scheduled && random() < config.target / 100;
      return {
        slot,
        sinr,
        mcs,
        rank,
        scheduled,
        error,
        throughput:
          scheduled && !error
            ? Math.max(0, mcs) * rank * config.bandwidth * 0.06
            : 0,
      };
    });
    const active = samples.filter((s) => s.scheduled);
    return {
      id: i + 1,
      cell: (i % 3) + 1,
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
      rsrp: -65 - r * 0.075 + (random() - 0.5) * 6,
      sinr: mean(samples.map((s) => s.sinr)),
      mcs: mean(active.map((s) => s.mcs)),
      rank: mean(active.map((s) => s.rank)),
      ibler: active.length
        ? (active.filter((s) => s.error).length / active.length) * 100
        : 0,
      throughput: mean(samples.map((s) => s.throughput)),
      samples,
    };
  });
  return {
    id: crypto.randomUUID(),
    name: `实验 ${String(index).padStart(2, "0")}`,
    config: { ...config },
    users,
    created: new Date().toLocaleTimeString("zh-CN"),
    source: "demo",
  };
}
export function validate(c: Config): string | null {
  const ranges: Partial<Record<keyof Config, [number, number]>> = {
    frequency: [0.1, 100],
    bandwidth: [1, 400],
    isd: [50, 5000],
    users: [1, 300],
    rows: [1, 48],
    cols: [1, 32],
    group: [1, 48],
    power: [0, 70],
    tilt: [-30, 60],
    slots: [10, 1000],
    spacing: [0.1, 2],
    noise: [0, 20],
    target: [0, 100],
    seed: [0, 2147483647],
  };
  for (const [key, [min, max]] of Object.entries(ranges) as [
    keyof Config,
    [number, number],
  ][]) {
    const v = c[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
      return `${key} 必须位于 ${min}—${max}`;
  }
  for (const k of ["users", "rows", "cols", "group", "slots", "seed"] as const)
    if (!Number.isInteger(c[k])) return `${k} 必须是整数`;
  if (c.rows % c.group !== 0) return "垂直阵子行数必须能被每通道阵子数整除";
  if (
    !["UMa", "UMi", "RMa"].includes(c.scenario) ||
    !["PF", "Round Robin"].includes(c.scheduler) ||
    !["理想 CSI", "SRS 估计"].includes(c.csi)
  )
    return "配置包含不支持的选项";
  return null;
}
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
