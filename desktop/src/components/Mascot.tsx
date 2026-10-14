import React from 'react';

export type MascotMood = 'idle' | 'thinking' | 'browsing' | 'typing' | 'waiting_for_approval' | 'completed' | 'paused' | 'failed';

interface MascotProps {
  mood?: MascotMood;
  size?: number; // width & height in px
  className?: string;
  showHalo?: boolean;
}

export const Mascot: React.FC<MascotProps> = ({
  mood = 'idle',
  size = 32,
  className = '',
  showHalo = true,
}) => {
  // Determine state-based colors and animations
  const isThinking = mood === 'thinking';
  const isTyping = mood === 'typing' || mood === 'browsing';
  const isApproval = mood === 'waiting_for_approval';
  const isCompleted = mood === 'completed';
  const isPaused = mood === 'paused';
  const isFailed = mood === 'failed';

  // Halo glow color
  let haloColor = 'rgba(139, 92, 246, 0.35)'; // violet
  if (isApproval) haloColor = 'rgba(245, 158, 11, 0.45)'; // amber
  if (isCompleted) haloColor = 'rgba(16, 185, 129, 0.45)'; // emerald
  if (isFailed) haloColor = 'rgba(244, 63, 94, 0.45)'; // rose
  if (isTyping) haloColor = 'rgba(99, 102, 241, 0.45)'; // iris

  return (
    <div
      className={`muse-mascot-wrapper ${className}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {/* Ambient Halo Glow */}
      {showHalo && (
        <div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: '50%',
            background: haloColor,
            filter: 'blur(6px)',
            opacity: isThinking || isTyping ? 0.9 : 0.6,
            animation: isThinking || isTyping ? 'pulse-halo 2s infinite ease-in-out' : 'none',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* SVG Mascot Character */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'relative',
          zIndex: 1,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
        }}
      >
        <defs>
          <linearGradient id="bodyGrad" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9333EA" />
            <stop offset="0.5" stopColor="#7C3AED" />
            <stop offset="1" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="screenGrad" x1="20" y1="36" x2="44" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="1" stopColor="#818CF8" />
          </linearGradient>
          <linearGradient id="laptopGrad" x1="18" y1="42" x2="46" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E293B" />
            <stop offset="1" stopColor="#0F172A" />
          </linearGradient>
        </defs>

        {/* Mascot Antenna / Sparkle */}
        <line x1="32" y1="14" x2="32" y2="8" stroke="#A855F7" strokeWidth="2.5" strokeLinecap="round" />
        <circle
          cx="32"
          cy="7"
          r={isThinking ? '4' : '3'}
          fill={isApproval ? '#F59E0B' : isCompleted ? '#10B981' : '#C084FC'}
          className={isThinking ? 'mascot-antenna-pulse' : ''}
        />

        {/* Head & Body Capsule */}
        <rect
          x="14"
          y="14"
          width="36"
          height="32"
          rx="16"
          fill="url(#bodyGrad)"
          stroke="#C084FC"
          strokeWidth="1.5"
        />

        {/* Visor / Face Glass */}
        <rect
          x="19"
          y="20"
          width="26"
          height="16"
          rx="8"
          fill="#0F172A"
          stroke="#38BDF8"
          strokeWidth="1"
          fillOpacity="0.85"
        />

        {/* Dynamic Eyes / Expression */}
        {isCompleted ? (
          // Happy Eyes ^ ^
          <>
            <path d="M23 29 Q26 25 29 29" stroke="#10B981" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M35 29 Q38 25 41 29" stroke="#10B981" strokeWidth="2" strokeLinecap="round" fill="none" />
          </>
        ) : isApproval ? (
          // Alert / Waiting Eyes ! !
          <>
            <circle cx="26" cy="27" r="2.2" fill="#F59E0B" />
            <circle cx="38" cy="27" r="2.2" fill="#F59E0B" />
            <path d="M29 32 Q32 30 35 32" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </>
        ) : isThinking ? (
          // Thinking Sparkle Eyes * *
          <>
            <circle cx="26" cy="27" r="2.5" fill="#38BDF8" className="mascot-eye-blink" />
            <circle cx="38" cy="27" r="2.5" fill="#38BDF8" className="mascot-eye-blink" />
            <circle cx="28" cy="25" r="1" fill="#FFFFFF" />
            <circle cx="40" cy="25" r="1" fill="#FFFFFF" />
          </>
        ) : isTyping ? (
          // Focused Browsing / Working Eyes
          <>
            <circle cx="26" cy="27" r="2.2" fill="#67E8F9" />
            <circle cx="38" cy="27" r="2.2" fill="#67E8F9" />
            <circle cx="27" cy="26" r="0.8" fill="#FFFFFF" />
            <circle cx="39" cy="26" r="0.8" fill="#FFFFFF" />
          </>
        ) : (
          // Normal Idle Friendly Eyes
          <>
            <circle cx="26" cy="27" r="2.2" fill="#38BDF8" />
            <circle cx="38" cy="27" r="2.2" fill="#38BDF8" />
            <circle cx="27" cy="26" r="0.8" fill="#FFFFFF" />
            <circle cx="39" cy="26" r="0.8" fill="#FFFFFF" />
          </>
        )}

        {/* Tiny Laptop when typing / browsing (The Alex Cornell signature) */}
        {isTyping && (
          <g className="mascot-typing-laptop">
            {/* Screen */}
            <rect
              x="22"
              y="38"
              width="20"
              height="12"
              rx="2"
              fill="url(#screenGrad)"
              stroke="#60A5FA"
              strokeWidth="0.8"
            />
            {/* Code / Screen lines */}
            <line x1="25" y1="41" x2="35" y2="41" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
            <line x1="25" y1="44" x2="39" y2="44" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />
            <line x1="25" y1="47" x2="32" y2="47" stroke="#38BDF8" strokeWidth="0.8" strokeLinecap="round" />
            {/* Keyboard base */}
            <path
              d="M18 50 L46 50 L43 54 L21 54 Z"
              fill="url(#laptopGrad)"
              stroke="#475569"
              strokeWidth="0.8"
            />
            {/* Little Hands Tapping */}
            <circle cx="24" cy="48" r="1.8" fill="#C084FC" className="mascot-hand-left" />
            <circle cx="40" cy="48" r="1.8" fill="#C084FC" className="mascot-hand-right" />
          </g>
        )}

        {/* Small Cheerful Smile if Idle or Completed */}
        {(mood === 'idle' || isCompleted) && (
          <path
            d="M30 32 Q32 34 34 32"
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>
    </div>
  );
};
