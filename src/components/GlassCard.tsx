import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useRef, useCallback, useState } from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  animate?: boolean;
  delay?: number;
  tilt?: boolean;
  maxTilt?: number;
}

const GlassCard = ({ 
  children, 
  className, 
  hover = false, 
  animate = true, 
  delay = 0,
  tilt = true,
  maxTilt = 8,
}: GlassCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || !tilt) return;

    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    ref.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    
    // Update glare position
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlarePosition({ x: glareX, y: glareY });
  }, [tilt, maxTilt]);

  const handleMouseLeave = useCallback(() => {
    if (!ref.current || !tilt) return;
    ref.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    setIsHovered(false);
  }, [tilt]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const cardContent = (
    <>
      {children}
      {/* Glare effect */}
      {tilt && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, hsl(var(--primary) / 0.2) 0%, transparent 60%)`,
            opacity: isHovered ? 1 : 0,
          }}
        />
      )}
    </>
  );

  if (animate) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        className={cn(
          hover ? 'glass-card-hover' : 'glass-card',
          'rounded-2xl relative overflow-hidden',
          tilt && 'transform-gpu will-change-transform',
          className
        )}
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 400ms cubic-bezier(0.03, 0.98, 0.52, 0.99)',
        }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      className={cn(
        hover ? 'glass-card-hover' : 'glass-card',
        'rounded-2xl relative overflow-hidden',
        tilt && 'transform-gpu will-change-transform',
        className
      )}
      style={{
        transformStyle: 'preserve-3d',
        transition: 'transform 400ms cubic-bezier(0.03, 0.98, 0.52, 0.99)',
      }}
    >
      {cardContent}
    </div>
  );
};

export default GlassCard;
