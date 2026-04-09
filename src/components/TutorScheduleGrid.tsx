import type { Tutor, Shift, DayOfWeek } from '../types';
import { timeToFloat, floatToTime } from '../utils/scheduler';

interface TutorScheduleGridProps {
  tutor: Tutor;
  shifts: Shift[];
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Generate 30-min time slots from 9:00 to 16:30
const TIMES: string[] = [];
for (let i = 9; i < 17; i += 0.5) {
  TIMES.push(floatToTime(i));
}

// Helper to turn TimeSlots or Shifts into a searchable Set of "Day-Time" strings
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

export function TutorScheduleGrid({ tutor, shifts }: TutorScheduleGridProps) {
  // Map both arrays into Sets for instant lookup
  const availableSlots = buildSlotSet(tutor.availability);
  const scheduledSlots = buildSlotSet(shifts);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
      
      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#3b82f6', borderRadius: '4px' }}></div>
          <span>Scheduled Shift</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#bfdbfe', borderRadius: '4px' }}></div>
          <span>Available (Not Scheduled)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px' }}></div>
          <span>Unavailable</span>
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
              const isScheduled = scheduledSlots.has(cellId);
              const isAvailable = availableSlots.has(cellId);

              // Determine cell color
              let bgColor = '#f1f5f9'; // Default Gray
              if (isScheduled) bgColor = '#3b82f6'; // Solid Blue
              else if (isAvailable) bgColor = '#bfdbfe'; // Light Blue

              return (
                <div
                  key={cellId}
                  style={{
                    height: '24px',
                    backgroundColor: bgColor,
                    border: '1px solid #cbd5e1',
                    borderRadius: '2px',
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