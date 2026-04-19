import type { Tutor, Shift, DayOfWeek, ScheduleConfig } from '../types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const START_HOUR = 9;  // 9.0 = 9:00 AM

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
  
  const globalMaxWeekly = config.maxHoursPerWeek || 40; 
  
  // NEW: Calculate the dynamic end hour for the algorithm
  const activeEndHour = config.autoScheduleNightHours ? 22 : 17; // 10:00 PM or 5:00 PM
  
  // Calculate Availability Scarcity per Tutor
  const tutorTotalAvailability: Record<string, number> = {};
  tutors.forEach(tutor => {
    let totalHours = 0;
    tutor.availability.forEach(slot => {
      totalHours += (timeToFloat(slot.endTime) - timeToFloat(slot.startTime));
    });
    tutorTotalAvailability[tutor.id] = totalHours;
  });

  // Calculate the "Hardest Day" (Total availability pool per day)
  const dailyAvailabilityScore: Record<string, number> = {
    Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0
  };

  tutors.forEach(tutor => {
    tutor.availability.forEach(slot => {
      const duration = timeToFloat(slot.endTime) - timeToFloat(slot.startTime);
      dailyAvailabilityScore[slot.day] += duration;
    });
  });

  // Sort the days from least available (hardest) to most available (easiest)
  const sortedDays = [...DAYS].sort((a, b) => dailyAvailabilityScore[a] - dailyAvailabilityScore[b]);

  for (const day of sortedDays) {
    const consecutiveSlotsToday: Record<string, number> = {};
    const cooldownRemaining: Record<string, number> = {};
    const hoursAssignedToday: Record<string, number> = {};
    
    tutors.forEach(t => {
      consecutiveSlotsToday[t.id] = 0;
      cooldownRemaining[t.id] = 0;
      hoursAssignedToday[t.id] = 0;
    });

    // UPDATED: Loop now terminates at the dynamic activeEndHour
    for (let timeSlot = START_HOUR; timeSlot < activeEndHour; timeSlot += 0.5) {
      
      let eligibleTutors = tutors.filter(tutor => {
        const actualMax = Math.min(tutor.maxHours, globalMaxWeekly);

        const canWork = isAvailable(tutor, day, timeSlot);
        const notWorking = !isAlreadyWorking(tutor.id, day, timeSlot, schedule);
        const underWeeklyMax = hoursAssigned[tutor.id] < actualMax;
        const underDailyMax = hoursAssignedToday[tutor.id] < config.maxHoursPerDay;
        const notOnCooldown = cooldownRemaining[tutor.id] === 0;

        if (!canWork || !notWorking || !underWeeklyMax || !underDailyMax || !notOnCooldown) {
          return false;
        }

        const isStartingNewShift = consecutiveSlotsToday[tutor.id] === 0;

        if (isStartingNewShift && minShiftSlots > 1) {
          const remainingDaily = config.maxHoursPerDay - hoursAssignedToday[tutor.id];
          const remainingWeekly = actualMax - hoursAssigned[tutor.id]; 
          if (remainingDaily < (minShiftSlots * 0.5) || remainingWeekly < (minShiftSlots * 0.5)) {
            return false; 
          }

          for (let i = 1; i < minShiftSlots; i++) { 
            const futureSlot = timeSlot + (i * 0.5);
            // UPDATED: Lookahead constraint now respects the dynamic end hour
            if (futureSlot >= activeEndHour || !isAvailable(tutor, day, futureSlot)) {
              return false;
            }
          }
        }
        return true;
      });

      const coveredSubjectsThisSlot = new Set<string>();
      let tutorsScheduledThisSlot = 0;
      const scheduledThisBlock = new Set<string>();

      // NEW: Dynamically determine the maximum tutors allowed for this specific time block
      const currentCap = timeSlot >= 17 
        ? (config.maxTutorsPerNightShift || 2) // If it's 5PM or later, use the night cap
        : config.tutorsPerHour;                // Otherwise use the standard daytime cap

      while (eligibleTutors.length > 0 && tutorsScheduledThisSlot < currentCap) {
        
        eligibleTutors.sort((a, b) => {
          // PRIORITY 1: SHIFT MOMENTUM
          const aIsWorking = consecutiveSlotsToday[a.id] > 0;
          const bIsWorking = consecutiveSlotsToday[b.id] > 0;
          if (aIsWorking && !bIsWorking) return -1;
          if (!aIsWorking && bIsWorking) return 1;

          // PRIORITY 2: MINIMUM HOURS
          const aNeedsMin = hoursAssigned[a.id] < a.minHours;
          const bNeedsMin = hoursAssigned[b.id] < b.minHours;
          if (aNeedsMin && !bNeedsMin) return -1;
          if (!aNeedsMin && bNeedsMin) return 1;

          // PRIORITY 3: SCARCITY TIE-BREAKER
          if (aNeedsMin && bNeedsMin) {
            const aAvailable = tutorTotalAvailability[a.id];
            const bAvailable = tutorTotalAvailability[b.id];
            if (aAvailable !== bAvailable) {
              return aAvailable - bAvailable;
            }
          }

          // PRIORITY 4: MAXIMIZE SUBJECT COVERAGE
          const aNewSubjects = a.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          const bNewSubjects = b.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          if (aNewSubjects !== bNewSubjects) {
            return bNewSubjects - aNewSubjects;
          }

          // PRIORITY 5: PERCENTAGE-BASED LOAD BALANCING
          const aActualMax = Math.min(a.maxHours, globalMaxWeekly);
          const bActualMax = Math.min(b.maxHours, globalMaxWeekly);
          const aPercentFull = hoursAssigned[a.id] / aActualMax;
          const bPercentFull = hoursAssigned[b.id] / bActualMax;
          
          return aPercentFull - bPercentFull;
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