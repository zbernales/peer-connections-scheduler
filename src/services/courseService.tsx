import { db } from '../firebase'; // Adjust path to your firebase config
import { collection, doc, setDoc, deleteDoc, getDocs, orderBy, query } from 'firebase/firestore';

export interface Course {
  id: string; // Used as the course code (e.g., "MATH-31")
  name: string;
  department: string;
}

const COURSES_COLLECTION = 'courses';

// Fetch all courses sorted alphabetically by ID
export const getAllCourses = async (): Promise<Course[]> => {
  const coursesRef = collection(db, COURSES_COLLECTION);
  const q = query(coursesRef, orderBy('id', 'asc'));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Course));
};

// Add or Update a course
export const saveCourse = async (course: Course): Promise<void> => {
  // Stripping whitespace and forcing uppercase for clean indexing
  const courseId = course.id.trim().toUpperCase();
  const courseRef = doc(db, COURSES_COLLECTION, courseId);
  
  await setDoc(courseRef, {
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