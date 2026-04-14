import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { floatToTime } from './scheduler';
import type { Tutor, DayOfWeek, TimeSlot } from '../types';

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Sam', 'Avery', 'Jamie', 'Quinn', 'Mia', 'Ethan', 'Isabella', 'Liam', 'Sophia', 'Noah', 'Ava', 'Lucas', 'Charlotte', 'Oliver', 'Mark', 'Debbie', 'George', 'Fiona', 'Hannah', 'Alice', 'Jonathan', 'Ron', 'Jada', 'Dwayne', 'Tyler'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Lee', 'Nguyen','Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Park', 'Murray', 'Michaels', "White"];

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const MOCK_COURSES = [
  'MATH 19', 'MATH 30', 'MATH 31', 'MATH 32', 'MATH 42', 'STAT 95',
  'PHYS 50', 'PHYS 51', 'PHYS 52',
  'CHEM 1A', 'CHEM 1B', 'CHEM 8',
  'BIOL 30', 'BIOL 31',
  'CS 22A', 'CS 46A', 'CS 46B',
  'ENGL 1A', 'ENGL 1B', 'COMM 20',
  'CS 146', 'CS 151', 'CMPE 130', 'CMPE 148',
  'EE 98', 'ME 101', 'ME 111', 'CE 95', 'ISE 130',
  'BUS1 20', 'BUS1 21', 'BUS2 90', 'BUS3 80',
  'PSYC 1', 'PSYC 30', 'SOCI 1', 'POLS 15',
  'AE 160', 'AE 165', 'MATE 25', 'CHEM 112A', 
  'ANTH 140', 'NUFS 1A', 'CHAD 60', 'KIN 158',
  'LING 21', 'JPN 1A', 'FREN 1A', 'ISDA 140'
];

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItems<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateRandomAvailability(): TimeSlot[] {
  const availability: TimeSlot[] = [];
  
  // 1. Pick 3 to 5 random days to ensure wide weekly coverage
  const workingDays = getRandomItems(DAYS, getRandomInt(3, 5));

  workingDays.forEach(day => {
    const startFloat1 = getRandomInt(18, 24) * 0.5; 
    // Shift is 2 to 5 hours long
    const duration1 = getRandomInt(4, 10) * 0.5; 
    let endFloat1 = startFloat1 + duration1;

    if (endFloat1 > 17) endFloat1 = 17; 

    for (let t = startFloat1; t < endFloat1; t += 0.5) {
      availability.push({
        day,
        startTime: floatToTime(t),
        endTime: floatToTime(t + 0.5)
      });
    }

    // --- SHIFT 2: Afternoon / Evening (SPLIT SHIFT) ---
    // 40% chance to have a second shift, ONLY IF their first shift ended before 5:00 PM
    if (Math.random() > 0.6 && endFloat1 < 17) {
      // Add a realistic 1 to 2.5 hour gap for a college class
      const gap = getRandomInt(2, 5) * 0.5; 
      const startFloat2 = endFloat1 + gap;
      
      // Second shift is 2 to 4 hours long
      const duration2 = getRandomInt(4, 8) * 0.5; 
      let endFloat2 = startFloat2 + duration2;

      // Cap at 7:00 PM
      if (endFloat2 > 17) endFloat2 = 17;

      // Push the second block of Lego bricks
      for (let t = startFloat2; t < endFloat2; t += 0.5) {
        availability.push({
          day,
          startTime: floatToTime(t),
          endTime: floatToTime(t + 0.5)
        });
      }
    }
  });

  return availability;
}

export async function seedDatabase(count: number = 30) {
  console.log(`Starting to generate ${count} fake tutors...`);
  
  for (let i = 0; i < count; i++) {
    const firstName = FIRST_NAMES[getRandomInt(0, FIRST_NAMES.length - 1)];
    const lastName = LAST_NAMES[getRandomInt(0, LAST_NAMES.length - 1)];
    
    const minHours = getRandomInt(4, 9);
    const maxHours = minHours + getRandomInt(4, 9);

    const newTutor: Tutor = {
      id: crypto.randomUUID(),
      name: `${firstName} ${lastName}`,
      subjects: getRandomItems(MOCK_COURSES, getRandomInt(4, 10)), // 2 to 5 random subjects
      minHours,
      maxHours,
      availability: generateRandomAvailability()
    };

    try {
      // Push directly to Firebase!
      await setDoc(doc(db, 'tutors', newTutor.id), newTutor);
      console.log(`Created: ${newTutor.name}`);
    } catch (error) {
      console.error(`Failed to create ${newTutor.name}:`, error);
    }
  }

  console.log("Finished seeding database!");
  alert(`Successfully added ${count} fake tutors to the database!`);
}