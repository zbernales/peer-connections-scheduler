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

  for (const day of DAYS) {
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      
      // 1. Gather EVERY tutor who is legally allowed to work right now
      const eligibleTutors = tutors.filter(tutor => {
        const canWork = isAvailable(tutor, day, hour);
        const notWorking = !isAlreadyWorking(tutor.id, day, hour, schedule);
        const underMaxHours = hoursAssigned[tutor.id] < tutor.maxHours;
        return canWork && notWorking && underMaxHours;
      });

      // 2. If no one is eligible, leave the slot empty and move to the next hour
      if (eligibleTutors.length === 0) continue;

      // 3. Sort the eligible tutors to prioritize those who need hours!
      eligibleTutors.sort((a, b) => {
        const aNeedsMin = hoursAssigned[a.id] < a.minHours;
        const bNeedsMin = hoursAssigned[b.id] < b.minHours;

        // Rule A: Someone who hasn't hit minHours beats someone who has
        if (aNeedsMin && !bNeedsMin) return -1;
        if (!aNeedsMin && bNeedsMin) return 1;

        // Rule B: If both need minHours (or both have hit it), give the shift 
        // to whoever has the fewest hours currently assigned to them.
        return hoursAssigned[a.id] - hoursAssigned[b.id];
      });

      // 4. Pick the winner (the first person in our newly sorted list)
      const winner = eligibleTutors[0];

      const newShift: Shift = {
        id: crypto.randomUUID(),
        tutorId: winner.id,
        subject: winner.subjects[0], // We are still just picking their first subject
        day: day,
        startTime: `${hour}:00`,
        endTime: `${hour + 1}:00`
      };

      schedule.push(newShift);
      hoursAssigned[winner.id] += 1;
    }
  }

  return schedule;
}