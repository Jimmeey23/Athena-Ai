const SIDEBAR_BASE_CLASSES = [
  'z-10',
  'hidden',
  'min-h-0',
  'h-full',
  'flex-shrink-0',
  'flex-col',
  'overflow-y-auto',
  'overflow-x-hidden',
  'border-l',
  'border-slate-200/70',
  'bg-white/95',
  'py-4',
  'shadow-[-16px_0_56px_rgba(15,23,42,0.08)]',
  'backdrop-blur-2xl',
  'transition-all',
  'duration-300',
  'md:flex',
].join(' ');

export function appSidebarClassName(expanded: boolean): string {
  return `${SIDEBAR_BASE_CLASSES} ${expanded ? 'w-52 px-2.5' : 'w-[64px] px-2'}`;
}
