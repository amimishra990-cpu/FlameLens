import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { OverviewStarfield } from '../components/OverviewStarfield';
import { useAuth } from '../lib/AuthContext';
import {
  answerFromEvidence, COPILOT_PROMPTS, loadCopilotIndex, rankEvidence,
  type CopilotAnswer, type CopilotClaim, type CopilotIndex, type EvidenceMatch,
} from '../data/copilot';
import '../styles/copilot.css';

type Turn = { id: string; question: string; answer: CopilotAnswer; createdAt: number };
type ProviderState = 'checking' | 'not-configured' | 'ready' | 'unavailable';
const MAX_SAVED_TURNS = 40;

function readSavedTurns(key: string): Turn[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((turn): turn is Turn => Boolean(turn && typeof turn === 'object' &&
      typeof turn.id === 'string' && typeof turn.question === 'string' && typeof turn.createdAt === 'number' &&
      turn.answer && typeof turn.answer === 'object' && typeof turn.answer.summary === 'string' && Array.isArray(turn.answer.claims)))
      .slice(-MAX_SAVED_TURNS);
  } catch {
    return [];
  }
}

function Glyph({ name }: { name: 'orbit' | 'send' | 'source' | 'link' | 'reset' | 'shield' }) {
  const paths = {
    orbit: <><circle cx="12" cy="12" r="2.3"/><ellipse cx="12" cy="12" rx="9" ry="4.4" transform="rotate(-28 12 12)"/><path d="m17.9 6.1 1.3-1.3"/></>,
    send: <><path d="m21 3-7.2 18-3.6-7.2L3 10.2 21 3Z"/><path d="M10.2 13.8 21 3"/></>,
    source: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 5.5v15.2M8 7h8M8 10.5h8M8 14h5"/></>,
    link: <><path d="M10 13.5a4.5 4.5 0 0 0 6.4 0l2-2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1"/><path d="M14 10.5a4.5 4.5 0 0 0-6.4 0l-2 2A4.5 4.5 0 0 0 12 18.9l1.1-1.1"/></>,
    reset: <><path d="M3 12a9 9 0 1 0 2.5-6.2L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
    shield: <><path d="M12 22s8-3.8 8-10V5l-8-3-8 3v7c0 6.2 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function labelForSource(sourceType: string) {
  const labels: Record<string, string> = {
    primary_local_dataset: 'Primary data · local table',
    derived_transcription: 'Report-derived transcription',
    internal_audit: 'Internal audit · not a NASA finding',
    internal_methodology: 'FlameLens methodology note',
    internal_source_note: 'Source review note · secondary',
    internal_evidence_note: 'FlameLens evidence note',
    internal_project_document: 'FlameLens project document',
    secondary_reference: 'Reference · not indexed',
  };
  return labels[sourceType] || 'Local evidence source';
}

function EvidenceMap({ claims, activeId, onSelect }: { claims: CopilotClaim[]; activeId: string | null; onSelect: (id: string) => void }) {
  const sources = useMemo(() => {
    const byPath = new Map<string, EvidenceMatch>();
    claims.forEach((claim) => byPath.set(claim.evidence.source.localPath, claim.evidence));
    return [...byPath.values()].slice(0, 4);
  }, [claims]);
  if (!sources.length) return <div className="rc-map-empty"><span className="rc-map-empty-ring"/><p>Source links appear here when evidence is found.</p></div>;
  return <div className="rc-evidence-map" role="group" aria-label="Retrieved source trail">
    <svg className="rc-map-lines" viewBox="0 0 320 176" aria-hidden="true">
      {sources.map((source, index) => {
        const x = 48 + index * (224 / Math.max(1, sources.length - 1));
        const y = index % 2 ? 48 : 132;
        return <path key={source.chunk.id} d={`M160 88 Q ${(160 + x) / 2} ${y} ${x} ${y}`} className={`rc-map-line${activeId === source.chunk.id ? ' is-active' : ''}`} style={{ '--line-order': index } as CSSProperties}/>;
      })}
      <circle cx="160" cy="88" r="4" className="rc-map-origin"/>
    </svg>
    <div className="rc-map-origin-label"><span className="rc-map-origin-dot"/>CURRENT QUESTION</div>
    <div className="rc-map-nodes">
      {sources.map(({ chunk, source }, index) => <button key={chunk.id} type="button" className={`rc-map-node${activeId === chunk.id ? ' is-active' : ''}`} style={{ '--node-order': index } as CSSProperties} onClick={() => onSelect(chunk.id)} aria-label={`Open evidence from ${source.title}, ${chunk.locator}`} aria-pressed={activeId === chunk.id}>
        <span className="rc-map-node-mark"><i/></span>
        <span className="rc-map-node-id">{source.sourceId.toUpperCase()}</span>
      </button>)}
    </div>
    <p className="rc-map-caption">Each node is a retrieved source passage. Select one to inspect its locator.</p>
  </div>;
}

export function ResearchCopilot() {
  const { session, isGuest, loading: authLoading } = useAuth();
  const [index, setIndex] = useState<CopilotIndex | null>(null);
  const [indexError, setIndexError] = useState('');
  const [providerState, setProviderState] = useState<ProviderState>('checking');
  const [providerConsent, setProviderConsent] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [providerError, setProviderError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const historyKey = session?.user.id ? `flamelens:copilot-history:v1:${session.user.id}` : null;

  useEffect(() => {
    if (authLoading) return;
    const restored = historyKey ? readSavedTurns(historyKey) : [];
    setTurns(restored);
    const latestTurn = restored[restored.length - 1];
    setSelectedChunkId(latestTurn?.answer.claims[0]?.evidence.chunk.id ?? null);
    setHistoryReady(true);
  }, [authLoading, historyKey]);

  useEffect(() => {
    if (!historyReady || !historyKey) return;
    try {
      if (turns.length) window.localStorage.setItem(historyKey, JSON.stringify(turns.slice(-MAX_SAVED_TURNS)));
      else window.localStorage.removeItem(historyKey);
    } catch { /* Private browsing or storage limits should not interrupt research. */ }
  }, [historyKey, historyReady, turns]);

  useEffect(() => {
    let active = true;
    loadCopilotIndex().then((loaded) => { if (active) setIndex(loaded); })
      .catch((error: unknown) => { if (active) setIndexError(error instanceof Error ? error.message : 'Evidence index could not be loaded.'); });
    fetch('/api/copilot?mode=status', { headers: { Accept: 'application/json' } }).then(async (response) => {
      if (!response.ok) throw new Error('Provider status endpoint is unavailable.');
      return response.json() as Promise<{ configured?: boolean }>;
    }).then((status) => { if (active) setProviderState(status.configured ? 'ready' : 'not-configured'); })
      .catch(() => { if (active) setProviderState('unavailable'); });
    return () => { active = false; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length]);

  const activeTurn = turns[turns.length - 1];
  const activeClaims = activeTurn?.answer.claims ?? [];
  const selected = useMemo(() => {
    if (!index || !selectedChunkId) return null;
    const chunk = index.chunks.find((entry) => entry.id === selectedChunkId);
    const source = chunk && index.sources.find((entry) => entry.sourceId === chunk.sourceId);
    return chunk && source ? { chunk, source, score: 0 } : null;
  }, [index, selectedChunkId]);

  const askQuestion = async (raw: string) => {
    const nextQuestion = raw.trim();
    if (!nextQuestion || isWorking || !index) return;
    setIsWorking(true);
    setProviderError('');
    setQuestion('');
    try {
      let answer = answerFromEvidence(nextQuestion, index);
      const keepLocal = answer.kind === 'safety' || /\b(same|spice|soot|cfi[- ]?g|partial[- ]gravity|lunar gravity|mars gravity|one[- ]sixth|1\/6\s*g)\b/i.test(nextQuestion);
      if (providerConsent && providerState === 'ready' && !keepLocal) {
        try {
          if (!session?.access_token) throw new Error('Your sign-in session is missing. Sign in again to use the configured model.');
          const response = await fetch('/api/copilot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ question: nextQuestion }),
          });
          const payload = await response.json() as { claims?: { text: string; evidenceIds: string[] }[]; error?: string; followUps?: string[]; note?: string };
          if (!response.ok) throw new Error(payload.error || 'The configured provider could not answer this question.');
          const claims: CopilotClaim[] = (payload.claims || []).flatMap((claim) => claim.evidenceIds.map((evidenceId) => {
            const evidence = rankEvidence(nextQuestion, index, 8).find((match) => match.chunk.id === evidenceId);
            return evidence ? { text: claim.text, evidence, label: 'Provider summary · verify against cited source' } : null;
          }).filter((claim): claim is CopilotClaim => Boolean(claim)));
          answer = claims.length ? {
            kind: 'found', heading: 'Source-grounded model summary', summary: 'This summary was generated by the configured provider from retrieved local evidence. Each claim is paired with a verified source passage; inspect it before relying on the summary.', claims,
            followUps: payload.followUps || answer.followUps, note: payload.note || 'Provider summaries can be wrong. The cited source passage is the evidence of record.',
          } : answer;
        } catch (error) {
          setProviderError(error instanceof Error ? `${error.message} Showing local evidence results instead.` : 'Provider unavailable. Showing local evidence results instead.');
        }
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const turn = { id, question: nextQuestion, answer, createdAt: Date.now() };
      setTurns((current) => [...current, turn]);
      setSelectedChunkId(answer.claims[0]?.evidence.chunk.id ?? null);
    } finally {
      setIsWorking(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void askQuestion(question);
  };
  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void askQuestion(question);
    }
  };

  const clearSession = () => { setTurns([]); setQuestion(''); setSelectedChunkId(null); setProviderError(''); };

  return <section className="rc-page" aria-labelledby="rc-title">
    <OverviewStarfield />
    <div className="rc-frame">
      <header className="rc-heading-row">
        <div>
          <div className="rc-kicker"><span className="rc-kicker-line"/>RESEARCH INTELLIGENCE · LOCAL EVIDENCE INDEX</div>
          <h1 id="rc-title">Research <em>Copilot</em></h1>
          <p className="rc-intro">Ask about FlameLens datasets, investigation records, and methods. Every answer stays attached to a source passage you can inspect.</p>
        </div>
        <div className="rc-integrity-stamp"><Glyph name="shield"/><span>CLAIM-LEVEL<br/>PROVENANCE</span></div>
      </header>

      <div className="rc-statusbar" aria-live="polite">
        <span className={`rc-status-pip${indexError ? ' is-error' : index ? ' is-live' : ''}`}/>
        <span>{indexError ? 'INDEX UNAVAILABLE' : index ? 'LOCAL EVIDENCE INDEX READY' : 'READING SOURCE INDEX'}</span>
        <i aria-hidden="true"/>
        <span>{providerState === 'ready' ? 'SERVER PROVIDER CONFIGURED' : providerState === 'checking' ? 'CHECKING PROVIDER' : 'NO EXTERNAL MODEL CONNECTED'}</span>
        <span className="rc-status-spacer"/>
        <span className="rc-session-note">{session ? 'Account history · saved on this device' : isGuest ? 'Guest profile · chat is not saved' : 'Conversation stays in this tab'}</span>
      </div>

      {indexError ? <div className="rc-index-error" role="alert"><strong>Evidence index unavailable.</strong> {indexError} Restart the app or run the evidence-index build step, then reload.</div> : null}

      <div className="rc-workspace">
        <section className="rc-conversation" aria-label="Research conversation">
          <div className="rc-conversation-head">
            <div><span className="rc-eyebrow">WORKSPACE 01 / SOURCE REVIEW</span><h2>Evidence desk</h2></div>
            <button type="button" className="rc-clear-button" onClick={clearSession} disabled={!turns.length}><Glyph name="reset"/>{session ? 'Delete saved history' : 'Clear session'}</button>
          </div>

          {!turns.length ? <div className="rc-welcome">
            <div className="rc-welcome-graphic" aria-hidden="true"><div className="rc-crosshair rc-crosshair-h"/><div className="rc-crosshair rc-crosshair-v"/><span className="rc-welcome-core"><Glyph name="orbit"/></span><span className="rc-welcome-ring rc-ring-one"/><span className="rc-welcome-ring rc-ring-two"/><i className="rc-orbit-node rc-node-a"/><i className="rc-orbit-node rc-node-b"/><i className="rc-orbit-node rc-node-c"/></div>
            <p className="rc-welcome-label">A question starts the source trail</p>
            <h3>Where should we look?</h3>
            <p className="rc-welcome-copy">This workspace retrieves local passages and leaves the original labels, units, and evidence gaps visible.</p>
            <div className="rc-prompt-grid" aria-label="Suggested research questions">{COPILOT_PROMPTS.map((prompt, indexPrompt) => <button key={prompt} type="button" className="rc-prompt" onClick={() => void askQuestion(prompt)} disabled={!index || isWorking}><span>0{indexPrompt + 1}</span>{prompt}<b aria-hidden="true">↗</b></button>)}</div>
          </div> : <div className="rc-turn-list" aria-live="polite">
            {turns.map((turn, turnIndex) => <article className="rc-turn" key={turn.id}>
              <div className="rc-user-question"><span className="rc-turn-number">Q{String(turnIndex + 1).padStart(2, '0')}</span><p>{turn.question}</p></div>
              <div className={`rc-answer rc-answer-${turn.answer.kind}`}>
                <div className="rc-answer-mark"><Glyph name="orbit"/></div>
                <div className="rc-answer-content">
                  <div className="rc-answer-meta"><span>{turn.answer.kind === 'not-found' ? 'EVIDENCE GAP' : turn.answer.kind === 'safety' ? 'SCOPE BOUNDARY' : 'LOCAL RETRIEVAL'}</span><time>{new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(turn.createdAt)}</time></div>
                  <h3>{turn.answer.heading}</h3><p className="rc-answer-summary">{turn.answer.summary}</p>
                  {turn.answer.claims.length > 0 ? <div className="rc-claim-list">{turn.answer.claims.map((claim) => <article className="rc-claim" key={`${turn.id}-${claim.evidence.chunk.id}`}>
                    <p className="rc-claim-text">{claim.text}</p>
                    <div className="rc-claim-source-row"><span className="rc-claim-class">{claim.label}</span><button type="button" className={`rc-citation${selectedChunkId === claim.evidence.chunk.id ? ' is-active' : ''}`} onClick={() => setSelectedChunkId(claim.evidence.chunk.id)} aria-pressed={selectedChunkId === claim.evidence.chunk.id}>
                      <Glyph name="source"/><span>{claim.evidence.source.sourceId.toUpperCase()}</span><span className="rc-citation-locator">{claim.evidence.chunk.locator}</span><b aria-hidden="true">↗</b>
                    </button></div>
                  </article>)}</div> : null}
                  {turn.answer.note ? <p className="rc-answer-note">{turn.answer.note}</p> : null}
                  <div className="rc-followups"><span>CONTINUE WITH</span>{turn.answer.followUps.map((followUp) => <button type="button" key={followUp} onClick={() => void askQuestion(followUp)} disabled={isWorking}>{followUp}<b aria-hidden="true">→</b></button>)}</div>
                </div>
              </div>
            </article>)}
            {isWorking ? <div className="rc-loading-state" aria-live="polite"><span className="rc-loading-glyph"><Glyph name="orbit"/></span><span>Searching the local source index…</span><i/></div> : null}
            {providerError ? <p className="rc-provider-error" role="status">{providerError}</p> : null}
            <div ref={endRef}/>
          </div>}

          <form className="rc-composer" onSubmit={onSubmit}>
            <label htmlFor="rc-question" className="rc-composer-label">ASK A RESEARCH QUESTION <span>· {question.length}/1000</span></label>
            <textarea id="rc-question" value={question} maxLength={1000} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onInputKeyDown} placeholder="e.g. What does the supplied SPICE table actually measure?" disabled={!index || isWorking} rows={2}/>
            <div className="rc-composer-bottom">
              <span className="rc-composer-hint">Enter to send · Shift + Enter for a new line</span>
              <button type="submit" className="rc-send-button" disabled={!index || !question.trim() || isWorking}><span>{isWorking ? 'Searching' : 'Search evidence'}</span><Glyph name="send"/></button>
            </div>
            {providerState === 'ready' ? <label className="rc-provider-consent"><input type="checkbox" checked={providerConsent} onChange={(event) => setProviderConsent(event.target.checked)}/><span>Use configured AI provider. My question and retrieved public excerpts will be sent to it for a source-linked summary.</span></label> : null}
            {isGuest && providerState === 'ready' ? <p className="rc-provider-hint">Guest profiles use local evidence retrieval. Sign in to use the configured AI summary.</p> : null}
            {providerState === 'unavailable' ? <p className="rc-provider-hint">Provider status endpoint unavailable; this remains local-only retrieval.</p> : null}
          </form>
        </section>

        <aside className="rc-evidence-panel" aria-label="Evidence trail and source details">
          <div className="rc-panel-heading"><div><span className="rc-eyebrow">TRACE / VERIFY</span><h2>Evidence trail</h2></div><span className="rc-panel-index">{activeClaims.length.toString().padStart(2, '0')} LINKS</span></div>
          <EvidenceMap claims={activeClaims} activeId={selectedChunkId} onSelect={setSelectedChunkId}/>
          {selected ? <section className="rc-source-detail" aria-live="polite" aria-label="Selected source detail">
            <div className="rc-source-detail-top"><span className="rc-eyebrow">SELECTED SOURCE</span><span className="rc-source-id">{selected.source.sourceId.toUpperCase()}</span></div>
            <h3>{selected.source.title}</h3>
            <p className="rc-source-type">{labelForSource(selected.source.sourceType)}</p>
            <div className="rc-source-locator"><span>LOCATOR</span><b>{selected.chunk.locator}</b>{selected.chunk.line ? <small>· line / row {selected.chunk.line}</small> : null}</div>
            <blockquote>{selected.chunk.text}</blockquote>
            <details className="rc-meta-details">
              <summary>Technical provenance & file hash ▾</summary>
              <dl className="rc-source-metadata"><div><dt>AUTHOR / AGENCY</dt><dd>{selected.source.authorAgency}</dd></div><div><dt>VERSION</dt><dd>{selected.source.version}</dd></div><div><dt>LOCAL FILE</dt><dd className="rc-path">{selected.source.localPath}</dd></div><div><dt>CONTENT HASH</dt><dd className="rc-hash">{selected.source.sha256.slice(0, 16)}…</dd></div></dl>
            </details>
            {selected.source.officialUrl ? <a className="rc-source-link" href={selected.source.officialUrl} target="_blank" rel="noopener noreferrer"><Glyph name="link"/> Open linked source record <span aria-hidden="true">↗</span></a> : <p className="rc-source-link rc-source-link-muted"><Glyph name="source"/> No verified external source URL in the local registry</p>}
          </section> : <section className="rc-source-idle"><span className="rc-source-idle-mark"><Glyph name="source"/></span><h3>{index ? 'A source is one click away' : 'Source panel initializing'}</h3><p>Select a citation after asking a question. The local locator and source role will open here.</p><Link to="/explorer">Browse the investigation catalogue <span aria-hidden="true">↗</span></Link></section>}
          <div className="rc-index-foot"><span>INDEX INVENTORY</span><div><b>{index?.sources.filter((source) => source.ingestionStatus === 'indexed').length ?? '—'}</b> indexed sources <i/> <b>{index?.chunks.length.toLocaleString() ?? '—'}</b> passages</div>{(() => { const ok = index?.sources.filter((source) => source.ingestionStatus === 'indexed').length ?? 0; const fail = index?.parseFailures.length ?? 0; const total = Math.max(1, ok + fail); return index ? <div className="rc-index-bar" aria-label={`${ok} indexed sources, ${fail} unparsed references`}>{ok > 0 && <span className="rc-index-bar-ok" style={{ width: `${Math.round((ok / total) * 100)}%` }}/>}{fail > 0 && <span className="rc-index-bar-fail" style={{ width: `${Math.round((fail / total) * 100)}%` }}/>}</div> : null; })()}<p>{index?.parseFailures.length ? `${index.parseFailures.length} PDF reference${index.parseFailures.length === 1 ? '' : 's'} registered but not parsed.` : 'No parsing failures reported.'}</p></div>
        </aside>
      </div>

      <footer className="rc-footer"><span>FLAMELENS / RESEARCH COPILOT</span><p>Research discovery only · not a model validation, hazard rating, or spacecraft fire-response authority.</p><span>{session ? 'ACCOUNT HISTORY · THIS DEVICE' : isGuest ? 'GUEST · NOT SAVED' : 'SESSION-ONLY'}</span></footer>
    </div>
  </section>;
}
