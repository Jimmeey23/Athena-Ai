import React, { useEffect, useMemo, useState } from 'react';
import {
  loadMomenceSessionsProgressively,
  MomenceMemberOption,
  MomenceSessionOption,
  searchMomenceMembers,
} from '@/lib/momence-api';

function sessionDisplay(session: MomenceSessionOption): string {
  return [session.label, session.description].filter(Boolean).join(' · ');
}

function contactDisplay(member: MomenceMemberOption): string {
  return member.email || member.phoneNumber || member.description || '';
}

export const MomenceMemberTicketField: React.FC<{
  memberName?: string | null;
  memberContact?: string | null;
  onSelect: (member: MomenceMemberOption) => void;
  onClear?: () => void;
}> = ({ memberName, memberContact, onSelect, onClear }) => {
  const [query, setQuery] = useState(memberName || memberContact || '');
  const [options, setOptions] = useState<MomenceMemberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === memberName) {
      setOptions([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        setOptions(await searchMomenceMembers(trimmed));
      } catch (e) {
        setOptions([]);
        setError(e instanceof Error ? e.message : 'Momence member search failed');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [memberName, query]);

  return (
    <label className="relative grid gap-1.5 text-xs font-semibold text-muted-foreground">
      Momence member
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Momence by name, email, or phone"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        />
        {memberName && onClear ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOptions([]);
              onClear();
            }}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
          >
            Clear
          </button>
        ) : null}
      </div>
      {memberContact ? <span className="truncate text-[11px] font-medium text-muted-foreground">{memberContact}</span> : null}
      {loading ? <span className="text-[11px] font-medium text-muted-foreground">Searching Momence...</span> : null}
      {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
      {options.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-[0_18px_44px_rgba(15,23,42,0.12)]">
          {options.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => {
                setQuery(member.label);
                setOptions([]);
                onSelect(member);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-xs transition hover:bg-muted"
            >
              <span className="block font-semibold text-foreground">{member.label}</span>
              <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">{contactDisplay(member)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
};

export const MomenceSessionTicketField: React.FC<{
  classType?: string | null;
  classDateTime?: string | null;
  trainer?: string | null;
  studio?: string | null;
  onSelect: (session: MomenceSessionOption) => void;
  onClear?: () => void;
}> = ({ classType, classDateTime, trainer, studio, onSelect, onClear }) => {
  const [options, setOptions] = useState<MomenceSessionOption[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setOptions([]);

    loadMomenceSessionsProgressively('', undefined, (sessions) => {
      if (!cancelled) {
        setOptions((current) => {
          const byId = new Map(current.map((session) => [session.id, session]));
          sessions.forEach((session) => byId.set(session.id, session));
          return Array.from(byId.values());
        });
      }
    })
      .then((sessions) => {
        if (!cancelled) setOptions(sessions);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Momence sessions failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((session) => sessionDisplay(session).toLowerCase().includes(normalized));
  }, [options, query]);

  return (
    <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
      Momence session
      <div className="flex gap-2">
        <select
          value=""
          onChange={(event) => {
            const selected = options.find((session) => session.id === event.target.value);
            if (selected) onSelect(selected);
          }}
          className="h-10 min-w-0 flex-1 rounded-xl border border-border px-3 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
        >
          <option value="">
            {loading && options.length === 0
              ? 'Loading Momence sessions...'
              : classType || 'Select Momence session'}
          </option>
          {filteredOptions.map((session) => (
            <option key={session.id} value={session.id}>{sessionDisplay(session)}</option>
          ))}
        </select>
        {(classType || classDateTime || trainer || studio) && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
          >
            Clear
          </button>
        ) : null}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter loaded Momence sessions"
        className="h-9 rounded-xl border border-border px-3 text-xs font-medium text-foreground outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      />
      {[classDateTime, trainer, studio].filter(Boolean).length > 0 ? (
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {[classDateTime, trainer, studio].filter(Boolean).join(' · ')}
        </span>
      ) : null}
      {loading && options.length > 0 ? <span className="text-[11px] font-medium text-muted-foreground">Loading more Momence sessions...</span> : null}
      {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
    </label>
  );
};
