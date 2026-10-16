import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
const colors = ["#47dfca", "#6e9dff", "#d59bff", "#ffbc70"];
export function Chart({
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
