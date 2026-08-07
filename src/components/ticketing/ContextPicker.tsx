import React, { useEffect, useState } from 'react';
import { STUDIOS, TRAINERS, CATEGORIES, MEMBERSHIPS, INTAKE_ROUTES, PRIORITY_SLA } from '@/lib/ticketing-data';
import { MapPin, User, Calendar, Tag, ChevronDown, X, BadgeCheck, Search, Route, Siren, Paperclip } from 'lucide-react';
import { trainerImageUrl, trainerInitials } from '@/lib/trainer-images';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  MomenceMemberOption,
  MomenceSessionOption,
  searchMomenceMembers,
  searchMomenceSessions,
} from '@/lib/momence-api';

export interface Context {
  intakeRoute?: string;
  memberId?: string;
  memberName?: string;
  memberContact?: string;
  sessionId?: string;
  studio?: string;
  trainer?: string;
  classType?: string;
  classDateTime?: string;
  membership?: string;
  category?: string;
  subCategory?: string;
  priority?: string;
  urgencyReason?: string;
  reportedBy?: string;
}

interface Props {
  context: Context;
  onChange: (ctx: Context) => void;
  attachmentCount?: number;
  accent?: 'blue';
}

interface MomenceSearchOption {
  id: string;
  label: string;
  description: string;
}

function splitMulti(value?: string): string[] {
  return (value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function appendMultiUnique(current: string | undefined, next: string): string {
  const existing = splitMulti(current);
  if (!next.trim()) return existing.join(' | ');
  if (existing.some((item) => item.toLowerCase() === next.trim().toLowerCase())) return existing.join(' | ');
  return [...existing, next.trim()].join(' | ');
}

function multiDisplay(value?: string, fallback = ''): string {
  const items = splitMulti(value);
  if (items.length === 0) return fallback;
  if (items.length === 1) return items[0];
  return `${items[0]} +${items.length - 1}`;
}

export const ContextPicker: React.FC<Props> = ({ context, onChange, attachmentCount = 0, accent = 'blue' }) => {
  const activeTone = 'border-blue-500 bg-blue-50 text-blue-700 shadow-[0_10px_22px_rgba(37,99,235,0.14)]';
  const controls: Array<{ key: string; active: boolean; node: React.ReactNode }> = [
    {
      key: 'documents',
      active: attachmentCount > 0,
      node: (
        <button
          type="button"
          className={`inline-flex h-8 min-w-0 max-w-[180px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm transition duration-200 ${
            attachmentCount > 0
              ? activeTone
              : 'border-border bg-card/90 text-muted-foreground'
          }`}
          title={attachmentCount > 0 ? `${attachmentCount} attachment(s) queued` : 'No attachments queued'}
        >
          <Paperclip className="w-3 h-3" />
          <span className="truncate min-w-0">
            {attachmentCount > 0 ? `Documents (${attachmentCount})` : 'Documents'}
          </span>
        </button>
      ),
    },
    {
      key: 'member',
      active: Boolean(context.memberName || context.memberId),
      node: (
        <AsyncPicker
          icon={<User className="w-3 h-3" />}
          label="Member"
          value={multiDisplay(context.memberName)}
          loadOptions={searchMomenceMembers}
          onSelect={(member) =>
            onChange({
              ...context,
              memberId: appendMultiUnique(context.memberId, member.id),
              memberName: appendMultiUnique(context.memberName, member.name),
              memberContact: appendMultiUnique(context.memberContact, member.email || member.phoneNumber || ''),
            })
          }
          onClear={() =>
            onChange({
              ...context,
              memberId: undefined,
              memberName: undefined,
              memberContact: undefined,
            })
          }
          accent={accent}
        />
      ),
    },
    {
      key: 'session',
      active: Boolean(context.sessionId || context.classType),
      node: (
        <AsyncPicker
          icon={<Calendar className="w-3 h-3" />}
          label="Session"
          value={multiDisplay(context.classType)}
          loadOptions={searchMomenceSessions}
          onSelect={(session) =>
            onChange({
              ...context,
              sessionId: appendMultiUnique(context.sessionId, session.id),
              classType: appendMultiUnique(context.classType, session.classType),
              classDateTime: appendMultiUnique(context.classDateTime, session.startsAt || ''),
              trainer: appendMultiUnique(context.trainer, session.trainer || ''),
              studio: appendMultiUnique(context.studio, session.studio || ''),
            })
          }
          onClear={() =>
            onChange({
              ...context,
              sessionId: undefined,
              classType: undefined,
              classDateTime: undefined,
            })
          }
          accent={accent}
        />
      ),
    },
    {
      key: 'studio',
      active: Boolean(context.studio),
      node: (
        <Picker
          icon={<MapPin className="w-3 h-3" />}
          label="Studio"
          value={context.studio}
          options={STUDIOS}
          onSelect={(v) => onChange({ ...context, studio: v })}
          onClear={() => onChange({ ...context, studio: undefined })}
          accent={accent}
        />
      ),
    },
    {
      key: 'trainer',
      active: Boolean(context.trainer),
      node: (
        <TrainerPicker
          value={context.trainer}
          onSelect={(v) => onChange({ ...context, trainer: v })}
          onClear={() => onChange({ ...context, trainer: undefined })}
          accent={accent}
        />
      ),
    },
    {
      key: 'membership',
      active: Boolean(context.membership),
      node: (
        <Picker
          icon={<BadgeCheck className="w-3 h-3" />}
          label="Membership"
          value={context.membership}
          options={MEMBERSHIPS}
          onSelect={(v) => onChange({ ...context, membership: v })}
          onClear={() => onChange({ ...context, membership: undefined })}
          accent={accent}
        />
      ),
    },
    {
      key: 'route',
      active: Boolean(context.intakeRoute),
      node: (
        <Picker
          icon={<Route className="w-3 h-3" />}
          label="Route"
          value={context.intakeRoute}
          options={INTAKE_ROUTES}
          onSelect={(v) => onChange({ ...context, intakeRoute: v })}
          onClear={() => onChange({ ...context, intakeRoute: undefined })}
          accent={accent}
        />
      ),
    },
    {
      key: 'category',
      active: Boolean(context.category),
      node: (
        <Picker
          icon={<Tag className="w-3 h-3" />}
          label="Category"
          value={context.category}
          options={Object.keys(CATEGORIES)}
          onSelect={(v) => onChange({ ...context, category: v, subCategory: undefined })}
          onClear={() => onChange({ ...context, category: undefined, subCategory: undefined })}
          accent={accent}
        />
      ),
    },
    ...(context.category ? [{
      key: 'subCategory',
      active: Boolean(context.subCategory),
      node: (
        <Picker
          icon={<Tag className="w-3 h-3" />}
          label="Sub-category"
          value={context.subCategory}
          options={CATEGORIES[context.category] || []}
          onSelect={(v) => onChange({ ...context, subCategory: v })}
          onClear={() => onChange({ ...context, subCategory: undefined })}
          accent={accent}
        />
      ),
    }] : []),
    {
      key: 'priority',
      active: Boolean(context.priority),
      node: (
        <Picker
          icon={<Siren className="w-3 h-3" />}
          label="Priority"
          value={context.priority}
          options={Object.keys(PRIORITY_SLA)}
          onSelect={(v) => onChange({ ...context, priority: v })}
          onClear={() => onChange({ ...context, priority: undefined })}
          accent={accent}
        />
      ),
    },
    {
      key: 'urgency',
      active: Boolean(context.urgencyReason),
      node: (
        <input
          value={context.urgencyReason || ''}
          onChange={(event) => onChange({ ...context, urgencyReason: event.target.value })}
          placeholder="Urgency reason"
          className={`h-8 min-w-[200px] rounded-full border border-border bg-card/90 px-3 text-xs font-semibold text-foreground shadow-sm outline-none transition duration-200 placeholder:text-muted-foreground focus:ring-4 ${
            'hover:border-blue-200 focus:border-blue-500 focus:ring-blue-500/15'
          }`}
        />
      ),
    },
  ];
  const sortedControls = controls
    .map((control, index) => ({ ...control, index }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.index - b.index);

  return (
    <div className="flex w-max flex-nowrap items-center gap-2">
      {sortedControls.map((control) => (
        <React.Fragment key={control.key}>{control.node}</React.Fragment>
      ))}
    </div>
  );
};

interface AsyncPickerProps<TOption extends MomenceSearchOption> {
  icon: React.ReactNode;
  label: string;
  value?: string;
  loadOptions: (query: string) => Promise<TOption[]>;
  onSelect: (option: TOption) => void;
  onClear: () => void;
  accent?: 'blue';
}

const AsyncPicker = <TOption extends MomenceSearchOption,>({
  icon,
  label,
  value,
  loadOptions,
  onSelect,
  onClear,
  accent = 'blue',
}: AsyncPickerProps<TOption>) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<TOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await loadOptions(query);
        setOptions(results);
      } catch (e: unknown) {
        setOptions([]);
        setError(e instanceof Error ? e.message : 'Momence search failed');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [loadOptions, open, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-8 min-w-0 max-w-[210px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm transition duration-200 ${
            value
              ? 'border-stone-950 bg-stone-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]'
              : 'border-border bg-card/90 text-muted-foreground hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-stone-950'
          }`}
        >
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate min-w-0">{value || `Search ${label}`}</span>
          {value ? (
            <X
              className="w-3 h-3 ml-0.5 flex-shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }}
            />
          ) : (
            <Search className="w-3 h-3 flex-shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-border bg-card/96 p-0 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={`Search Momence ${label.toLowerCase()}...`}
            className="text-xs"
          />
          <CommandList className="max-h-[352px]">
            <CommandEmpty>
              {loading
                ? 'Searching Momence...'
                : error
                  ? error
                  : query.length < 2 && label === 'Member'
                    ? 'Enter at least 2 characters'
                    : 'No Momence matches'}
            </CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.id}
                value={`${option.label} ${option.description}`}
                onSelect={() => {
                  onSelect(option);
                  setOpen(false);
                  setQuery('');
                }}
                className="items-start whitespace-normal break-words text-xs leading-snug"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-foreground">{option.label}</div>
                  {option.description && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{option.description}</div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const Picker: React.FC<{
  icon: React.ReactNode;
  label: string;
  value?: string;
  options: string[];
  onSelect: (v: string) => void;
  onClear: () => void;
  accent?: 'blue';
}> = ({ icon, label, value, options, onSelect, onClear, accent = 'blue' }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-8 min-w-0 max-w-[180px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm transition duration-200 ${
            value
              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-[0_10px_22px_rgba(37,99,235,0.14)]'
              : 'border-border bg-card/90 text-muted-foreground hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-stone-950'
          }`}
        >
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate min-w-0">{value || label}</span>
          {value ? (
            <X
              className="w-3 h-3 ml-0.5 flex-shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }}
            />
          ) : (
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-border bg-card/96 p-0 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl"
      >
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} className="text-xs" />
          <CommandList className="max-h-[352px]">
            <CommandEmpty>No matches</CommandEmpty>
            {options.map((opt) => (
              <CommandItem
                key={opt}
                value={opt}
                onSelect={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                className="items-start whitespace-normal break-words text-xs leading-snug"
              >
                {opt}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const TrainerPicker: React.FC<{
  value?: string;
  onSelect: (v: string) => void;
  onClear: () => void;
  accent?: 'blue';
}> = ({ value, onSelect, onClear }) => {
  const [open, setOpen] = useState(false);
  const imgUrl = trainerImageUrl(value);
  const initials = trainerInitials(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex h-8 min-w-0 max-w-[200px] items-center gap-1.5 rounded-full border px-2 pr-3 text-xs font-semibold shadow-sm transition duration-200 ${
            value
              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-[0_10px_22px_rgba(37,99,235,0.14)]'
              : 'border-border bg-card/90 text-muted-foreground hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-stone-950'
          }`}
        >
          {value ? (
            imgUrl ? (
              <img src={imgUrl} alt={value} className="h-5 w-5 flex-shrink-0 rounded-full object-cover ring-1 ring-blue-200" />
            ) : (
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">{initials}</span>
            )
          ) : (
            <User className="w-3 h-3 flex-shrink-0" />
          )}
          <span className="truncate min-w-0">{value || 'Trainer'}</span>
          {value ? (
            <X
              className="w-3 h-3 ml-0.5 flex-shrink-0 opacity-60 hover:opacity-100"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClear(); }}
            />
          ) : (
            <ChevronDown className="w-3 h-3 flex-shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-border bg-card/96 p-0 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl"
      >
        <Command>
          <CommandInput placeholder="Search trainer..." className="text-xs" />
          <CommandList className="max-h-[352px]">
            <CommandEmpty>No matches</CommandEmpty>
            {TRAINERS.map((name) => {
              const url = trainerImageUrl(name);
              const init = trainerInitials(name);
              return (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={() => { onSelect(name); setOpen(false); }}
                  className="flex items-center gap-2.5 px-2 py-1.5 text-xs leading-snug"
                >
                  {url ? (
                    <img src={url} alt={name} className="h-7 w-7 flex-shrink-0 rounded-full object-cover shadow-sm" />
                  ) : (
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-bold text-white shadow-sm">
                      {init}
                    </span>
                  )}
                  <span className="font-medium text-foreground">{name}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
