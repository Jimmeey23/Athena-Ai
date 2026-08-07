import React, { useContext, useState } from 'react';
import { Check, Moon, MoonStar, Sun, Monitor } from 'lucide-react';
import { ThemeContext, type Theme } from './theme-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const THEME_OPTIONS: Array<{ value: Theme; label: string; description: string; icon: React.ElementType }> = [
  { value: 'light', label: 'Light', description: 'Crisp daylight surfaces', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Classic deep-navy dark mode', icon: Moon },
  { value: 'black', label: 'Matte Black', description: 'True matte black surfaces', icon: MoonStar },
  { value: 'system', label: 'System', description: 'Follow your device preference', icon: Monitor },
];

export function ThemeToggle({ className = '' }: { className?: string }) {
  const context = useContext(ThemeContext);
  const [open, setOpen] = useState(false);

  if (!context) {
    return null;
  }

  const { theme, setTheme } = context;
  const current = THEME_OPTIONS.find((option) => option.value === theme) || THEME_OPTIONS[3];
  const CurrentIcon = current.icon;

  const selectTheme = (value: Theme) => {
    setTheme(value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Theme: ${current.label}`}
          title={`Theme: ${current.label}`}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:border-slate-700 dark:hover:bg-slate-800 ${className}`}
        >
          <CurrentIcon className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-60 overflow-hidden rounded-2xl border-border bg-card/96 p-1.5 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl"
      >
        <div className="px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">
            Appearance
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Choose how Athena looks on your screen.
          </p>
        </div>
        <div className="p-1">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = option.value === theme;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => selectTheme(option.value)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'text-foreground hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    active
                      ? 'border-blue-200 bg-card text-blue-700 dark:border-blue-800 dark:text-blue-300'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">
                    {option.description}
                  </span>
                </span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
