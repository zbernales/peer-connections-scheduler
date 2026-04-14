import type { Tutor, Shift, DayOfWeek, ScheduleConfig } from '../types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_HOUR = 9;  // 9.0 = 9:00 AM
const END_HOUR = 19;   // 19.0 = 7:00 PM

export function timeToFloat(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes / 60);
}

export function floatToTime(timeFloat: number): string {
  const hours = Math.floor(timeFloat);
  const minutes = Math.round((timeFloat - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes === 0 ? '00' : minutes}`;
}

export function format12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hr12 = h % 12 || 12;
  const minStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
  return `${hr12}${minStr}${ampm}`;
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
export function generateSchedule(tutors: Tutor[], config: ScheduleConfig): Shift[] {
  const schedule: Shift[] = [];
  const hoursAssigned: Record<string, number> = {};
  tutors.forEach(t => hoursAssigned[t.id] = 0);

  const maxConsecutiveSlots = config.maxConsecutiveHours * 2;
  const minCooldownSlots = config.minCooldownHours * 2;
  const minShiftSlots = (config.minHoursPerShift || 0.5) * 2; 

  // ============================================================================
  // --- PRE-COMPUTATION ENGINE ---
  // ============================================================================
  
  // Calculate Availability Scarcity
  // (Finds out exactly how many total hours a tutor is available to work this week)
  const tutorTotalAvailability: Record<string, number> = {};
  tutors.forEach(tutor => {
    let totalHours = 0;
    tutor.availability.forEach(slot => {
      totalHours += (timeToFloat(slot.endTime) - timeToFloat(slot.startTime));
    });
    tutorTotalAvailability[tutor.id] = totalHours;
  });
  // ============================================================================


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

        if (!canWork || !notWorking || !underWeeklyMax || !underDailyMax || !notOnCooldown) {
          return false;
        }

        const isStartingNewShift = consecutiveSlotsToday[tutor.id] === 0;

        if (isStartingNewShift && minShiftSlots > 1) {
          const remainingDaily = config.maxHoursPerDay - hoursAssignedToday[tutor.id];
          const remainingWeekly = tutor.maxHours - hoursAssigned[tutor.id];
          if (remainingDaily < (minShiftSlots * 0.5) || remainingWeekly < (minShiftSlots * 0.5)) {
            return false; 
          }

          for (let i = 1; i < minShiftSlots; i++) { 
            const futureSlot = timeSlot + (i * 0.5);
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
        
        // ============================================================================
        // --- THE SORTING ENGINE ---
        // ============================================================================
        eligibleTutors.sort((a, b) => {
          
          // PRIORITY 1: SHIFT MOMENTUM (Keep people working if they started)
          const aIsWorking = consecutiveSlotsToday[a.id] > 0;
          const bIsWorking = consecutiveSlotsToday[b.id] > 0;
          if (aIsWorking && !bIsWorking) return -1;
          if (!aIsWorking && bIsWorking) return 1;

          // PRIORITY 2: MINIMUM HOURS (Prioritize people under their minimums)
          const aNeedsMin = hoursAssigned[a.id] < a.minHours;
          const bNeedsMin = hoursAssigned[b.id] < b.minHours;
          if (aNeedsMin && !bNeedsMin) return -1;
          if (!aNeedsMin && bNeedsMin) return 1;

          // PRIORITY 3: SCARCITY TIE-BREAKER
          // If they BOTH need minimum hours, prioritize the tutor who has less availability
          if (aNeedsMin && bNeedsMin) {
            const aAvailable = tutorTotalAvailability[a.id];
            const bAvailable = tutorTotalAvailability[b.id];
            if (aAvailable !== bAvailable) {
              return aAvailable - bAvailable; // Smaller availability moves to the front
            }
          }

          // PRIORITY 4: MAXIMIZE SUBJECT COVERAGE (The Old Way - Quantity over Rarity)
          const aNewSubjects = a.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          const bNewSubjects = b.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          if (aNewSubjects !== bNewSubjects) {
            return bNewSubjects - aNewSubjects; // Higher quantity of new subjects moves to the front
          }

          // PRIORITY 5: LOAD BALANCING (If all else is equal, give it to whoever has fewer hours)
          return hoursAssigned[a.id] - hoursAssigned[b.id];
        });
        // ============================================================================

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