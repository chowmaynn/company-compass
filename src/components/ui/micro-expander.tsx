'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';
import { Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MicroExpanderProps {
  text: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isLoading?: boolean;
  className?: string;
}

const SIZE = 32; // collapsed circle diameter

const variantStyles = {
  default: 'bg-primary text-primary-foreground border border-primary',
  outline: 'bg-transparent border border-input text-foreground hover:border-primary',
  ghost: 'bg-accent/50 border border-transparent text-accent-foreground hover:bg-accent',
};

export function MicroExpander({
  text,
  icon,
  variant = 'default',
  onClick,
  isLoading = false,
  className,
}: MicroExpanderProps) {
  const [hovered, setHovered] = React.useState(false);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [textWidth, setTextWidth] = React.useState(0);

  React.useEffect(() => {
    if (textRef.current) {
      setTextWidth(textRef.current.scrollWidth);
    }
  }, [text]);

  const expandedWidth = SIZE + textWidth + 12; // 12px right padding

  const containerVariants: Variants = {
    collapsed: { width: SIZE + 2 },
    expanded: { width: expandedWidth },
  };

  const textVariants: Variants = {
    collapsed: { opacity: 0, x: -8 },
    expanded: {
      opacity: 1,
      x: 0,
      transition: { delay: 0.1, duration: 0.2, ease: 'easeOut' },
    },
  };

  return (
    <motion.button
      className={cn(
        'relative flex items-center rounded-full overflow-hidden',
        'whitespace-nowrap font-medium text-[11px] tracking-wide',
        'h-8',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isLoading && 'cursor-not-allowed opacity-50',
        variantStyles[variant],
        className
      )}
      variants={containerVariants}
      initial="collapsed"
      animate={hovered && !isLoading ? 'expanded' : 'collapsed'}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => !isLoading && onClick?.(e)}
      aria-label={text}
    >
      {/* Icon */}
      <div className="shrink-0 flex items-center justify-center" style={{ width: SIZE, minWidth: SIZE }}>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          icon || <Plus className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Text — slides in from the right of the icon */}
      <motion.span
        ref={textRef}
        variants={textVariants}
        className="pr-3"
      >
        {text}
      </motion.span>
    </motion.button>
  );
}
