import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Heart, Zap, Music, RefreshCw, Smile } from 'lucide-react';

interface InteractiveRobotSplineProps {
  scene?: string;
  className?: string;
  headObjectName?: string;
  smile?: boolean;
  isThinking?: boolean;
  isSpeaking?: boolean;
}

type BotMood = 'cyan' | 'violet' | 'emerald';

export default function InteractiveRobotSpline({
  className,
  smile = false,
  isThinking = false,
  isSpeaking = false,
}: InteractiveRobotSplineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const [canMountSpline, setCanMountSpline] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [mood, setMood] = useState<BotMood>('cyan');
  const [quote, setQuote] = useState('Hi Jimmeey! 👋 Click me!');
  const [clickSparks, setClickSparks] = useState<Array<{ id: number; x: number; y: number; type: 'heart' | 'zap' | 'star' }>>([]);

  // Container readiness guard for tests & dynamic sizing
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateReadiness = () => {
      const rect = node.getBoundingClientRect();
      const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
      setCanMountSpline((rect.width >= 24 && rect.height >= 24) || isTest);
    };

    updateReadiness();
    const observer = new ResizeObserver(updateReadiness);
    observer.observe(node);
    const frame = requestAnimationFrame(updateReadiness);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Canvas floating particle background effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canMountSpline) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 280;
      canvas.height = canvas.parentElement?.clientHeight || 280;
    };
    resizeCanvas();

    for (let i = 0; i < 22; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.6 + 0.2,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const color = mood === 'emerald' ? '52, 211, 153' : mood === 'violet' ? '167, 139, 250' : '56, 189, 248';

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${p.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${color}, 0.8)`;
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [canMountSpline, mood]);

  // Automatic eye blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 180);
    }, 3800);
    return () => clearInterval(blinkInterval);
  }, []);

  // Mouse tilt and pupil tracking
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const mouseX = (event.clientX - rect.left) / rect.width - 0.5;
      const mouseY = (event.clientY - rect.top) / rect.height - 0.5;

      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        setPupilOffset({
          x: Math.max(-12, Math.min(12, mouseX * 24)),
          y: Math.max(-10, Math.min(10, mouseY * 20)),
        });
        setTilt({
          x: Math.max(-10, Math.min(10, -mouseY * 16)),
          y: Math.max(-10, Math.min(10, mouseX * 16)),
        });
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Update speech bubble context quotes
  useEffect(() => {
    if (isThinking) {
      setQuote('Analyzing tickets... ⚡');
    } else if (isSpeaking) {
      setQuote('Drafting smart response! 💬');
    } else if (isHovered) {
      setQuote('Boop! I see you! ✨');
    } else {
      setQuote('Hi Jimmeey! 👋 Click me!');
    }
  }, [isThinking, isSpeaking, isHovered]);

  // Click burst reaction
  const handleBotClick = (event: React.MouseEvent) => {
    if (isSpinning) return;
    setIsSpinning(true);
    setTimeout(() => setIsSpinning(false), 750);

    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const types: Array<'heart' | 'zap' | 'star'> = ['heart', 'zap', 'star'];

    const newSparks = Array.from({ length: 4 }).map((_, i) => ({
      id: Date.now() + i,
      x: clickX + (Math.random() - 0.5) * 40,
      y: clickY + (Math.random() - 0.5) * 40,
      type: types[i % types.length],
    }));

    setClickSparks((prev) => [...prev.slice(-6), ...newSparks]);
    setTimeout(() => {
      setClickSparks((prev) => prev.filter((s) => !newSparks.some((n) => n.id === s.id)));
    }, 900);
  };

  const cycleMood = (e: React.MouseEvent) => {
    e.stopPropagation();
    const modes: BotMood[] = ['cyan', 'violet', 'emerald'];
    const next = modes[(modes.indexOf(mood) + 1) % modes.length];
    setMood(next);
  };

  const themeColors = {
    cyan: {
      border: 'border-cyan-400/40',
      glow: 'from-cyan-400/30 via-blue-500/20 to-purple-500/30',
      eye: 'from-cyan-300 via-cyan-400 to-blue-500 shadow-[0_0_18px_rgba(56,189,248,0.9)]',
      accent: 'text-cyan-400',
      ring: 'border-cyan-400/40',
      badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-400/30',
    },
    violet: {
      border: 'border-purple-400/40',
      glow: 'from-purple-500/30 via-pink-500/20 to-indigo-500/30',
      eye: 'from-fuchsia-300 via-purple-400 to-indigo-500 shadow-[0_0_18px_rgba(192,132,252,0.9)]',
      accent: 'text-purple-400',
      ring: 'border-purple-400/40',
      badge: 'bg-purple-500/10 text-purple-300 border-purple-400/30',
    },
    emerald: {
      border: 'border-emerald-400/40',
      glow: 'from-emerald-400/30 via-teal-500/20 to-cyan-500/30',
      eye: 'from-emerald-300 via-teal-400 to-cyan-500 shadow-[0_0_18px_rgba(52,211,153,0.9)]',
      accent: 'text-emerald-400',
      ring: 'border-emerald-400/40',
      badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
    },
  }[mood];

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleBotClick}
      className={cn('relative flex flex-col items-center justify-center overflow-visible min-h-6 min-w-6 cursor-pointer select-none p-2', className)}
    >
      {canMountSpline ? (
        <div className="relative flex flex-col items-center justify-center w-full max-w-[300px]">
          {/* Interactive Speech Bubble */}
          <div className="relative mb-2.5 animate-bounce [animation-duration:3s]">
            <div className={cn('flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-xl transition-all duration-300', themeColors.badge)}>
              <Sparkles className={cn('h-3.5 w-3.5 animate-spin', themeColors.accent)} />
              <span>{quote}</span>
            </div>
            {/* Speech Bubble Arrow */}
            <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b bg-slate-900 border-slate-700" />
          </div>

          {/* Hologram Stage Pod */}
          <div
            style={{
              transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            }}
            className={cn(
              'relative flex h-56 w-56 items-center justify-center rounded-3xl border border-white/10 bg-slate-950/80 p-3 shadow-[0_25px_60px_rgba(15,23,42,0.6)] backdrop-blur-2xl transition-transform duration-150 ease-out',
              themeColors.border,
              isSpinning && 'animate-[spin_0.75s_cubic-bezier(0.34,1.56,0.64,1)]'
            )}
          >
            {/* Canvas Particle Overlay */}
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none rounded-3xl" />

            {/* Glowing Ambient Aura */}
            <div
              className={cn(
                'absolute inset-2 rounded-full bg-gradient-to-br blur-2xl transition-all duration-700',
                themeColors.glow,
                isThinking && 'animate-pulse scale-125',
                isSpeaking && 'scale-130',
                isHovered && 'scale-120 blur-3xl'
              )}
            />

            {/* Rotating Holographic Ring Base */}
            <div className={cn('absolute bottom-3 h-10 w-44 rounded-full border border-dashed animate-[spin_6s_linear_infinite]', themeColors.ring)} />

            {/* Floating Sparks on Click */}
            {clickSparks.map((spark) => (
              <div
                key={spark.id}
                style={{ left: spark.x, top: spark.y }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-[ping_0.8s_ease-out]"
              >
                {spark.type === 'heart' && <Heart className="h-5 w-5 text-pink-400 fill-pink-400" />}
                {spark.type === 'zap' && <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" />}
                {spark.type === 'star' && <Sparkles className="h-5 w-5 text-cyan-400 fill-cyan-400" />}
              </div>
            ))}

            {/* Bot Head Structure */}
            <div className="relative z-10 flex h-[82%] w-[82%] flex-col items-center justify-center rounded-[38px] border-2 border-slate-700/80 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-3.5 shadow-[0_15px_40px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
              {/* Top Antenna */}
              <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 flex-col items-center">
                <div
                  className={cn(
                    'h-3.5 w-3.5 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-[0_0_14px_#38bdf8] transition-all duration-300',
                    (isThinking || isHovered) && 'scale-125 animate-ping',
                    isSpeaking && 'scale-130 bg-emerald-400 shadow-[0_0_18px_#34d399]'
                  )}
                />
                <div className="h-3.5 w-1 bg-slate-600 shadow-sm" />
              </div>

              {/* Glossy Visor Screen */}
              <div className="relative flex h-[74%] w-[92%] items-center justify-between overflow-hidden rounded-[26px] border border-blue-500/25 bg-slate-950 px-3 py-2 shadow-[inset_0_4px_18px_rgba(0,0,0,0.9)]">
                {/* Visor Screen Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none" />

                {/* Eyes & Face Layer */}
                <div
                  style={{
                    transform: `translate3d(${pupilOffset.x}px, ${pupilOffset.y}px, 0px)`,
                  }}
                  className="relative flex w-full items-center justify-between transition-transform duration-100 ease-out"
                >
                  {/* Left Eye */}
                  <div className="relative flex h-10 w-10 items-center justify-center">
                    <div
                      className={cn(
                        'flex items-center justify-center rounded-full bg-gradient-to-br transition-all duration-200',
                        themeColors.eye,
                        isBlinking ? 'h-1 w-8 rounded-full' : 'h-9 w-9',
                        (smile || isHovered) && !isBlinking && 'h-9 w-9 rounded-t-full rounded-b-sm'
                      )}
                    >
                      {!isBlinking && <div className="absolute top-1.5 left-1.5 h-2.5 w-2.5 rounded-full bg-white shadow-sm" />}
                    </div>
                  </div>

                  {/* Mouth LED */}
                  <div className="flex items-center justify-center">
                    {isSpeaking ? (
                      <div className="flex items-center gap-0.5">
                        <span className="h-3 w-1 animate-bounce rounded-full bg-emerald-400" />
                        <span className="h-5 w-1 animate-bounce rounded-full bg-cyan-300 [animation-delay:0.15s]" />
                        <span className="h-3 w-1 animate-bounce rounded-full bg-emerald-400 [animation-delay:0.3s]" />
                      </div>
                    ) : isHovered || smile ? (
                      <div className="h-2 w-7 rounded-b-full border-b-3 border-cyan-300 shadow-[0_4px_10px_rgba(56,189,248,0.8)]" />
                    ) : isThinking ? (
                      <div className="h-1.5 w-5 animate-pulse rounded-full bg-cyan-400" />
                    ) : (
                      <div className="h-1.5 w-4 rounded-full bg-blue-400/60" />
                    )}
                  </div>

                  {/* Right Eye */}
                  <div className="relative flex h-10 w-10 items-center justify-center">
                    <div
                      className={cn(
                        'flex items-center justify-center rounded-full bg-gradient-to-br transition-all duration-200',
                        themeColors.eye,
                        isBlinking ? 'h-1 w-8 rounded-full' : 'h-9 w-9',
                        isHovered && !isBlinking && 'h-1 w-8 rounded-full', // Winking on hover!
                        smile && !isHovered && !isBlinking && 'h-9 w-9 rounded-t-full rounded-b-sm'
                      )}
                    >
                      {!isBlinking && (!isHovered || smile) && (
                        <div className="absolute top-1.5 left-1.5 h-2.5 w-2.5 rounded-full bg-white shadow-sm" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Pink Blush Glow */}
                {(isHovered || smile) && (
                  <>
                    <div className="absolute bottom-2 left-3 h-2.5 w-4 rounded-full bg-pink-400/40 blur-xs" />
                    <div className="absolute bottom-2 right-3 h-2.5 w-4 rounded-full bg-pink-400/40 blur-xs" />
                  </>
                )}
              </div>

              {/* Bot Chest Badge */}
              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/80">
                <Sparkles className={cn('h-3 w-3 animate-spin', themeColors.accent)} />
                <span>Athena Prime</span>
              </div>
            </div>
          </div>

          {/* Interactive Mood Controls */}
          <div className="mt-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/80 px-2.5 py-1 backdrop-blur-md shadow-md">
            <button
              type="button"
              onClick={cycleMood}
              className="flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-white/80 hover:bg-slate-700 hover:text-white transition"
              title="Cycle Color Theme"
            >
              <RefreshCw className="h-3 w-3 text-cyan-400" />
              <span>Theme</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleBotClick(e);
              }}
              className="flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-white/80 hover:bg-slate-700 hover:text-white transition"
              title="Poke Bot"
            >
              <Smile className="h-3 w-3 text-pink-400" />
              <span>Poke</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-transparent">
          <div className="h-6 w-6 rounded-full border-2 border-blue-400/30 border-t-cyan-400 animate-spin" />
        </div>
      )}
    </div>
  );
}
