import type { Tutor, Shift, DayOfWeek } from '../types';

// The operating hours for Peer Connections
const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_HOUR = 9; // 9 AM
const END_HOUR = 17;  // 5 PM

// Checks if a tutor's availability includes a specific day and hour
function isAvailable(tutor: Tutor, day: DayOfWeek, hour: number): boolean {
  return tutor.availability.some(slot => {
    if (slot.day !== day) return false;
    
    // Convert "09:00" to the number 9 for easy comparison
    const start = parseInt(slot.startTime.split(':')[0], 10);
    const end = parseInt(slot.endTime.split(':')[0], 10);
    
    return hour >= start && hour < end;
  });
}

// Checks if a tutor is already scheduled at this exact time
function isAlreadyWorking(tutorId: string, day: DayOfWeek, hour: number, currentSchedule: Shift[]): boolean {
  return currentSchedule.some(shift => {
    const shiftStart = parseInt(shift.startTime.split(':')[0], 10);
    return shift.tutorId === tutorId && shift.day === day && shiftStart === hour;
  });
}

export function generateSchedule(tutors: Tutor[]): Shift[] {
  const schedule: Shift[] = [];
  const hoursAssigned: Record<string, number> = {};
  tutors.forEach(t => hoursAssigned[t.id] = 0);

  // 1. Loop through every day of the week
  for (const day of DAYS) {
    
    // 2. Loop through every hour of operation (e.g., 9 to 16 for 9am-5pm)
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      
      // 3. Look for a tutor who can fill this slot
      for (const tutor of tutors) {
        
        const canWork = isAvailable(tutor, day, hour);
        const notWorking = !isAlreadyWorking(tutor.id, day, hour, schedule);
        const underMaxHours = hoursAssigned[tutor.id] < tutor.maxHours;

        // If they meet all criteria, assign them the shift!
        if (canWork && notWorking && underMaxHours) {
          
          const newShift: Shift = {
            id: crypto.randomUUID(), // Generates a unique ID
            tutorId: tutor.id,
            subject: tutor.subjects[0], // For now, just assign their first subject
            day: day,
            startTime: `${hour}:00`,
            endTime: `${hour + 1}:00` // 1 hour shifts for simplicity
          };

          schedule.push(newShift);
          hoursAssigned[tutor.id] += 1;
          
          // Stop looking for tutors for this exact slot, move to the next hour
          // (Remove this break if you want multiple tutors working at the same time)
          break; 
        }
      }
    }
  }

  return schedule;
}