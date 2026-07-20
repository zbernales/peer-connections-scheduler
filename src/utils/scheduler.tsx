import type { Tutor, Shift, DayOfWeek, ScheduleConfig } from '../types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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

export function generateSchedule(tutors: Tutor[], config: ScheduleConfig): Shift[] {
  const schedule: Shift[] = [];
  const hoursAssigned: Record<string, number> = {};
  tutors.forEach(t => hoursAssigned[t.id] = 0);

  const maxConsecutiveSlots = config.maxConsecutiveHours * 2;
  const minCooldownSlots = config.minCooldownHours * 2;
  const minShiftSlots = (config.minHoursPerShift || 0.5) * 2; 
  const globalMaxWeekly = config.maxHoursPerWeek || 40; 

  // Determine which days to schedule based on config
  const daysToProcess = DAYS.filter(day => {
    if (day === 'Saturday' || day === 'Sunday') return config.autoScheduleWeekendHours;
    return true;
  });
  
  // Calculate Availability Scarcity per Tutor
  const tutorTotalAvailability: Record<string, number> = {};
  tutors.forEach(tutor => {
    let totalHours = 0;
    tutor.availability.forEach(slot => {
      totalHours += (timeToFloat(slot.endTime) - timeToFloat(slot.startTime));
    });
    tutorTotalAvailability[tutor.id] = totalHours;
  });

  // Calculate the "Hardest Day" pool based on only enabled days
  const dailyAvailabilityScore: Record<string, number> = {};
  daysToProcess.forEach(d => dailyAvailabilityScore[d] = 0);

  tutors.forEach(tutor => {
    tutor.availability.forEach(slot => {
      if (daysToProcess.includes(slot.day)) {
        const duration = timeToFloat(slot.endTime) - timeToFloat(slot.startTime);
        dailyAvailabilityScore[slot.day] += duration;
      }
    });
  });

  const sortedDays = daysToProcess.sort((a, b) => dailyAvailabilityScore[a] - dailyAvailabilityScore[b]);

  for (const day of sortedDays) {
    const consecutiveSlotsToday: Record<string, number> = {};
    const cooldownRemaining: Record<string, number> = {};
    const hoursAssignedToday: Record<string, number> = {};
    
    tutors.forEach(t => {
      consecutiveSlotsToday[t.id] = 0;
      cooldownRemaining[t.id] = 0;
      hoursAssignedToday[t.id] = 0;
    });

    // Determine Dynamic End Hour per day type
    // Weekends (Sat/Sun) always go to 22 (10pm). Weekdays depend on Night Hours setting.
    const isWeekend = day === 'Saturday' || day === 'Sunday';
    const activeEndHour = isWeekend ? 22 : (config.autoScheduleNightHours ? 22 : 17);

    for (let timeSlot = START_HOUR; timeSlot < activeEndHour; timeSlot += 0.5) {
      
      let eligibleTutors = tutors.filter(tutor => {
        const actualMax = Math.min(tutor.maxHours, globalMaxWeekly);

        // Night constraint check for Mon-Fri
        if (!isWeekend && !config.autoScheduleNightHours && timeSlot >= 17) return false;

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

      // Dynamically determine cap: Weekend vs Night vs Day
      const currentCap = isWeekend 
        ? (config.maxTutorsPerWeekendShift || 2)
        : (timeSlot >= 17 ? (config.maxTutorsPerNightShift || 2) : config.tutorsPerHour);

      while (eligibleTutors.length > 0 && tutorsScheduledThisSlot < currentCap) {
        
        eligibleTutors.sort((a, b) => {
          // 1. Keep working if already working (minimize gaps)
          const aIsWorking = consecutiveSlotsToday[a.id] > 0;
          const bIsWorking = consecutiveSlotsToday[b.id] > 0;
          if (aIsWorking && !bIsWorking) return -1;
          if (!aIsWorking && bIsWorking) return 1;

          // 2. Minimum Hours Target
          const aNeedsMin = hoursAssigned[a.id] < a.minHours;
          const bNeedsMin = hoursAssigned[b.id] < b.minHours;
          if (aNeedsMin && !bNeedsMin) return -1;
          if (!aNeedsMin && bNeedsMin) return 1;

          // 3. Availability Scarcity
          if (aNeedsMin && bNeedsMin) {
            const aAvailable = tutorTotalAvailability[a.id];
            const bAvailable = tutorTotalAvailability[b.id];
            if (aAvailable !== bAvailable) return aAvailable - bAvailable;
          }

          // ---> NEW: 4. PRIORITY SUBJECTS <---
          // Check how many priority subjects this tutor can teach that ARE NOT YET COVERED in this time slot
          if (config.prioritySubjects && config.prioritySubjects.length > 0) {
            const aPriorityCount = a.subjects.filter(sub => 
              config.prioritySubjects!.includes(sub) && !coveredSubjectsThisSlot.has(sub)
            ).length;
            
            const bPriorityCount = b.subjects.filter(sub => 
              config.prioritySubjects!.includes(sub) && !coveredSubjectsThisSlot.has(sub)
            ).length;

            if (aPriorityCount !== bPriorityCount) {
              return bPriorityCount - aPriorityCount; // Higher priority count wins
            }
          }

          // 5. Broad Subject Coverage (If neither has a priority subject, who brings the most unique normal subjects?)
          const aNewSubjects = a.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          const bNewSubjects = b.subjects.filter(sub => !coveredSubjectsThisSlot.has(sub)).length;
          if (aNewSubjects !== bNewSubjects) return bNewSubjects - aNewSubjects;

          // 6. Percent Full (Load Balancing)
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