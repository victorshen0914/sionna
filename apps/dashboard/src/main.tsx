import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Radio,
  TowerControl,
  SlidersHorizontal,
  Play,
  Download,
  Upload,
  ChevronRight,
  Layers,
  Info,
  Check,
  RotateCcw,
} from "lucide-react";
import Plotly from "plotly.js-dist-min";
import {
  Config,
  defaults,
  generate,
  mean,
  Run,
  User,
  validate,
  download,
} from "./data";
import "./style.css";

const colors = ["#47dfca", "#6e9dff", "#d59bff", "#ffbc70"];
function Chart({
  data,
  title,
  height = 290,
  layout = {},
}: {
  data: unknown[];
  title: string;
  height?: number;
  layout?: Record<string, unknown>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    Plotly.react(
      el,
      data,
      {
        height,
        margin: { l: 54, r: 20, t: 22, b: 48 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        font: {
          color: "#91a5b9",
          family: "Inter, Microsoft YaHei, sans-serif",
          size: 11,
        },
        colorway: colors,
        xaxis: { gridcolor: "#213143", zerolinecolor: "#304153" },
        yaxis: { gridcolor: "#213143", zerolinecolor: "#304153" },
        legend: { orientation: "h", y: 1.15 },
        ...layout,
      },
      {
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
        toImageButtonOptions: { format: "png", filename: title, scale: 2 },
      },
    );
    const observer = new ResizeObserver(() => Plotly.Plots.resize(el));
    observer.observe(el);
    return () => observer.disconnect();
  }, [data, height, layout, title]);
  useEffect(
    () => () => {
      if (ref.current) Plotly.purge(ref.current);
    },
    [],
  );
  return (
    <div ref={ref} aria-label={title} style={{ width: "100%", minWidth: 0 }} />
  );
}
function Panel({
  title,
  tag,
  children,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {tag && <span>{tag}</span>}
      </div>
      {children}
    </section>
  );
}
const fields: Record<string, [string, string, number, number, number]> = {
  frequency: ["载波频率", "GHz", 0.1, 100, 0.1],
  bandwidth: ["系统带宽", "MHz", 1, 400, 1],
  isd: ["站间距", "m", 50, 5000, 50],
  users: ["用户数量", "UE", 1, 300, 1],
  rows: ["垂直阵子行数", "", 1, 48, 1],
  cols: ["水平阵子列数", "", 1, 32, 1],
  group: ["每通道垂直阵子数", "", 1, 48, 1],
  power: ["扇区总发射功率", "dBm", 0, 70, 1],
  tilt: ["电下倾角", "°", -30, 60, 1],
  slots: ["仿真时隙数", "slots", 10, 1000, 10],
  spacing: ["阵子间距", "λ", 0.1, 2, 0.05],
  noise: ["接收机噪声系数", "dB", 0, 20, 1],
  target: ["目标首次传输错误率", "%", 0, 100, 1],
  seed: ["随机种子", "", 0, 2147483647, 1],
};
function App() {
  const [tab, setTab] = useState("system"),
    [view, setView] = useState("概览"),
    [expert, setExpert] = useState(false),
    [config, setConfig] = useState<Config>(defaults),
    [runs, setRuns] = useState<Run[]>(() => [generate(defaults, 1)]),
    [runId, setRunId] = useState(""),
    [cell, setCell] = useState(0),
    [uid, setUid] = useState(1),
    [metric, setMetric] = useState("sinr"),
    [compare, setCompare] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [sort, setSort] = useState("id"),
    [descending, setDescending] = useState(false),
    [scan, setScan] = useState(0),
    [patternMode, setPatternMode] = useState("整阵"),
    [start, setStart] = useState(0),
    [end, setEnd] = useState(99);
  const run = runs.find((r) => r.id === runId) || runs[runs.length - 1],
    stale = JSON.stringify(config) !== JSON.stringify(run.config),
    filtered = run.users.filter((u) => !cell || u.cell === cell),
    user = filtered.find((u) => u.id === uid) || filtered[0],
    error = validate(config),
    fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setStart(0);
    setEnd(run.config.slots - 1);
  }, [run.id]);
  useEffect(() => {
    if (view === "时序" && metric === "rsrp") setMetric("sinr");
  }, [view, metric]);
  const set = (key: keyof Config, value: number | string) =>
    setConfig((c) => ({ ...c, [key]: value }));
  const numberField = (key: string) => (
    <label className="field" key={key}>
      <span>{fields[key][0]}</span>
      <div>
        <input
          aria-label={fields[key][0]}
          type="number"
          min={fields[key][2]}
          max={fields[key][3]}
          step={fields[key][4]}
          value={config[key as keyof Config]}
          onChange={(e) =>
            set(
              key as keyof Config,
              e.target.value === "" ? NaN : Number(e.target.value),
            )
          }
        />
        <small>{fields[key][1]}</small>
      </div>
    </label>
  );
  const renderSelect = (
    key: keyof Config,
    label: string,
    options: string[],
  ) => (
    <label className="field">
      <span>{label}</span>
      <select value={config[key]} onChange={(e) => set(key, e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  async function importConfig(file?: File) {
    if (!file) return;
    try {
      const value = { ...defaults, ...JSON.parse(await file.text()) };
      const problem = validate(value);
      if (problem) throw Error(problem);
      setConfig(value);
      setMessage("配置已导入");
    } catch (e) {
      setMessage(`导入失败：${e instanceof Error ? e.message : "格式不正确"}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  function execute() {
    if (error) return;
    setBusy(true);
    setTimeout(() => {
      const next = generate(config, runs.length + 1);
      setRuns((r) => [...r, next]);
      setRunId(next.id);
      setStart(0);
      setEnd(config.slots - 1);
      setBusy(false);
      setMessage("示例结果已生成 · 不代表 Sionna 仿真");
    }, 450);
  }
  const units: Record<string, string> = {
    sinr: "dB",
    rsrp: "dBm",
    throughput: "Mbps",
    mcs: "",
    rank: "",
    ibler: "%",
  };
  const label: Record<string, string> = {
    sinr: "SINR",
    rsrp: "RSRP",
    throughput: "吞吐量",
    mcs: "MCS",
    rank: "Rank",
    ibler: "IBLER",
  };
  const cdf = (
    <Chart
      title="指标分布 CDF"
      data={(compare ? runs : [run]).map((r, i) => {
        const values = r.users
          .filter((u) => !cell || u.cell === cell)
          .map((u) => u[metric as keyof User] as number)
          .sort((a, b) => a - b);
        return {
          x: values,
          y: values.map((_, i) => (i + 1) / values.length),
          type: "scatter",
          mode: "lines",
          name: r.name,
          line: { color: colors[i % 4], width: 2.5, shape: "hv" },
        };
      })}
      layout={{
        xaxis: {
          title: { text: `${label[metric]} ${units[metric]}` },
          gridcolor: "#213143",
        },
        yaxis: {
          title: { text: "累计概率" },
          range: [0, 1],
          gridcolor: "#213143",
        },
      }}
    />
  );
  const map = (
    <Chart
      title="用户空间分布"
      data={[
        {
          x: filtered.map((u) => u.x),
          y: filtered.map((u) => u.y),
          text: filtered.map(
            (u) =>
              `UE ${u.id} · Cell ${u.cell}<br>SINR ${u.sinr.toFixed(1)} dB`,
          ),
          type: "scatter",
          mode: "markers",
          marker: {
            size: filtered.map((u) => (u.id === user?.id ? 16 : 8)),
            color: filtered.map((u) => u.sinr),
            colorscale: [
              [0, "#325a93"],
              [0.5, "#3ab2be"],
              [1, "#74f4c5"],
            ],
            line: { width: 1, color: "#132334" },
          },
          hovertemplate: "%{text}<extra></extra>",
          name: "用户",
        },
        {
          x: [0],
          y: [0],
          mode: "markers",
          type: "scatter",
          marker: { symbol: "triangle-up", size: 17, color: "#ffffff" },
          name: "站点",
        },
      ]}
      layout={{
        showlegend: false,
        xaxis: { title: { text: "东向 / m" }, gridcolor: "#213143" },
        yaxis: {
          title: { text: "北向 / m" },
          scaleanchor: "x",
          gridcolor: "#213143",
        },
      }}
    />
  );
  const timeMetric = metric === "rsrp" ? "sinr" : metric;
  const time = (
    <Chart
      title="用户时序"
      data={[
        {
          x: user?.samples
            .filter((s) => s.slot >= start && s.slot <= end)
            .map((s) => s.slot),
          y: user?.samples
            .filter((s) => s.slot >= start && s.slot <= end)
            .map((s) =>
              timeMetric === "ibler"
                ? s.scheduled
                  ? Number(s.error) * 100
                  : null
                : timeMetric === "sinr"
                  ? s.sinr
                  : s.scheduled
                    ? s[timeMetric as "mcs" | "rank" | "throughput"]
                    : null,
            ),
          type: "scatter",
          mode: "lines",
          connectgaps: false,
          line: {
            color: colors[0],
            width: 2,
            shape: ["mcs", "rank", "ibler"].includes(timeMetric)
              ? "hv"
              : "linear",
          },
          name: `UE ${user?.id}`,
        },
      ]}
      layout={{
        xaxis: { title: { text: "Slot" }, gridcolor: "#213143" },
        yaxis: {
          title: { text: `${label[timeMetric]} ${units[timeMetric]}` },
          gridcolor: "#213143",
        },
      }}
    />
  );
  function exportCsv() {
    const keys = [
      "id",
      "cell",
      "rsrp",
      "sinr",
      "mcs",
      "rank",
      "ibler",
      "throughput",
    ] as const;
    download(
      "user-metrics.csv",
      "\uFEFF" +
        [
          keys.join(","),
          ...filtered.map((u) => keys.map((k) => u[k]).join(",")),
        ].join("\n"),
      "text/csv;charset=utf-8",
    );
  }
  const geometryValid = !error;
  const channels = geometryValid
    ? (config.rows / config.group) * config.cols * 2
    : 0;
  function gain(theta: number, phi: number) {
    const rad = Math.PI / 180;
    let re = 0,
      im = 0;
    const nr = patternMode === "子阵" ? config.group : config.rows,
      nc = patternMode === "子阵" ? 1 : config.cols;
    for (let r = 0; r < nr; r++)
      for (let c = 0; c < nc; c++) {
        const phase =
          2 *
          Math.PI *
          config.spacing *
          (r * (Math.sin(theta * rad) + Math.sin(config.tilt * rad)) +
            c *
              (Math.sin(phi * rad) * Math.cos(theta * rad) -
                Math.sin(scan * rad)));
        re += Math.cos(phase);
        im += Math.sin(phase);
      }
    const element =
      8 - Math.min(12 * (theta / 65) ** 2 + 12 * (phi / 65) ** 2, 30);
    return Math.max(
      -40,
      element +
        10 * Math.log10(Math.max(1e-8, (re * re + im * im) / (nr * nc))),
    );
  }
  const angles = Array.from({ length: 181 }, (_, i) => i - 90),
    phis = Array.from({ length: 61 }, (_, i) => i * 3 - 90),
    thetas = Array.from({ length: 41 }, (_, i) => i * 3 - 60);
  return (
    <>
      <header>
        <div className="brand">
          <div className="brand-icon">
            <Radio size={25} />
          </div>
          <div>
            ARRAY<span>LAB</span>
            <small>AAU SYSTEM DESIGN STUDIO</small>
          </div>
        </div>
        <nav>
          <button
            className={tab === "antenna" ? "active" : ""}
            onClick={() => setTab("antenna")}
          >
            <Radio size={17} />
            天线阵列与方向图
          </button>
          <button
            className={tab === "system" ? "active" : ""}
            onClick={() => setTab("system")}
          >
            <Activity size={17} />
            系统仿真
          </button>
        </nav>
        <div className="env">
          <i />
          本地工作空间 <span>v0.1</span>
        </div>
      </header>
      <div className="workspace-title">
        <div>
          <div className="eyebrow">
            DESIGN /{" "}
            {tab === "system" ? "SYSTEM SIMULATION" : "ANTENNA EXPLORER"}
          </div>
          <h1>
            {tab === "system" ? "系统仿真工作台" : "探索你的阵面设计"}
            <span className="badge">示例数据</span>
          </h1>
          <p>
            {tab === "system"
              ? "从天面架构到无线性能，让每一个设计决策有迹可循。"
              : "连接物理阵子与数字通道，交互观察波束与阵列形态。"}
          </p>
        </div>
        <div className="toolbar">
          <button onClick={() => fileRef.current?.click()}>
            <Upload size={15} />
            导入配置
          </button>
          <button
            onClick={() =>
              download(
                "simulation-config.json",
                JSON.stringify(config, null, 2),
              )
            }
          >
            <Download size={15} />
            导出配置
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".json"
            onChange={(e) => importConfig(e.target.files?.[0])}
          />
        </div>
      </div>
      <main>
        <aside>
          <div className="sidebar-heading">
            <SlidersHorizontal size={17} />
            <b>参数配置</b>
            <button
              className="icon"
              aria-label="恢复默认"
              onClick={() => {
                setConfig(defaults);
                setMessage("已恢复默认配置");
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <div className="segmented">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                className={expert === v ? "selected" : ""}
                onClick={() => setExpert(v)}
              >
                {v ? "Expert" : "Beginner"}
              </button>
            ))}
          </div>
          <div className="config-scroll">
            <div className="group-title">
              01 / {tab === "system" ? "部署与无线参数" : "物理阵面"}
            </div>
            <div className="fields">
              {(tab === "system"
                ? ["frequency", "bandwidth", "isd", "users", "power", "slots"]
                : ["frequency", "rows", "cols", "group", "tilt"]
              ).map(numberField)}
            </div>
            {tab === "system" ? (
              <>
                <button
                  className="array-summary"
                  onClick={() => setTab("antenna")}
                >
                  <Layers size={17} />
                  <span>
                    <b>
                      {config.rows} × {config.cols} 双极化阵列
                    </b>
                    <small>
                      {channels || "—"} 通道 · 每通道 {config.group} 阵子
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <div className="note">
                双极化独立馈电 · 垂直连续分组
                <br />
                阵子数：{config.rows * config.cols} · 极化端口数：
                {config.rows * config.cols * 2}
              </div>
            )}
            {expert && (
              <>
                <div className="group-title">02 / 高级设置</div>
                <div className="fields">
                  {(tab === "system"
                    ? ["noise", "target", "seed"]
                    : ["spacing"]
                  ).map(numberField)}
                </div>
                {tab === "system" && (
                  <>
                    {renderSelect("scenario", "传播场景", [
                      "UMa",
                      "UMi",
                      "RMa",
                    ])}
                    {renderSelect("scheduler", "调度算法", [
                      "PF",
                      "Round Robin",
                    ])}
                    {renderSelect("csi", "信道信息", ["理想 CSI", "SRS 估计"])}
                    <div className="note">
                      算法与 CSI 为配置占位，首版未执行对应仿真。
                    </div>
                  </>
                )}
              </>
            )}
            <div className="note">
              <Info size={14} />{" "}
              {tab === "system"
                ? "固定种子生成合成记录，结果不代表真实系统性能。"
                : "标准阵子模型 × 理想阵列因子；未计互耦、馈电损耗。"}
            </div>
          </div>
          <div className="run-footer">
            {error && <div className="error">{error}</div>}
            <button
              className="primary"
              disabled={!!error || busy}
              onClick={execute}
            >
              <Play size={15} />
              {busy ? "正在生成…" : "生成示例结果"}
            </button>
            <small>LOCAL DEMO · 非 Sionna 仿真</small>
          </div>
        </aside>
        <article>
          {tab === "system" ? (
            <>
              <div className="result-top">
                <div>
                  <span className="status-dot" /> 实验结果{" "}
                  <select
                    aria-label="当前实验"
                    value={run.id}
                    onChange={(e) => setRunId(e.target.value)}
                  >
                    {runs.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <span className={stale ? "stale" : "muted"}>
                    {stale
                      ? "配置已变化 · 需重新生成"
                      : `已完成 · ${run.created}`}
                  </span>
                </div>
                <span className="muted">
                  {run.config.users} UEs / {run.config.slots} slots
                </span>
              </div>
              <div className="kpis">
                {[
                  [
                    "平均 SINR",
                    mean(filtered.map((u) => u.sinr)).toFixed(1),
                    "dB",
                    "无线链路质量",
                  ],
                  [
                    "平均 RSRP",
                    mean(filtered.map((u) => u.rsrp)).toFixed(1),
                    "dBm",
                    "参考信号接收功率",
                  ],
                  [
                    "用户平均吞吐量",
                    mean(filtered.map((u) => u.throughput)).toFixed(1),
                    "Mbps",
                    "包含未调度时隙",
                  ],
                  [
                    "首次传输错误率",
                    mean(filtered.map((u) => u.ibler)).toFixed(1),
                    "%",
                    "IBLER · 用户均值",
                  ],
                ].map(([name, value, unit, desc], i) => (
                  <div className="kpi" key={name}>
                    <div>
                      {name}
                      <Activity size={14} color={colors[i]} />
                    </div>
                    <strong>
                      {value}
                      <small>{unit}</small>
                    </strong>
                    <footer>
                      <span style={{ background: colors[i] }} />
                      {desc}
                    </footer>
                  </div>
                ))}
              </div>
              <div className="analysis-bar">
                <div className="subtabs">
                  {["概览", "指标表", "CDF", "时序"].map((v) => (
                    <button
                      className={view === v ? "active" : ""}
                      key={v}
                      onClick={() => setView(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="filters">
                  <select
                    aria-label="小区筛选"
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
                  <select
                    aria-label="用户选择"
                    value={user?.id || ""}
                    onChange={(e) => setUid(Number(e.target.value))}
                  >
                    {filtered.map((u) => (
                      <option key={u.id} value={u.id}>
                        UE {String(u.id).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(view === "CDF" || view === "时序") && (
                <div className="chart-controls">
                  <span>分析指标</span>
                  <select
                    aria-label="分析指标"
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                  >
                    {Object.keys(label)
                      .filter((k) => view !== "时序" || k !== "rsrp")
                      .map((k) => (
                        <option value={k} key={k}>
                          {label[k]}
                        </option>
                      ))}
                  </select>
                  {view === "CDF" ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={compare}
                        onChange={(e) => setCompare(e.target.checked)}
                      />
                      叠加历史实验
                    </label>
                  ) : (
                    <>
                      <label>
                        起始 slot{" "}
                        <input
                          aria-label="起始 slot"
                          type="number"
                          min={0}
                          max={end}
                          value={start}
                          onChange={(e) =>
                            setStart(
                              Math.max(
                                0,
                                Math.min(end, Number(e.target.value)),
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        结束 slot{" "}
                        <input
                          aria-label="结束 slot"
                          type="number"
                          min={start}
                          max={run.config.slots - 1}
                          value={Math.min(end, run.config.slots - 1)}
                          onChange={(e) =>
                            setEnd(
                              Math.max(
                                start,
                                Math.min(
                                  run.config.slots - 1,
                                  Number(e.target.value),
                                ),
                              ),
                            )
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
              )}
              {view === "概览" ? (
                <>
                  <div className="two-col">
                    <Panel title="用户空间分布" tag="颜色 / SINR">
                      {map}
                    </Panel>
                    <Panel title="SINR 累积分布" tag="CDF">
                      <Chart
                        title="SINR CDF"
                        data={[
                          {
                            x: filtered
                              .map((u) => u.sinr)
                              .sort((a, b) => a - b),
                            y: filtered.map(
                              (_, i) => (i + 1) / filtered.length,
                            ),
                            type: "scatter",
                            mode: "lines",
                            line: { color: colors[0], width: 3, shape: "hv" },
                            fill: "tozeroy",
                            fillcolor: "rgba(71,223,202,.06)",
                          },
                        ]}
                        layout={{
                          xaxis: {
                            title: { text: "SINR / dB" },
                            gridcolor: "#213143",
                          },
                          yaxis: {
                            range: [0, 1],
                            title: { text: "累计概率" },
                            gridcolor: "#213143",
                          },
                        }}
                      />
                    </Panel>
                  </div>
                  <Panel title={`UE ${user?.id} · SINR 时序`} tag="逐 slot">
                    <Chart
                      title="SINR 时间曲线"
                      data={[
                        {
                          x: user?.samples.map((s) => s.slot),
                          y: user?.samples.map((s) => s.sinr),
                          type: "scatter",
                          mode: "lines",
                          line: { color: colors[1], width: 2 },
                        },
                      ]}
                      height={230}
                      layout={{
                        xaxis: {
                          title: { text: "Slot" },
                          gridcolor: "#213143",
                        },
                        yaxis: {
                          title: { text: "SINR / dB" },
                          gridcolor: "#213143",
                        },
                      }}
                    />
                  </Panel>
                </>
              ) : view === "CDF" ? (
                <Panel
                  title={`${label[metric]} 累积分布`}
                  tag="悬停读取 · 框选缩放"
                >
                  {cdf}
                </Panel>
              ) : view === "时序" ? (
                <Panel
                  title={`UE ${user?.id} · ${label[timeMetric]}`}
                  tag="未调度记录显示为空缺"
                >
                  {time}
                </Panel>
              ) : (
                <Panel title="用户指标明细" tag="点击表头排序">
                  <div className="table-toolbar">
                    <span>汇总值：MCS / Rank 为已调度样本均值</span>
                    <button onClick={exportCsv}>
                      <Download size={14} />
                      导出 CSV
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {[
                            ["id", "用户"],
                            ["cell", "小区"],
                            ["rsrp", "RSRP / dBm"],
                            ["sinr", "SINR / dB"],
                            ["mcs", "平均 MCS"],
                            ["rank", "平均 Rank"],
                            ["ibler", "IBLER / %"],
                            ["throughput", "吞吐量 / Mbps"],
                          ].map(([k, v]) => (
                            <th key={k}>
                              <button
                                onClick={() => {
                                  setSort(k);
                                  setDescending(
                                    sort === k ? !descending : false,
                                  );
                                }}
                              >
                                {v}
                                {sort === k ? (descending ? " ↓" : " ↑") : ""}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...filtered]
                          .sort(
                            (a, b) =>
                              ((a[sort as keyof User] as number) -
                                (b[sort as keyof User] as number)) *
                              (descending ? -1 : 1),
                          )
                          .map((u) => (
                            <tr
                              className={u.id === user?.id ? "chosen" : ""}
                              key={u.id}
                              onClick={() => setUid(u.id)}
                            >
                              {[
                                u.id,
                                u.cell,
                                u.rsrp,
                                u.sinr,
                                u.mcs,
                                u.rank,
                                u.ibler,
                                u.throughput,
                              ].map((v, i) => (
                                <td key={i}>
                                  {i === 0
                                    ? `UE ${String(v).padStart(2, "0")}`
                                    : i === 1
                                      ? `Cell ${v}`
                                      : v.toFixed(1)}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
              <div className="bottom-note">
                <Info size={13} />
                IBLER：首次传输 TB 错误率。示例无 HARQ 协议；Rank 与 MCS
                为合成记录。配置仅部分参与数据生成。
              </div>
            </>
          ) : (
            <>
              <div className="result-top">
                <div>
                  <span className="status-dot" />
                  阵列设计预览
                </div>
                <span className="muted">
                  {config.frequency} GHz · {channels || "—"} RF 通道
                </span>
              </div>
              {!geometryValid ? (
                <div className="error">请先修正左侧配置：{error}</div>
              ) : (
                <>
                  <div className="two-col">
                    <Panel
                      title="阵面与通道映射"
                      tag="每个点代表一个双极化阵子"
                    >
                      <Chart
                        title="阵面结构"
                        height={350}
                        data={Array.from(
                          {
                            length: config.cols * (config.rows / config.group),
                          },
                          (_, g) => {
                            const col = Math.floor(
                                g / (config.rows / config.group),
                              ),
                              block = g % (config.rows / config.group);
                            return {
                              x: Array(config.group).fill(col * config.spacing),
                              y: Array.from(
                                { length: config.group },
                                (_, r) =>
                                  (block * config.group + r) * config.spacing,
                              ),
                              type: "scatter",
                              mode: "markers",
                              name: `分组 ${g + 1}`,
                              text: Array.from(
                                { length: config.group },
                                (_, r) =>
                                  `行 ${block * config.group + r + 1} / 列 ${col + 1}<br>极化 ±45° · 两路独立通道`,
                              ),
                              hovertemplate:
                                "%{text}<extra>%{fullData.name}</extra>",
                              marker: {
                                symbol: "square",
                                size: 11,
                                color: colors[g % 4],
                              },
                            };
                          },
                        )}
                        layout={{
                          showlegend: false,
                          xaxis: {
                            title: { text: "水平位置 / λ" },
                            gridcolor: "#213143",
                          },
                          yaxis: {
                            title: { text: "垂直位置 / λ" },
                            scaleanchor: "x",
                            gridcolor: "#213143",
                          },
                        }}
                      />
                    </Panel>
                    <Panel title="三维方向图" tag="理想模型 · dBi">
                      <Chart
                        title="三维方向图"
                        height={350}
                        data={[
                          {
                            type: "surface",
                            x: thetas.map((t) =>
                              phis.map((p) => {
                                const r = Math.pow(10, gain(t, p) / 20);
                                return (
                                  r *
                                  Math.cos((t * Math.PI) / 180) *
                                  Math.cos((p * Math.PI) / 180)
                                );
                              }),
                            ),
                            y: thetas.map((t) =>
                              phis.map(
                                (p) =>
                                  Math.pow(10, gain(t, p) / 20) *
                                  Math.cos((t * Math.PI) / 180) *
                                  Math.sin((p * Math.PI) / 180),
                              ),
                            ),
                            z: thetas.map((t) =>
                              phis.map(
                                (p) =>
                                  Math.pow(10, gain(t, p) / 20) *
                                  Math.sin((t * Math.PI) / 180),
                              ),
                            ),
                            surfacecolor: thetas.map((t) =>
                              phis.map((p) => gain(t, p)),
                            ),
                            colorscale: [
                              [0, "#172b4b"],
                              [0.5, "#348da9"],
                              [1, "#63efd1"],
                            ],
                            showscale: false,
                          },
                        ]}
                        layout={{
                          scene: {
                            bgcolor: "transparent",
                            xaxis: { title: "前向", showgrid: false },
                            yaxis: { title: "水平", showgrid: false },
                            zaxis: { title: "垂直", showgrid: false },
                            aspectmode: "data",
                          },
                          margin: { l: 0, r: 0, t: 0, b: 0 },
                        }}
                      />
                    </Panel>
                  </div>
                  <div className="chart-controls">
                    <span>方向图模式</span>
                    <select
                      aria-label="方向图模式"
                      value={patternMode}
                      onChange={(e) => setPatternMode(e.target.value)}
                    >
                      <option>整阵</option>
                      <option>子阵</option>
                    </select>
                    <label>
                      水平扫描角 {scan}°{" "}
                      <input
                        aria-label="水平扫描角"
                        type="range"
                        min={-60}
                        max={60}
                        value={scan}
                        onChange={(e) => setScan(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <Panel title="方向图切面" tag="绝对增益 · 非归一化">
                    <Chart
                      title="方向图切面"
                      data={[
                        {
                          x: angles,
                          y: angles.map((p) => gain(-config.tilt, p)),
                          name: "水平切面",
                          type: "scatter",
                          mode: "lines",
                          line: { color: colors[0], width: 2 },
                        },
                        {
                          x: angles,
                          y: angles.map((t) => gain(t, scan)),
                          name: "垂直切面",
                          type: "scatter",
                          mode: "lines",
                          line: { color: colors[1], width: 2 },
                        },
                      ]}
                      layout={{
                        xaxis: {
                          title: { text: "角度 / °" },
                          gridcolor: "#213143",
                        },
                        yaxis: {
                          title: { text: "增益 / dBi" },
                          range: [-40, 40],
                          gridcolor: "#213143",
                        },
                      }}
                    />
                  </Panel>
                  <div className="bottom-note">
                    <Info size={13} />
                    双极化分别建模；曲线展示单极化理想阵列。三维图以场幅度为径向尺度，颜色为
                    dBi。
                  </div>
                </>
              )}
            </>
          )}
        </article>
      </main>
      <footer className="app-footer">
        <span>
          <TowerControl size={13} /> ARRAY LAB / SIONNA WORKSPACE
        </span>
        <span>交互原型 · 本地运行 · 所有系统结果均为示例</span>
      </footer>
      {message && (
        <div className="toast" role="status">
          <Check size={16} />
          {message}
          <button aria-label="关闭提示" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
