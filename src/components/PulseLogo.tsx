const BARS = [
  { height: 8, color: '#2A2825' },
  { height: 14, color: '#3D3A36' },
  { height: 10, color: '#4A4640' },
  { height: 24, color: '#E8803A' },
  { height: 10, color: '#4A4640' },
  { height: 16, color: '#3D3A36' },
  { height: 8, color: '#2A2825' },
];

const BAR_W = 3;
const GAP = 2.5;
const VH = 28;
const BARS_TOTAL_W = BARS.length * BAR_W + (BARS.length - 1) * GAP;

interface PulseLogoProps {
  scale?: number;
  showWordmark?: boolean;
}

export function PulseLogo({ scale = 1, showWordmark = true }: PulseLogoProps) {
  const vw = showWordmark ? 130 : Math.ceil(BARS_TOTAL_W);
  return (
    <svg
      width={vw * scale}
      height={VH * scale}
      viewBox={`0 0 ${vw} ${VH}`}
      fill="none"
    >
      {BARS.map((bar, i) => {
        const x = i * (BAR_W + GAP);
        const y = (VH - bar.height) / 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={BAR_W}
            height={bar.height}
            rx={1.5}
            fill={bar.color}
          />
        );
      })}
      {showWordmark && (
        <text
          x={BARS_TOTAL_W + 8}
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

export function PulseLogoIcon() {
  const size = 32;
  const scaledH = 18;
  const scaleFactor = scaledH / 24; // scale relative to tallest bar
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <rect width={size} height={size} fill="var(--bg-root)" rx={4} />
      {BARS.map((bar, i) => {
        const h = bar.height * scaleFactor;
        const totalW = BARS.length * BAR_W + (BARS.length - 1) * GAP;
        const offsetX = (size - totalW) / 2;
        const x = offsetX + i * (BAR_W + GAP);
        const y = (size - h) / 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={BAR_W}
            height={h}
            rx={1.5}
            fill={bar.color}
          />
        );
      })}
    </svg>
  );
}
