export default function PhysioLogo({ size = 64, inverted = false }: { size?: number; inverted?: boolean }) {
  const bg = inverted ? '#ffffff22' : '#6B8E7F'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Green circle */}
      <circle cx="32" cy="32" r="32" fill={bg} />
      {/* Wave 1 */}
      <path
        d="M10 28 C16 18, 22 18, 32 28 C42 38, 48 38, 54 28"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Wave 2 */}
      <path
        d="M10 38 C16 28, 22 28, 32 38 C42 48, 48 48, 54 38"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function Wordmark({ size = 36, inverted = false }: { size?: number; inverted?: boolean }) {
  const textColor = inverted ? 'text-white' : 'text-[#2A2622]'
  return (
    <div className="inline-flex items-center gap-2.5">
      <PhysioLogo size={size} inverted={inverted} />
      <div className={`leading-tight ${textColor}`} style={{ fontFamily: '"Fraunces", Georgia, serif' }}>
        <div className="font-medium" style={{ fontSize: size * 0.36 }}>Physio</div>
        <div className="font-light tracking-wide" style={{ fontSize: size * 0.36 }}>Allmend</div>
      </div>
    </div>
  )
}
