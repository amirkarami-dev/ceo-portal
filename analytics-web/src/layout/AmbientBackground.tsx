/**
 * Ambient animated backdrop for the whole app — three slow-drifting brand-coloured
 * gradient blobs over a faint blueprint grid. Pure CSS animation (see global.css):
 * transform/opacity only, fixed and pointer-events-free so it costs nothing to
 * interact with, and it stops entirely under prefers-reduced-motion.
 */
export function AmbientBackground() {
  return (
    <div className="rw-ambient" aria-hidden>
      <div className="rw-ambient-grid" />
      <div className="rw-ambient-blob rw-ambient-blob-a" />
      <div className="rw-ambient-blob rw-ambient-blob-b" />
      <div className="rw-ambient-blob rw-ambient-blob-c" />
    </div>
  );
}
