import { useEffect, useRef, useState } from 'react';
import {
  runExtinctionExperiments, runSootExperiments, runSpreadExperiments,
  SPICE_CORRELATION,
  type ExtinctionBatch, type SpreadBatch, type SootBatch,
} from '../data/virtualExperiments';
import type { ModelTrackId } from '../data/modelLab';

export type VirtualExperimentBatch = ExtinctionBatch | SpreadBatch | SootBatch;
type Batch = VirtualExperimentBatch;

interface VirtualExperimentPanelProps {
  trackId: ModelTrackId;
  autoRunInitial?: boolean;
  onBatchComplete?: (trackId: ModelTrackId, batch: VirtualExperimentBatch) => void;
  onBatchReset?: () => void;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="ml-exp-metric"><span>{label}</span><b>{value}</b>{note && <small>{note}</small>}</div>;
}

function RunCount({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <label>Experiment count<select value={value} onChange={(event) => onChange(Number(event.target.value))}>{[10, 25, 50, 100].map((count) => <option key={count} value={count}>{count} virtual cases</option>)}</select></label>;
}

const SEGMENT_COLORS = ['#66d9f2', '#f3b65a', '#76c7a3', '#e66a52', '#c4b6e8'];

function BatchCurvePlot({
  points,
  xLabel,
  yLabel,
  xUnit,
  yUnit,
  accent,
}: {
  points: { x: number; y: number; tip: string }[];
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  accent: string;
}) {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const minX = Math.min(...sorted.map((p) => p.x));
  const maxX = Math.max(...sorted.map((p) => p.x));
  const minY = Math.min(...sorted.map((p) => p.y));
  const maxY = Math.max(...sorted.map((p) => p.y));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const w = 520, h = 156, padL = 48, padR = 16, padT = 16, padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const coords = sorted.map((p) => ({
    cx: padL + ((p.x - minX) / spanX) * plotW,
    cy: padT + plotH - ((p.y - minY) / spanY) * plotH,
    tip: p.tip,
  }));
  const poly = coords.map((c) => `${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ');
  return (
    <div className="ml-exp-plot-wrap">
      <div className="ml-exp-plot-head">
        <span>{yLabel} ({yUnit}) vs. {xLabel} ({xUnit})</span>
        <span>{sorted.length} sampled points</span>
      </div>
      <svg className="ml-exp-plot" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${yLabel} versus ${xLabel} chart`}>
        {[0, 0.5, 1].map((t) => {
          const y = padT + plotH - t * plotH;
          const val = minY + t * spanY;
          return (
            <g key={t}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} className="ml-plot-grid" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="ml-plot-tick">{val.toFixed(yUnit === 'mm/s' ? 2 : 1)}</text>
            </g>
          );
        })}
        {[0, 0.5, 1].map((t) => {
          const x = padL + t * plotW;
          const val = minX + t * spanX;
          return <text key={t} x={x} y={h - 8} textAnchor="middle" className="ml-plot-tick">{val.toFixed(1)} {xUnit}</text>;
        })}
        <polyline fill="none" stroke={accent} strokeWidth="1.6" strokeOpacity="0.65" points={poly} />
        {coords.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r="3.4" fill={accent} stroke="#070b14" strokeWidth="1">
            <title>{c.tip}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export function VirtualExperimentPanel({ trackId, autoRunInitial = true, onBatchComplete, onBatchReset }: VirtualExperimentPanelProps) {
  const [count, setCount] = useState(25);
  const [fuel, setFuel] = useState('Methanol');
  const [pressureMin, setPressureMin] = useState(500);
  const [pressureMax, setPressureMax] = useState(760);
  const [oxygenMin, setOxygenMin] = useState(0.18);
  const [oxygenMax, setOxygenMax] = useState(0.3);
  const [diameterMin, setDiameterMin] = useState(1.2);
  const [diameterMax, setDiameterMax] = useState(2.4);
  const [thickness, setThickness] = useState(3);
  const [width, setWidth] = useState(1.2);
  const [sides, setSides] = useState<1 | 2>(1);
  const [flowMin, setFlowMin] = useState(5.4);
  const [flowMax, setFlowMax] = useState(21);
  const [sootFuel, setSootFuel] = useState('ethylene');
  const [burnerDiameter, setBurnerDiameter] = useState(0.76);
  const [result, setResult] = useState<Batch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const onBatchCompleteRef = useRef(onBatchComplete);
  const onBatchResetRef = useRef(onBatchReset);
  onBatchCompleteRef.current = onBatchComplete;
  onBatchResetRef.current = onBatchReset;

  const run = async () => {
    setBusy(true); setError('');
    setResult(null);
    onBatchResetRef.current?.();
    try {
      // Let the running state paint before local parsing and calculation begin.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 520));
      const finiteRange = (min: number, max: number, low: number, high: number, label: string) => {
        if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error(`${label}: enter finite minimum and maximum values, with minimum no greater than maximum.`);
        if (min < low || max > high) throw new Error(`${label} must stay within the observed or published range ${low}–${high}.`);
      };
      if (trackId === 'extinction') {
        finiteRange(pressureMin, pressureMax, 0, 2319.9, 'Ambient pressure (mmHg)');
        finiteRange(oxygenMin, oxygenMax, 0.12, 0.34, 'Initial oxygen fraction');
        finiteRange(diameterMin, diameterMax, 1.1, 4.67, 'Initial droplet diameter (mm)');
      }
      if (trackId === 'spread') {
        if (!Number.isFinite(thickness) || thickness < 1 || thickness > 5) throw new Error('PMMA thickness must stay within the BASS-II range of 1–5 mm.');
        if (![1.2, 2.2].includes(width)) throw new Error('Select one of the BASS-II sample widths: 1.2 or 2.2 cm.');
        if (flowMin > flowMax || flowMin < 2 || flowMax > 21) throw new Error('Opposed airflow must stay within the BASS-II range of 2–21 cm/s, with minimum no greater than maximum.');
      }
      if (trackId === 'soot-smoke' && (flowMin > flowMax || flowMin < 5.4 || flowMax > 65)) throw new Error('SPICE coflow must stay within the published 5.4–65 cm/s range, with minimum no greater than maximum.');
      const batch = trackId === 'extinction'
        ? await runExtinctionExperiments({ fuel, pressureMin, pressureMax, oxygenMin, oxygenMax, diameterMin, diameterMax, count })
        : trackId === 'spread'
          ? await runSpreadExperiments({ thickness, width, sides, flowMin, flowMax, count })
          : runSootExperiments({ fuelId: sootFuel, diameter: burnerDiameter, flowMin: Math.max(5.4, flowMin), flowMax: Math.min(65, flowMax), count });
      setResult(batch);
      onBatchCompleteRef.current?.(trackId, batch);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The experiment batch could not run.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (autoRunInitial) void run(); }, [trackId, autoRunInitial]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearResults = () => { setResult(null); onBatchResetRef.current?.(); };

  return <section className="ml-experiment" aria-labelledby="ml-experiment-title">
    <div className="ml-exp-heading"><div><span className="ml-eyebrow">VIRTUAL EXPERIMENT AGENT · LOCAL COMPUTATION</span><h2 id="ml-experiment-title">Set conditions. Run a batch.</h2><p>Runs a reproducible sweep against the selected research evidence. Results are calculated in your browser; no account, API key, or external service is used.</p></div><span className={`ml-exp-pulse${busy ? ' is-running' : ''}`} aria-live="polite"><i />{busy ? 'RUNNING LOCAL SWEEP' : 'READY TO RUN'}</span></div>
    <div className="ml-exp-body">
      <form className="ml-exp-controls" onChange={clearResults} onSubmit={(event) => { event.preventDefault(); void run(); }}>
        {trackId === 'extinction' ? <>
          <label>Fuel<select value={fuel} onChange={(event) => setFuel(event.target.value)}>{['Methanol', 'Heptane'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Ambient pressure · min (mmHg)<input type="number" value={pressureMin} min="0" max="2319.9" step="10" onChange={(event) => setPressureMin(Number(event.target.value))} /></label>
          <label>Ambient pressure · max (mmHg)<input type="number" value={pressureMax} min="0" max="2319.9" step="10" onChange={(event) => setPressureMax(Number(event.target.value))} /></label>
          <label>Initial O₂ · min (mole fraction)<input type="number" value={oxygenMin} min="0.12" max="0.34" step="0.01" onChange={(event) => setOxygenMin(Number(event.target.value))} /></label>
          <label>Initial O₂ · max (mole fraction)<input type="number" value={oxygenMax} min="0.12" max="0.34" step="0.01" onChange={(event) => setOxygenMax(Number(event.target.value))} /></label>
          <label>Droplet diameter · min (mm)<input type="number" value={diameterMin} min="1.1" max="4.67" step="0.1" onChange={(event) => setDiameterMin(Number(event.target.value))} /></label>
          <label>Droplet diameter · max (mm)<input type="number" value={diameterMax} min="1.1" max="4.67" step="0.1" onChange={(event) => setDiameterMax(Number(event.target.value))} /></label>
        </> : trackId === 'spread' ? <>
          <label>Material<select value="PMMA · BASS-II" disabled><option>PMMA · BASS-II</option></select></label>
          <label className="ml-exp-range-label">
            <span>Thickness (mm) · <b>{thickness}</b></span>
            <div className="ml-exp-range-row">
              <input type="range" value={thickness} min="1" max="5" step="0.5" aria-label="Thickness slider" onChange={(event) => setThickness(Number(event.target.value))} />
              <input type="number" value={thickness} min="1" max="5" step="0.5" onChange={(event) => setThickness(Number(event.target.value))} />
            </div>
          </label>
          <label>Sample width (cm)<select value={width} onChange={(event) => setWidth(Number(event.target.value))}><option value="1.2">1.2</option><option value="2.2">2.2</option></select></label>
          <label>Burning sides<select value={sides} onChange={(event) => setSides(Number(event.target.value) as 1 | 2)}><option value="1">One side</option><option value="2">Two sides</option></select></label>
          <label>Opposed airflow · min (cm/s)<input type="number" value={flowMin} min="2" max="21" step="0.1" onChange={(event) => setFlowMin(Number(event.target.value))} /></label>
          <label>Opposed airflow · max (cm/s)<input type="number" value={flowMax} min="2" max="21" step="0.1" onChange={(event) => setFlowMax(Number(event.target.value))} /></label>
        </> : <>
          <label>Fuel<select value={sootFuel} onChange={(event) => setSootFuel(event.target.value)}>{SPICE_CORRELATION.fuels.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label>Burner diameter (mm)<select value={burnerDiameter} onChange={(event) => setBurnerDiameter(Number(event.target.value))}>{[0.41, 0.76, 1.6].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Coflow velocity · min (cm/s)<input type="number" value={Math.max(5.4, flowMin)} min="5.4" max="65" step="0.1" onChange={(event) => setFlowMin(Number(event.target.value))} /></label>
          <label>Coflow velocity · max (cm/s)<input type="number" value={Math.min(65, flowMax)} min="5.4" max="65" step="0.1" onChange={(event) => setFlowMax(Number(event.target.value))} /></label>
        </>}
        <RunCount value={count} onChange={setCount} />
        <button className="ml-exp-run" type="submit" disabled={busy}>{busy ? 'Running batch…' : `Run ${count} experiments`} <span aria-hidden="true">↗</span></button>
      </form>
      <div className="ml-exp-results" aria-live="polite">
        {error ? <div className="ml-exp-error" role="alert">{error}</div> : !result ? <div className={`ml-exp-pending${busy ? ' is-running' : ''}`} role={busy ? 'status' : undefined}>{busy && <i aria-hidden="true"/>}{busy ? 'Sampling conditions and calculating the local FLEX batch…' : 'Choose conditions, then run the batch to see refreshed outputs.'}</div> : trackId === 'extinction' && 'labelSummary' in result ? <>
          <div className="ml-exp-result-title"><span>CASE BASED · FLEX PSI-69</span><b>{result.experiments.length} parameter cases</b></div>
          <div className="ml-exp-metrics"><Metric label="Source observations" value={result.trainingRows.toLocaleString()} note="Complete FLEX rows"/><Metric label="FLEX test IDs" value={String(result.evaluation.groups)} note="In complete-case rows"/><Metric label="Dataset accuracy" value={`${((result.evaluation.accuracy ?? 0) * 100).toFixed(1)}%`} note="Leave one test ID out"/><Metric label="Macro F1" value={(result.evaluation.macroF1 ?? 0).toFixed(3)} note="Same grouped folds"/></div>
          <p className="ml-exp-caveat">The accuracy and F1 are fixed dataset-level diagnostics for this method, so they stay the same across parameter batches. The label distribution and case table below respond to your selected conditions. FLEX test IDs are candidate groups; independence still needs source confirmation.</p>
          <p className="ml-exp-caveat">Outputs are neighbor-weighted shares of the literal <code>Test end</code> labels. They do not mean extinction probability; the source event semantics are not verified.</p>
          <div className="ml-exp-bars">{result.labelSummary.map((item, idx) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.share * 100}%`, background: SEGMENT_COLORS[idx % SEGMENT_COLORS.length] }}/></i><strong>{item.count}</strong></div>)}</div>
          <details className="ml-exp-table-details">
            <summary>Inspect sampled cases ({Math.min(8, result.experiments.length)} rows) ▾</summary>
            <div className="ml-exp-table-wrap"><table className="ml-exp-table"><thead><tr><th>Case</th><th>Pressure</th><th>O₂</th><th>Droplet</th><th>Estimated source label</th><th>Nearest FLEX tests</th></tr></thead><tbody>{result.experiments.slice(0, 8).map((item, i) => <tr key={i}><td>{String(i + 1).padStart(2, '0')}</td><td>{item.pressure.toFixed(0)} mmHg</td><td>{item.oxygen.toFixed(3)}</td><td>{item.diameter.toFixed(2)} mm</td><td>{item.estimatedLabel}</td><td>{item.neighborIds.join(', ')}</td></tr>)}</tbody></table></div>
          </details>
        </> : trackId === 'spread' && 'testGroups' in result ? <>
          <div className="ml-exp-result-title"><span>EMPIRICAL NEIGHBOR MODEL · NASA BASS-II</span><b>{result.experiments.length} airflow cases</b></div>
          <div className="ml-exp-metrics"><Metric label="Measured conditions" value={String(result.trainingRows)} note="NASA Table 5.1"/><Metric label="Physical burns" value={String(result.testGroups)} note="M1–M20, numeric outcomes"/><Metric label="Grouped MAE" value={`${(result.evaluation.mae ?? 0).toFixed(3)} mm/s`} note="Leave one burn out"/><Metric label="Grouped RMSE" value={`${(result.evaluation.rmse ?? 0).toFixed(3)} mm/s`} note="Leave one burn out"/></div>
          <BatchCurvePlot
            points={result.experiments.map((item) => ({ x: item.flow, y: item.estimatedSpreadRate, tip: `${item.flow.toFixed(1)} cm/s → ${item.estimatedSpreadRate.toFixed(3)} mm/s` }))}
            xLabel="Opposed flow"
            yLabel="Spread rate"
            xUnit="cm/s"
            yUnit="mm/s"
            accent="#f3b65a"
          />
          <p className="ml-exp-caveat">Nearest-neighbor estimates are empirical interpolation over the NASA PMMA points. Oxygen is contextual in the report and excluded because its start/end values are test-level, not flow-row measurements.</p>
          <details className="ml-exp-table-details">
            <summary>View sampled bar breakdown ({Math.min(12, result.experiments.length)} airflow cases) ▾</summary>
            <div className="ml-exp-bars ml-rate-bars">{result.experiments.slice(0, 12).map((item, i) => <div key={i}><span>{item.flow.toFixed(1)} cm/s</span><i><b style={{ width: `${Math.min(100, item.estimatedSpreadRate / 1.5 * 100)}%` }}/></i><strong>{item.estimatedSpreadRate.toFixed(3)} mm/s</strong></div>)}</div>
          </details>
          <p className="ml-exp-note">Predictions are tagged to nearest NASA burns: {result.experiments[0]?.nearestTestIds.join(', ')}. A displayed 100 mm traversal time is a simple distance ÷ rate calculation, not a NASA-reported result.</p>
        </> : trackId === 'soot-smoke' && 'source' in result ? <>
          <div className="ml-exp-result-title"><span>PUBLISHED PHYSICS CORRELATION · SPICE</span><b>{result.experiments.length} coflow conditions</b></div>
          <div className="ml-exp-metrics"><Metric label="Published smoke points" value="55" note="Dotson et al. (2011)"/><Metric label="Reported fit R²" value="0.90" note="In-sample correlation fit"/><Metric label="Mean smoke-point length" value={`${result.averageLength.toFixed(1)} mm`} note={`${result.fuelLabel} · ${burnerDiameter} mm burner`}/><Metric label="Coflow range" value={`${Math.min(...result.experiments.map((item) => item.flow)).toFixed(1)}–${Math.max(...result.experiments.map((item) => item.flow)).toFixed(1)} cm/s`} note="Sampled within paper domain"/></div>
          <BatchCurvePlot
            points={result.experiments.map((item) => ({ x: item.flow, y: item.estimatedSmokePointLength, tip: `${item.flow.toFixed(1)} cm/s → ${item.estimatedSmokePointLength.toFixed(1)} mm` }))}
            xLabel="Coflow velocity"
            yLabel="Smoke-point length"
            xUnit="cm/s"
            yUnit="mm"
            accent="#66d9f2"
          />
          <p className="ml-exp-formula">L<sub>SP</sub> = A<sub>f</sub> × d<sup>−0.910</sup> × u<sub>air</sub><sup>0.414</sup> · source-reported luminous length uncertainty ±5%; air velocity ±10%.</p>
          <details className="ml-exp-table-details">
            <summary>View sampled bar breakdown ({Math.min(12, result.experiments.length)} coflow cases) ▾</summary>
            <div className="ml-exp-bars ml-rate-bars">{result.experiments.slice(0, 12).map((item, i) => <div key={i}><span>{item.flow.toFixed(1)} cm/s</span><i><b style={{ width: `${Math.min(100, item.estimatedSmokePointLength / 80 * 100)}%` }}/></i><strong>{item.estimatedSmokePointLength.toFixed(1)} mm</strong></div>)}</div>
          </details>
          <a className="ml-exp-source-link" href={result.source.pdf} target="_blank" rel="noreferrer">Open the published SPICE paper ↗</a>
          <p className="ml-exp-caveat">This predicts luminous smoke-point length only; it is not a soot fraction, smoke mass, or detector response. The paper says the correlation does not apply to quiescent ambient air.</p>
        </> : null}
      </div>
    </div>
  </section>;
}
