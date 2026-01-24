import React from 'react';
import { cn } from '@/lib/utils';
import { useTiltEffect } from '@/hooks/useTiltEffect';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  scale?: number;
  speed?: number;
  glareEnabled?: boolean;
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className,
  maxTilt = 8,
  perspective = 1000,
  scale = 1.02,
  speed = 400,
  glareEnabled = true,
}) => {
  const { ref, onMouseMove, onMouseLeave, onMouseEnter } = useTiltEffect({
    maxTilt,
    perspective,
    scale,
    speed,
  });

  const [glarePosition, setGlarePosition] = React.useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseMove(e);
    
    if (glareEnabled && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setGlarePosition({ x, y });
    }
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
      className={cn(
        "relative transform-gpu will-change-transform",
        className
      )}
      style={{
        transformStyle: 'preserve-3d',
        transition: `transform ${speed}ms cubic-bezier(0.03, 0.98, 0.52, 0.99)`,
      }}
    >
      {children}
      
      {/* Glare effect */}
      {glareEnabled && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, hsl(var(--primary) / 0.15) 0%, transparent 60%)`,
          }}
        />
      )}
    </div>
  );
};
