export default function PhysioLogo({ size = 64 }: { size?: number }) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-full bg-[#6B8E7F] text-white"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.45}
        height={size * 0.45}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Person silhouette */}
        <circle cx="12" cy="5" r="2.5" />
        <path d="M7 12c0-2.8 2.2-5 5-5s5 2.2 5 5" />
        {/* Hands / physiotherapy */}
        <path d="M5 14c1-1 2.5-1.5 4-1h6c1.5-.5 3 0 4 1" />
        <path d="M9 13v5m6-5v5" />
        <path d="M7 22h10" />
      </svg>
    </div>
  )
}
