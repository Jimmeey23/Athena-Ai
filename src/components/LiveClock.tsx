import React, { useEffect, useState } from 'react';

export const LiveClock: React.FC<{
  className?: string;
  dateClassName?: string;
  timeClassName?: string;
}> = ({
  className,
  dateClassName = 'text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400',
  timeClassName = 'mt-0.5 text-[15px] font-bold tabular-nums leading-none text-slate-800',
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const handle = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(handle);
  }, []);
  return (
    <div className={className || 'text-right'}>
      <div className={dateClassName}>
        {now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
      <div className={timeClassName}>
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
};
