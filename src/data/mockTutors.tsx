import type { Tutor } from '../types';

export const mockTutors: Tutor[] = [
  {
    id: '1',
    name: 'Alice',
    subjects: ['CS146', 'MATH32'],
    minHours: 5,
    maxHours: 10,
    availability: [
      { day: 'Monday', startTime: '10:00', endTime: '14:30' },
      { day: 'Wednesday', startTime: '10:00', endTime: '14:00' }
    ]
  },
  {
    id: '2',
    name: 'Bob',
    subjects: ['CS146', 'CS151'],
    minHours: 2,
    maxHours: 6,
    availability: [
      { day: 'Tuesday', startTime: '09:30', endTime: '15:00' },
      { day: 'Thursday', startTime: '09:00', endTime: '15:00' }
    ]
  },
  {
    id: '3',
    name: 'Charlie',
    subjects: ['PHYS50', 'CHEM1A'], // Brings entirely unique subjects
    minHours: 4,
    maxHours: 8,
    availability: [
      { day: 'Monday', startTime: '09:00', endTime: '12:30' },
      { day: 'Wednesday', startTime: '09:00', endTime: '12:00' },
      { day: 'Friday', startTime: '09:00', endTime: '12:30' }
    ]
  },
  {
    id: '4',
    name: 'Diana',
    subjects: ['MATH32', 'MATH31', 'MATH30'], // Heavy math overlap
    minHours: 10,
    maxHours: 20, // Needs a lot of hours
    availability: [
      { day: 'Monday', startTime: '13:30', endTime: '17:00' },
      { day: 'Tuesday', startTime: '13:00', endTime: '17:00' },
      { day: 'Wednesday', startTime: '13:00', endTime: '17:00' },
      { day: 'Thursday', startTime: '13:00', endTime: '17:00' },
      { day: 'Friday', startTime: '13:00', endTime: '17:00' }
    ]
  },
  {
    id: '5',
    name: 'Ethan',
    subjects: ['ENGL1A', 'HIST15'], // Humanities representation
    minHours: 4,
    maxHours: 10,
    availability: [
      { day: 'Tuesday', startTime: '10:00', endTime: '16:00' },
      { day: 'Thursday', startTime: '10:00', endTime: '16:00' }
    ]
  },
  {
    id: '6',
    name: 'Fiona',
    subjects: ['CS146', 'CS151', 'MATH32', 'PHYS50'], // The "Super Tutor" (high overlap)
    minHours: 12,
    maxHours: 25,
    availability: [
      { day: 'Monday', startTime: '09:00', endTime: '17:00' },
      { day: 'Tuesday', startTime: '09:00', endTime: '17:00' },
      { day: 'Wednesday', startTime: '09:00', endTime: '17:00' }
    ]
  },
  {
    id: '7',
    name: 'George',
    subjects: ['BIOL10'], // Highly constrained
    minHours: 4,
    maxHours: 8,
    availability: [
      { day: 'Friday', startTime: '09:00', endTime: '17:00' } // Only works Fridays
    ]
  }
];