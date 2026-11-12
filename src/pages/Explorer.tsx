import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { EXPLORER_RECORDS, RESEARCH_INTENTS, filterExplorerRecords, relevanceEvidence, type ResearchIntent, type ExplorerRecord } from '../data/explorer';
import { FUNCTION_LABEL } from '../data/investigations';
import { OverviewStarfield } from '../components/OverviewStarfield';

const INTENT_IDS = new Set<string>(RESEARCH_INTENTS.map((item) => item.id));
function intentFrom(value: string | null): ResearchIntent {
  return value && INTENT_IDS.has(value) ? value as ResearchIntent : 'extinction';
}
function formatNumber(value: number | null | undefined): string {
  return value == null ? 'Not reported' : new Intl.NumberFormat('en-US').format(value);
}
function fileName(path: string): string { return path.split('/').pop() ?? path; }
function detailHref(record: ExplorerRecord, search: URLSearchParams): string {
  const query = new URLSearchParams(search);
  return `/explorer/${encodeURIComponent(record.id)}${query.size ? `?${query.toString()}` : ''}`;
}

function EvidencePips({ points }: { points: number }) {
  return (
    <span className="explorer-pips" aria-label={`${points} of 7 evidence points`} title={`${points} / 7 evidence points`}>
      {Array.from({ length: 7 }, (_, i) => (
        <i key={i} className={i < points ? 'is-filled' : ''} aria-hidden="true" />
      ))}
      <b className="mono">{points}/7</b>
    </span>
  );
}

export function Explorer() {
  const { investigationId } = useParams();
  const [search, setSearch] = useSearchParams();
  const query = search.get('q') ?? '';
  const intent = intentFrom(search.get('intent'));
  const category = search.get('category') ?? '';
  const availability = search.get('availability') ?? '';
  const type = search.get('type') ?? '';
  const sort = search.get('sort') ?? 'relevance';
  const selected = investigationId ? EXPLORER_RECORDS.find((record) => record.id === investigationId) : undefined;

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value); else next.delete(key);
    setSearch(next, { replace: true });
  };
  const clear = () => setSearch(new URLSearchParams(), { replace: true });

  const records = useMemo(() => filterExplorerRecords({ query, category, availability, type, sort, intent }),
    [query, category, availability, type, sort, intent]);

  const nav = <Link className="explorer-back" to={`/explorer${search.size ? `?${search.toString()}` : ''}`}>← All investigations</Link>;
  if (investigationId) {
    if (!selected) return <section className="explorer-page"><OverviewStarfield /><div className="explorer-empty"><p className="section-label">Catalogue lookup</p><h1>Source not found</h1><p>No indexed record matches <code>{investigationId}</code>.</p>{nav}</div></section>;
    const evidence = relevanceEvidence(selected, intent);
    const inv = selected.investigation;
    return <section className="explorer-page explorer-detail">
      <OverviewStarfield />
      {nav}
      <div className="explorer-detail-kicker mono">{selected.sourceId} <span>·</span> {selected.availability}</div>
      <header className="explorer-detail-head">
        <div><p className="section-label">Investigation record</p><h1>{selected.title}</h1><p className="explorer-detail-subtitle">{inv.objective}</p></div>
        <span className={`explorer-function explorer-function-${inv.fn}`}>{FUNCTION_LABEL[inv.fn]}</span>
      </header>

      <div className="explorer-detail-grid">
        <div className="explorer-detail-main">
          <section className="explorer-panel" aria-labelledby="source-evidence-heading">
            <h2 id="source-evidence-heading">Source evidence</h2>
            <p className="explorer-detail-description">{selected.audit?.note ?? inv.caveat}</p>
            <div className="explorer-detail-kpis">
              <div><span className="mono">Availability</span><strong>{selected.availability}</strong></div>
              <div><span className="mono">Rows in audited file</span><strong>{formatNumber(selected.audit?.rows)}</strong></div>
              <div><span className="mono">Non-empty rows</span><strong>{formatNumber(selected.audit?.nonEmptyRows)}</strong></div>
              <div><span className="mono">Columns / exact duplicate rows</span><strong>{selected.audit ? `${formatNumber(selected.audit.columns)} / ${formatNumber(selected.audit.duplicates)}` : 'Not reported'}</strong></div>
            </div>
            <dl className="explorer-metadata">
              <div><dt>Data type</dt><dd>{selected.dataType}</dd></div>
              <div><dt>Campaign / investigation</dt><dd>{selected.audit?.title ?? inv.name}</dd></div>
              <div><dt>Phenomenon</dt><dd>{selected.audit?.category ?? FUNCTION_LABEL[inv.fn]}</dd></div>
              <div><dt>Materials</dt><dd>{selected.materials ?? 'Not reported in indexed source'}</dd></div>
              <div><dt>Hardware</dt><dd>{inv.facilityHardware ?? 'Not reported in indexed source'}</dd></div>
              <div><dt>Variables</dt><dd>{inv.measuredVariables ?? 'Not reported in indexed source'}</dd></div>
              <div><dt>Reported dates</dt><dd>{inv.dates ?? 'Not reported in indexed source'}</dd></div>
              <div><dt>Persistent identifier</dt><dd>{inv.doi ?? 'Not reported in indexed source'}</dd></div>
            </dl>
          </section>

          <section className="explorer-panel" aria-labelledby="ranking-heading">
            <div className="explorer-panel-heading"><div><p className="section-label">Selected intent · {RESEARCH_INTENTS.find((item) => item.id === intent)?.label}</p><h2 id="ranking-heading">Relevance evidence</h2></div><div className="explorer-match-group"><EvidencePips points={evidence.points} /><span className="explorer-match mono">{evidence.points} / 7 evidence points</span></div></div>
            <p className="explorer-method-summary">A traceable discovery heuristic, not model validation. It adds evidence for candidate target coverage, phenomenon match, described variables and a local audited file. Missing evidence is shown separately.</p>
            <div className="explorer-evidence-columns"><div><h3>Why it matches</h3><ul>{evidence.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div><div><h3>Evidence gaps</h3><ul>{evidence.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul></div></div>
          </section>
        </div>

        <aside className="explorer-detail-aside">
          <div className="explorer-panel"><h2>Source & files</h2>
            {selected.localFile ? <div className="explorer-file-entry"><span className="mono">LOCAL CSV</span><strong>{fileName(selected.localFile)}</strong><code>{selected.localFile}</code><p>Original audited table; opening it does not normalize rows or remove repeated records.</p>{selected.localFileUrl && <a className="explorer-source-link" href={selected.localFileUrl} download={fileName(selected.localFile)}>Download local CSV <span aria-hidden="true">↓</span></a>}</div> : <p className="explorer-aside-note">No dataset file is present in this project for this source.</p>}
            {inv.sourceUrl && <a className="explorer-source-link" href={inv.sourceUrl} target="_blank" rel="noreferrer">Open authoritative source <span aria-hidden="true">↗</span></a>}
            {inv.doi && <a className="explorer-source-link" href={`https://doi.org/${encodeURIComponent(inv.doi)}`} target="_blank" rel="noreferrer">Open persistent identifier <span aria-hidden="true">↗</span></a>}
          </div>
          <div className="explorer-panel explorer-limitations"><h2>Interpretation limits</h2><p>{inv.caveat}</p>{selected.audit && <p>{selected.audit.readiness}</p>}</div>
          <div className="explorer-panel"><h2>Related records</h2><ul className="explorer-related">{EXPLORER_RECORDS.filter((item) => item.id !== selected.id && item.investigation.fn === inv.fn).slice(0, 4).map((item) => <li key={item.id}><Link to={detailHref(item, search)}>{item.sourceId} · {item.title}</Link><span>{item.availability}</span></li>)}</ul></div>
        </aside>
      </div>
    </section>;
  }

  return <section className="explorer-page" aria-labelledby="explorer-heading">
    <OverviewStarfield />
    <header className="explorer-hero">
      <div className="explorer-hero-copy"><p className="section-label">FlameLens / Research index</p><h1 id="explorer-heading">Find the evidence<br /><em>behind the question.</em></h1><p>Search indexed NASA combustion investigations and see what their local files actually contain. Sources without bundled data remain clearly marked.</p></div>
      <div className="explorer-index-mark" aria-label="Investigation index marker"><span className="explorer-index-orbit orbit-a"/><span className="explorer-index-orbit orbit-b"/><span className="explorer-index-core"/><span className="explorer-index-label mono">SOURCE<br />INDEX</span></div>
      <div className="explorer-hero-foot mono"><span>PSI · NASA · INDEXED PROJECT SOURCES</span><span>{EXPLORER_RECORDS.length.toString().padStart(2, '0')} catalogued records</span></div>
    </header>

    <div className="explorer-search-block">
      <label htmlFor="explorer-query" className="explorer-search-label mono">Search investigations, files, variables, materials</label>
      <div className="explorer-search-row"><span aria-hidden="true" className="explorer-search-glyph">⌕</span><input id="explorer-query" type="search" value={query} onChange={(event) => update('q', event.target.value)} placeholder="Try ‘PSI-102’, soot, PMMA, extinction…"/><kbd>ENTER</kbd></div>
      <div className="explorer-intents" role="group" aria-label="Research question">
        <span className="mono">RESEARCH INTENT</span>{RESEARCH_INTENTS.map((item) => <button type="button" key={item.id} className={intent === item.id ? 'is-selected' : ''} aria-pressed={intent === item.id} onClick={() => update('intent', item.id)}>{item.label}</button>)}
      </div>
    </div>

    <div className="explorer-workspace">
      <aside className="explorer-filters" aria-label="Filter investigations">
        <div className="explorer-filters-heading"><h2>Refine index</h2><button type="button" onClick={clear}>Reset</button></div>
        <label>Research area<select value={category} onChange={(event) => update('category', event.target.value)}><option value="">All areas</option>{[...new Set(EXPLORER_RECORDS.map((item) => item.phenomenonGroup))].sort().map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Availability<select value={availability} onChange={(event) => update('availability', event.target.value)}><option value="">All states</option>{[...new Set(EXPLORER_RECORDS.map((item) => item.availability))].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Indexed material<select value={type} onChange={(event) => update('type', event.target.value)}><option value="">All types</option>{[...new Set(EXPLORER_RECORDS.map((item) => item.dataType))].map((value) => <option key={value}>{value}</option>)}</select></label>
        <div className="explorer-filter-note"><span aria-hidden="true">i</span><p>Local availability means a file is present in this project. Metadata and publications do not count as local datasets.</p></div>
      </aside>

      <div className="explorer-results-area">
        <div className="explorer-results-header"><div><p className="section-label">Evidence index</p><h2>{records.length} {records.length === 1 ? 'record' : 'records'} <span>· {RESEARCH_INTENTS.find((item) => item.id === intent)?.label}</span></h2></div><label className="explorer-sort">Sort by<select value={sort} onChange={(event) => update('sort', event.target.value)}><option value="relevance">Evidence relevance</option><option value="title">Title</option><option value="id">Source ID</option><option value="completeness">Metadata completeness</option></select></label></div>
        {records.length ? <div className="explorer-result-list">{records.map((record, index) => {
          const evidence = relevanceEvidence(record, intent);
          const inv = record.investigation;
          return <article className="explorer-result" key={record.id}>
            <div className="explorer-result-index mono">{String(index + 1).padStart(2, '0')}<span/></div>
            <div className="explorer-result-body"><div className="explorer-result-meta mono"><span>{record.sourceId}</span><span>{record.availability}</span>{record.audit && <span>{formatNumber(record.audit.nonEmptyRows)} non-empty rows</span>}<EvidencePips points={evidence.points} /></div>
              <h3><Link to={detailHref(record, search)}>{record.title}<span aria-hidden="true"> ↗</span></Link></h3>
              <p className="explorer-result-description">{inv.objective}</p>
              <div className="explorer-result-tags"><span>{FUNCTION_LABEL[inv.fn]}</span><span>{record.phenomenonGroup}</span>{record.materials && <span>{record.materials.split(/[;,]/)[0]}</span>}{record.audit && <span>{record.audit.columns} fields</span>}</div>
              <div className="explorer-result-bottom"><span className={`explorer-status status-${inv.status}`}><i aria-hidden="true"/>{record.availability}</span><span className="explorer-result-match">{evidence.reasons[0]}</span><Link className="explorer-inspect" to={detailHref(record, search)}>Inspect evidence <span aria-hidden="true">→</span></Link></div>
            </div>
          </article>;
        })}</div> : <div className="explorer-empty"><p className="section-label">No indexed matches</p><h2>No source fits those filters.</h2><p>Try a broader search or clear one of the filters. Missing local evidence is not filled with synthetic results.</p><button type="button" className="btn btn-secondary" onClick={clear}>Clear filters</button></div>}
        <p className="explorer-footnote">Records and row counts come from the project’s dataset audit and source catalogue. Rankings summarize source fit and availability; they do not indicate scientific validity.</p>
      </div>
    </div>
  </section>;
}

