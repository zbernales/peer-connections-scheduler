import type { Tutor, Shift, DayOfWeek } from '../types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_HOUR = 9;  // 9.0 = 9:00 AM
const END_HOUR = 17;   // 17.0 = 5:00 PM
const IDEAL_TUTORS_PER_HOUR = 5; 

export const MAX_CONSECUTIVE_HOURS = 3; 
const MAX_CONSECUTIVE_SLOTS = MAX_CONSECUTIVE_HOURS * 2;

export const MIN_COOLDOWN_HOURS = 1.5;
const MIN_COOLDOWN_SLOTS = MIN_COOLDOWN_HOURS * 2;

export const MAX_HOURS_PER_DAY = 5;

// --- TIME HELPERS ---
export function timeToFloat(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes / 60);
}

export function floatToTime(timeFloat: number): string {
  const hours = Math.floor(timeFloat);
  const minutes = Math.round((timeFloat - hours) * 60);
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
  tutors.forEach(t => hoursAssigned[t.id] = 0);

  for (const day of DAYS) {
    const consecutiveSlotsToday: Record<string, number> = {};
    const cooldownRemaining: Record<string, number> = {};
    const hoursAssignedToday: Record<string, number> = {};
    
    tutors.forEach(t => {
      consecutiveSlotsToday[t.id] = 0;
      cooldownRemaining[t.id] = 0;
      hoursAssignedToday[t.id] = 0;
    });

    for (let timeSlot = START_HOUR; timeSlot < END_HOUR; timeSlot += 0.5) {
      
      let eligibleTutors = tutors.filter(tutor => {
        const canWork = isAvailable(tutor, day, timeSlot);
        const notWorking = !isAlreadyWorking(tutor.id, day, timeSlot, schedule);
        const underWeeklyMax = hoursAssigned[tutor.id] < tutor.maxHours;
        const underDailyMax = hoursAssignedToday[tutor.id] < MAX_HOURS_PER_DAY;
        const notOnCooldown = cooldownRemaining[tutor.id] === 0;

        return canWork && notWorking && underWeeklyMax && underDailyMax && notOnCooldown;
      });

      const coveredSubjectsThisSlot = new Set<string>();
      let tutorsScheduledThisSlot = 0;
      const scheduledThisBlock = new Set<string>();

      while (eligibleTutors.length > 0 && tutorsScheduledThisSlot < IDEAL_TUTORS_PER_HOUR) {
        eligibleTutors.sort((a, b) => {
          
          // 1. SHIFT MOMENTUM: If you are already working, you get priority to KEEP working
          // This prevents the algorithm from randomly swapping tutors and creating 30-min holes.
          const aIsWorking = consecutiveSlotsToday[a.id] > 0;
          const bIsWorking = consecutiveSlotsToday[b.id] > 0;
          if (aIsWorking && !bIsWorking) return -1;
          if (!aIsWorking && bIsWorking) return 1;

          // 2. Maximize Subject Coverage
          const aNewSubjects = a.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          const bNewSubjects = b.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          if (aNewSubjects !== bNewSubjects) return bNewSubjects - aNewSubjects;

          // 3. Prioritize those who need minimum hours
          const aNeedsMin = hoursAssigned[a.id] < a.minHours;
          const bNeedsMin = hoursAssigned[b.id] < b.minHours;
          if (aNeedsMin && !bNeedsMin) return -1;
          if (!aNeedsMin && bNeedsMin) return 1;

          // 4. Balance total hours assigned
          return hoursAssigned[a.id] - hoursAssigned[b.id];
        });

        const winner = eligibleTutors[0];

        schedule.push({
          id: crypto.randomUUID(),
          tutorId: winner.id,
          subjects: winner.subjects,
          day: day,
          startTime: floatToTime(timeSlot),
          endTime: floatToTime(timeSlot + 0.5) 
        });

        hoursAssigned[winner.id] += 0.5;
        hoursAssignedToday[winner.id] += 0.5; 
        winner.subjects.forEach(sub => coveredSubjectsThisSlot.add(sub));
        tutorsScheduledThisSlot++;
        scheduledThisBlock.add(winner.id);

        eligibleTutors = eligibleTutors.filter(t => t.id !== winner.id);
      }

      // AFTER THE BLOCK IS SCHEDULED: Update fatigue and cooldowns
      tutors.forEach(tutor => {
        if (scheduledThisBlock.has(tutor.id)) {
          // They worked this slot
          consecutiveSlotsToday[tutor.id] += 1;
          
          // Did they just hit the 3-hour fatigue limit?
          if (consecutiveSlotsToday[tutor.id] >= MAX_CONSECUTIVE_SLOTS) {
            cooldownRemaining[tutor.id] = MIN_COOLDOWN_SLOTS; 
            consecutiveSlotsToday[tutor.id] = 0; 
          }
        } else {
          // They didn't work this slot. 
          if (cooldownRemaining[tutor.id] > 0) {
            // If they are already in timeout, tick down the timer
            cooldownRemaining[tutor.id] -= 1;
          } else if (consecutiveSlotsToday[tutor.id] > 0) {
            // *** THE STRICT GAP FIX ***
            // They were working previously, but didn't get this slot.
            // Force them into a full cooldown so they don't get a 30-minute gap!
            // We subtract 1 because they are already sitting out this current slot.
            cooldownRemaining[tutor.id] = MIN_COOLDOWN_SLOTS - 1; 
            consecutiveSlotsToday[tutor.id] = 0;
          }
        }
      });
    }
  }

  return schedule;
}