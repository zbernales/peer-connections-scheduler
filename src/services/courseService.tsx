import { db } from '../firebase'; // Adjust path to your firebase config
import { collection, doc, setDoc, deleteDoc, getDocs, orderBy, query } from 'firebase/firestore';

export interface Course {
  id: string; // Used as the course code (e.g., "MATH-31")
  name: string;
  department: string;
}

// ... existing code ...
const COURSES_COLLECTION = 'courses';

// Fetch all courses sorted alphabetically by ID
export const getAllCourses = async (): Promise<Course[]> => {
  const coursesRef = collection(db, COURSES_COLLECTION);
  // Fetch everything without a Firestore query filter, so we don't skip existing seeded data
  const querySnapshot = await getDocs(coursesRef);
  
  const courses = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Course));

  // Sort them alphabetically in JavaScript instead of Firebase
  return courses.sort((a, b) => a.id.localeCompare(b.id));
};

// Add or Update a course
export const saveCourse = async (course: Course): Promise<void> => {
  // Stripping whitespace and forcing uppercase for clean indexing
  const courseId = course.id.trim().toUpperCase();
  const courseRef = doc(db, COURSES_COLLECTION, courseId);
  
  await setDoc(courseRef, {
    id: courseId, // <-- ADDED: Save the ID inside the document too for future-proofing
    name: course.name.trim(),
    department: course.department.trim(),
    createdAt: new Date()
  });
};

// Delete a course
export const removeCourse = async (courseId: string): Promise<void> => {
  const courseRef = doc(db, COURSES_COLLECTION, courseId);
  await deleteDoc(courseRef);
};