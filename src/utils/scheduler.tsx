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

// Add this constant near the top of your scheduler.ts file
const IDEAL_TUTORS_PER_HOUR = 3; // Adjust this dial based on your budget/demand!

export function generateSchedule(tutors: Tutor[]): Shift[] {
  const schedule: Shift[] = [];
  const hoursAssigned: Record<string, number> = {};
  tutors.forEach(t => hoursAssigned[t.id] = 0);

  for (const day of DAYS) {
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      
      // 1. Gather everyone legally allowed to work this hour
      let eligibleTutors = tutors.filter(tutor => {
        const canWork = isAvailable(tutor, day, hour);
        const notWorking = !isAlreadyWorking(tutor.id, day, hour, schedule);
        const underMaxHours = hoursAssigned[tutor.id] < tutor.maxHours;
        return canWork && notWorking && underMaxHours;
      });

      // 2. Track what subjects are currently being covered THIS hour
      const coveredSubjectsThisHour = new Set<string>();
      let tutorsScheduledThisHour = 0;

      // 3. Keep assigning shifts until we hit our ideal limit OR run out of people
      while (eligibleTutors.length > 0 && tutorsScheduledThisHour < IDEAL_TUTORS_PER_HOUR) {
        
        // --- THE MAGIC SORT ---
        eligibleTutors.sort((a, b) => {
          // Calculate how many *currently uncovered* subjects each tutor brings
          const aNewSubjects = a.subjects.filter(sub => !coveredSubjectsThisHour.has(sub)).length;
          const bNewSubjects = b.subjects.filter(sub => !coveredSubjectsThisHour.has(sub)).length;

          // Rule 1: Whoever brings the most new subjects to the floor wins
          if (aNewSubjects !== bNewSubjects) {
            return bNewSubjects - aNewSubjects; // Sort descending
          }

          // Rule 2: If they bring the same amount of new subjects, who needs minHours?
          const aNeedsMin = hoursAssigned[a.id] < a.minHours;
          const bNeedsMin = hoursAssigned[b.id] < b.minHours;
          if (aNeedsMin && !bNeedsMin) return -1;
          if (!aNeedsMin && bNeedsMin) return 1;

          // Rule 3: Tie-breaker - who has worked the least overall this week?
          return hoursAssigned[a.id] - hoursAssigned[b.id];
        });

        // 4. Pick the winner!
        const winner = eligibleTutors[0];

        const newShift: Shift = {
          id: crypto.randomUUID(),
          tutorId: winner.id,
          subjects: winner.subjects, 
          day: day,
          startTime: `${hour}:00`,
          endTime: `${hour + 1}:00`
        };

        // 5. Bookkeeping: Update all our trackers
        schedule.push(newShift);
        hoursAssigned[winner.id] += 1;
        winner.subjects.forEach(sub => coveredSubjectsThisHour.add(sub));
        tutorsScheduledThisHour++;

        // 6. Remove the winner from the eligible pool so they don't get scheduled twice in the same hour
        eligibleTutors = eligibleTutors.filter(t => t.id !== winner.id);
      }
    }
  }

  return schedule;
}