type RangeRow = { species: string; n: number; petal_length_min: number; petal_length_max: number; petal_length_mean: number };
export function ResearchResultChart({ result }: { result: unknown }) {
  if (!result || typeof result !== "object") return null;
  const data = result as Record<string, unknown>;
  if (!Array.isArray(data.summary_rows) || data.summary_rows.length < 2 || data.summary_rows.length > 10 || typeof data.measurement_unit !== "string") return null;
  const rows = data.summary_rows as RangeRow[];
  if (!rows.every(r => r && typeof r.species === "string" && [r.n, r.petal_length_min, r.petal_length_max, r.petal_length_mean].every(Number.isFinite) && r.n > 0 && r.petal_length_min >= 0 && r.petal_length_max >= r.petal_length_min && r.petal_length_mean >= r.petal_length_min && r.petal_length_mean <= r.petal_length_max)) return null;
  const max = Math.ceil(Math.max(...rows.map(r => r.petal_length_max))) || 1;
  return <figure className="ev-range-chart" aria-label={`各物种花瓣长度的观测范围及均值，单位 ${data.measurement_unit}`}>
    <figcaption><strong>花瓣长度对比</strong><span>观测最小—最大值；圆点为均值 · {data.measurement_unit}</span></figcaption>
    {rows.map((row, i) => <div className="ev-range-row" key={row.species}>
      <span className="ev-range-name">{row.species.replace(/^Iris-/, "")}<small>n = {row.n}</small></span>
      <div className="ev-range-track" aria-hidden="true"><span className={`ev-range-bar tone-${i % 3}`} style={{ left: `${100 * row.petal_length_min / max}%`, width: `${100 * (row.petal_length_max - row.petal_length_min) / max}%` }} /><i style={{ left: `${100 * row.petal_length_mean / max}%` }} /></div>
      <span className="ev-range-value">{row.petal_length_min}–{row.petal_length_max}<small>均值 {row.petal_length_mean.toFixed(3)}</small></span>
    </div>)}
    <div className="ev-range-axis"><span>0</span><span>{max} {data.measurement_unit}</span></div>
    <p>范围来自本次成果中的实际观测，不是置信区间；均值差异不能单独证明分类性能或因果关系。</p>
  </figure>;
}
