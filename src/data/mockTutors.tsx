import type { Tutor } from '../types';

export const mockTutors: Tutor[] = [
  {
    id: '1',
    name: 'Alice',
    subjects: ['CS146', 'MATH32'],
    minHours: 5,
    maxHours: 10,
    availability: [
      { day: 'Monday', startTime: '10:00', endTime: '14:00' },
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
      { day: 'Tuesday', startTime: '09:00', endTime: '15:00' },
      { day: 'Thursday', startTime: '09:00', endTime: '15:00' }
    ]
  }
];