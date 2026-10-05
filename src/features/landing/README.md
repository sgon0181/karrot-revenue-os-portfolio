# Public landing experience

`landing` owns the anonymous visual gateway at `/`. It introduces the independent Karrot Revenue OS concept and hands visitors to the existing administratively provisioned login at `/login`.

## File map

- `components/landing-experience.tsx` owns semantic story content, controls and route hand-off.
- `components/particle-canvas.tsx` owns the decorative Canvas renderer and native-scroll animation loop.
- `components/landing-experience.module.css` scopes the dark visual system to this route.
- `lib/particle-motion.ts` owns scroll phases, persistent particle identity, coherent flight paths, typed transition buffers and frame-rate-independent damping.
- `lib/particle-scenes.ts` validates and loads the versioned target atlas, samples complete responsive silhouettes and creates deterministic intro scatter.
- `lib/particle-framing.ts` measures target bounds and keeps settled sculptures and flight envelopes inside the visible portrait safe area.
- `public/landing/particle-targets.v1.bin` stores four reference-derived point targets; the final scene aliases the opening logo exactly.
- `tools/particle-targets/generate_atlas.py` is the offline extraction and atlas-build tool. It accepts explicit paths for all four supplied source images and requires NumPy, Pillow and SciPy.

## Boundaries

- The experience performs no database reads and exposes no authenticated application data.
- Australia-wide dots are representative visual locations, not customers, facilities from the canonical NSW dataset or resident data.
- All meaningful copy and controls remain semantic HTML; Canvas output is decorative.
- `/login` and all `(app)` routes retain their existing authentication behavior. Authenticated visits to `/` continue to redirect to `/dashboard` in the request proxy.
- This is an independent working concept, not an official Karrot Care product or a public-signup surface.

## Particle-recognition system

- Each scene has reference-derived lime, green, orange and warm-white material roles and three emphasis levels. One persistent 20,000-particle registry follows coherent, staggered, displacement-aware curves and interpolates colour as it reorganises between scenes.
- Reduced particle tiers uniformly sample the complete 20,000-point atlas. Phones therefore retain every sculpture's full extent instead of rendering a dense spatial fragment.
- Target positions are extracted from the supplied dot artwork offline. The source rasters are not served to visitors; runtime code fetches only the 640,016-byte binary atlas.
- The Australia target retains Cape York, the Gulf of Carpentaria, the Great Australian Bight and Tasmania.
- The embrace retains the bowed grandmother, bun, glasses, nested child, crossing arms, overlapping hands and facial/clothing details. Semantic depth gives foreground hands and white details subtle parallax without deforming the supplied front silhouette.
- The rabbit target retains its seated profile, separated ears, eye, nose, whiskers, haunch, tail and paws; the detached carrot retains its orange taper, warm-white rings and branching leaves. Normalised depth bands, restrained perspective, additive highlight emission and pointer/idle movement create a 2.5D surface effect while preserving recognition.
- The opening and closing targets are the same densely filled three-region point mark, so the story closes without a quantisation-width jump.
- Visual QA covered two three-loop compare/implement/review rounds: isolated responsive particle reconstructions, reference-to-browser colour and luminance comparisons, every held scene and mid-morph frame, pointer parallax, 1440 × 900 desktop, 834 × 1112 tablet and 390 × 844 compact layouts.

## Scroll-linked motion system

- Reference inspection showed that the Heidelberg experience gets its character from a WebGL camera journey through persistent point sculptures, inertial scrolling, depth parallax and local pointer displacement:not D3 or SVG layout transitions. Karrot reproduces that motion language with the existing Canvas renderer so the checked-in point atlas and responsive particle tiers remain authoritative.
- Every story segment has exact 12% holds at both ends. Between them, the same particle identities leave in staggered neighborhoods, follow reversible cubic/vortex lanes, bloom briefly near the camera and reform without position or colour pops. Scroll direction is authoritative, so reversing the wheel reverses the core path exactly.
- Spatially neighboring atlas points share most of their lane and vortex signal, producing broad particle streams rather than a single sliding sheet or unrelated confetti. Departure timing retains additional per-dot jitter so a 96-particle neighborhood does not move as a rigid clump.
- Runtime path data uses a 2.1 MB struct of typed arrays for 20,000 particles instead of retaining tens of megabytes of nested descriptor objects. Three material-interpolation bands and nine depth bands keep colour/depth continuity while bounding Canvas batching cost.
- Scroll velocity stretches the ambient field and adds a restrained camera surge. When scrolling settles, mouse movement introduces subtle sculpture tilt plus local magnetic repulsion; it is suppressed in flight and returns smoothly when the pointer leaves.
- Reduced-motion users receive the final static state. Runtime quality tiers now cap compact screens at 6,000 particles and 30 fps, with a 4,200-particle and 24 fps constrained tier for low-memory, low-core or data-saver devices. Capable wide screens retain the full 20,000-particle target.
- Mobile uses a stable large-viewport canvas, an unchanged scroll-progress denominator and guarded bitmap resizing. Full-screen Canvas filters, blurred aurora compositing and blend-mode grain are removed at compact widths to avoid WebKit repaint flashes when browser chrome expands or collapses.
- Portrait framing is bounds-aware. The camera preserves the full target at rest and pulls back during particle flight so curved paths, depth bloom and short browser viewports cannot crop the recognisable sculpture.
