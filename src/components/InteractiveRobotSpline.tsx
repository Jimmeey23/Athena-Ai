import { cn } from '@/lib/utils';

interface InteractiveRobotSplineProps {
  scene?: string;
  className?: string;
  headObjectName?: string;
  smile?: boolean;
  isThinking?: boolean;
  isSpeaking?: boolean;
}

export default function InteractiveRobotSpline({
  className,
}: InteractiveRobotSplineProps) {
  return (
    <div
      className={cn('relative min-h-6 min-w-6', className)}
      /* Force a dark base so even if the iframe bg bleeds, it reads dark */
      style={{ background: 'rgb(10, 15, 30)' }}
    >
      {/* iframe sits below all z-10 overlay cards */}
      <iframe
        src="https://my.spline.design/genkubgreetingrobot-dPYL2QOApdnp3T8l7XOfA33f/"
        frameBorder="0"
        title="Greeting Robot"
        allow="autoplay"
        style={{
          position: 'absolute',
          top: '5%',
          left: '10%',
          width: '120%',
          height: '100%',
          border: 'none',
          display: 'block',
          /* lighten: white bg of iframe disappears against our dark container;
             only the robot (bright object) shows through */
          mixBlendMode: 'lighten',
          zIndex: 1,
          transform: 'scaleX(1)',
        }}
      />

      {/* Top-edge fade: merges iframe top into the sidebar gradient */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'linear-gradient(to bottom, rgb(10,15,30) 0%, transparent 18%, transparent 75%, rgb(10,15,30) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Side-edge fade: softens left/right overflow from the oversized iframe */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          background:
            'linear-gradient(to right, rgb(10,15,30) 0%, transparent 10%, transparent 90%, rgb(10,15,30) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
