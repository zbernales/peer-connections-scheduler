export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface TimeSlot {
  day: DayOfWeek;
  startTime: string; // e.g., "09:00" 
  endTime: string;   // e.g., "11:00"
}

export interface Tutor {
  id: string;
  name: string;
  subjects: string[];       
  minHours: number;
  maxHours: number;
  availability: TimeSlot[]; 
}

export interface Shift {
  id: string;
  tutorId: string;
  subjects: string[];
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface ScheduleConfig {
  tutorsPerHour: number;
  maxConsecutiveHours: number;
  minCooldownHours: number;
  maxHoursPerDay: number;
  minHoursPerShift: number;
  maxHoursPerWeek?: number;
  autoScheduleNightHours?: boolean;
  maxTutorsPerNightShift?: number;
}