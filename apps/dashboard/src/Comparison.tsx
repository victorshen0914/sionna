import { useEffect, useState } from "react";
import { Download, ArrowRight, GitCompareArrows } from "lucide-react";
import type { Run, Config } from "./data";
import { download } from "./data";
import { Chart } from "./Chart";
import {
  parameters,
  metrics,
  Metric,
  colorFor,
  summary,
  delta,
  cdfValues,
  series,
  csv,
} from "./comparisonStats";

export function Comparison({
  runs,
  rename,
  onGenerate,
}: {
  runs: Run[];
  rename: (id: string, name: string) => void;
  onGenerate: () => void;
}) {
  const [excluded, setExcluded] = useState<string[]>([]),
    [baseline, setBaseline] = useState(""),
    [view, setView] = useState("指标对比"),
    [onlyDiff, setOnlyDiff] = useState(false),
    [cell, setCell] = useState(0),
    [metric, setMetric] = useState<Metric>("sinr"),
    [kind, setKind] = useState("CDF"),
    [uid, setUid] = useState(0);
  useEffect(() => {
    if (kind !== "CDF" && metric === "rsrp") setMetric("sinr");
  }, [kind, metric]);
  const selected = runs.filter((r) => !excluded.includes(r.id)),
    base = selected.find((r) => r.id === baseline) || selected[0],
    stats = new Map(selected.map((r) => [r.id, summary(r, cell)])),
    baseStats = base ? stats.get(base.id)! : {};
  const configKeys = (Object.keys(parameters) as (keyof Config)[]).filter(
    (k) => !onlyDiff || selected.some((r) => r.config[k] !== base?.config[k]),
  );
  const metricRows = [
    ...Object.entries(metrics).map(([key, m]) => ({
      key,
      label: `平均 ${m.label}`,
      unit: m.unit,
    })),
    ...["p5", "p50", "p95"].map((key) => ({
      key,
      label: `用户 ${key.toUpperCase()} 吞吐量`,
      unit: "Mbps",
    })),
  ];
  const users = [
    ...new Set(
      selected.flatMap((r) =>
        r.users.filter((u) => !cell || u.cell === cell).map((u) => u.id),
      ),
    ),
  ].sort((a, b) => a - b);
  const traces = selected.map((r) => ({
    ...(kind === "CDF"
      ? cdfValues(r, cell, metric)
      : series(r, cell, uid, metric)),
    type: "scatter",
    mode: "lines",
    name: r.name,
    connectgaps: false,
    line: {
      color: colorFor(runs.findIndex((v) => v.id === r.id)),
      width: r.id === base?.id ? 3 : 2,
      shape:
        kind === "CDF" || ["mcs", "rank", "ibler"].includes(metric)
          ? "hv"
          : "linear",
    },
  }));
  function exportTable() {
    const rows: unknown[][] = [
      [
        "示例数据",
        ...selected.map(
          (r) => `${r.name}${r.id === base?.id ? "（基准）" : ""}`,
        ),
      ],
    ];
    if (view === "配置对比") {
      for (const k of configKeys)
        rows.push([parameters[k], ...selected.map((r) => r.config[k])]);
    } else {
      rows.push(["筛选", cell ? `Cell ${cell}` : "全部小区"]);
      for (const m of metricRows) {
        rows.push([
          `${m.label} / ${m.unit}`,
          ...selected.map((r) => stats.get(r.id)![m.key]),
        ]);
        rows.push([
          `${m.label} 相对基准差值`,
          ...selected.map((r) =>
            delta(
              stats.get(r.id)![m.key],
              baseStats[m.key],
              m.unit,
              m.unit === "Mbps",
            ),
          ),
        ]);
      }
    }
    download("prisma-comparison.csv", csv(rows), "text/csv;charset=utf-8");
  }
  return (
    <main className="compare-workspace">
      <aside className="experiment-sidebar">
        <div className="sidebar-heading">
          <GitCompareArrows size={17} />
          <b>实验选择</b>
        </div>
        <p className="comparison-help">勾选实验进行对比，名称可直接编辑。</p>
        <div className="experiment-list">
          {runs.map((r, i) => (
            <div
              className="experiment-card"
              key={r.id}
              style={{ borderLeftColor: colorFor(i) }}
            >
              <label>
                <input
                  type="checkbox"
                  aria-label={`对比 ${r.name}`}
                  checked={!excluded.includes(r.id)}
                  onChange={(e) =>
                    setExcluded((v) =>
                      e.target.checked
                        ? v.filter((id) => id !== r.id)
                        : [...v, r.id],
                    )
                  }
                />
                <input
                  aria-label={`重命名 ${r.name}`}
                  value={r.name}
                  maxLength={60}
                  onChange={(e) => rename(r.id, e.target.value)}
                />
              </label>
              <small>
                {r.config.bandwidth} MHz · {r.config.users} UEs ·{" "}
                {r.config.slots} slots
              </small>
              <small>示例数据 · {r.created}</small>
            </div>
          ))}
        </div>
        <div className="run-footer">
          <button className="primary" onClick={onGenerate}>
            <ArrowRight size={15} />
            前往生成实验
          </button>
        </div>
      </aside>
      <article>
        <div className="result-top">
          <div>
            <span className="status-dot" />
            方案对比{" "}
            <span className="muted">
              已选 {selected.length} / {runs.length} 个实验
            </span>
          </div>
          <span className="badge">示例数据</span>
        </div>
        <div className="comparison-notice">
          所有数据来自已运行实验的配置快照。阵列、功率、调度和 CSI
          等参数尚未影响合成系统性能；不同配置可能得到相同结果。
        </div>
        {selected.length < 2 && (
          <div className="empty-state">
            <b>
              {selected.length ? "再选择或生成一个实验" : "请选择至少两个实验"}
            </b>
            <p>可以先修改系统配置并生成新实验，再回到这里比较。</p>
            <button onClick={onGenerate}>
              前往系统仿真 <ArrowRight size={14} />
            </button>
          </div>
        )}
        {selected.length > 0 && (
          <>
            <div className="comparison-controls">
              <label>
                基准实验
                <select
                  aria-label="基准实验"
                  value={base?.id}
                  onChange={(e) => setBaseline(e.target.value)}
                >
                  {selected.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || "未命名实验"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                小区筛选
                <select
                  aria-label="对比小区"
                  value={cell}
                  onChange={(e) => setCell(Number(e.target.value))}
                >
                  <option value={0}>全部小区</option>
                  {[1, 2, 3].map((c) => (
                    <option key={c} value={c}>
                      Cell {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="analysis-bar">
              <div className="subtabs">
                {["配置对比", "指标对比", "曲线对比"].map((v) => (
                  <button
                    key={v}
                    className={view === v ? "active" : ""}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {view !== "曲线对比" && (
                <button onClick={exportTable}>
                  <Download size={14} />
                  导出 CSV
                </button>
              )}
            </div>
            {view === "配置对比" ? (
              <>
                <label className="diff-toggle">
                  <input
                    type="checkbox"
                    checked={onlyDiff}
                    onChange={(e) => setOnlyDiff(e.target.checked)}
                  />
                  只看与基准不同的参数
                </label>
                <section className="panel table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>配置参数</th>
                        {selected.map((r) => (
                          <th
                            key={r.id}
                            style={{ color: colorFor(runs.indexOf(r)) }}
                          >
                            {r.name || "未命名实验"}{" "}
                            {r.id === base?.id ? "· 基准" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {configKeys.map((k) => (
                        <tr key={k}>
                          <td>{parameters[k]}</td>
                          {selected.map((r) => (
                            <td
                              key={r.id}
                              className={
                                r.config[k] !== base?.config[k]
                                  ? "config-difference"
                                  : ""
                              }
                            >
                              {r.config[k]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!configKeys.length && (
                    <p className="comparison-help">
                      所选实验配置一致，没有差异。
                    </p>
                  )}
                </section>
              </>
            ) : view === "指标对比" ? (
              <>
                <section className="panel table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>统计指标</th>
                        {selected.map((r) => (
                          <th
                            key={r.id}
                            style={{ color: colorFor(runs.indexOf(r)) }}
                          >
                            {r.name || "未命名实验"}{" "}
                            {r.id === base?.id ? "· 基准" : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metricRows.map((m) => (
                        <tr key={m.key}>
                          <td>
                            {m.label}
                            <small className="metric-unit">{m.unit}</small>
                          </td>
                          {selected.map((r) => {
                            const value = stats.get(r.id)![m.key];
                            return (
                              <td key={r.id}>
                                <b>{value === null ? "—" : value.toFixed(2)}</b>
                                {r.id !== base?.id && (
                                  <small className="metric-delta">
                                    {delta(
                                      value,
                                      baseStats[m.key],
                                      m.unit,
                                      m.unit === "Mbps",
                                    )}
                                  </small>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                <p className="comparison-help">
                  各平均值按用户等权统计；MCS、Rank 和 IBLER
                  只包含有效传输。吞吐量包含未调度时隙，P5/P50/P95
                  为用户吞吐量分位数。空样本显示 —。
                </p>
              </>
            ) : (
              <>
                <div className="chart-controls">
                  <label>
                    曲线类型
                    <select
                      aria-label="对比曲线类型"
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      <option>CDF</option>
                      <option>Slot 时序</option>
                    </select>
                  </label>
                  <label>
                    指标
                    <select
                      aria-label="对比指标"
                      value={metric}
                      onChange={(e) => setMetric(e.target.value as Metric)}
                    >
                      {(Object.keys(metrics) as Metric[])
                        .filter((k) => kind === "CDF" || k !== "rsrp")
                        .map((k) => (
                          <option key={k} value={k}>
                            {metrics[k].label}
                          </option>
                        ))}
                    </select>
                  </label>
                  {kind !== "CDF" && (
                    <label>
                      用户
                      <select
                        aria-label="对比用户"
                        value={uid}
                        onChange={(e) => setUid(Number(e.target.value))}
                      >
                        <option value={0}>全体用户聚合</option>
                        {uid !== 0 && !users.includes(uid) && (
                          <option value={uid}>
                            UE {uid}（当前筛选无记录）
                          </option>
                        )}
                        {users.map((id) => (
                          <option key={id} value={id}>
                            UE {id}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {kind !== "CDF" && (
                  <div className="comparison-notice">
                    按相同 slot 索引展示，不补齐不同长度的实验。聚合为每 slot
                    用户均值；IBLER 为当 slot 已调度用户的错误比例。同一 UE
                    编号在不同实验中可能对应不同位置。
                  </div>
                )}
                <section className="panel">
                  <div className="panel-head">
                    <h3>
                      {metrics[metric].label} · {kind}
                    </h3>
                    <span>基准加粗 · 工具栏导出 PNG</span>
                  </div>
                  <Chart
                    title={`Prisma-${metric}-${kind}`}
                    height={430}
                    data={traces}
                    layout={{
                      xaxis: {
                        title: {
                          text:
                            kind === "CDF"
                              ? `${metrics[metric].label} / ${metrics[metric].unit}`
                              : "Slot",
                        },
                        gridcolor: "#213143",
                      },
                      yaxis: {
                        title: {
                          text:
                            kind === "CDF"
                              ? "累计概率"
                              : `${metrics[metric].label} / ${metrics[metric].unit}`,
                        },
                        ...(kind === "CDF" ? { range: [0, 1] } : {}),
                        gridcolor: "#213143",
                      },
                    }}
                  />
                  {!traces.some((t) => t.y.some((v) => v !== null)) && (
                    <p className="comparison-help">
                      当前筛选下没有有效数据，请更换小区或用户。
                    </p>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </article>
    </main>
  );
}
