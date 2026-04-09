import type { Tutor, Shift, DayOfWeek } from '../types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_HOUR = 9;  // 9.0 = 9:00 AM
const END_HOUR = 17;   // 17.0 = 5:00 PM
const IDEAL_TUTORS_PER_HOUR = 5; 

// --- NEW CONFIGURATION VARIABLE ---
export const MAX_CONSECUTIVE_HOURS = 3; 
const MAX_CONSECUTIVE_SLOTS = MAX_CONSECUTIVE_HOURS * 2;

// --- TIME HELPERS ---
export function timeToFloat(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes / 60);
}

export function floatToTime(timeFloat: number): string {
  const hours = Math.floor(timeFloat);
  const minutes = (timeFloat - hours) * 60;
  return `${hours.toString().padStart(2, '0')}:${minutes === 0 ? '00' : minutes}`;
}

// --- CONSTRAINT HELPERS ---
function isAvailable(tutor: Tutor, day: DayOfWeek, timeSlot: number): boolean {
  return tutor.availability.some(slot => {
    if (slot.day !== day) return false;
    const start = timeToFloat(slot.startTime);
    const end = timeToFloat(slot.endTime);
    return timeSlot >= start && (timeSlot + 0.5) <= end;
  });
}

function isAlreadyWorking(tutorId: string, day: DayOfWeek, timeSlot: number, currentSchedule: Shift[]): boolean {
  return currentSchedule.some(shift => {
    return shift.tutorId === tutorId && 
           shift.day === day && 
           timeToFloat(shift.startTime) === timeSlot;
  });
}

// --- THE SCHEDULER ---
export function generateSchedule(tutors: Tutor[]): Shift[] {
  const schedule: Shift[] = [];
  const hoursAssigned: Record<string, number> = {};
  
  // Initialize hours tracker
  tutors.forEach(t => hoursAssigned[t.id] = 0);

  for (const day of DAYS) {
    // Reset fatigue trackers at the start of every day
    const consecutiveSlotsToday: Record<string, number> = {};
    tutors.forEach(t => consecutiveSlotsToday[t.id] = 0);

    for (let timeSlot = START_HOUR; timeSlot < END_HOUR; timeSlot += 0.5) {
      
      let eligibleTutors = tutors.filter(tutor => {
        const canWork = isAvailable(tutor, day, timeSlot);
        const notWorking = !isAlreadyWorking(tutor.id, day, timeSlot, schedule);
        const underMaxHours = hoursAssigned[tutor.id] < tutor.maxHours;
        
        // NEW FATIGUE CHECK: Are they under the consecutive limit?
        const notFatigued = consecutiveSlotsToday[tutor.id] < MAX_CONSECUTIVE_SLOTS;

        return canWork && notWorking && underMaxHours && notFatigued;
      });

      const coveredSubjectsThisSlot = new Set<string>();
      let tutorsScheduledThisSlot = 0;
      
      // Keep track of who wins a shift in this specific 30-min block
      const scheduledThisBlock = new Set<string>();

      while (eligibleTutors.length > 0 && tutorsScheduledThisSlot < IDEAL_TUTORS_PER_HOUR) {
        eligibleTutors.sort((a, b) => {
          const aNewSubjects = a.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          const bNewSubjects = b.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;

          if (aNewSubjects !== bNewSubjects) return bNewSubjects - aNewSubjects;

          const aNeedsMin = hoursAssigned[a.id] < a.minHours;
          const bNeedsMin = hoursAssigned[b.id] < b.minHours;
          if (aNeedsMin && !bNeedsMin) return -1;
          if (!aNeedsMin && bNeedsMin) return 1;

          return hoursAssigned[a.id] - hoursAssigned[b.id];
        });

        const winner = eligibleTutors[0];

        const newShift: Shift = {
          id: crypto.randomUUID(),
          tutorId: winner.id,
          subjects: winner.subjects,
          day: day,
          startTime: floatToTime(timeSlot),
          endTime: floatToTime(timeSlot + 0.5) 
        };

        schedule.push(newShift);
        hoursAssigned[winner.id] += 0.5;
        winner.subjects.forEach(sub => coveredSubjectsThisSlot.add(sub));
        tutorsScheduledThisSlot++;
        scheduledThisBlock.add(winner.id);

        eligibleTutors = eligibleTutors.filter(t => t.id !== winner.id);
      }

      // AFTER THE BLOCK IS SCHEDULED: Update fatigue for EVERY tutor
      tutors.forEach(tutor => {
        if (scheduledThisBlock.has(tutor.id)) {
          // If they worked, increase their streak
          consecutiveSlotsToday[tutor.id] += 1;
        } else {
          // If they didn't work (for any reason), their streak resets to zero!
          consecutiveSlotsToday[tutor.id] = 0;
        }
      });
    }
  }

  return schedule;
}