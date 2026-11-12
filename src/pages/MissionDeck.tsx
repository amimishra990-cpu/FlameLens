import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { OverviewStarfield } from '../components/OverviewStarfield';
import { MissionGuideMascot } from '../components/MissionGuideMascot';
import { useReducedMotion } from '../lib/useReducedMotion';

type Choice = { id: string; label: string; correct: boolean; feedback: string };
type Level = { id: string; title: string; shortTitle: string; source: string; sourceTo: string; situation: string; prompt: string; choices: Choice[]; debrief: string };

export const MISSION_LEVELS: Level[] = [
  {
    id: 'event-log', title: 'The Vanishing Flame', shortTitle: 'Event log', source: 'NASA PSI-69 · FLEX', sourceTo: '/models/extinction',
    situation: 'A fictional research console flags a droplet test as “extinguished.” The dashboard team wants to freeze that word as the model’s verified outcome.',
    prompt: 'What is the evidence-safe move?',
    choices: [
      { id: 'accept', label: 'Treat “Extinction” as a verified physical end state.', correct: false, feedback: 'The local FLEX table records the label, but the observation protocol and event definition have not been verified.' },
      { id: 'preserve', label: 'Keep the source label and hold target approval until its event definition and censoring rules are checked.', correct: true, feedback: 'Correct. Preserve what the source actually records. The local PSI-69 audit contains Extinction, Disruption, and Completion labels; their semantics are unresolved, so they must not be collapsed into a validated target.' },
      { id: 'merge', label: 'Merge all three end labels into a single “failure” class.', correct: false, feedback: 'That would change the source meanings and invent a shared class. The three labels remain separate until their definitions are established.' },
    ],
    debrief: 'A recorded category is an observation in a table. It does not become a verified physical definition just because its name sounds familiar.',
  },
  {
    id: 'front-alert', title: 'The Mislabelled Front', shortTitle: 'Regime check', source: 'NASA PSI-25 / PSI-99 · BASS-II / SAFFIRE-II', sourceTo: '/models/spread',
    situation: 'A fictional briefing calls a spread result “microgravity.” Its source line is labelled “1-g Spread Rate,” and a second SAFFIRE-II field carries an unresolved “?-g” marker.',
    prompt: 'Which record should the investigation trust?',
    choices: [
      { id: 'relabel', label: 'Relabel the 1-g rate as microgravity because it appears in a spaceflight dataset.', correct: false, feedback: 'A mission context does not change the stated gravity regime. The source explicitly labels this rate 1-g.' },
      { id: 'pool', label: 'Combine both fields and treat blank or unclear values as zero spread.', correct: false, feedback: 'Missing and unresolved values are not zero. The “?-g” marker remains unverified, so combining these records would erase a real applicability limit.' },
      { id: 'separate', label: 'Keep the 1-g result separate, quarantine the unresolved gravity marker, and use only measurements with a verified regime and definition.', correct: true, feedback: 'Correct. Keep regimes separate. The NASA BASS-II PMMA Table 5.1 points support a bounded empirical exploration; they do not validate a general microgravity spread model.' },
    ],
    debrief: 'A dataset’s spaceflight setting does not establish that every row is a microgravity measurement. Regime and measurement definition travel with each result.',
  },
  {
    id: 'smoke-signal', title: 'The Smoke Signal', shortTitle: 'Target check', source: 'NASA PSI-102 SAME / PSI-107 SPICE', sourceTo: '/models/soot-smoke',
    situation: 'A fictional console turns a SAME smoke/aerosol record into a soot-production alert. A SPICE conditions table is available, but its local CSV contains no soot or smoke-point target.',
    prompt: 'How do you clear the evidence mismatch?',
    choices: [
      { id: 'same-soot', label: 'Use the SAME smoke record as a soot-volume-fraction measurement.', correct: false, feedback: 'PSI-102 SAME is a smoke/aerosol-detection investigation. Its local table has no particle-size distribution or detector-response target, and it is not a soot-production measurement.' },
      { id: 'spice-input', label: 'Treat SPICE input conditions as measured soot output.', correct: false, feedback: 'The bundled PSI-107 table records conditions, not soot output. An input table cannot supply a missing target.' },
      { id: 'request-target', label: 'Keep SAME and SPICE distinct; seek a verified, linked SPICE outcome product before making a soot claim.', correct: true, feedback: 'Correct. PSI-102 detection and PSI-107 SPICE conditions answer different questions. The local SPICE target is absent, so this evidence cannot support a soot prediction.' },
    ],
    debrief: 'Related words do not make interchangeable measurements. Confirm the target, method, units, and run linkage before interpreting a signal.',
  },
];

export function MissionDeck() {
  const [levelIndex, setLevelIndex] = useState(0);
  const [unlockedThrough, setUnlockedThrough] = useState(0);
  const [solved, setSolved] = useState<string[]>([]);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [guideAction, setGuideAction] = useState<'Idle' | 'Walk' | 'Special'>('Idle');
  const reducedMotion = useReducedMotion();
  const level = MISSION_LEVELS[levelIndex];
  const choice = useMemo(() => level.choices.find((item) => item.id === choiceId) ?? null, [level, choiceId]);
  const complete = solved.length === MISSION_LEVELS.length;
  const guideLine = complete
    ? 'All three evidence challenges are clear. The win is knowing exactly what the record can support—and where it stops.'
    : choice?.correct
      ? 'Nice work. That call follows the evidence. Your next level is ready when you are.'
      : choice
        ? 'Not quite. Read the source boundary in the debrief, then take another run at it.'
        : levelIndex === 0
          ? 'Commander, the log reports “Extinction.” Does that word tell us everything we need to know?'
          : levelIndex === 1
            ? 'Commander, check the gravity label before this result crosses into a new regime.'
            : 'Commander, these two records both mention smoke. Are they measuring the same thing?';

  const selectLevel = (index: number) => {
    if (index > unlockedThrough || index === levelIndex) return;
    setLevelIndex(index);
    setChoiceId(null);
    setDebriefOpen(false);
  };
  const submitChoice = (id: string) => {
    if (choice?.correct) return;
    const selected = level.choices.find((item) => item.id === id);
    if (!selected) return;
    setChoiceId(id);
    setDebriefOpen(true);
    if (selected.correct) {
      setSolved((items) => items.includes(level.id) ? items : [...items, level.id]);
      setUnlockedThrough((value) => Math.max(value, Math.min(levelIndex + 1, MISSION_LEVELS.length - 1)));
      setGuideAction('Special');
    }
  };
  const nextLevel = () => {
    if (!choice?.correct || levelIndex >= MISSION_LEVELS.length - 1) return;
    setLevelIndex((index) => index + 1);
    setChoiceId(null);
    setDebriefOpen(false);
    setGuideAction('Walk');
  };
  const restart = () => {
    setLevelIndex(0);
    setUnlockedThrough(0);
    setSolved([]);
    setChoiceId(null);
    setDebriefOpen(false);
    setGuideAction('Idle');
  };

  return <main id="main-content" className="mission-deck">
    <OverviewStarfield />
    <header className="md-game-header">
      <div className="md-game-title">
        <p className="md-kicker"><span className="md-radar-mark" aria-hidden="true"><i /></span> FLAMELENS TRAINING SIMULATOR <b>·</b> SCENARIO MODE</p>
        <h1>Evidence <em>under pressure.</em></h1>
        <p>Three fictional research emergencies. Make the call that the evidence supports, unlock the next level, and learn where the science stops.</p>
      </div>
      <div className="md-score" aria-label={`${solved.length} of 3 levels cleared`}>
        <span>CASE FILE</span><b>{String(solved.length).padStart(2, '0')}<i> / 03</i></b><small>levels cleared</small>
        <div className="md-score-track" aria-hidden="true"><i style={{ width: `${(solved.length / MISSION_LEVELS.length) * 100}%` }} /></div>
      </div>
    </header>

    <section className="md-level-map" aria-label="Scenario levels">
      <div className="md-map-heading"><span>THE INCIDENT BOARD</span><span>CHOOSE A CLEARED LEVEL · NEXT LEVELS UNLOCK IN ORDER</span></div>
      <div className="md-level-track">{MISSION_LEVELS.map((item, index) => {
        const cleared = solved.includes(item.id);
        const locked = index > unlockedThrough;
        return <button key={item.id} type="button" className={`md-level-tab${index === levelIndex ? ' is-active' : ''}${cleared ? ' is-cleared' : ''}${locked ? ' is-locked' : ''}`} onClick={() => selectLevel(index)} aria-pressed={index === levelIndex} aria-disabled={locked} disabled={locked}>
          <span className="md-level-orbit"><i>{cleared ? '✓' : locked ? '·' : `0${index + 1}`}</i></span>
          <span className="md-level-tab-copy"><b>LEVEL 0{index + 1}</b><strong>{item.shortTitle}</strong></span>
          <span className="md-level-status">{cleared ? 'CLEARED' : locked ? 'LOCKED' : index === levelIndex ? 'IN PROGRESS' : 'READY'}</span>
        </button>;
      })}</div>
    </section>

    <section className="md-scenario-shell" aria-labelledby="md-scenario-title">
      <div className="md-scenario-topline"><span><i className="md-alert-dot" /> SIMULATED RESEARCH INCIDENT</span><Link to={level.sourceTo}>SOURCE RECORD · {level.source} ↗</Link></div>
      <div className="md-scenario-layout">
        <div className="md-scenario-main">
          <div className="md-scenario-heading"><span>LEVEL 0{levelIndex + 1} <i>/</i> DECISION POINT</span><span>CASE {String(levelIndex + 1).padStart(2, '0')}—03</span></div>
          <h2 id="md-scenario-title">{complete ? 'Evidence desk cleared' : level.title}</h2>
          {complete ? <div className="md-win-state"><span className="md-win-seal" aria-hidden="true">✓</span><div><b>CASE FILE CLOSED</b><p>You completed all three evidence decisions. No fire-response procedure was simulated or recommended.</p><button type="button" className="md-restart" onClick={restart}>Run the scenarios again <span aria-hidden="true">↻</span></button></div></div> : <>
            <p className="md-situation">{level.situation}</p>
            <fieldset className="md-choices" disabled={Boolean(choice?.correct)}>
              <legend>{level.prompt}</legend>
              {level.choices.map((item, index) => {
                const selected = choiceId === item.id;
                return <label key={item.id} className={`md-choice${selected ? ' is-selected' : ''}${selected && item.correct ? ' is-correct' : ''}${selected && !item.correct ? ' is-incorrect' : ''}`}>
                  <input type="radio" name={level.id} value={item.id} checked={selected} onChange={() => submitChoice(item.id)} />
                  <span className="md-choice-letter">{String.fromCharCode(65 + index)}</span><span className="md-choice-text">{item.label}</span><span className="md-choice-mark" aria-hidden="true">{selected ? item.correct ? '✓' : '×' : '↗'}</span>
                </label>;
              })}
            </fieldset>
            {choice && <div className={`md-feedback ${choice.correct ? 'is-correct' : 'is-incorrect'}`} role="status" aria-live="polite">
              <div><span>{choice.correct ? 'DECISION SUPPORTED' : 'RECHECK THE RECORD'}</span><p>{choice.feedback}</p></div>
              {choice.correct && levelIndex < MISSION_LEVELS.length - 1 ? <button type="button" onClick={nextLevel}>Unlock next level <b aria-hidden="true">→</b></button> : !choice.correct ? <button type="button" onClick={() => setChoiceId(null)}>Try again <b aria-hidden="true">↻</b></button> : null}
            </div>}
            <div className="md-evidence-debrief">
              <button
                type="button"
                className="md-debrief-toggle"
                aria-expanded={debriefOpen}
                onClick={() => setDebriefOpen((open) => !open)}
              >
                <span>FIELD NOTE</span>
                <b>{debriefOpen ? 'Hide ▴' : 'Show note ▾'}</b>
              </button>
              {debriefOpen && <p>{level.debrief}</p>}
            </div>
          </>}
        </div>
        <aside className="md-guide" aria-label="Mission guide">
          <div className="md-guide-window"><div className="md-guide-stars" aria-hidden="true" /><div className="md-guide-scan" aria-hidden="true" /><MissionGuideMascot action={reducedMotion ? 'Idle' : guideAction} /><span className="md-guide-tag">MICA / FIELD GUIDE</span><span className="md-guide-coord">{String(levelIndex + 1).padStart(2, '0')} · {level.shortTitle.toUpperCase()}</span></div>
          <div className="md-guide-dialog" aria-live="polite"><div className="md-guide-speaker"><span>FIELD GUIDE / MICA</span><i>{complete || choice?.correct ? 'DECISION MATCH' : 'STANDING BY'}</i></div><p>{guideLine}</p></div>
          <a className="md-asset-credit" href="https://gobkit.com/freebies" target="_blank" rel="noreferrer">RoboCatHelper mesh & rig · Gobkit free library · CC0 1.0 ↗</a>
        </aside>
      </div>
      <div className="md-scenario-footer"><span>ILLUSTRATIVE SCENARIOS · SOURCE FACTS ARE CITED PER LEVEL</span><span>NOT FOR REAL-WORLD FIRE RESPONSE</span></div>
    </section>

    <aside className="md-integrity-strip"><span className="md-integrity-icon" aria-hidden="true">i</span><p>This is a fictional science-literacy game. Your score reflects answers in this session, not real-world readiness or an operational safety recommendation. Models and validated prediction targets are not currently available.</p><Link to="/models">Review the evidence in Model Lab <b aria-hidden="true">↗</b></Link></aside>
  </main>;
}
