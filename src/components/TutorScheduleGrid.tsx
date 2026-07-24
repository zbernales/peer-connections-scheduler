import { useState, useEffect, useMemo } from 'react';
import type { Tutor, Location } from '../types';
import { timeToFloat, floatToTime, format12Hour } from '../utils/scheduler';

interface TutorScheduleGridProps {
  tutor: Tutor;
  selectedSlots: Set<string>; 
  onChange: (newSlots: Set<string>) => void; 
  endHour?: number;
  days: string[];
  // --- NEW PROPS FOR LOCATIONS ---
  locationsList?: Location[];
  slotLocations?: Record<string, string>;
  onLocationChangeRequest?: (slotId: string, newLoc: string) => void;
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

export function TutorScheduleGrid({ 
  tutor, 
  selectedSlots, 
  onChange, 
  endHour = 17, 
  days,
  locationsList = [],
  slotLocations = {},
  onLocationChangeRequest
}: TutorScheduleGridProps) {
  const availableSlots = buildSlotSet(tutor.availability);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isAdding, setIsAdding] = useState(true);

  const weekdays = days.filter(d => d !== 'Saturday' && d !== 'Sunday');
  const weekends = days.filter(d => d === 'Saturday' || d === 'Sunday');
  const showSeparator = weekdays.length > 0 && weekends.length > 0;

  const gridCols = showSeparator 
    ? `60px repeat(${weekdays.length}, 1fr) 20px repeat(${weekends.length}, 1fr)`
    : `60px repeat(${days.length}, 1fr)`;

  const times = useMemo(() => {
    const generatedTimes: string[] = [];
    for (let i = 9; i < endHour; i += 0.5) {
      generatedTimes.push(floatToTime(i));
    }
    return generatedTimes;
  }, [endHour]);

  const showNightLine = times.includes('17:00') && weekdays.length > 0;
  const totalRows = 1 + times.length + (showNightLine ? 1 : 0);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const updateCell = (cellId: string, add: boolean) => {
    const newSlots = new Set(selectedSlots);
    if (add) {
      newSlots.add(cellId);
    } else {
      newSlots.delete(cellId);
    }
    onChange(newSlots);
  };

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

  const renderCell = (day: string, time: string) => {
    const cellId = `${day}-${time}`;
    const isScheduled = selectedSlots.has(cellId);
    const isAvailable = availableSlots.has(cellId);

    let bgColor = '#f1f5f9'; 
    if (isScheduled && isAvailable) bgColor = '#3b82f6'; 
    else if (isScheduled && !isAvailable) bgColor = '#fca5a5'; 
    else if (!isScheduled && isAvailable) bgColor = '#bfdbfe'; 

    const currentLoc = slotLocations[cellId] || 'SSC 600';

    return (
      <div
        key={cellId}
        onMouseDown={() => handleMouseDown(cellId)}
        onMouseEnter={() => handleMouseEnter(cellId)}
        title="Click and drag to toggle shift"
        style={{
          height: '28px',
          backgroundColor: bgColor,
          border: '1px solid #cbd5e1',
          borderRadius: '2px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end', // <-- Push dropdown to right
          position: 'relative'
        }}
      >
        {/* We place the select box here on the right, leaving the left side easy to click/drag */}
        {isScheduled && locationsList.length > 0 && onLocationChangeRequest && (
          <select
            value={currentLoc}
            onMouseDown={(e) => e.stopPropagation()} // Prevents dragging when clicking dropdown
            onChange={(e) => onLocationChangeRequest(cellId, e.target.value)}
            style={{
              width: '65%', // <-- Narrower dropdown
              height: '80%',
              marginRight: '2px',
              fontSize: '0.65rem',
              backgroundColor: 'rgba(255,255,255,0.25)',
              color: 'white',
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              borderRadius: '2px',
              textAlign: 'center',
              textOverflow: 'ellipsis'
            }}
          >
            <option value="SSC 600" style={{ color: 'black' }}>SSC 600</option>
            {/* Filter out SSC 600 if it was manually added by user in settings */}
            {locationsList.filter(l => l.name !== 'SSC 600').map(l => (
              <option key={l.id} value={l.name} style={{ color: 'black' }}>{l.name}</option>
            ))}
          </select>
        )}
      </div>
    );
  };

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem', userSelect: 'none' }}>
      
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

      <div 
        style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '4px', minWidth: '600px', position: 'relative' }}
        onMouseLeave={() => setIsDragging(false)} 
      >
        <div></div> 
        
        {weekdays.map(day => (
          <div key={day} style={{ textAlign: 'center', fontWeight: 'bold', padding: '0.5rem 0', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
            {day}
          </div>
        ))}

        {showSeparator && (
          <div style={{
            gridColumn: weekdays.length + 2,
            gridRow: `1 / span ${totalRows}`,
            width: '3px',
            backgroundColor: '#334155',
            justifySelf: 'center',
            alignSelf: 'stretch',
            borderRadius: '2px',
            zIndex: 1
          }} />
        )}

        {weekends.map(day => (
          <div key={day} style={{ textAlign: 'center', fontWeight: 'bold', padding: '0.5rem 0', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>
            {day}
          </div>
        ))}

        {times.map(time => {
          const isNightStart = time === '17:00';

          return (
            <div style={{ display: 'contents' }} key={time}>
    
              {isNightStart && weekdays.length > 0 && (
                <>
                  <div style={{
                    gridColumn: `2 / span ${weekdays.length}`, 
                    height: '3px',
                    backgroundColor: '#334155',
                    marginTop: '0.75rem',
                    marginBottom: '0.75rem', 
                    borderRadius: '2px'
                  }} />
                  {showSeparator && (
                    <div style={{ gridColumn: `${weekdays.length + 3} / -1` }} />
                  )}
                </>
              )}

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

              {weekdays.map(day => renderCell(day, time))}
              {weekends.map(day => renderCell(day, time))}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', marginTop: '1rem' }}>
        * Click and drag to quickly paint or erase shifts for this tutor. Use dropdowns inside blocks to change location.
      </p>
    </div>
  );
}