import type { Tutor, Shift, DayOfWeek, ScheduleConfig } from '../types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_HOUR = 9;  // 9.0 = 9:00 AM
const END_HOUR = 17;   // 17.0 = 5:00 PM

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
// Converts "13:30" to "1:30pm" and "09:00" to "9am"
export function format12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hr12 = h % 12 || 12;
  const minStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
  return `${hr12}${minStr}${ampm}`;
}

// --- THE SCHEDULER ---
export function generateSchedule(tutors: Tutor[], config: ScheduleConfig): Shift[] {
  const schedule: Shift[] = [];
  const hoursAssigned: Record<string, number> = {};
  tutors.forEach(t => hoursAssigned[t.id] = 0);

  const maxConsecutiveSlots = config.maxConsecutiveHours * 2;
  const minCooldownSlots = config.minCooldownHours * 2;
  // Fallback to 0.5 hours (1 slot) if the config hasn't been updated yet
  const minShiftSlots = (config.minHoursPerShift || 0.5) * 2; 

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
        const underDailyMax = hoursAssignedToday[tutor.id] < config.maxHoursPerDay;
        const notOnCooldown = cooldownRemaining[tutor.id] === 0;

        // If they fail any basic check, they are out
        if (!canWork || !notWorking || !underWeeklyMax || !underDailyMax || !notOnCooldown) {
          return false;
        }

        // --- NEW: MINIMUM SHIFT LENGTH LOOKAHEAD ---
        // We only need to check the lookahead if they are about to START a brand new shift
        const isStartingNewShift = consecutiveSlotsToday[tutor.id] === 0;

        if (isStartingNewShift && minShiftSlots > 1) {
          // 1. Do they have enough daily/weekly hours left to finish a minimum block?
          const remainingDaily = config.maxHoursPerDay - hoursAssignedToday[tutor.id];
          const remainingWeekly = tutor.maxHours - hoursAssigned[tutor.id];
          if (remainingDaily < (minShiftSlots * 0.5) || remainingWeekly < (minShiftSlots * 0.5)) {
            return false; // They don't have enough hours left to work the minimum shift
          }

          // 2. Are they actually available for the entire minimum block?
          // Start at i=1 because we already validated the current slot (i=0) above
          for (let i = 1; i < minShiftSlots; i++) { 
            const futureSlot = timeSlot + (i * 0.5);
            // If the shift pushes past closing time, or they aren't available, they can't start!
            if (futureSlot >= END_HOUR || !isAvailable(tutor, day, futureSlot)) {
              return false;
            }
          }
        }

        return true;
      });

      const coveredSubjectsThisSlot = new Set<string>();
      let tutorsScheduledThisSlot = 0;
      const scheduledThisBlock = new Set<string>();

      while (eligibleTutors.length > 0 && tutorsScheduledThisSlot < config.tutorsPerHour) {
        eligibleTutors.sort((a, b) => {
          // 1. SHIFT MOMENTUM
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
          consecutiveSlotsToday[tutor.id] += 1;
          
          if (consecutiveSlotsToday[tutor.id] >= maxConsecutiveSlots) {
            cooldownRemaining[tutor.id] = minCooldownSlots; 
            consecutiveSlotsToday[tutor.id] = 0; 
          }
        } else {
          if (cooldownRemaining[tutor.id] > 0) {
            cooldownRemaining[tutor.id] -= 1;
          } else if (consecutiveSlotsToday[tutor.id] > 0) {
            cooldownRemaining[tutor.id] = minCooldownSlots - 1; 
            consecutiveSlotsToday[tutor.id] = 0;
          }
        }
      });
    }
  }

  

  return schedule;
}