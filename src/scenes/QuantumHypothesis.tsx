import { useCallback, useEffect, useRef, useState } from 'react';
import katex from 'katex';

function MathFormula({ formula }: { formula: string }) {
  const html = katex.renderToString(formula, { output: 'htmlAndMathml', displayMode: true, throwOnError: false, strict: 'ignore' });
  return <div className="qh-rendered-equation" dangerouslySetInnerHTML={{ __html: html }} />;
}

function preferredNarratorVoice() {
  if (!('speechSynthesis' in window)) return undefined;
  return window.speechSynthesis.getVoices()
    .filter((voice) => /^en([-_]|$)/i.test(voice.lang))
    .sort((a, b) => {
      const score = (name: string, lang: string, local: boolean) =>
        (/natural|neural|premium|online/i.test(name) ? 50 : 0) +
        (/aria|jenny|ava|samantha|google us english|zira/i.test(name) ? 25 : 0) +
        (/^en-US/i.test(lang) ? 15 : /^en-GB/i.test(lang) ? 8 : 0) +
        (!local ? 10 : 0) -
        (/novelty|whisper/i.test(name) ? 80 : 0);
      return score(b.name, b.lang, b.localService) - score(a.name, a.lang, a.localService);
    })[0];
}

type AmbientSound = { context: AudioContext; master: GainNode; oscillators: OscillatorNode[] };

const story = [
  { chapter: 'Prologue', title: 'Once upon a time, long ago...', text: 'Once upon a time, long ago, in a place far beyond the reach of ordinary gravity, there lived a tiny droplet of fuel.\n\nAround it burned a beautiful flame. It glowed, danced and illuminated the darkness around it.\n\nThen, one moment, the light disappeared.\n\nThe story should have ended there.\n\nBut it didn’t.' },
  { chapter: 'Chapter I — The Flame That Disappeared', title: 'An ending in two acts', text: 'In some NASA FLEX droplet experiments, sufficiently large n-alkane droplets continued to vaporise after their visible hot flame underwent radiative extinction. Later, a distinct event marked the end of that regression.\n\nThe camera saw darkness. The droplet’s changing size told another part of the story. Neither observation alone reveals every reaction taking place in the surrounding gas.' },
  { chapter: 'Chapter II — A World Without Ordinary Gravity', title: 'The quiet between currents', text: 'Far from ordinary gravity, buoyancy-driven flow is strongly suppressed. The flame does not simply lose every way to move: diffusion still carries heat and species, forced flow may remain, fuel vapour streams outward through Stefan flow, radiation carries energy away, and residual accelerations can still matter.\n\nThe setting changes the transport around the droplet—not the intrinsic quantum nature of a bond.' },
  { chapter: 'Chapter III — The Hidden Chemical Journey', title: 'Letters in a molecular story', text: 'A fuel molecule RH can give up a hydrogen atom to a reaction partner X, leaving a radical R. Oxygen may then add to R to form RO₂, an alkylperoxy radical. Rearrangement can form QOOH, a hydroperoxyalkyl radical.\n\nThese are signposts in a complicated, fuel-specific network—not a complete recipe. Low-temperature oxidation can continue through routes that do not announce themselves as a bright hot flame.' },
  { chapter: 'Chapter IV — A Strange Quantum Possibility', title: 'The narrow path', text: 'In a selected hydrogen-transfer step, the hydrogen nucleus may have a quantum-mechanical chance to pass through part of an activation barrier. This is tunnelling. It can alter an elementary reaction rate under suitable molecular and thermal conditions.\n\nThe flame itself is not a quantum object. Whether tunnelling matters enough to change the droplet’s macroscopic fate is still an open question.' },
  { chapter: 'Chapter V — The Mystery Beyond the Light', title: 'Three clocks, one droplet', text: 'There may be three different endings: the visible hot flame disappears; measurable chemical conversion ceases; and measurable droplet regression ceases. They need not occur at the same time.\n\nTo tell them apart requires more than a dark image. It takes carefully matched optical, size, chemical or calorimetric evidence—and honest uncertainty.' },
  { chapter: 'Chapter V — The Mystery Beyond the Light', title: 'A question, not a verdict', text: 'Could tunnelling-sensitive hydrogen-transfer kinetics shift the boundary between visible-flame extinction, post-luminous cool-flame persistence and complete chemical extinction in microgravity droplet combustion?\n\nThe FLEX observations motivate the question. They do not measure tunnelling, and they do not prove this explanation. A mechanism must make predictions that survive independent tests—and be allowed to fail.' },
  { chapter: 'Epilogue', title: 'Where the light ends', text: 'The next pages leave the fairy tale and enter the workbench: reaction networks, transport equations, evidence boundaries and experiments that could answer back.\n\nAnd so, the mystery begins where the light ends.' },
];
const storyIllustrations = [
  { src: '/images/storybook/flame-birth.jpg', alt: 'A tiny fuel droplet glowing inside a delicate flame in deep space' },
  { src: '/images/storybook/afterglow.jpg', alt: 'A darkened droplet surrounded by a faint remaining vapour halo' },
  { src: '/images/storybook/microgravity.jpg', alt: 'A spherical droplet burning in a microgravity research chamber' },
  { src: '/images/storybook/molecular-pathway.jpg', alt: 'A conceptual molecular sequence showing hydrogen transfer and oxygen addition' },
  { src: '/images/storybook/tunnelling.jpg', alt: 'A luminous particle beside a translucent energy barrier, suggesting quantum tunnelling' },
  { src: '/images/storybook/afterglow.jpg', alt: 'A droplet and its fading flame after visible light has disappeared' },
  { src: '/images/storybook/tunnelling.jpg', alt: 'A conceptual quantum hypothesis posed as a question to be tested' },
  { src: '/images/storybook/flame-birth.jpg', alt: 'The small flame around the fuel droplet before its light fades' },
];

const datasets = [
  ['PSI-69 · FLEX', 'Primary retrospective anchor', 'Droplet extinction and reported post-luminous regression context. Can motivate timing analysis; existing records do not directly measure tunnelling or every radical.'],
  ['PSI-159 · ACME CFI-G', 'Gas-phase comparison', 'Cool diffusion flames. Normal and inverse configurations remain separate; they are not droplet experiments.'],
  ['PSI-25 · BASS-II / SAFFIRE', 'Solid-fuel context', 'Ignition, flame growth, spread and extinction on solids. Different fuel geometry and pathways limit direct transfer.'],
  ['PSI-107 · SPICE', 'Soot context', 'Smoke-point and soot-related behaviour; useful context, not a direct test of droplet low-temperature kinetics.'],
  ['PSI-102 · SAME', 'Aerosol context', 'Smoke aerosol and detection context; it cannot establish a specific flame radical sequence.'],
];
const stages = ['Retrospective FLEX analysis', 'Quantum-kinetic mechanism development', 'Isotope-resolved microgravity experiments', 'Integration into FlameLens analysis'];

export function QuantumHypothesis() {
  const [page, setPage] = useState(0); const [flipping, setFlipping] = useState(false); const [storyDone, setStoryDone] = useState(false); const [narrationOn, setNarrationOn] = useState(false); const [ambienceOn, setAmbienceOn] = useState(false); const [narratorName, setNarratorName] = useState(''); const [audioNotice, setAudioNotice] = useState('');
  const [gravity, setGravity] = useState<'normal' | 'micro'>('micro'); const [event, setEvent] = useState(1); const [activeData, setActiveData] = useState(0);
  const touchX = useRef<number | null>(null); const scienceRef = useRef<HTMLElement>(null);
  const ambienceRef = useRef<AmbientSound | null>(null); const ambienceSuspendTimer = useRef<number | null>(null);
  const speakPage = useCallback((index: number) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const narration = new SpeechSynthesisUtterance(`${story[index].chapter}. ${story[index].title}. ${story[index].text}`);
    const voice = preferredNarratorVoice();
    if (voice) { narration.voice = voice; narration.lang = voice.lang; setNarratorName(voice.name); }
    narration.rate = 0.87; narration.pitch = 1.02; narration.volume = 0.96;
    window.speechSynthesis.speak(narration);
  }, []);
  const stopAmbience = useCallback(() => {
    const sound = ambienceRef.current;
    if (!sound) { setAmbienceOn(false); return; }
    const now = sound.context.currentTime;
    sound.master.gain.cancelScheduledValues(now);
    sound.master.gain.setTargetAtTime(0, now, 0.7);
    if (ambienceSuspendTimer.current !== null) window.clearTimeout(ambienceSuspendTimer.current);
    ambienceSuspendTimer.current = window.setTimeout(() => { if (sound.context.state !== 'closed') void sound.context.suspend().catch(() => {}); }, 2200);
    setAmbienceOn(false);
  }, []);
  const toggleAmbience = useCallback(() => {
    if (ambienceOn) { stopAmbience(); return; }
    try {
      let sound = ambienceRef.current;
      if (!sound) {
        const context = new window.AudioContext();
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 460; filter.Q.value = 0.45;
        const master = context.createGain(); master.gain.value = 0;
        const dry = context.createGain(); dry.gain.value = 0.68;
        const wet = context.createGain(); wet.gain.value = 0.36;
        const reverb = context.createConvolver();
        const impulseLength = Math.floor(context.sampleRate * 2.6);
        const impulse = context.createBuffer(2, impulseLength, context.sampleRate);
        for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
          const samples = impulse.getChannelData(channel);
          for (let i = 0; i < samples.length; i += 1) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 2.8);
        }
        reverb.buffer = impulse;
        filter.connect(dry); filter.connect(reverb); dry.connect(master); reverb.connect(wet); wet.connect(master); master.connect(context.destination);
        const oscillators: OscillatorNode[] = [];
        [[110, 0.25], [130.81, 0.16], [164.81, 0.11], [220, 0.035]].forEach(([frequency, level]) => {
          const oscillator = context.createOscillator();
          const voiceGain = context.createGain();
          oscillator.type = 'sine'; oscillator.frequency.value = frequency;
          voiceGain.gain.value = level;
          oscillator.connect(voiceGain); voiceGain.connect(filter); oscillator.start(); oscillators.push(oscillator);
        });
        const tide = context.createOscillator(); const tideDepth = context.createGain();
        tide.frequency.value = 0.07; tideDepth.gain.value = 82;
        tide.connect(tideDepth); tideDepth.connect(filter.frequency); tide.start(); oscillators.push(tide);
        sound = { context, master, oscillators };
        ambienceRef.current = sound;
      }
      if (ambienceSuspendTimer.current !== null) { window.clearTimeout(ambienceSuspendTimer.current); ambienceSuspendTimer.current = null; }
      const activeSound = sound;
      void activeSound.context.resume().then(() => {
        const now = activeSound.context.currentTime;
        activeSound.master.gain.cancelScheduledValues(now);
        activeSound.master.gain.setTargetAtTime(0.16, now, 1.25);
      }).catch(() => { setAudioNotice('Ambient audio is unavailable in this browser.'); setAmbienceOn(false); });
      setAudioNotice(''); setAmbienceOn(true);
    } catch {
      setAudioNotice('Ambient audio is unavailable in this browser.'); setAmbienceOn(false);
    }
  }, [ambienceOn, stopAmbience]);
  const completeStory = useCallback(() => {
    if (flipping || storyDone || page !== story.length - 1) return;
    setFlipping(true);
    window.setTimeout(() => {
      window.speechSynthesis?.cancel();
      stopAmbience(); setNarrationOn(false);
      setStoryDone(true);
      setFlipping(false);
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650);
  }, [flipping, page, storyDone, stopAmbience]);
  const turn = useCallback((direction: number) => {
    if (flipping || storyDone) return;
    if (direction > 0 && page === story.length - 1) { completeStory(); return; }
    const next = Math.max(0, Math.min(story.length - 1, page + direction));
    if (next === page) return;
    setFlipping(true);
    window.setTimeout(() => { setPage(next); setFlipping(false); if (narrationOn) speakPage(next); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 760);
  }, [completeStory, flipping, narrationOn, page, speakPage, storyDone]);
  useEffect(() => {
    if (storyDone) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.body.classList.add('qh-reading-lock');
    document.documentElement.style.overflow = 'hidden';
    return () => { document.body.classList.remove('qh-reading-lock'); document.documentElement.style.overflow = previousOverflow; window.speechSynthesis?.cancel(); };
  }, [storyDone]);
  useEffect(() => {
    const updateVoice = () => { const voice = preferredNarratorVoice(); if (voice) setNarratorName(voice.name); };
    updateVoice();
    window.speechSynthesis?.addEventListener('voiceschanged', updateVoice);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', updateVoice);
  }, []);
  useEffect(() => () => {
    if (ambienceSuspendTimer.current !== null) window.clearTimeout(ambienceSuspendTimer.current);
    if (ambienceRef.current) { ambienceRef.current.oscillators.forEach((oscillator) => { try { oscillator.stop(); } catch { /* Already stopped. */ } }); void ambienceRef.current.context.close().catch(() => {}); ambienceRef.current = null; }
  }, []);
  useEffect(() => { if (storyDone) scienceRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }, [storyDone]);
  const toggleNarration = useCallback(() => {
    if (narrationOn) { window.speechSynthesis?.cancel(); setNarrationOn(false); return; }
    if (!ambienceOn) toggleAmbience();
    setNarrationOn(true); speakPage(page);
  }, [ambienceOn, narrationOn, page, speakPage, toggleAmbience]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return; if (e.key === 'ArrowRight') turn(1); if (e.key === 'ArrowLeft') turn(-1); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [turn]);
  const current = story[page];
  return <div className="quantum-hypothesis">
    {!storyDone && <section className="qh-opening qh-reading-view" aria-label="Immersive FlameLens science storybook">
      <div className="qh-stars" aria-hidden="true" />
      <div className="qh-book-stage"><div className={`qh-open-book ${flipping ? 'is-flipping' : ''}`} onTouchStart={e => { touchX.current = e.touches[0].clientX; }} onTouchEnd={e => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 45) turn(dx < 0 ? 1 : -1); touchX.current = null; }}>
        <div className="qh-spine"/><div className="qh-page qh-left-page"><span className="qh-chapter">FLAMELENS · FIELD NOTES</span><div className="qh-illustration-frame"><img src={storyIllustrations[page].src} alt={storyIllustrations[page].alt} loading={page < 2 ? 'eager' : 'lazy'} /></div><span className="qh-story-title">{page === 0 ? 'The light, and what followed' : current.title}</span><span className="qh-page-number">{page * 2 + 1}</span></div>
        <div className="qh-page qh-right-page" aria-live="polite"><span className="qh-chapter">{current.chapter}</span><h1 className="qh-story-title">{current.title}</h1><div className="qh-story-text">{current.text.split('\n\n').map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div><span className="qh-page-number">{page * 2 + 2}</span></div>
        <div className="qh-turn-leaf" aria-hidden="true" />
      </div><div className="qh-reader-toolbar"><div className="qh-audio-controls" role="group" aria-label="Story audio controls"><button className="qh-narration-button" onClick={toggleNarration} disabled={!('speechSynthesis' in window)} aria-pressed={narrationOn}>{narrationOn ? 'Ⅱ Stop narration' : '▷ Listen to story'}</button><button className="qh-music-button" onClick={toggleAmbience} disabled={!('AudioContext' in window)} aria-pressed={ambienceOn}>{ambienceOn ? '♪ Space ambience: on' : '♪ Space ambience: off'}</button></div><div className="qh-book-nav"><button onClick={() => turn(-1)} disabled={page === 0 || flipping}>← Previous</button><span>SPREAD {String(page + 1).padStart(2, '0')} / {String(story.length).padStart(2, '0')}</span><button onClick={() => turn(1)} disabled={flipping}>{page === story.length - 1 ? 'Continue to research →' : 'Turn page →'}</button></div><p className="qh-audio-status" aria-live="polite">{audioNotice || `Narrator: ${narratorName || 'best available English voice'}${ambienceOn ? ' · soft ambient music playing' : ''}`}</p><p className="qh-hint">Turn each page to continue · use ← → keys</p></div></div>
    </section>}
    <section className="qh-science" ref={scienceRef} id="qh-science">
      <div className="qh-science-head"><p className="qh-eyebrow">FROM STORY TO RESEARCH</p><h2>Can a Flame Persist After Its Light Has Gone?</h2><p className="qh-lede">A quantum-kinetically informed hypothesis for cool-flame persistence in microgravity.</p><p className="qh-caveat">The observations motivate a test. They do not establish that tunnelling causes post-luminous persistence.</p></div>
      <section className="qh-paper-featured" aria-labelledby="qh-paper-title"><div><p className="qh-eyebrow">THE SAMPLE PAPER · FULL TECHNICAL FRAMEWORK</p><h3 id="qh-paper-title">Take the research with you</h3><p>Read the hypothesis, equations, evidence limits and proposed experiments in the full paper.</p></div><a className="qh-paper-button" href="/research/quantum-hypothesis-paper.pdf" target="_blank" rel="noreferrer">Read the sample paper ↗</a></section>
      <article className="qh-section qh-phenomenon"><header><span>01 · THE OBSERVATION</span><h2>When the light disappears, does the fire really end?</h2></header><div className="qh-two-col"><div><p>In microgravity droplet combustion, certain sufficiently large n-alkane droplets in NASA’s FLEX investigation continued to vaporise after the visible hot flame underwent radiative extinction, before a later distinct extinction event. This motivates the question of what persists between those observations.</p><p>Visible luminosity, heat release and chemical conversion are different observables. A dark image does not prove all reactions stopped; droplet regression does not identify which reactions continued. Low-temperature oxidation and negative-temperature-coefficient (NTC) chemistry provide a possible chemical context: in some temperature ranges, alkane oxidation rates can respond non-monotonically as temperature changes.</p></div><div className="qh-droplet-visual" role="img" aria-label="Schematic droplet cross-section: fuel droplet, surrounding gas, diffusion and radiation"><div className="qh-orbit orbit-a"/><div className="qh-orbit orbit-b"/><div className="qh-droplet"/><i className="qh-transport t1">diffusion</i><i className="qh-transport t2">radiation</i><i className="qh-transport t3">fuel vapour</i><small>SCHEMATIC · NOT TO SCALE</small></div></div></article>
      <article className="qh-section"><header><span>02 · THREE DIFFERENT ENDINGS</span><h2>One droplet. Three clocks.</h2></header><div className="qh-timeline"><input aria-label="Move timeline focus between extinction events" type="range" min="0" max="2" value={event} onChange={e => setEvent(Number(e.target.value))}/><div className="qh-events">{[['tL','Visible luminous hot flame is lost'],['tC','Measurable chemical conversion ceases'],['tV','Measurable droplet regression / vaporisation ceases']].map(([id, label], i)=><button key={id} className={event===i?'selected':''} onClick={()=>setEvent(i)}><b>{id}</b><span>{label}</span></button>)}</div></div><MathFormula formula={String.raw`\Delta t_{\mathrm{PL}} = t_C - t_L`} /><p className="qh-note">This interval needs suitable chemical or calorimetric evidence. With only optical data and droplet size, chemical cessation is inferred and the interval must carry uncertainty. The ordering and separation are not universal constants.</p></article>
      <article className="qh-section"><header><span>03 · THE CHEMISTRY</span><h2>A hidden low-temperature pathway</h2></header><div className="qh-reaction-path"><div className="qh-reaction-step featured"><small>H TRANSFER</small><b>RH + X → R + XH</b></div><span>→</span><div className="qh-reaction-step"><b>R + O₂ ⇌ RO₂</b><small>alkylperoxy</small></div><span>→</span><div className="qh-reaction-step"><b>RO₂ → QOOH</b><small>hydroperoxyalkyl</small></div><span>→</span><div className="qh-reaction-step"><b>QOOH + O₂ → O₂QOOH</b></div><span>→</span><div className="qh-reaction-step"><b>O₂QOOH → KHP + OH + …</b></div></div><p>Hydrogen abstraction creates R; oxygen addition forms RO₂; internal H transfer can form QOOH; further oxygen addition and subsequent chemistry can support chain branching under suitable conditions. This pathway is schematic: real mechanisms include multiple isomers, competing pathways, pressure-dependent processes and fuel-specific chemistry. Not all intermediates are measured in FLEX.</p></article>
      <article className="qh-section qh-quantum"><header><span>04 · THE QUANTUM CONNECTION</span><h2>Can a particle cross what it should not be able to cross?</h2></header><div className="qh-two-col"><div><p>Classically, reactants need enough energy to pass an activation barrier. Quantum nuclear tunnelling gives a nucleus—especially a light nucleus such as hydrogen—a probability of crossing through a barrier. It may alter selected hydrogen-transfer rates; it does not make the macroscopic flame quantum mechanical.</p><p>Transition-state theory (TST) estimates rates at a dividing surface; variational TST optimises that surface. Small-curvature tunnelling (SCT), semiclassical approaches and instanton methods can supply quantum corrections with different assumptions and validity ranges. Comparing H/D isotopologues can test a predicted kinetic isotope response, but an isotope effect alone is not proof of tunnelling.</p></div><div className="qh-barrier"><svg viewBox="0 0 520 240" role="img" aria-label="Schematic energy barrier contrasting a classical over-barrier route and a quantum tunnelling route"><path d="M36 200H492M44 212V25"/><path className="barrier-curve" d="M50 188 C145 188 160 45 260 45 S365 188 484 188"/><path className="classical-path" d="M68 163 H260"/><path className="tunnel-path" d="M68 163 C145 163 183 162 212 165 S252 181 280 178 385 188 475 188"/><text x="70" y="150">classical: over barrier</text><text x="286" y="151">tunnelling: through barrier</text><text x="230" y="232">reaction coordinate</text><text x="4" y="25">energy</text></svg><small>CONCEPTUAL SCHEMATIC · NOT FLEX DATA OR A CALCULATED PROFILE</small></div></div><div className="qh-formulas"><div><span>Quantum-corrected rate</span><MathFormula formula={String.raw`k_j^Q(T) = \kappa_j(T)\,\Gamma_j^{\mathrm{CVT}}(T)\,k_j^{\mathrm{TST}}(T)`} /></div><div><span>Wigner first-order estimate</span><MathFormula formula={String.raw`\kappa_W(T) = 1 + \frac{(\hbar|\omega^\ddagger|)^2}{24(k_BT)^2}`} /></div><div><span>Correction ratio</span><MathFormula formula={String.raw`\chi_j(T) = \frac{k_j^Q(T)}{k_j^{\mathrm{cl}}(T)}`} /></div></div><p className="qh-note">The Wigner expression is a first-order local harmonic approximation. It is not a validated rate expression for the specific FLEX chemistry. These terms describe a proposed modelling framework, not measured tunnelling coefficients.</p></article>
      <article className="qh-section"><header><span>05 · TRANSPORT AND CHEMISTRY</span><h2>What microgravity changes</h2></header><div className="qh-gravity-toggle" role="group" aria-label="Compare gravity environments"><button className={gravity==='normal'?'selected':''} onClick={()=>setGravity('normal')}>Normal gravity</button><button className={gravity==='micro'?'selected':''} onClick={()=>setGravity('micro')}>Microgravity</button></div><div className={`qh-gravity-viz ${gravity}`}><div className="qh-gravity-flame"/><div className="qh-flow-lines"><i/><i/><i/></div><div className="qh-gravity-legend"><b>{gravity==='normal'?'Buoyancy-driven plume prominent':'Buoyancy-driven flow suppressed'}</b><span>Diffusion · forced flow · Stefan flow · radiation · residual acceleration</span></div></div><p>Microgravity reduces buoyancy-driven transport, making some couplings easier to isolate; diffusion, imposed flow, outward Stefan flow, radiation and residual acceleration remain relevant. The environment changes transport, while quantum corrections modify selected chemical source terms.</p><div className="qh-formulas qh-wide-formulas"><div><span>Species conservation</span><MathFormula formula={String.raw`\frac{\partial(\rho Y_i)}{\partial t} + \nabla\cdot(\rho \mathbf{u}Y_i) = \nabla\cdot(\rho D_i\nabla Y_i) + \dot{\omega}_i`} /></div><div><span>Energy balance</span><MathFormula formula={String.raw`\rho c_p \frac{DT}{Dt} = \nabla\cdot(\lambda\nabla T) - \nabla\cdot\mathbf{q}_r - \sum_i h_i\dot{\omega}_i`} /></div></div></article>
      <article className="qh-section"><header><span>06 · THREE CENTRAL HYPOTHESES</span><h2>What would the model have to show?</h2></header><div className="qh-hypotheses"><div><b>H1 · PRIMARY HYPOTHESIS</b><p>Quantum tunnelling corrections to selected hydrogen-transfer reactions may measurably change predicted cool-flame persistence and/or final extinction conditions in selected n-alkane droplets versus a consistently calibrated classical-rate model.</p></div><div><b>H2 · ISOTOPE PREDICTION</b><p>Site-specific deuteration may produce an isotope-dependent change in persistence or extinction, with direction and magnitude predicted by the mechanism in advance.</p></div><div><b>H3 · MICROGRAVITY OBSERVABILITY</b><p>Suppressed buoyancy-driven transport may make chemistry–diffusion–radiation coupling easier to isolate. It does not increase intrinsic tunnelling probability.</p></div></div></article>
      <article className="qh-section"><header><span>07 · EVIDENCE MAP</span><h2>Different datasets. Different jobs.</h2></header><div className="qh-datasets">{datasets.map(([name,role,desc],i)=><button key={name} className={activeData===i?'selected':''} onClick={()=>setActiveData(i)}><span>{name}</span><b>{role}</b><p>{desc}</p></button>)}</div><p className="qh-note">FLEX is the retrospective anchor. The other investigation families provide bounded comparisons and context; none should be treated as interchangeable or as direct validation of the same molecular pathway. Dataset availability does not imply a particular measurement exists.</p></article>
      <article className="qh-section"><header><span>08 · FIVE FALSIFIABLE PREDICTIONS</span><h2>Let the hypothesis risk being wrong.</h2></header><div className="qh-predictions">{[['P1','Pathway-specific sensitivity','Selected H-transfer rates matter more than unrelated rate perturbations.'],['P2','Independent prediction','Quantum-corrected chemistry improves macroscopic predictions on held-out tests after consistent calibration.'],['P3','Isotope response','A pre-registered mechanism predicts direction and size of an isotope-dependent response.'],['P4','Transport interaction','The effect changes meaningfully with transport and radiation conditions.'],['P5','Bounded transfer','Results do not transfer indiscriminately across droplets, gas flames and solid fuels.']].map(([n,t,d])=><div key={n}><b>{n}</b><strong>{t}</strong><span>{d}</span></div>)}</div><p className="qh-note">If the quantum model does not improve independent predictions, or the predicted isotope response is absent within uncertainty, the hypothesis should be weakened or rejected. A negative result is useful.</p></article>
      <article className="qh-section"><header><span>09 · PROPOSED ROADMAP</span><h2>From records to a discriminating test</h2></header><div className="qh-roadmap">{stages.map((s,i)=><div key={s}><span>0{i+1}</span><b>{s}</b><p>{['Audit timing, diameter histories, radiometry and uncertainty in the existing FLEX record.','Compare consistently calibrated classical and quantum-corrected pathways with sensitivity analysis.','Use matched conditions, droplet diameter histories, radiometry, imaging and species-sensitive diagnostics.','Integrate evidence with explicit provenance and uncertainty; do not convert association into molecular causation.'][i]}</p></div>)}</div><p className="qh-proposal-label">PROPOSED FUTURE WORK · THESE EXPERIMENTS ARE NOT CLAIMED AS COMPLETED</p></article>
      <article className="qh-section"><header><span>10 · LIMITATIONS</span><h2>What the evidence cannot yet tell us</h2></header><div className="qh-limit-grid">{[['Measurement','Timing, imaging, radiometry and diameter histories have finite resolution and uncertainty.'],['Coverage','Available fuels, sizes, conditions and diagnostics may not span the boundary of interest.'],['Kinetics','Rate constants and quantum corrections carry parameter uncertainty.'],['Transport & radiation','Diffusion, flow, heat loss and radiative properties couple to chemistry.'],['Mechanism structure','Alternative pathways and model choices can fit similar observations.'],['Identifiability','Droplet regression alone cannot name a radical pathway; an isotope effect alone does not prove tunnelling.']].map(([a,b])=><div key={a}><b>{a}</b><p>{b}</p></div>)}</div><p>SHAP and other feature attribution methods describe associations in a fitted model; they do not establish molecular causation.</p></article>
      <article className="qh-section qh-conclusion"><header><span>11 · WHY ASK?</span><h2>What would make this important?</h2></header><p>A positive result could show that quantum-sensitive elementary kinetics deserve inclusion in selected low-temperature combustion predictions, provided the effect survives independent, discriminating tests. A negative result would constrain those models and sharpen the boundary between chemical and transport explanations.</p><blockquote>“When the visible flame disappears, could a quantum-sensitive molecular reaction network be helping the combustion process persist in a form that conventional optical fire interpretation fails to recognise?”</blockquote><p className="qh-note">Research hypothesis only. No NASA endorsement or operational spacecraft fire-safety certification is implied.</p></article>
      <footer className="qh-footer">FLAMELENS · HYPOTHESIS EXPLORER <a href="#qh-science">Back to top ↑</a></footer>
    </section>
  </div>;
}
