import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { OverviewStarfield } from '../components/OverviewStarfield';
import {
  COMPARISON_SOURCES, EXPERIMENT_ATLAS, VARIABLE_DEFINITIONS, commonMetrics,
  compatibilityForMetric, getAtlasRecord, loadComparisonSeries,
  type ComparisonMetric, type ComparisonSeries, type Eligibility,
} from '../data/comparisonLab';

const PRESETS: { label: string; ids: string[] }[] = [
  { label: 'SAFFIRE II ↔ III', ids: ['psi-99', 'psi-100'] },
  { label: 'Three-campaign airflow', ids: ['psi-99', 'psi-100', 'psi-102'] },
  { label: 'CFI-G normal ↔ inverse', ids: ['psi-159-norm', 'psi-159-inv'] },
  { label: 'FLEX ↔ CFI-G pressure', ids: ['psi-69', 'psi-159-norm'] },
  { label: 'SAME ↔ SPICE (not comparable)', ids: ['psi-102', 'psi-107'] },
];
const FIELD_LABELS = ['campaign / investigation', 'hardware', 'materials', 'geometry', 'gravity context', 'pressure / atmosphere', 'oxygen', 'measurement scope', 'target coverage'] as const;
const RESEARCH_CONTEXT = [
  { title: 'SAFFIRE-II', kicker: '9 sample positions', text: 'NASA reports a nine-sample campaign with materials including silicone, SIBAL, PMMA and Nomex. The bundled 15-row CSV mixes sample, flow-visualization and note rows.', source: 'NASA / Large-Scale Flammability Tests', href: 'https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf?attachment=true' },
  { title: 'SAME', kicker: '30 campaign samples', text: 'NASA reports six samples each across five materials and post-flight particle / detector analyses. The supplied table has four numeric condition records, not paired detector-response measurements.', source: 'NASA PSI-102', href: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-102' },
  { title: 'SPICE', kicker: '526 flames studied', text: 'NASA describes 526 flames across microgravity and analogous ground tests. The local 469-row file is a condition index with 34 exact duplicate rows and no explicit soot or smoke-point target.', source: 'NASA PSI-107', href: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-107' },
  { title: 'FLEX', kicker: 'Droplet extinction map', text: 'NASA’s protocol varied oxygen, pressure and droplet size to map extinction limits. The bundled table has 274 records; Disruption, Extinction and Completion remain distinct source labels.', source: 'NASA PSI-69', href: 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-69' },
];

function getField(source: (typeof COMPARISON_SOURCES)[number], label: string): string | null {
  switch (label) {
    case 'campaign / investigation': return source.record.audit?.title ?? source.record.investigation.name;
    case 'hardware': return source.hardware;
    case 'materials': return source.record.materials;
    case 'geometry': return source.geometry;
    case 'gravity context': return source.gravity;
    case 'pressure / atmosphere': return source.record.id === 'psi-69' ? 'Ambient pressure recorded per FLEX row in mmHg.' : source.record.id.startsWith('psi-159') ? 'Approximate pressure recorded in bar; source definition remains caveated.' : source.record.id === 'psi-25' ? 'Initial and final gas composition are separate; final measurements are post-test.' : null;
    case 'oxygen': return source.oxygen;
    case 'measurement scope': return source.measurement;
    case 'target coverage': return source.target;
    default: return null;
  }
}

function color(index: number) { return ['#9edbed', '#e1bd84', '#c4b6e8'][index % 3]; }
function nice(value: number, digits = 3) { return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value); }
function statusClass(status: Eligibility) { return `lab-status lab-status-${status}`; }

function NASAFireEvidence() {
  return <figure className="lab-fire-evidence">
    <div className="lab-flex-explainer" role="img" aria-label="Explanatory schematic of a FLEX fuel droplet: ignition, a spherical microgravity flame, then a possible cool flame after visible flame-out.">
      <div className="lab-flex-explainer-head"><span className="lab-eyebrow">NASA FLEX · HOW A DROPLET BURNS</span><span>EXPLANATORY SCHEMATIC</span></div>
      <svg className="lab-flex-diagram" viewBox="0 0 600 190" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="flexFlameGlow"><stop stopColor="#fff0bc" stopOpacity=".92"/><stop offset=".35" stopColor="#ff9a42" stopOpacity=".62"/><stop offset="1" stopColor="#ff6b2d" stopOpacity="0"/></radialGradient>
          <radialGradient id="flexCoolGlow"><stop stopColor="#ffc477" stopOpacity=".64"/><stop offset="1" stopColor="#ef7d48" stopOpacity="0"/></radialGradient>
          <marker id="flexArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 7 3.5 0 7" fill="none" stroke="#8ea4aa" strokeWidth="1"/></marker>
        </defs>
        <path className="lab-flex-flow" d="M144 79h100M355 79h98" fill="none" stroke="#81959c" strokeWidth="1" strokeDasharray="3 5" markerEnd="url(#flexArrow)"/>
        <g className="lab-flex-phase lab-flex-phase-one">
          <circle cx="90" cy="79" r="43" fill="url(#flexFlameGlow)" opacity=".52"/>
          <path d="M90 35c-17 18-22 30-16 42 5 10 18 14 28 7 13-9 8-25-12-49z" fill="#ffad58" opacity=".78"/>
          <ellipse cx="90" cy="80" rx="10" ry="14" fill="#f3d5a1" stroke="#ffe5ba" strokeWidth="1.2"/>
          <circle className="lab-flex-spark" cx="90" cy="23" r="2.5" fill="#fff2ca"/>
          <text x="90" y="145" textAnchor="middle" className="lab-flex-label">1 · IGNITE</text>
          <text x="90" y="161" textAnchor="middle" className="lab-flex-note">spark lights fuel droplet</text>
        </g>
        <g className="lab-flex-phase lab-flex-phase-two">
          <circle cx="300" cy="79" r="58" fill="url(#flexFlameGlow)"/>
          <circle className="lab-flex-flame-ring" cx="300" cy="79" r="37" fill="none" stroke="#ffb25b" strokeWidth="2"/>
          <circle cx="300" cy="79" r="22" fill="none" stroke="#f28f48" strokeWidth="1" strokeDasharray="2 4"/>
          <ellipse cx="300" cy="79" rx="10" ry="14" fill="#f3d5a1" stroke="#ffe5ba" strokeWidth="1.2"/>
          <circle className="lab-flex-oxygen oxygen-a" cx="254" cy="70" r="2" fill="#92d9e8"/><circle className="lab-flex-oxygen oxygen-b" cx="343" cy="99" r="2" fill="#92d9e8"/><circle className="lab-flex-oxygen oxygen-c" cx="311" cy="28" r="2" fill="#92d9e8"/>
          <text x="300" y="145" textAnchor="middle" className="lab-flex-label">2 · SPHERICAL FLAME</text>
          <text x="300" y="161" textAnchor="middle" className="lab-flex-note">flame wraps around the droplet</text>
        </g>
        <g className="lab-flex-phase lab-flex-phase-three">
          <circle cx="510" cy="79" r="47" fill="url(#flexCoolGlow)"/>
          <circle className="lab-flex-cool-ring" cx="510" cy="79" r="25" fill="none" stroke="#ed9c5d" strokeWidth="1.3" strokeDasharray="2 4"/>
          <ellipse cx="510" cy="79" rx="9" ry="13" fill="#d8b894" stroke="#f1d4ad" strokeWidth="1.2"/>
          <text x="510" y="145" textAnchor="middle" className="lab-flex-label">3 · AFTER FLAME-OUT</text>
          <text x="510" y="161" textAnchor="middle" className="lab-flex-note">a faint cool flame may remain*</text>
        </g>
      </svg>
      <div className="lab-flex-legend"><span><i className="legend-visible"/> visible flame</span><span><i className="legend-cool"/> residual cool flame</span><span><i className="legend-oxygen"/> oxygen</span></div>
    </div>
    <figcaption><span>*Under some conditions, a faint cool flame continues after the bright flame disappears.</span><a href="https://svs.gsfc.nasa.gov/11318/" target="_blank" rel="noreferrer">NASA: why flames can linger ↗</a></figcaption>
  </figure>;
}

function Distribution({ series, independentAxes }: { series: ComparisonSeries[]; independentAxes: boolean }) {
  if (!series.length) return <div className="lab-empty-chart">No shared field is available for this selection. Choose a field-aware preset or select records with a shared condition.</div>;
  const allValues = series.flatMap((item) => item.values.map((value) => value.normalizedValue));
  const min = Math.min(...allValues), max = Math.max(...allValues), span = max - min || Math.max(Math.abs(max), 1);
  const width = 760, height = 226, left = 48, right = 20, top = 18, plotW = width - left - right;
  return <div className="lab-plot-wrap"><svg className="lab-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Aligned strip plot of observed source rows">
    {[0, .25, .5, .75, 1].map((part) => { const x = left + part * plotW; return <g key={part}><line x1={x} y1={top} x2={x} y2={height - 38} className="lab-gridline"/><text x={x} y={height - 15} textAnchor="middle" className="lab-axis-label">{independentAxes ? `${Math.round(part * 100)}%` : nice(min + span * part)}</text></g>; })}
    {series.map((item, s) => { const y = top + 24 + s * 52; const rowValues = item.values.map((value) => value.value); const rowMin = Math.min(...rowValues), rowMax = Math.max(...rowValues), rowSpan = rowMax - rowMin || Math.max(Math.abs(rowMax), 1); return <g key={item.sourceId}>
      <text x={left - 8} y={y + 4} textAnchor="end" className="lab-row-label">{item.sourceId.toUpperCase()}</text>
      {independentAxes && <text x={left} y={y - 10} className="lab-row-range">{nice(rowMin)}–{nice(rowMax)} {item.sourceUnit}</text>}
      <line x1={left} y1={y} x2={width - right} y2={y} className="lab-rowline"/>
      {item.values.map((point, i) => { const x = left + ((independentAxes ? point.value - rowMin : point.normalizedValue - min) / (independentAxes ? rowSpan : span)) * plotW; return <circle key={`${point.rowLabel}-${i}`} cx={x} cy={y + ((i % 5) - 2) * 3.4} r="3" fill={color(s)} opacity=".82"><title>{`${point.rowLabel}: ${point.sourceValue} ${item.sourceUnit}`}</title></circle>; })}
    </g>; })}
  </svg><div className="lab-axis-caption">{independentAxes ? 'Source values · independent horizontal scales by source' : 'Common axis · transformed values in the selected common unit'}</div></div>;
}

export function ComparisonLab() {
  const [params, setParams] = useSearchParams();
  const sourceIds = useMemo(() => {
    const ids = [...new Set((params.get('items') ?? 'psi-99,psi-100,psi-102').split(',').filter((id) => COMPARISON_SOURCES.some((source) => source.id === id)))].slice(0, 3);
    return ids.length ? ids : ['psi-99', 'psi-100'];
  }, [params]);
  const selectedMetric = params.get('variable') as ComparisonMetric | null;
  const availableMetrics = commonMetrics(sourceIds);
  const metric: ComparisonMetric = selectedMetric && availableMetrics.includes(selectedMetric) ? selectedMetric : availableMetrics[0] ?? 'airflow';
  const independentAxes = params.get('scale') === 'source';
  const activeAtlas = params.get('atlas');
  const [series, setSeries] = useState<ComparisonSeries[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showRows, setShowRows] = useState(false);
  const [activeTab, setActiveTab] = useState<'compare' | 'notes' | 'atlas'>('compare');

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  const setSources = (ids: string[]) => {
    const next = new URLSearchParams(params);
    next.set('items', ids.join(','));
    const nextMetrics = commonMetrics(ids);
    if (!nextMetrics.includes(metric)) {
      if (nextMetrics[0]) next.set('variable', nextMetrics[0]);
      else next.delete('variable');
    }
    setParams(next);
  };
  useEffect(() => {
    let live = true;
    if (availableMetrics.length === 0) { setSeries([]); return () => { live = false; }; }
    setSeries([]); setBusy(true); setLoadError('');
    loadComparisonSeries(sourceIds, metric).then((result) => { if (live) setSeries(result); }).catch((error: unknown) => { if (live) setLoadError(error instanceof Error ? error.message : 'Could not load these source tables.'); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [sourceIds.join('|'), metric, availableMetrics.length]);

  const [differencesOnly, setDifferencesOnly] = useState(false);
  const selected = sourceIds.map((id) => COMPARISON_SOURCES.find((source) => source.id === id)!).filter(Boolean);
  const compatibility = availableMetrics.length ? compatibilityForMetric(sourceIds, metric) : { status: 'not-comparable' as const, label: 'Not comparable', reason: 'There is no shared verified field definition for this selection. Source records can still be reviewed side by side.' };
  const metricDefinition = VARIABLE_DEFINITIONS[metric];

  return <section className="comparison-lab" aria-labelledby="comparison-title">
    <OverviewStarfield />
    <header className="lab-hero"><div className="lab-hero-copy"><p className="lab-eyebrow">FLAMELENS / COMPARISON LAB</p><h1 id="comparison-title">Compare fire conditions <em>across campaigns.</em></h1><p>Choose from eight audited tables. The comparison below aligns only shared, verified fields and keeps each value tied to its source row.</p><div className="lab-hero-summary"><span>08 <small>LOCAL TABLES</small></span><i aria-hidden="true"/><span>03 <small>RECORDS PER VIEW</small></span><i aria-hidden="true"/><span>02 <small>VERIFIED FIELDS</small></span></div></div><NASAFireEvidence /></header>

    <div className="lab-view-tabs" role="tablist" aria-label="Comparison Lab sections">
      <button type="button" role="tab" aria-selected={activeTab === 'compare'} className={activeTab === 'compare' ? 'is-active' : ''} onClick={() => setActiveTab('compare')}>
        Compare Workspace <span className="mono">{selected.length}/3</span>
      </button>
      <button type="button" role="tab" aria-selected={activeTab === 'notes'} className={activeTab === 'notes' ? 'is-active' : ''} onClick={() => setActiveTab('notes')}>
        NASA Field Notes <span className="mono">{RESEARCH_CONTEXT.length}</span>
      </button>
      <button type="button" role="tab" aria-selected={activeTab === 'atlas'} className={activeTab === 'atlas' ? 'is-active' : ''} onClick={() => setActiveTab('atlas')}>
        Experiment Atlas <span className="mono">{EXPERIMENT_ATLAS.length}</span>
      </button>
    </div>

    <div hidden={activeTab !== 'compare'}>
      <section className="lab-section lab-selection" aria-labelledby="selection-title">
        <div className="lab-section-heading"><div><p className="lab-eyebrow">01 / SELECT RECORDS</p><h2 id="selection-title">A comparison starts with source identity</h2></div><span className="lab-count">{selected.length} of 3 selected</span></div>
        <div className="lab-presets" aria-label="Comparison presets">{PRESETS.map((preset) => <button key={preset.label} type="button" onClick={() => setSources(preset.ids)}>{preset.label}<span aria-hidden="true"> ↗</span></button>)}</div>
        <div className="lab-select-row">{selected.map((source, index) => <label className="lab-select-card" key={source.id}><span className="lab-card-index" style={{ color: color(index) }}>SOURCE 0{index + 1}</span><select aria-label={`Source ${index + 1}`} value={source.id} onChange={(event) => setSources(selected.map((item, i) => i === index ? event.target.value : item.id))}>{COMPARISON_SOURCES.map((item) => <option key={item.id} value={item.id}>{item.record.sourceId} · {item.record.title}</option>)}</select><small>{source.record.audit?.rows ?? '—'} source rows · {source.record.audit?.columns ?? '—'} fields · {source.record.availability}</small></label>)}{selected.length < 3 && <button className="lab-add-source" type="button" onClick={() => setSources([...sourceIds, COMPARISON_SOURCES.find((item) => !sourceIds.includes(item.id))!.id])}>＋ Add source</button>}</div>
      </section>

      <section className="lab-section" aria-labelledby="variable-title"><div className="lab-section-heading"><div><p className="lab-eyebrow">02 / FIELD-AWARE DISTRIBUTION</p><h2 id="variable-title">Compare observed condition rows</h2></div><label className="lab-variable-select">Shared field<select aria-label="Shared field" value={availableMetrics.includes(metric) ? metric : ''} onChange={(event) => setParam('variable', event.target.value)} disabled={!availableMetrics.length}><option value="" disabled>No shared verified field</option>{availableMetrics.map((key) => <option key={key} value={key}>{VARIABLE_DEFINITIONS[key].label} ({VARIABLE_DEFINITIONS[key].unit})</option>)}</select></label></div>
        {availableMetrics.length ? <><p className="lab-transform-note">{metricDefinition.description} {metricDefinition.transform}</p><div className="lab-chart-card"><div className="lab-chart-head"><div><span className="mono">SOURCE-ROW STRIP PLOT</span><p>{busy ? 'Reading audited local tables…' : `${series.reduce((sum, item) => sum + item.values.length, 0)} numeric source values · one mark per parsed value`}</p></div><label className="lab-toggle"><input type="checkbox" checked={independentAxes} onChange={(event) => setParam('scale', event.target.checked ? 'source' : '')}/><span>Show source values independently</span></label></div>{loadError ? <div className="lab-load-error" role="alert">{loadError}</div> : <Distribution series={series} independentAxes={independentAxes}/>}</div><div className="lab-series-grid">{series.map((item, index) => { const totalRows = Math.max(1, item.sourceRows); const numPct = Math.round((item.values.length / totalRows) * 100); const missPct = Math.round((item.missing / totalRows) * 100); const nonPct = Math.max(0, 100 - numPct - missPct); return <article key={item.sourceId} className="lab-series-card"><span className="lab-series-dot" style={{ background: color(index) }}/><h3>{item.sourceId.toUpperCase()}</h3><p>{item.field} <span>({item.sourceUnit})</span></p><div className="lab-series-meter" aria-label={`Row completeness: ${item.values.length} numeric, ${item.missing} missing, ${item.nonNumeric} non-numeric`}><div className="lab-series-meter-bar">{item.values.length > 0 && <span className="lab-series-seg-num" style={{ width: `${numPct}%` }}/>}{item.missing > 0 && <span className="lab-series-seg-miss" style={{ width: `${missPct}%` }}/>}{item.nonNumeric > 0 && <span className="lab-series-seg-non" style={{ width: `${nonPct}%` }}/>}</div><span className="lab-series-meter-label">{item.values.length}/{item.sourceRows} numeric · {item.missing} missing · {item.nonNumeric} non-numeric</span></div><dl><div><dt>Numeric values</dt><dd>{item.values.length}</dd></div><div><dt>Source rows</dt><dd>{item.sourceRows}</dd></div><div><dt>Missing</dt><dd>{item.missing}</dd></div><div><dt>Non-numeric</dt><dd>{item.nonNumeric}</dd></div><div><dt>Source range</dt><dd>{item.rawRange ? `${nice(item.rawRange[0])}–${nice(item.rawRange[1])} ${item.sourceUnit}` : 'No numeric values'}</dd></div><div><dt>Common-unit range</dt><dd>{item.normalizedRange ? `${nice(item.normalizedRange[0])}–${nice(item.normalizedRange[1])} ${metricDefinition.unit}` : '—'}</dd></div></dl></article>; })}</div><details className="lab-method"><summary>Parsing, units & provenance</summary><p>Only non-empty values that match a strict numeric-plus-unit pattern are plotted. The chart counts table rows, not independent experiments. Empty and non-numeric cells remain in the audit counts.</p><p>{metricDefinition.transform} Source strings are retained beside parsed values; normalization is reversible for the displayed pressure conversion.</p><button type="button" className="lab-text-button" onClick={() => setShowRows((value) => !value)}>{showRows ? 'Hide source row preview' : 'Show source row preview'}</button>{showRows && <div className="lab-table-scroll"><table><thead><tr><th>Source</th><th>Row label</th><th>Original value</th><th>Parsed</th><th>Common unit</th></tr></thead><tbody>{series.flatMap((item) => item.values.map((point, index) => <tr key={`${item.sourceId}-${index}`}><td>{item.sourceId}</td><td>{point.rowLabel}</td><td>{point.sourceValue} {item.sourceUnit}</td><td>{nice(point.value)}</td><td>{nice(point.normalizedValue)} {metricDefinition.unit}</td></tr>))}</tbody></table></div>}</details></> : <div className="lab-not-comparable"><strong>Shared plot unavailable.</strong> No verified field is defined for every selected source. The record comparison above remains available, and the specific differences are shown in the table below.</div>}
      </section>

      <section className="lab-section" aria-labelledby="records-title"><div className="lab-section-heading"><div><p className="lab-eyebrow">03 / RECORD CONTEXT</p><h2 id="records-title">Read the experiment before its values</h2></div><div className="lab-context-controls"><label className="lab-toggle"><input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)}/><span>Differences only</span></label><span className={statusClass(compatibility.status)}>{compatibility.label}</span></div></div>
        <div className="lab-context-scroll"><table className="lab-context-table"><thead><tr><th scope="col">Source field</th>{selected.map((source, index) => <th scope="col" key={source.id} style={{ borderTopColor: color(index) }}><span className="mono">{source.record.sourceId}</span><strong>{source.record.title}</strong><Link to={`/explorer/${source.id}`}>Inspect source record ↗</Link></th>)}</tr></thead><tbody>{FIELD_LABELS.map((label) => { const rowValues = selected.map((source) => getField(source, label) ?? ''); const hasDiff = new Set(rowValues).size > 1; if (differencesOnly && !hasDiff) return null; return <tr key={label} className={hasDiff ? 'lab-diff-row' : undefined}><th scope="row">{label}</th>{selected.map((source) => <td key={source.id}>{getField(source, label) ?? <span className="lab-unreported">Not reported in indexed source</span>}</td>)}</tr>; })}</tbody></table></div>
        <p className="lab-compatibility"><strong>{compatibility.label} · {metricDefinition.label}:</strong> {compatibility.reason}</p>
      </section>

      <section className="lab-section lab-eligibility" aria-labelledby="eligibility-title"><div className="lab-section-heading"><div><p className="lab-eyebrow">04 / ELIGIBILITY & LIMITS</p><h2 id="eligibility-title">What can be compared, and at what level</h2></div><a href="/data/COMPARISON_ELIGIBILITY.md" target="_blank" rel="noreferrer">Method note ↗</a></div><div className="lab-eligibility-list">{selected.flatMap((left, index) => selected.slice(index + 1).map((right) => { const relation = compatibilityForMetric([left.id, right.id], availableMetrics[0] ?? 'airflow'); const pairCaveats = [left, right].flatMap((source) => source.caveats.map((caveat) => ({ sourceId: source.id, label: source.record.sourceId, caveat }))); return <article key={`${left.id}-${right.id}`}><span className={statusClass(relation.status)}>{relation.label}</span><h3>{left.record.sourceId} <span>↔</span> {right.record.sourceId}</h3><p>{relation.reason}</p><details className="lab-caveats-details"><summary>Source caveats ({pairCaveats.length})</summary>{pairCaveats.map((item) => <small key={`${item.sourceId}-${item.caveat}`}>{item.label}: {item.caveat}</small>)}</details></article>; }))}</div></section>

      <details className="lab-source-coverage lab-coverage-details">
        <summary className="lab-coverage-summary">
          <div><p className="lab-eyebrow">SOURCE LIBRARY / COMPLETE LOCAL COVERAGE</p><h2>Eight audited tables. Multiple fire regimes.</h2></div>
          <span className="mono">Browse all 8 tables ▾</span>
        </summary>
        <div className="lab-source-coverage-heading"><span>Choose a preset above or replace any source in the selector.</span></div>
        <div className="lab-source-grid">{COMPARISON_SOURCES.map((source, index) => <Link className="lab-source-chip" to={`/explorer/${source.id}`} key={source.id}><span className="lab-source-chip-index">0{index + 1} / {source.record.sourceId}</span><strong>{source.record.title}</strong><span>{source.record.audit?.rows ?? '—'} rows · {source.record.investigation.name}</span><b aria-hidden="true">↗</b></Link>)}</div>
      </details>
    </div>

    <section className="lab-research-band" aria-label="NASA campaign context" hidden={activeTab !== 'notes'}><div className="lab-research-band-heading"><p className="lab-eyebrow">FIELD NOTES / NASA CAMPAIGN CONTEXT</p><span>Published scope and bundled-file coverage are shown separately.</span></div><div className="lab-research-grid">{RESEARCH_CONTEXT.map((item, index) => <article className="lab-research-card" key={item.title} style={{ animationDelay: `${index * 55}ms` }}><div className="lab-research-card-top"><span className="lab-research-index">0{index + 1}</span><span className="lab-research-kicker">{item.kicker}</span></div><h2>{item.title}</h2><p>{item.text}</p><a href={item.href} target="_blank" rel="noreferrer">{item.source} <span aria-hidden="true">↗</span></a></article>)}</div></section>

    <section className="lab-section lab-atlas" aria-labelledby="atlas-title" hidden={activeTab !== 'atlas'}><div className="lab-section-heading"><div><p className="lab-eyebrow">05 / EXPERIMENT ATLAS</p><h2 id="atlas-title">Relationships with a source trail</h2><p className="lab-section-intro">Evidence-linked groups rather than a geographic map. A relationship does not imply shared targets or independent test cohorts.</p></div><span className="lab-count">{EXPERIMENT_ATLAS.length} documented groups</span></div><div className="lab-atlas-grid">{EXPERIMENT_ATLAS.map((group) => <article className={`lab-atlas-card${activeAtlas === group.id ? ' is-open' : ''}`} key={group.id}><button type="button" aria-expanded={activeAtlas === group.id} onClick={() => { const open = activeAtlas === group.id ? null : group.id; setParam('atlas', open ?? ''); }}><span className="lab-eyebrow">{group.relationType}</span><strong>{group.title}</strong><span className="lab-atlas-count">{group.members.length} linked records · evidence ↗</span></button>{activeAtlas === group.id && <div className="lab-atlas-detail">{group.members.map((member) => { const record = getAtlasRecord(member.recordId); return <div key={member.recordId}><p><strong>{record?.sourceId ?? member.recordId}</strong> · {record?.title}</p><p>{member.relationDetail}</p>{record && <Link to={`/explorer/${record.id}`}>Open indexed record ↗</Link>}<button type="button" className="lab-text-button" onClick={() => setSources(sourceIds.includes(member.recordId) ? sourceIds : [...sourceIds.slice(0, 2), member.recordId].slice(-3))}>Add to comparison</button></div>; })}<a className="lab-atlas-source" href={group.sourceUrl} target="_blank" rel="noreferrer">{group.sourceLabel} ↗</a></div>}</article>)}</div></section>
    <footer className="lab-footer mono">FLAMELENS / LOCAL AUDITED RECORDS / VALUES RETAIN SOURCE LABELS</footer>
  </section>;
}
