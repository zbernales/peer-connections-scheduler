import { useState, useEffect } from 'react';
import type { DayOfWeek } from '../types';

interface AvailabilityGridProps {
  selectedSlots: Set<string>;
  onChange: (newSlots: Set<string>) => void;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Generate 30-min time slots from 9:00 to 16:30
const TIMES: string[] = [];
for (let i = 9; i < 17; i += 0.5) {
  const hours = Math.floor(i).toString().padStart(2, '0');
  const mins = i % 1 === 0 ? '00' : '30';
  TIMES.push(`${hours}:${mins}`);
}

export function AvailabilityGrid({ selectedSlots, onChange }: AvailabilityGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);

  // Stop dragging if the user lets go of the mouse anywhere on the screen
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      setDragMode(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const toggleCell = (cellId: string, mode: 'add' | 'remove') => {
    const newSlots = new Set(selectedSlots);
    if (mode === 'add') newSlots.add(cellId);
    else newSlots.delete(cellId);
    onChange(newSlots);
  };

  const handleMouseDown = (cellId: string) => {
    setIsDragging(true);
    // If they click an already-selected cell, we assume they want to drag to erase
    const mode = selectedSlots.has(cellId) ? 'remove' : 'add';
    setDragMode(mode);
    toggleCell(cellId, mode);
  };

  const handleMouseEnter = (cellId: string) => {
    if (isDragging && dragMode) {
      toggleCell(cellId, dragMode);
    }
  };

  return (
    <div style={{ userSelect: 'none', overflowX: 'auto' }}>
      <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.9rem' }}>
        <em>Click and drag to highlight your availability.</em>
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${DAYS.length}, 1fr)`, gap: '4px', minWidth: '600px' }}>
        
        {/* Header Row: Blank corner + Days */}
        <div></div> 
        {DAYS.map(day => (
          <div key={day} style={{ textAlign: 'center', fontWeight: 'bold', padding: '0.5rem 0', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
            {day}
          </div>
        ))}

        {/* Time Rows */}
        {TIMES.map(time => (
          <div style={{ display: 'contents' }} key={time}>
            
            {/* The Time Label on the left */}
            <div style={{ textAlign: 'right', paddingRight: '8px', fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {time}
            </div>

            {/* The Clickable Grid Cells */}
            {DAYS.map(day => {
              const cellId = `${day}-${time}`;
              const isSelected = selectedSlots.has(cellId);

              return (
                <div
                  key={cellId}
                  onMouseDown={() => handleMouseDown(cellId)}
                  onMouseEnter={() => handleMouseEnter(cellId)}
                  style={{
                    height: '24px',
                    backgroundColor: isSelected ? '#3b82f6' : '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    transition: 'background-color 0.1s'
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}