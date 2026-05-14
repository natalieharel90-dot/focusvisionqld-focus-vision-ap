type FocusVisionLogoProps = {
  size?: number;
  className?: string;
};

// Lifted verbatim from focus_vision_prototype.html (the .brand-mark SVG).
// Stroke + fill colours come from the prototype's .fv-ring / .fv-text rules.
export function FocusVisionLogo({ size = 120, className }: FocusVisionLogoProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      role="img"
      aria-label="Focus Vision logo"
      className={className}
    >
      <path
        d="M 100 28 A 72 72 0 0 0 100 172"
        fill="none"
        stroke="#5C8FA0"
        strokeWidth={2.5}
      />
      <path
        d="M 100 28 A 72 72 0 0 1 100 172"
        fill="none"
        stroke="#5C8FA0"
        strokeWidth={2.5}
      />
      <text
        x="100"
        y="105"
        textAnchor="middle"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight={700}
        fontSize={28}
        letterSpacing={2}
        fill="#1F3A48"
      >
        FOCUS
      </text>
      <text
        x="100"
        y="128"
        textAnchor="middle"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontWeight={400}
        fontSize={11}
        letterSpacing={8}
        fill="#1F3A48"
      >
        VISION
      </text>
    </svg>
  );
}
