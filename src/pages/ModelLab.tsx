import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { OverviewStarfield } from '../components/OverviewStarfield';
import { VirtualExperimentPanel } from '../components/VirtualExperimentPanel';
import { ResearchMotionPlate } from '../components/ResearchMotionPlate';
import {
  MODEL_DATASETS, MODEL_PROTOCOL, MODEL_TRACKS, auditModelDataset,
  deriveTrackStatus, fieldAuditFor,
  type DatasetAudit, type FieldAudit, type ModelFieldDefinition, type ModelTrackDefinition, type ModelTrackId,
} from '../data/modelLab';

const MODEL_ARTIFACTS = import.meta.glob('../../data/model_artifacts/**/*.{joblib,onnx,pkl,pt,pth,h5,safetensors}', { eager: true });
const TRACK_ORDER: ModelTrackId[] = ['extinction', 'spread', 'soot-smoke'];
const CATEGORY_COLORS = ['#ed9b62', '#d8c188', '#9bd9e5', '#b4c3cb', '#9fb99e', '#c3b2a0'];

function artifactCount(track: ModelTrackId) {
  return Object.keys(MODEL_ARTIFACTS).filter((file) => file.toLowerCase().includes(track)).length;
}
function formatCount(value: number) { return new Intl.NumberFormat('en-US').format(value); }
function sourceDisplay(sourceId: string) { return MODEL_DATASETS[sourceId]?.sourceId ?? sourceId.toUpperCase(); }
function roleClass(role: ModelFieldDefinition['role']) { return role === 'grouping / provenance' ? 'grouping-provenance' : role.replace(/\s+/g, '-'); }
function fieldStatus(field: FieldAudit) { return !field.present ? 'Not in local table' : `${formatCount(field.observed)} / ${formatCount(field.observed + field.missing)} records populated`; }

function StatusTag({ children, tone = 'caution' }: { children: ReactNode; tone?: 'caution' | 'neutral' | 'safe' }) {
  return <span className={`ml-status ml-status-${tone}`}><i aria-hidden="true" />{children}</span>;
}

function ReportButton({ track, audits }: { track: ModelTrackDefinition; audits: DatasetAudit[] }) {
  const status = deriveTrackStatus(track, audits, artifactCount(track.id));
  const download = () => {
    const report = {
      report_type: 'FlameLens evidence-gated model-lab audit',
      track: { id: track.id, title: track.title, scientific_objective: track.objective, target_definition: track.target },
      readiness: { stage: status.stage, trained: status.trained, evaluated: false, externally_validated: false, independent_validation: false },
      protocol: MODEL_PROTOCOL,
      model_plan: { baseline: track.candidateModels[0], candidates: track.candidateModels.slice(1), split_plan: track.splitPlan, applicability_domain: track.domainLimit },
      datasets: audits,
      generated_at: new Date().toISOString(),
      integrity_note: 'Raw CSV source files were read without modifying source values. Counts and field coverage are calculated from the local files at runtime. No model predictions or performance metrics are included.',
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flamelens-${track.id}-audit-report.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <button type="button" className="ml-report-button" onClick={download} disabled={!audits.length}>Export audit report <span aria-hidden="true">↓</span></button>;
}

function RecordSummary({ audit }: { audit: DatasetAudit }) {
  const totalFields = audit.headers.length;
  const populatedFields = audit.allFieldCoverage.filter((field) => field.nonMissing > 0).length;
  return <article className="ml-source-summary">
    <div className="ml-source-title"><span className="ml-source-id">{sourceDisplay(audit.sourceId)}</span><a href={audit.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open official ${sourceDisplay(audit.sourceId)} record`}>NASA record ↗</a></div>
    <h3>{audit.title}</h3>
    <p>{audit.scope}</p>
    <dl className="ml-source-stats"><div><dt>Rows with content</dt><dd>{formatCount(audit.nonEmptyRows)}</dd></div><div><dt>Empty export rows</dt><dd>{formatCount(audit.emptyRows)}</dd></div><div><dt>Exact repeat rows</dt><dd>{formatCount(audit.exactDuplicateRows)}</dd></div><div><dt>Fields populated</dt><dd>{populatedFields} / {totalFields}</dd></div></dl>
    <div className="ml-coverage-track" role="img" aria-label={`${populatedFields} of ${totalFields} source fields contain at least one value`}><span style={{ width: `${totalFields ? (populatedFields / totalFields) * 100 : 0}%` }} /></div>
    {audit.rowKinds.length > 0 && <ul className="ml-row-kinds">{audit.rowKinds.map((kind) => <li key={kind.label}><span>{kind.label}</span><b>{formatCount(kind.count)}</b></li>)}</ul>}
    <p className="ml-group-note"><b>Run grouping:</b> {audit.candidateGroupField} has {formatCount(audit.candidateIdentifierCount)} distinct candidate identifiers; {audit.missingIdentifierRows ? `${formatCount(audit.missingIdentifierRows)} rows lack the identifier. ` : ''}{audit.groupingNote}</p>
    <Link className="ml-source-file" to={`/explorer/${audit.sourceId}`} title={audit.filePath}>Open local record · {audit.filePath.split('/').slice(-1)[0]} ↗</Link>
  </article>;
}

function DistributionBars({ title, note, values }: { title: string; note: string; values: { label: string; count: number; color?: string }[] }) {
  const max = Math.max(1, ...values.map((value) => value.count));
  return <div className="ml-chart-panel">
    <div className="ml-chart-heading"><div><span className="ml-eyebrow">SOURCE OBSERVATIONS</span><h3>{title}</h3></div><span className="ml-chart-unit">COUNT</span></div>
    <div className="ml-bars">{values.map((item, index) => <div className="ml-bar-row" key={`${item.label}-${index}`}><span className="ml-bar-label" title={item.label}>{item.label}</span><span className="ml-bar-track"><i style={{ width: `${Math.max(item.count ? 2 : 0, (item.count / max) * 100)}%`, background: item.color ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} /></span><b>{formatCount(item.count)}</b></div>)}</div>
    <p className="ml-chart-note">{note}</p>
  </div>;
}

function ExtinctionVisualization({ audit }: { audit: DatasetAudit }) {
  const target = audit.targetValues[0];
  const values = target?.categories ?? [];
  return <div className="ml-output-visual ml-extinction-visual">
    <div className="ml-output-copy"><span className="ml-eyebrow">AUDITED OUTPUT · NOT A PREDICTION</span><h3>{target?.field ?? 'Candidate event field'}</h3><p>Observed labels are kept in the source vocabulary. No label has been mapped to sustained burning, extinction, ignition failure, or stability.</p></div>
    {values.length ? <DistributionBars title="Recorded value frequency" note="Each bar is a literal source-field value. Counts are table rows, not independent run counts or model classes." values={values.map((value, index) => ({ label: value.value || 'Blank', count: value.count, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }))} /> : <div className="ml-no-output"><span className="ml-no-output-mark">—</span><b>No target distribution in this table</b><span>Candidate output fields are missing or have not been defined for this branch.</span></div>}
  </div>;
}

function SpreadVisualization({ audits }: { audits: DatasetAudit[] }) {
  const max = Math.max(1, ...audits.map((audit) => audit.nonEmptyRows));
  return <div className="ml-output-visual ml-spread-visual">
    <div className="ml-output-copy"><span className="ml-eyebrow">LOCAL TABLE AUDIT</span><h3>Three distinct source tables</h3><p>These bars count bundled source rows. Separately, the experiment above uses measured PMMA spread-rate points transcribed from NASA BASS-II Table 5.1 and evaluates by whole burn.</p></div>
    <div className="ml-source-compare" role="img" aria-label="Non-empty row counts for the three flame-spread source tables">{audits.map((audit, index) => <div className="ml-source-compare-row" key={audit.sourceId}><div><b>{sourceDisplay(audit.sourceId)}</b><span>{audit.title}</span></div><span className="ml-bar-track"><i style={{ width: `${(audit.nonEmptyRows / max) * 100}%`, background: CATEGORY_COLORS[index] }} /></span><strong>{formatCount(audit.nonEmptyRows)} <small>rows</small></strong></div>)}</div>
    <div className="ml-target-grid">{audits.map((audit) => <div className="ml-target-cell" key={audit.sourceId}><span>{sourceDisplay(audit.sourceId)}</span><strong>{audit.targetValues.filter((field) => field.present).length} target columns present</strong><small>{audit.sourceId === 'psi-99' ? 'SAFFIRE-II rows include mixed text; gravity marker and measurement linkage require resolution.' : audit.sourceId === 'psi-100' ? 'SAFFIRE-III condition/configuration rows only; no outcome fields.' : 'The bundled BASS-II flight CSV is not the report table used by the PMMA spread experiment above.'}</small></div>)}</div>
    <div className="ml-illustration-note"><span className="ml-flow-illustration" aria-hidden="true"><i /><i /><i /><b /></span><span><b>Illustrative only</b> — the sample strip shows how a spread-front measurement would be represented; no measured front is drawn because the local tables do not contain calibrated position-versus-time data.</span></div>
  </div>;
}

function SootVisualization({ audit }: { audit: DatasetAudit }) {
  const fuels = fieldAuditFor(audit, 'Fuel')?.categories ?? [];
  const numericFields = ['Nozzle (mm)', 'Fuel Rate (sccm)', 'Fuel Rate (mg/s)', 'HC Fuel Rate (mg/s)', 'Air Rate (cm/s)']
    .map((name) => fieldAuditFor(audit, name)).filter((field): field is FieldAudit => Boolean(field));
  const outcomePresent = audit.targetValues.filter((field) => field.present).length;
  return <div className="ml-output-visual ml-soot-visual">
    <div className="ml-output-copy"><span className="ml-eyebrow">LOCAL SOURCE COVERAGE</span><h3>SPICE conditions and published outcomes</h3><p>PSI-107 supplies coflow experiment conditions. The smoke-point workspace pairs its scientific context with a separately published 55-point SPICE outcome analysis; the estimate is luminous length only.</p></div>
    <div className="ml-data-gate" role="img" aria-label="The local PSI-107 condition table connects to a separate published SPICE smoke-point correlation based on 55 measurements">
      <div className="ml-gate-node ml-gate-present"><span>LOCAL PSI-107</span><b>Fuel · nozzle · flow</b><small>{formatCount(audit.nonEmptyRows)} condition rows</small></div>
      <span className="ml-gate-connector" aria-hidden="true">→</span>
      <div className="ml-gate-node ml-gate-missing"><span>LOCAL PSI-107 TARGET FIELDS</span><b>Not included in this CSV</b><small>{outcomePresent} of 3 local target columns present</small></div>
      <span className="ml-gate-connector" aria-hidden="true">→</span>
      <div className="ml-gate-node ml-gate-blocked"><span>SEPARATE PUBLICATION</span><b>SPICE correlation</b><small>55 measured smoke points</small></div>
    </div>
    <div className="ml-soot-charts"><DistributionBars title="Fuel records in PSI-107" note="Fuel counts are source rows; exact duplicate rows remain in these counts pending replicate review." values={fuels.map((value, index) => ({ label: value.value, count: value.count, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }))} /><div className="ml-range-panel"><span className="ml-eyebrow">CONDITION COVERAGE · SOURCE UNITS</span><h3>Observed numeric ranges</h3>{numericFields.map((field) => <div className="ml-range-row" key={field.field}><span>{field.field}</span><b>{field.numeric.min === null ? '—' : `${field.numeric.min}–${field.numeric.max} ${field.unit}`}</b><small>{field.numeric.count}/{audit.nonEmptyRows} numeric entries · {audit.nonEmptyRows - field.numeric.count} missing or non-numeric</small></div>)}</div></div>
    <div className="ml-separation-note"><b>Keep measurements distinct:</b> PSI-102 SAME concerns smoke/aerosol detection, not SPICE smoke-point length. Its local table has no paired detector signal or alarm target. <Link to="/models">See the other research workspaces</Link></div>
  </div>;
}

function FieldDictionary({ audits }: { audits: DatasetAudit[] }) {
  const allFields = audits.flatMap((audit) => audit.fields.map((field) => ({ audit, field })));
  const [role, setRole] = useState<'all' | ModelFieldDefinition['role']>('all');
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const displayed = allFields.filter(({ audit, field }) => {
    if (role !== 'all' && field.role !== role) return false;
    if (!normalizedQuery) return true;
    return [field.field, field.definition, field.method, field.unit, sourceDisplay(audit.sourceId)].some((text) => text.toLowerCase().includes(normalizedQuery));
  });
  return <section className="ml-section" aria-labelledby="ml-dictionary-title">
    <div className="ml-section-heading"><div><span className="ml-eyebrow">FIELD CONTRACT</span><h2 id="ml-dictionary-title">Inputs, outputs & exclusions</h2><p>Definitions preserve the original source field names. “Not in local table” stays distinct from a blank measurement.</p></div><div className="ml-dictionary-controls"><label className="ml-field-search">Filter keyword<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search field, unit, or source…"/></label><label className="ml-filter">Show fields<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="all">All field roles</option><option value="candidate input">Candidate inputs</option><option value="candidate output">Candidate outputs</option><option value="excluded leakage">Leakage exclusions</option><option value="grouping / provenance">Grouping / provenance</option><option value="context only">Context only</option></select></label></div></div>
    <div className="ml-table-scroll"><table className="ml-field-table"><thead><tr><th>Source field</th><th>Role</th><th>Unit</th><th>Definition & method</th><th>Local coverage</th></tr></thead><tbody>{displayed.map(({ audit, field }, index) => <tr key={`${audit.sourceId}-${field.field}-${index}`} data-role={field.role}><th scope="row"><span>{sourceDisplay(audit.sourceId)}</span><code>{field.field}</code></th><td><span className={`ml-role ml-role-${roleClass(field.role)}`}>{field.role}</span></td><td>{field.unit}</td><td><span>{field.definition}</span><small>{field.method}{field.caution ? ` ${field.caution}` : ''}</small></td><td>{fieldStatus(field)}</td></tr>)}</tbody></table></div>
  </section>;
}

function QualityPanel({ track, audits }: { track: ModelTrackDefinition; audits: DatasetAudit[] }) {
  return <section className="ml-section ml-quality" aria-labelledby="ml-quality-title">
    <div className="ml-section-heading"><div><span className="ml-eyebrow">LEAKAGE & APPLICABILITY</span><h2 id="ml-quality-title">What would invalidate a result</h2></div></div>
    <div className="ml-quality-grid"><article><span className="ml-quality-index">01 / GROUPING</span><h3>Keep experiments together</h3><p>{track.splitPlan}</p>{audits.map((audit) => <small key={audit.sourceId}><b>{sourceDisplay(audit.sourceId)}:</b> {audit.candidateGroupField} · {formatCount(audit.candidateIdentifierCount)} distinct candidate identifiers · independence not confirmed.</small>)}</article><article><span className="ml-quality-index">02 / LEAKAGE</span><h3>Use only prediction-time fields</h3><p>Identifiers, comments, post-test composition, burn time, peak temperature, or other outcomes cannot become pre-test inputs. Preprocessing must be fitted within training folds, never on the full table.</p></article><article><span className="ml-quality-index">03 / DOMAIN</span><h3>Stop outside the evidence</h3><p>{track.domainLimit}</p></article></div>
  </section>;
}

function ExtinctionBranches({ audits, active, onSelect }: { audits: DatasetAudit[]; active: string; onSelect: (id: string) => void }) {
  return <div className="ml-branch-switch" role="tablist" aria-label="Extinction evidence branch">{audits.map((audit) => <button type="button" role="tab" aria-selected={active === audit.sourceId.toLowerCase()} className={active === audit.sourceId.toLowerCase() ? 'is-active' : ''} key={audit.sourceId} onClick={() => onSelect(audit.sourceId.toLowerCase())}><span>{sourceDisplay(audit.sourceId)}</span><b>{audit.title.split('·').slice(-1)[0]?.trim()}</b></button>)}</div>;
}

function TrackWorkspace({ track, audits }: { track: ModelTrackDefinition; audits: DatasetAudit[] }) {
  const [activeSourceId, setActiveSourceId] = useState(track.sourceIds[0]);
  const [workspaceTab, setWorkspaceTab] = useState<'experiment' | 'audit' | 'contract'>('experiment');
  useEffect(() => {
    setActiveSourceId(track.sourceIds[0]);
    setWorkspaceTab('experiment');
  }, [track.id]);
  const activeAudit = audits.find((audit) => audit.sourceId.toLowerCase() === activeSourceId) ?? audits[0];
  const evidenceCount = audits.reduce((sum, audit) => sum + audit.nonEmptyRows, 0);
  const fieldCount = (track.id === 'extinction' ? [activeAudit] : audits).reduce((sum, audit) => sum + audit.fields.length, 0);
  if (!activeAudit) return null;
  return <>
    <header className={`ml-track-hero ml-track-${track.id}`}>
      <div className="ml-track-copy"><div className="ml-track-kicker"><span>MODEL WORKSPACE / {track.number}</span><span>RESEARCH-GROUNDED SIMULATION</span></div><h1>{track.title}</h1><p>{track.objective}</p><div className="ml-track-tags"><StatusTag tone="safe">Virtual experiments available</StatusTag><StatusTag tone="neutral">{evidenceCount} supporting local rows</StatusTag><StatusTag tone="neutral">Batch runs execute locally</StatusTag></div></div>
      <div className="ml-target-statement"><span className="ml-eyebrow">WHAT THIS WORKSPACE ESTIMATES</span><p>{track.id === 'extinction' ? 'A case-based estimate of the recorded FLEX Test end label distribution for nearby conditions.' : track.id === 'spread' ? 'PMMA flame spread rate from measured NASA BASS-II conditions, with whole-burn cross-validation.' : 'Laminar smoke-point luminous length from the published SPICE fuel / burner / airflow relation.'}</p><div className="ml-target-gate"><span className="ml-target-symbol" aria-hidden="true">✓</span><div><b>{track.id === 'extinction' ? 'Source labels · not extinction probability' : track.id === 'spread' ? 'Measured spread rate · mm/s' : 'Smoke-point length · mm'}</b><small>Method and evidence limits are displayed with each batch output.</small></div></div></div>
    </header>
    <div className="ml-workspace-tabs" role="tablist" aria-label="Track workspace sections">
      <button type="button" role="tab" aria-selected={workspaceTab === 'experiment'} className={workspaceTab === 'experiment' ? 'is-active' : ''} onClick={() => setWorkspaceTab('experiment')}>
        Virtual Experiment <span className="mono">RUN</span>
      </button>
      <button type="button" role="tab" aria-selected={workspaceTab === 'audit'} className={workspaceTab === 'audit' ? 'is-active' : ''} onClick={() => setWorkspaceTab('audit')}>
        Source Audit & Charts <span className="mono">{audits.length}</span>
      </button>
      <button type="button" role="tab" aria-selected={workspaceTab === 'contract'} className={workspaceTab === 'contract' ? 'is-active' : ''} onClick={() => setWorkspaceTab('contract')}>
        Field Contract & Limits <span className="mono">{fieldCount}</span>
      </button>
    </div>

    <div hidden={workspaceTab !== 'experiment'}>
      <VirtualExperimentPanel trackId={track.id} />
      <section className="ml-method-strip"><span className="ml-eyebrow">MODEL METHOD</span><p>{track.id === 'extinction' ? 'Seven-neighbor, inverse-distance case retrieval; inputs are scaled by the observed range and labels remain in the original FLEX vocabulary. Performance is leave-one-test-ID-out.' : track.id === 'spread' ? 'Four-neighbor inverse-distance interpolation of NASA BASS-II PMMA observations; evaluation leaves out an entire burn (M test ID) at a time.' : 'Direct evaluation of the published Dotson et al. (2011) smoke-point scaling law using its reported fuel factors and exponents.'}</p></section>
    </div>

    <div hidden={workspaceTab !== 'audit'}>
      <section className="ml-section ml-evidence-section" aria-labelledby="ml-evidence-title">
        <div className="ml-section-heading"><div><span className="ml-eyebrow">01 / INCLUDED & EXCLUDED EVIDENCE</span><h2 id="ml-evidence-title">What the local records can support</h2><p>Counts below are calculated from the bundled CSV files; they distinguish table rows from established independent experiments.</p></div><ReportButton track={track} audits={audits} /></div>
        {track.id === 'extinction' && <ExtinctionBranches audits={audits} active={activeSourceId} onSelect={setActiveSourceId} />}
        {track.id === 'extinction' ? <div className="ml-extinction-layout"><RecordSummary audit={activeAudit} /><ExtinctionVisualization audit={activeAudit} /></div> : track.id === 'spread' ? <><div className="ml-source-card-grid">{audits.map((audit) => <RecordSummary audit={audit} key={audit.sourceId} />)}</div><SpreadVisualization audits={audits} /></> : <><RecordSummary audit={activeAudit} /><SootVisualization audit={activeAudit} /></>}
        <div className="ml-source-inclusion"><div><span className="ml-eyebrow">ASSIGNMENT DECISION</span><p>{track.id === 'extinction' ? 'FLEX is the first candidate branch. CFI-G Normal and CFI-G Inverse remain distinct, separate datasets; neither is pooled with FLEX.' : track.id === 'spread' ? 'All three sources are retained for source-specific exploration. No pooled training table is created because target and measurement definitions do not align.' : 'PSI-107 alone is assigned to soot/smoke-point conditions. PSI-102 is kept as a separate smoke/aerosol detection evidence track.'}</p></div><div><span className="ml-eyebrow">OUT OF SCOPE / NOT BUNDLED</span>{track.additionalSources.map((source) => <p className="ml-additional-source" key={source.title}><a href={source.href} target="_blank" rel="noreferrer">{source.title} ↗</a> <span>{source.state}.</span> {source.note}</p>)}</div></div>
      </section>
      {track.id === 'extinction' && <section className="ml-section ml-branch-inventory" aria-labelledby="ml-branch-inventory-title"><div className="ml-section-heading"><div><span className="ml-eyebrow">BRANCH INVENTORY</span><h2 id="ml-branch-inventory-title">Separate evidence, separate experts</h2><p>Review each CFI-G configuration without blending its outcomes with the droplet branch.</p></div></div><div className="ml-branch-grid">{audits.map((audit) => <button type="button" className={`ml-branch-card ${audit.sourceId.toLowerCase() === activeSourceId ? 'is-selected' : ''}`} key={audit.sourceId} onClick={() => { setActiveSourceId(audit.sourceId.toLowerCase()); document.querySelector('.ml-evidence-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><span>{audit.sourceId}</span><strong>{audit.title}</strong><small>{audit.nonEmptyRows} non-empty source rows · {audit.exactDuplicateRows} exact repeat rows</small></button>)}</div></section>}
    </div>

    <div hidden={workspaceTab !== 'contract'}>
      <FieldDictionary audits={track.id === 'extinction' ? [activeAudit] : audits} />
      <QualityPanel track={track} audits={audits} />
    </div>
    <footer className="ml-page-foot"><span>FlameLens / research audit interface</span><span>Not certified for spacecraft operations · no fire-response authority</span></footer>
  </>;
}

function TrackSchematic({ id }: { id: ModelTrackId }) {
  if (id === 'extinction') {
    return <svg className="ml-hub-schematic" viewBox="0 0 260 58" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line x1="12" y1="29" x2="248" y2="29" stroke="rgba(169,181,197,0.18)" strokeDasharray="3 4"/>
      <circle cx="62" cy="29" r="20" fill="rgba(102,217,242,0.08)" stroke="#66d9f2" strokeWidth="1.2"/>
      <circle cx="62" cy="29" r="11" fill="rgba(243,182,90,0.18)" stroke="#f3b65a" strokeWidth="1.3"/>
      <circle cx="62" cy="29" r="4" fill="#f3f6fa"/>
      <text x="98" y="25" fill="#cbd5e1" fontSize="9.5" fontFamily="monospace">HOT → COOL DUAL REGIME</text>
      <text x="98" y="39" fill="#76c7a3" fontSize="9" fontFamily="monospace">O₂ / CO₂ / N₂ diluent</text>
    </svg>;
  }
  if (id === 'spread') {
    return <svg className="ml-hub-schematic" viewBox="0 0 260 58" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="16" y="38" width="228" height="8" rx="3" fill="rgba(169,181,197,0.18)"/>
      <path d="M22 38 C48 38 62 20 82 16 C100 20 116 35 150 38" fill="rgba(243,182,90,0.2)" stroke="#f3b65a" strokeWidth="1.6"/>
      <path d="M160 24 L228 24" stroke="#66d9f2" strokeWidth="1.4" strokeDasharray="4 3"/>
      <polygon points="228,24 221,20 221,28" fill="#66d9f2"/>
      <text x="158" y="16" fill="#66d9f2" fontSize="9" fontFamily="monospace">Vf(mm/s) →</text>
    </svg>;
  }
  return <svg className="ml-hub-schematic" viewBox="0 0 260 58" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <line x1="12" y1="18" x2="248" y2="18" stroke="rgba(230,106,82,0.45)" strokeDasharray="4 4"/>
    <path d="M46 50 Q58 22 64 11 Q70 22 82 50 Z" fill="rgba(243,182,90,0.22)" stroke="#f3b65a" strokeWidth="1.3"/>
    <path d="M56 18 L64 7 L72 18" fill="none" stroke="#e66a52" strokeWidth="1.3"/>
    <text x="102" y="14" fill="#e66a52" fontSize="9" fontFamily="monospace">SMOKE-POINT THRESHOLD</text>
    <text x="102" y="35" fill="#cbd5e1" fontSize="9.5" fontFamily="monospace">L_f / SPICE relation</text>
  </svg>;
}

function ModelHub({ auditsById }: { auditsById: Record<string, DatasetAudit> }) {
  return <>
    <header className="ml-hub-hero"><div className="ml-hub-hero-top"><div className="ml-hub-hero-copy"><span className="ml-eyebrow">FLAMELENS / MODEL LAB</span><h1>Explore the physics <em>with evidence.</em></h1><p>Choose a research track, set conditions, and run a local batch simulation using measured NASA records or a published combustion correlation.</p></div><div className="ml-hub-summary"><span><b>03</b><small>EXPERIMENT ENGINES</small></span><i /><span><b>02</b><small>NASA MEASUREMENT SOURCES</small></span><i /><span><b>01</b><small>PUBLISHED SPICE CORRELATION</small></span></div></div><ResearchMotionPlate /></header>
    <section className="ml-hub-grid" aria-label="Scientific model workspaces">{TRACK_ORDER.map((id) => { const track = MODEL_TRACKS[id]; const audits = track.sourceIds.map((sourceId) => auditsById[sourceId]).filter(Boolean); const status = deriveTrackStatus(track, audits, artifactCount(track.id)); const method = id === 'extinction' ? 'Case-based label retrieval · FLEX' : id === 'spread' ? 'Grouped empirical interpolation · BASS-II' : 'Published smoke-point relation · SPICE'; return <Link className={`ml-hub-card ml-hub-${id}`} to={`/models/${id}`} key={id}><div className="ml-hub-card-top"><span>{track.number} / RESEARCH TRACK</span><StatusTag tone="safe">Ready to explore</StatusTag></div><h2>{track.title}</h2><TrackSchematic id={id}/><p>{track.objective}</p><div className="ml-hub-card-meta"><span>{audits.length} indexed source tables</span><span>{formatCount(status.rowCount)} local rows audited</span><span>{method}</span></div><div className="ml-hub-card-link">Open experiment workspace <b aria-hidden="true">↗</b></div></Link>; })}</section>
    <section className="ml-hub-integrity"><span className="ml-eyebrow">HOW TO READ RESULTS</span><p>Virtual experiments calculate estimates from observed records and published relationships. They are research aids, not hardware tests or operational fire-safety predictions. Each result shows the source count, grouped evaluation where applicable, model method, and domain limits.</p></section>
  </>;
}

export function ModelLab() {
  const { trackId } = useParams<{ trackId?: string }>();
  const validTrack = trackId && Object.prototype.hasOwnProperty.call(MODEL_TRACKS, trackId) ? trackId as ModelTrackId : null;
  const [audits, setAudits] = useState<Record<string, DatasetAudit>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sourceIds = useMemo(() => [...new Set(Object.values(MODEL_TRACKS).flatMap((track) => track.sourceIds))], []);
  useEffect(() => {
    let active = true;
    Promise.all(sourceIds.map((sourceId) => auditModelDataset(sourceId)))
      .then((results) => { if (active) setAudits(Object.fromEntries(results.map((audit) => [audit.sourceId, audit]))); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'A local source table could not be read.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sourceIds]);
  if (trackId && !validTrack) return <Navigate to="/models" replace />;
  const track = validTrack ? MODEL_TRACKS[validTrack] : null;
  const currentAudits = track ? track.sourceIds.map((sourceId) => audits[sourceId]).filter(Boolean) : [];
  return <main className="model-lab app-workspace" id="main">
    <OverviewStarfield />
    <div className="ml-page-topline"><Link to="/dashboard">OVERVIEW</Link><span>/</span><Link to="/models">MODEL LAB</Link>{track && <><span>/</span><span>{track.title.toUpperCase()}</span></>}<span className="ml-data-status"><i />{loading ? 'READING LOCAL TABLES' : error ? 'SOURCE AUDIT ERROR' : 'LOCAL TABLES AUDITED'}</span></div>
    {loading ? <div className="ml-loading" role="status"><span className="ml-loading-mark">FL</span><p>Reading the bundled source tables…</p></div> : error ? <div className="ml-error" role="alert"><b>Local data audit could not complete.</b><p>{error}</p></div> : track ? <TrackWorkspace key={track.id} track={track} audits={currentAudits} /> : <ModelHub auditsById={audits} />}
  </main>;
}
