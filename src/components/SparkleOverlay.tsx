// CSS-only sparkle overlay — small ✨ glyphs that twinkle around the
// screen edges. The animation is defined in globals.css; under
// [data-motion="reduced"] the transition/animation guard freezes it.
// The patient layout also gates rendering on shouldShowSparkle(), so
// reduce-motion patients get no sparkle at all.

const SPARKLES: ReadonlyArray<{ top: string; left: string; delay: string }> = [
  { top: "6%", left: "5%", delay: "0s" },
  { top: "10%", left: "90%", delay: "0.8s" },
  { top: "30%", left: "3%", delay: "1.6s" },
  { top: "44%", left: "94%", delay: "2.4s" },
  { top: "62%", left: "6%", delay: "0.4s" },
  { top: "72%", left: "91%", delay: "1.2s" },
  { top: "88%", left: "12%", delay: "2.0s" },
  { top: "92%", left: "84%", delay: "2.8s" },
];

export function SparkleOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="fv-sparkle absolute text-lg"
          style={{ top: s.top, left: s.left, animationDelay: s.delay }}
        >
          ✨
        </span>
      ))}
    </div>
  );
}
