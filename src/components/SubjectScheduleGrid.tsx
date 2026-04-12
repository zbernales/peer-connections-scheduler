import { useState } from 'react';
import type { Shift, DayOfWeek, Tutor } from '../types';
import { timeToFloat, floatToTime } from '../utils/scheduler';

interface SubjectScheduleGridProps {
  subject: string;
  shifts: Shift[];
  roster: Tutor[];
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Generate 30-min time slots from 9:00 to 16:30
const TIMES: string[] = [];
for (let i = 9; i < 17; i += 0.5) {
  TIMES.push(floatToTime(i));
}

export function SubjectScheduleGrid({ shifts, roster }: SubjectScheduleGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // 1. Build a dictionary mapping "Day-Time" to an Array of Tutor Names
  const coverageMap = new Map<string, string[]>();

  shifts.forEach(shift => {
    const tutor = roster.find(t => t.id === shift.tutorId);
    const tutorName = tutor ? tutor.name : 'Unknown';

    let current = timeToFloat(shift.startTime);
    const end = timeToFloat(shift.endTime);

    while (current < end) {
      const cellId = `${shift.day}-${floatToTime(current)}`;
      
      if (!coverageMap.has(cellId)) {
        coverageMap.set(cellId, []);
      }
      coverageMap.get(cellId)!.push(tutorName);
      
      current += 0.5;
    }
  });

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem', paddingTop: '1rem' }}>
      
      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#10b981', borderRadius: '4px' }}></div>
          <span>Covered</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}></div>
          <span>No Coverage</span>
        </div>
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

        {/* Time Rows */}
        {TIMES.map(time => (
          <div style={{ display: 'contents' }} key={time}>
            
            {/* Time Label */}
            <div style={{ textAlign: 'right', paddingRight: '8px', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {time}
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
                    backgroundColor: isCovered ? '#10b981' : '#f1f5f9', // Emerald Green for coverage
                    border: '1px solid #cbd5e1',
                    borderRadius: '2px',
                    position: 'relative', // Critical for the tooltip to attach correctly
                    cursor: isCovered ? 'pointer' : 'default'
                  }}
                >
                  {/* The Custom Hover Tooltip */}
                  {hoveredCell === cellId && isCovered && (
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '120%', 
                      left: '50%', 
                      transform: 'translateX(-50%)', 
                      backgroundColor: '#1e293b', 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      whiteSpace: 'nowrap',
                      zIndex: 50,
                      pointerEvents: 'none', // Prevents tooltip from flickering
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      {tutorsHere.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}