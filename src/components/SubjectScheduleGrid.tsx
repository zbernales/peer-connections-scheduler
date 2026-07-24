import { useState, useMemo } from 'react';
import type { Shift, DayOfWeek, Tutor } from '../types';
import { timeToFloat, floatToTime, format12Hour } from '../utils/scheduler';

interface SubjectScheduleGridProps {
  subject: string;
  shifts: Shift[];
  roster: Tutor[];
  endHour?: number;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function SubjectScheduleGrid({ subject, shifts, roster, endHour = 17 }: SubjectScheduleGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const times = useMemo(() => {
    const generatedTimes: string[] = [];
    for (let i = 9; i < endHour; i += 0.5) {
      generatedTimes.push(floatToTime(i));
    }
    return generatedTimes;
  }, [endHour]);

  const coverageMap = new Map<string, string[]>();

  shifts.forEach(shift => {
    const tutor = roster.find(t => t.id === shift.tutorId);
    const tutorName = tutor ? tutor.name : 'Unknown';
    const loc = shift.location || 'SSC 600'; // <-- Fallback to SSC 600 if missing

    let current = timeToFloat(shift.startTime);
    const end = timeToFloat(shift.endTime);

    while (current < end) {
      const cellId = `${shift.day}-${floatToTime(current)}`;
      
      if (!coverageMap.has(cellId)) {
        coverageMap.set(cellId, []);
      }
      
      // Pushing the name + location into the hover tooltip array
      coverageMap.get(cellId)!.push(`${tutorName} (${loc})`);
      
      current += 0.5;
    }
  });

  const handleCopyGrid = (e: React.MouseEvent) => {
    e.stopPropagation();

    let text = `${subject} Coverage Schedule\n\n`;

    if (shifts.length === 0) {
      text += "No coverage scheduled this week.\n";
    } else {
      const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      ALL_DAYS.forEach(day => {
        const dayShifts = shifts.filter(s => s.day === day);
        if (dayShifts.length > 0) {
          text += `${day}:\n`;
          // Sort sequentially by start time
          dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
          
          dayShifts.forEach(shift => {
            const tutor = roster.find(t => t.id === shift.tutorId);
            const tutorName = tutor ? tutor.name : 'Unknown Educator';
            const role = tutor && (tutor as any).role ? (tutor as any).role : 'Tutor';
            const loc = shift.location || 'SSC 600'; // <-- Include location in copy text
            
            text += `- ${format12Hour(shift.startTime)} to ${format12Hour(shift.endTime)} (${tutorName}, ${role} @ ${loc})\n`;
          });
          text += '\n';
        }
      });
    }

    const textArea = document.createElement("textarea");
    textArea.value = text.trim();
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy grid schedule', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem', paddingTop: '1rem' }}>
      
      {/* Header Controls: Legend + Copy Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        
        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#10b981', borderRadius: '4px' }}></div>
            <span>Covered</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}></div>
            <span>No Coverage</span>
          </div>
        </div>

        {/* Copy Button */}
        <button 
          onClick={handleCopyGrid}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: isCopied ? '#ecfdf5' : 'white',
            color: isCopied ? '#10b981' : '#475569',
            border: `1px solid ${isCopied ? '#10b981' : '#cbd5e1'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          title={`Copy ${subject} Schedule`}
        >
          {isCopied ? '✅ Copied to Clipboard!' : '📋 Copy Schedule Text'}
        </button>

      </div>

      {/* The Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${DAYS.length}, 1fr)`, gap: '4px', minWidth: '600px' }}>
        
        {/* Header Row */}
        <div></div> 
        {DAYS.map(day => (
          <div key={day} style={{ textAlign: 'center', fontWeight: 'bold', padding: '0.5rem 0', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
            {day}
          </div>
        ))}

        {times.map(time => {
          // Identify the 5:00 PM boundary
          const isNightStart = time === '17:00';

          return (
            <div style={{ display: 'contents' }} key={time}>
              
              {isNightStart && (
                <div style={{
                  gridColumn: '1 / -1', 
                  height: '3px',
                  backgroundColor: '#334155',
                  marginTop: '0.75rem',
                  marginBottom: '0.75rem', 
                  borderRadius: '2px'
                }} />
              )}

              {/* Sidebar Time Label */}
              <div style={{ 
                textAlign: 'right', 
                paddingRight: '8px', 
                fontSize: '0.85rem', 
                color: isNightStart ? '#334155' : '#475569', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'flex-end', 
                justifyContent: 'flex-start', 
                paddingTop: '4px',
              }}>
                {time.endsWith(':00') ? format12Hour(time) : ''}
              </div>

              {/* Grid Cells */}
              {DAYS.map(day => {
                const cellId = `${day}-${time}`;
                const tutorsHere = coverageMap.get(cellId) || [];
                const isCovered = tutorsHere.length > 0;

                return (
                  <div
                    key={cellId}
                    onMouseEnter={() => setHoveredCell(cellId)}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      height: '24px',
                      backgroundColor: isCovered ? '#10b981' : '#f1f5f9', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '2px',
                      position: 'relative', 
                      cursor: isCovered ? 'pointer' : 'default'
                    }}
                  >
                    {hoveredCell === cellId && isCovered && (
                      <div style={{ 
                        position: 'absolute', 
                        bottom: '120%', 
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        backgroundColor: '#1e293b', 
                        color: 'white', 
                        padding: '6px 10px', // Extra padding for larger tooltip
                        borderRadius: '4px', 
                        fontSize: '0.75rem', 
                        whiteSpace: 'nowrap',
                        zIndex: 50,
                        pointerEvents: 'none', 
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                      }}>
                        {/* Map over the list so multiple tutors don't smash together onto one line */}
                        {tutorsHere.map((t, idx) => (
                           <div key={idx} style={{ paddingBottom: idx === tutorsHere.length - 1 ? 0 : '4px' }}>
                             {t}
                           </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}