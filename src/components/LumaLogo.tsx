const VH = 28;
const ICON_SIZE = 20;
const ICON_RADIUS = 9;

interface LumaLogoProps {
  scale?: number;
  showWordmark?: boolean;
}

export function LumaLogo({ scale = 1, showWordmark = true }: LumaLogoProps) {
  const vw = showWordmark ? 130 : ICON_SIZE;
  return (
    <svg
      width={vw * scale}
      height={VH * scale}
      viewBox={`0 0 ${vw} ${VH}`}
      fill="none"
    >
      <circle cx={10} cy={14} r={ICON_RADIUS} fill="#2A2825" />
      <path d="M6.5 9.5V18.5H9V13L14 18.5H17.2L11.7 12.5L16.8 9.5H13.4L9 12V9.5H6.5Z" fill="#E8803A" />
      <circle cx={16.3} cy={9.7} r={1.3} fill="#4A4640" />
      {showWordmark && (
        <text
          x={28}
          y={20}
          fontFamily="Outfit"
          fontSize={17}
          fontWeight={700}
          fill="currentColor"
          letterSpacing="-0.025em"
        >
          Luma
        </text>
      )}
    </svg>
  );
}

export function LumaLogoIcon() {
  const size = 32;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <rect width={size} height={size} fill="var(--bg-root)" rx={4} />
      <circle cx={16} cy={16} r={10} fill="#2A2825" />
      <path d="M12 11V21H14.8V15.5L20 21H23.4L17.5 14.8L22.9 11H19.3L14.8 14.2V11H12Z" fill="#E8803A" />
      <circle cx={22.2} cy={11.4} r={1.4} fill="#4A4640" />
    </svg>
  );
}
