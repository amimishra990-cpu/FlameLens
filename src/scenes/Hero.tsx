import { Link } from 'react-router-dom';
import { ModelViewer } from '../components/ModelViewer';
import { IssPoster } from '../components/Posters';
import { Reveal } from '../components/Reveal';

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-heading">
      <div className="earth-limb" aria-hidden="true" />
      <div className="container hero-grid">
        <div className="hero-copy">
          <Reveal>
            <p className="section-label">Scene 01 · Orbital fire-safety observatory</p>
          </Reveal>
          <Reveal delay={90}>
            <h1 id="hero-heading" className="hero-heading">
              Understand fire before it becomes a{' '}
              <em>spacecraft emergency.</em>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="lede hero-lede">
              Explore decades of NASA combustion research. Compare the conditions, understand the evidence and uncover
              what it means for fire safety beyond Earth.
            </p>
          </Reveal>
          <Reveal delay={260}>
            <div className="hero-ctas">
              <a href="#investigations" className="btn btn-primary">
                Explore investigations
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <Link to="/sign-in" className="btn btn-secondary">
                Sign in
              </Link>
              <Link to="/quantum" className="btn btn-secondary quantum-story-cta">
                Enter the storybook
              </Link>
            </div>
          </Reveal>
          <Reveal delay={340}>
            <p className="hero-context mono">
              NASA PSI research · Microgravity combustion · Evidence-led decisions
            </p>
            <p className="hero-independence">
              Independent research tool organizing public NASA evidence — not a NASA product or endorsement.
            </p>
          </Reveal>
        </div>

        <Reveal delay={200} className="hero-visual">
          <ModelViewer
            src="/models/iss-b.glb"
            label="International Space Station — NASA 3D model"
            description="A compact NASA model of the orbital station, shown as habitat context for the research indexed by FlameLens."
            poster={<IssPoster />}
            className="hero-model"
            attribution={
              <a
                className="model-credit"
                href="https://science.nasa.gov/3d-resources/international-space-station-iss-b/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Model: NASA Science 3D Resources
              </a>
            }
          />
        </Reveal>
      </div>

      <a className="scroll-cue" href="#playground" aria-label="Scroll to the gravity playground">
        <span className="mono">Scroll</span>
        <svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true">
          <rect x="1" y="1" width="12" height="20" rx="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle className="scroll-cue-dot" cx="7" cy="7" r="1.8" fill="currentColor" />
        </svg>
      </a>
    </section>
  );
}
