// src/components/TutorScheduleGrid.tsx
import { useState, useEffect } from 'react';
import type { Tutor, DayOfWeek } from '../types';
import { timeToFloat, floatToTime } from '../utils/scheduler';

interface TutorScheduleGridProps {
  tutor: Tutor;
  selectedSlots: Set<string>; // NEW: We now pass a flat Set of "Day-Time" strings
  onChange: (newSlots: Set<string>) => void; // NEW: Callback for draft changes
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TIMES: string[] = [];
for (let i = 9; i < 17; i += 0.5) {
  TIMES.push(floatToTime(i));
}

function buildSlotSet(items: { day: string; startTime: string; endTime: string }[]) {
  const set = new Set<string>();
  items.forEach(item => {
    let current = timeToFloat(item.startTime);
    const end = timeToFloat(item.endTime);
    while (current < end) {
      set.add(`${item.day}-${floatToTime(current)}`);
      current += 0.5;
    }
  });
  return set;
}

export function TutorScheduleGrid({ tutor, selectedSlots, onChange }: TutorScheduleGridProps) {
  const availableSlots = buildSlotSet(tutor.availability);
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [isAdding, setIsAdding] = useState(true);

  // Stop dragging if the mouse leaves the browser window or user lets go of the button
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseDown = (cellId: string) => {
    setIsDragging(true);
    const willAdd = !selectedSlots.has(cellId);
    setIsAdding(willAdd);
    updateCell(cellId, willAdd);
  };

  const handleMouseEnter = (cellId: string) => {
    if (isDragging) {
      updateCell(cellId, isAdding);
    }
  };

  const updateCell = (cellId: string, add: boolean) => {
    const newSlots = new Set(selectedSlots);
    if (add) {
      newSlots.add(cellId);
    } else {
      newSlots.delete(cellId);
    }
    onChange(newSlots);
  };

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem', userSelect: 'none' }}>
      
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#3b82f6', borderRadius: '4px' }}></div>
          <span>Scheduled</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#fca5a5', borderRadius: '4px' }}></div>
          <span>Forced (Outside Availability)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#bfdbfe', borderRadius: '4px' }}></div>
          <span>Available</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}></div>
          <span>Unavailable</span>
        </div>
      </div>

      {/* Grid */}
      <div 
        style={{ display: 'grid', gridTemplateColumns: `60px repeat(${DAYS.length}, 1fr)`, gap: '4px', minWidth: '600px' }}
        onMouseLeave={() => setIsDragging(false)} // Safety catch
      >
        <div></div> 
        {DAYS.map(day => (
          <div key={day} style={{ textAlign: 'center', fontWeight: 'bold', padding: '0.5rem 0', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
            {day}
          </div>
        ))}

        {TIMES.map(time => (
          <div style={{ display: 'contents' }} key={time}>
            <div style={{ textAlign: 'right', paddingRight: '8px', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {time}
            </div>

            {DAYS.map(day => {
              const cellId = `${day}-${time}`;
              const isScheduled = selectedSlots.has(cellId);
              const isAvailable = availableSlots.has(cellId);

              // Determine exact cell color
              let bgColor = '#f1f5f9'; 
              if (isScheduled && isAvailable) bgColor = '#3b82f6'; 
              else if (isScheduled && !isAvailable) bgColor = '#fca5a5'; 
              else if (!isScheduled && isAvailable) bgColor = '#bfdbfe'; 

              return (
                <div
                  key={cellId}
                  onMouseDown={() => handleMouseDown(cellId)}
                  onMouseEnter={() => handleMouseEnter(cellId)}
                  title="Click and drag to toggle shift"
                  style={{
                    height: '24px',
                    backgroundColor: bgColor,
                    border: '1px solid #cbd5e1',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', marginTop: '1rem' }}>
        * Click and drag to quickly paint or erase shifts for this tutor.
      </p>
    </div>
  );
}