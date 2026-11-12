import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useInView } from '../lib/useInView';
import { useReducedMotion } from '../lib/useReducedMotion';

type ViewerState = 'idle' | 'loading' | 'ready' | 'error';

interface ModelViewerProps {
  src: string;
  label: string;
  description: string;
  poster: ReactNode;
  attribution: ReactNode;
  className?: string;
  autoRotateSpeed?: number;
}

/**
 * Lazy GLB viewer: three.js is imported only when the section approaches the
 * viewport. A static poster remains visible while loading and on any failure
 * (no WebGL, network/parse error). One rAF loop; paused off-screen; fully
 * disposed on unmount. Arrow keys rotate for keyboard users.
 */
export function ModelViewer({
  src,
  label,
  description,
  poster,
  attribution,
  className = '',
  autoRotateSpeed = 0.55,
}: ModelViewerProps) {
  const { ref: visibilityRef, inView } = useInView<HTMLDivElement>({ rootMargin: '250px', once: true });
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ViewerState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const reduced = useReducedMotion();
  const inViewRef = useRef(true);
  const controlsRef = useRef<{ rotate: (delta: number) => void } | null>(null);

  // Track ongoing visibility to pause rendering off-screen.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      inViewRef.current = entries[0]?.isIntersecting ?? true;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !hostRef.current) return;
    const host = hostRef.current;
    let cancelled = false;
    let dispose: (() => void) | null = null;
    const partial: { renderer?: { dispose(): void; domElement: HTMLCanvasElement }; draco?: { dispose(): void } } = {};

    setState('loading');

    (async () => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) throw new Error('WebGL is not available in this browser.');

        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (cancelled) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        host.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('aria-hidden', 'true');
        partial.renderer = renderer;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);

        const hemi = new THREE.HemisphereLight(0x9fc4e0, 0x0b1220, 0.85);
        const key = new THREE.DirectionalLight(0xe8f1fa, 2.0);
        key.position.set(5, 6, 4);
        const rim = new THREE.DirectionalLight(0x66d9f2, 0.85);
        rim.position.set(-6, -2, -5);
        const warm = new THREE.DirectionalLight(0xf3b65a, 0.3);
        warm.position.set(-3, 2, 6);
        scene.add(hemi, key, rim, warm);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.enablePan = false;
        controls.autoRotate = !reduced;
        controls.autoRotateSpeed = autoRotateSpeed;

        let resumeTimer: ReturnType<typeof setTimeout> | undefined;
        controls.addEventListener('start', () => {
          controls.autoRotate = false;
          if (resumeTimer) clearTimeout(resumeTimer);
        });
        controls.addEventListener('end', () => {
          if (resumeTimer) clearTimeout(resumeTimer);
          if (!reduced) resumeTimer = setTimeout(() => (controls.autoRotate = true), 3500);
        });

        controlsRef.current = {
          rotate: (delta: number) => {
            controls.autoRotate = false;
            const offset = camera.position.clone().sub(controls.target);
            offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
            camera.position.copy(controls.target).add(offset);
            controls.update();
            if (resumeTimer) clearTimeout(resumeTimer);
            if (!reduced) resumeTimer = setTimeout(() => (controls.autoRotate = true), 3500);
          },
        };

        const draco = new DRACOLoader();
        draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
        partial.draco = draco;
        const loader = new GLTFLoader();
        loader.setDRACOLoader(draco);
        const gltf = await loader.loadAsync(src);
        if (cancelled) {
          draco.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          return;
        }

        const model = gltf.scene;
        // Frame the dominant connected structure. Some authoring-source assets carry
        // stray geometry far from the body (the NASA ISS (B) GLB has a truss cluster
        // ~25 units above the station); full-scene bounds would shrink the subject.
        const parts: { box: InstanceType<typeof THREE.Box3>; count: number; obj: InstanceType<typeof THREE.Object3D> }[] = [];
        model.traverse((obj) => {
          const mesh = obj as unknown as { isMesh?: boolean; geometry?: { getAttribute: (n: string) => { count: number } | undefined } };
          if (!mesh.isMesh || !mesh.geometry) return;
          parts.push({ box: new THREE.Box3().setFromObject(obj), count: mesh.geometry.getAttribute('position')?.count ?? 0, obj });
        });
        let frameBox: InstanceType<typeof THREE.Box3>;
        if (parts.length === 0) {
          frameBox = new THREE.Box3().setFromObject(model);
        } else {
          parts.sort((a, b) => b.count - a.count);
          frameBox = parts[0].box.clone();
          for (let pass = 0; pass < 4; pass++) {
            for (const p of parts) {
              if (p.box.intersectsBox(frameBox)) frameBox.union(p.box);
            }
          }
        }
        const size = frameBox.getSize(new THREE.Vector3());
        const center = frameBox.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        // The ISS (B) asset includes a detached, cloud-like geometry cluster above
        // the station. Keep the cutoff conservative for this asset so its attached
        // solar arrays and station modules remain intact.
        const detachedPartLimit = src.endsWith('/iss-b.glb') ? maxDim * 0.6 : maxDim * 1.5;
        for (const p of parts) {
          if (p.box.intersectsBox(frameBox)) continue;
          if (p.box.getCenter(new THREE.Vector3()).distanceTo(center) > detachedPartLimit) p.obj.visible = false;
        }
        const scale = 2.4 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        scene.add(model);

        const fit = 2.4;
        camera.position.set(fit * 1.0, fit * 0.5, fit * 1.7);
        controls.target.set(0, 0, 0);
        controls.minDistance = fit * 0.7;
        controls.maxDistance = fit * 3.2;
        controls.update();

        const resize = () => {
          const rect = host.getBoundingClientRect();
          const wpx = Math.max(1, rect.width);
          const hpx = Math.max(1, rect.height);
          renderer.setSize(wpx, hpx, false);
          camera.aspect = wpx / hpx;
          camera.updateProjectionMatrix();
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        let raf = 0;
        const loop = () => {
          raf = requestAnimationFrame(loop);
          if (document.hidden || !inViewRef.current) return;
          controls.update();
          renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(loop);

        dispose = () => {
          cancelAnimationFrame(raf);
          if (resumeTimer) clearTimeout(resumeTimer);
          ro.disconnect();
          controls.dispose();
          draco.dispose();
          scene.traverse((obj) => {
            const mesh = obj as { geometry?: { dispose(): void }; material?: unknown };
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
            for (const m of mats) {
              const mat = m as { dispose(): void; map?: { dispose(): void } | null };
              mat.map?.dispose();
              mat.dispose();
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
          controlsRef.current = null;
        };
        partial.renderer = undefined;
        partial.draco = undefined;

        if (!cancelled) setState('ready');
      } catch (err) {
        partial.draco?.dispose();
        partial.renderer?.dispose();
        partial.renderer?.domElement.remove();
        if (!cancelled) {
          setState('error');
          setErrorMsg(err instanceof Error ? err.message : 'The 3D model could not be loaded.');
        }
      }
    })();

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [inView, src, reduced, autoRotateSpeed]);

  const showPoster = state !== 'ready';

  return (
    <figure className={`model-viewer ${className}`.trim()} ref={visibilityRef}>
      <div
        className="model-stage"
        ref={hostRef}
        tabIndex={state === 'ready' ? 0 : -1}
        role="img"
        aria-label={`${label}. ${description} Drag to orbit, scroll to zoom, arrow keys to rotate.`}
        onKeyDown={(e) => {
          if (state !== 'ready' || !controlsRef.current) return;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            controlsRef.current.rotate(-0.18);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            controlsRef.current.rotate(0.18);
          }
        }}
      >
        {showPoster && (
          <div className="model-poster" aria-hidden="true">
            {poster}
          </div>
        )}
        {state === 'loading' && (
          <p className="model-state mono" role="status">
            Loading 3D model…
          </p>
        )}
        {state === 'error' && (
          <p className="model-state model-state-error mono" role="status">
            Static fallback shown — {errorMsg}
          </p>
        )}
      </div>
      <figcaption className="model-caption">
        <span className="model-hint mono">{state === 'ready' ? 'Drag to orbit · scroll to zoom' : label}</span>
        {attribution}
      </figcaption>
    </figure>
  );
}
