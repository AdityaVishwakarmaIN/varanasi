'use client';

import React from 'react';
import { msg, useMessages } from 'gt-next';
import { MapPin } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AdvisorIcon } from '@/components/ui/Icons';
import { ADVISOR_IDS, type AdvisorId, type AdvisorNote } from '@/lib/advisors';
import { useAdvisorNotes } from '@/hooks/useAdvisorNotes';

// Translatable UI labels
const UI_LABELS = {
  cityAdvisors: msg('City Advisors'),
  overallCityRating: msg('Overall City Rating'),
  ratingDescription: msg('Based on happiness, health, education, safety & environment'),
  noUrgentIssues: msg('No urgent issues to report!'),
  cityRunningSmoothly: msg('Your city is running smoothly.'),
  showMe: msg('Show me'),
  fix: msg('Fix:'),
  allClear: msg('All clear'),
};

const ADVISOR_LABELS: Record<AdvisorId, { title: string; covers: string }> = {
  treasury: { title: msg('Treasury Officer'), covers: msg('Money, taxes, loans, bankruptcy risk') },
  engineer: { title: msg('City Engineer'), covers: msg('Power, water, roads, traffic, collapses') },
  river: { title: msg('River Officer'), covers: msg('Ganga Health, floods, embankments, ghats, tourism') },
  health: { title: msg('Health Officer'), covers: msg('Health, disease, heatwaves') },
  police: { title: msg('Police Commissioner'), covers: msg('Safety, crime, festivals and crowds') },
};

const PRIORITY_LABELS = {
  low: msg('low'),
  medium: msg('medium'),
  high: msg('high'),
  critical: msg('critical'),
};

const AVATAR_COLORS: Record<AdvisorId, { bg: string; accent: string }> = {
  treasury: { bg: '#b45309', accent: '#fcd34d' },
  engineer: { bg: '#1d4ed8', accent: '#facc15' },
  river: { bg: '#0e7490', accent: '#67e8f9' },
  health: { bg: '#047857', accent: '#f8fafc' },
  police: { bg: '#334155', accent: '#e2e8f0' },
};

/** Simple illustrated avatar: a face on a coloured disc, with one prop per role. */
export function AdvisorAvatar({ advisor, size = 32 }: { advisor: AdvisorId; size?: number }) {
  const { bg, accent } = AVATAR_COLORS[advisor];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="16" fill={bg} />
      {/* shoulders */}
      <path d="M6 30 C8 22, 24 22, 26 30 Z" fill="#f1f5f9" opacity="0.9" />
      {/* face */}
      <circle cx="16" cy="14" r="6" fill="#c68642" />
      <circle cx="13.8" cy="13.5" r="0.8" fill="#1f2937" />
      <circle cx="18.2" cy="13.5" r="0.8" fill="#1f2937" />
      <path d="M13.8 16.6 Q16 18 18.2 16.6" stroke="#1f2937" strokeWidth="0.8" fill="none" />
      {advisor === 'treasury' && (
        <>
          <path d="M10 10 Q16 4 22 10 Z" fill="#1f2937" />
          <circle cx="25" cy="24" r="3.5" fill={accent} stroke="#92400e" strokeWidth="0.8" />
        </>
      )}
      {advisor === 'engineer' && <path d="M9.5 11 Q16 3 22.5 11 L23.5 12 L8.5 12 Z" fill={accent} />}
      {advisor === 'river' && (
        <>
          <path d="M10 10 Q16 4 22 10 Z" fill="#1f2937" />
          <path d="M3 25 Q6 23 9 25 T15 25" stroke={accent} strokeWidth="1.4" fill="none" />
        </>
      )}
      {advisor === 'health' && (
        <>
          <path d="M10 10 Q16 5 22 10 Z" fill="#1f2937" />
          <rect x="22.5" y="21" width="6" height="6" rx="1" fill={accent} />
          <path d="M25.5 22.2 V25.8 M23.7 24 H27.3" stroke="#dc2626" strokeWidth="1.2" />
        </>
      )}
      {advisor === 'police' && (
        <>
          <path d="M9 11 L23 11 L22 7 Q16 5 10 7 Z" fill="#1e3a8a" />
          <rect x="9" y="10.5" width="14" height="1.5" fill={accent} />
        </>
      )}
    </svg>
  );
}

const PRIORITY_BORDER: Record<AdvisorNote['priority'], string> = {
  critical: 'border-l-2 border-l-red-500',
  high: 'border-l-2 border-l-amber-500',
  medium: 'border-l-2 border-l-yellow-500',
  low: '',
};

export function AdvisorsPanel({ onShowMe }: { onShowMe?: (note: AdvisorNote) => void } = {}) {
  const { state, setActivePanel } = useGame();
  const { stats } = state;
  const { notes } = useAdvisorNotes(state);
  const m = useMessages();

  const avgRating = (stats.happiness + stats.health + stats.education + stats.safety + stats.environment) / 5;
  const grade = avgRating >= 90 ? 'A+' : avgRating >= 80 ? 'A' : avgRating >= 70 ? 'B' : avgRating >= 60 ? 'C' : avgRating >= 50 ? 'D' : 'F';
  const gradeColor = avgRating >= 70 ? 'text-green-400' : avgRating >= 50 ? 'text-amber-400' : 'text-red-400';
  const quiet = ADVISOR_IDS.filter((id) => !notes.some((n) => n.advisor === id));

  const showMe = (note: AdvisorNote) => {
    onShowMe?.(note);
    setActivePanel('none');
  };

  return (
    <Dialog open={true} onOpenChange={() => setActivePanel('none')}>
      <DialogContent className="max-w-[520px] max-h-[85vh] sm:max-h-[640px]">
        <DialogHeader>
          <DialogTitle>{m(UI_LABELS.cityAdvisors)}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 min-h-0">
          <Card className="flex items-center gap-4 p-4 bg-primary/10 border-primary/30">
            <div className={`w-16 h-16 flex items-center justify-center text-3xl font-black rounded-md ${gradeColor} bg-primary/20`}>
              {grade}
            </div>
            <div>
              <div className="text-foreground font-semibold">{m(UI_LABELS.overallCityRating)}</div>
              <div className="text-muted-foreground text-sm">{m(UI_LABELS.ratingDescription)}</div>
            </div>
          </Card>

          <ScrollArea className="h-[min(420px,55vh)]">
            <div className="space-y-3 pr-2">
              {notes.length === 0 ? (
                <Card className="text-center py-8 text-muted-foreground bg-primary/10 border-primary/30">
                  <AdvisorIcon size={32} className="mx-auto mb-3 opacity-50" />
                  <div className="text-sm">{m(UI_LABELS.noUrgentIssues)}</div>
                  <div className="text-xs mt-1">{m(UI_LABELS.cityRunningSmoothly)}</div>
                </Card>
              ) : (
                notes.map((note) => {
                  const labels = ADVISOR_LABELS[note.advisor];
                  const canShow = (note.x !== undefined && note.y !== undefined) || !!note.overlay;
                  return (
                    <Card key={note.id} className={`p-3 bg-primary/10 border-primary/30 ${PRIORITY_BORDER[note.priority]}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <AdvisorAvatar advisor={note.advisor} size={28} />
                        <span className="text-foreground font-medium text-sm">{m(labels.title)}</span>
                        <Badge
                          variant={note.priority === 'critical' || note.priority === 'high' ? 'destructive' : 'secondary'}
                          className="ml-auto text-[10px]"
                        >
                          {m(PRIORITY_LABELS[note.priority])}
                        </Badge>
                      </div>
                      <div className="text-foreground text-sm leading-snug">{note.problem}</div>
                      <div className="text-muted-foreground text-xs leading-snug mt-0.5">
                        <span className="font-medium">{m(UI_LABELS.fix)}</span> {note.fix}
                      </div>
                      {canShow && onShowMe && (
                        <Button variant="ghost" size="sm" className="mt-1 h-8 px-2 text-xs text-primary" onClick={() => showMe(note)}>
                          <MapPin className="w-3.5 h-3.5 mr-1" />
                          {m(UI_LABELS.showMe)}
                        </Button>
                      )}
                    </Card>
                  );
                })
              )}
              {notes.length > 0 && quiet.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <span>{m(UI_LABELS.allClear)}:</span>
                  {quiet.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1" title={m(ADVISOR_LABELS[id].covers)}>
                      <AdvisorAvatar advisor={id} size={18} />
                      {m(ADVISOR_LABELS[id].title)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
