import { useRef, useState, useEffect } from 'react';
import { useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react';

type FlashDirection = 'up' | 'down' | 'none';

interface PriceFlashResult {
  /** CSS class for the row background flash (green/red). */
  rowFlashClass: string;
  /** Spring-animated motion value — use with AnimatedNumber to render. */
  springValue: MotionValue<string>;
  /** Raw spring (for custom formatting). */
  rawSpring: MotionValue<number>;
  direction: FlashDirection;
}

const SPRING_CONFIG = { stiffness: 80, damping: 20, mass: 0.5 };

/**
 * Tracks a numeric value and returns:
 * - A CSS class for a row background flash (green/red)
 * - A spring-animated MotionValue that smoothly interpolates to the new number
 */
export function usePriceFlash(
  value: number | undefined,
  formatFn?: (n: number) => string,
): PriceFlashResult {
  const prevRef = useRef<number | undefined>(undefined);
  const [direction, setDirection] = useState<FlashDirection>('none');

  const motionVal = useMotionValue(value ?? 0);
  const spring = useSpring(motionVal, SPRING_CONFIG);

  const defaultFormat = (n: number) => Math.round(n).toLocaleString();
  const fmt = formatFn ?? defaultFormat;
  const display = useTransform(spring, (v) => fmt(v));

  useEffect(() => {
    if (value === undefined) return;

    if (prevRef.current !== undefined && value !== prevRef.current) {
      setDirection(value > prevRef.current ? 'up' : 'down');
      // Clear direction after animation completes
      const timer = setTimeout(() => setDirection('none'), 1500);
      motionVal.set(value);
      prevRef.current = value;
      return () => clearTimeout(timer);
    }

    // Initial mount or first defined value — jump without animation
    motionVal.jump(value);
    prevRef.current = value;
  }, [value, motionVal]);

  const rowFlashClass =
    direction === 'up'
      ? 'animate-price-up'
      : direction === 'down'
        ? 'animate-price-down'
        : '';

  return {
    rowFlashClass,
    springValue: display,
    rawSpring: spring,
    direction,
  };
}
