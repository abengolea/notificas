function FlagFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 9 6"
      className="h-auto w-full"
      role="img"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      {children}
    </svg>
  );
}

export function FlagArgentina() {
  return (
    <FlagFrame>
      <rect width="9" height="2" fill="#74ACDF" />
      <rect y="2" width="9" height="2" fill="#fff" />
      <rect y="4" width="9" height="2" fill="#74ACDF" />
      <g fill="#F6B40E">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          const x1 = 4.5 + Math.cos(a) * 0.42;
          const y1 = 3 + Math.sin(a) * 0.42;
          const x2 = 4.5 + Math.cos(a) * 0.92;
          const y2 = 3 + Math.sin(a) * 0.92;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F6B40E" strokeWidth="0.18" strokeLinecap="round" />;
        })}
        <circle cx="4.5" cy="3" r="0.46" />
      </g>
    </FlagFrame>
  );
}

export function FlagBrazil() {
  return (
    <svg viewBox="0 0 720 504" className="h-auto w-full" role="img" aria-hidden preserveAspectRatio="xMidYMid slice">
      <rect width="720" height="504" fill="#009B3A" />
      <polygon points="360,46 674,252 360,458 46,252" fill="#FEDD00" />
      <circle cx="360" cy="252" r="92" fill="#002776" />
      <path
        d="M278 268c28-22 78-36 164-28"
        fill="none"
        stroke="#fff"
        strokeWidth="18"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FlagColombia() {
  return (
    <FlagFrame>
      <rect width="9" height="3" fill="#FCD116" />
      <rect y="3" width="9" height="1.5" fill="#003893" />
      <rect y="4.5" width="9" height="1.5" fill="#CE1126" />
    </FlagFrame>
  );
}
