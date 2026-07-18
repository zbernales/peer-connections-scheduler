import React, { useState, useEffect } from 'react';
import { getAllCourses, saveCourse, removeCourse, type Course } from '../services/courseService';

const AVAILABLE_COURSES = [
  // Aerospace Engineering
  'AE 20', 'AE 30', 'AE 112', 'AE 114', 'AE 138', 'AE 160', 'AE 162', 'AE 164', 'AE 165',
  
  // American Studies & Anthropology
  'AMS 139', 'ANTH 11', 'ANTH 12', 'ANTH 100W', 'ANTH 115', 'ANTH 140', 'ANTH 146', 'ANTH 160', 'ANTH 168', 'ANTH 176', 'ANTH 193',
  
  // Biological Sciences & Microbiology
  'BIOL 10', 'BIOL 21', 'BIOL 30', 'BIOL 31', 'BIOL 54', 'BIOL 65', 'BIOL 66', 'BIOL 115', 'BIOL 124', 'BIOL 155', 'BIOL 167', 'MICR 20', 'MICR 101',
  
  // Business (BUS1 - BUS5)
  'BUS1 20', 'BUS1 21', 'BUS1 120A', 'BUS1 120B', 'BUS1 121A', 'BUS1 121B', 'BUS1 122A', 'BUS1 123A', 'BUS1 123C', 'BUS1 124', 'BUS1 127A', 'BUS1 129A', 'BUS1 170', 'BUS1 172A', 'BUS1 173A', 'BUS1 173B',
  'BUS2 90', 'BUS2 130', 'BUS2 190', 'BUS2 194A', 'BUS2 194B', 'BUS2 195A', 'BUS2 195B',
  'BUS3 10', 'BUS3 12', 'BUS3 80', 'BUS3 150', 'BUS3 160', 'BUS3 161A', 'BUS3 161B', 'BUS3 186',
  'BUS4 91L', 'BUS4 92', 'BUS4 188',
  'BUS5 140', 'BUS5 187',
  
  // Chemical & Chemistry
  'CHE 110B', 'CHE 115', 'CHE 162', 'CHE 190',
  'CHEM 1A', 'CHEM 1B', 'CHEM 8', 'CHEM 10', 'CHEM 30A', 'CHEM 30B', 'CHEM 55', 'CHEM 112A', 'CHEM 112B', 'CHEM 135',
  
  // Child Dev & Civil Engineering
  'CHAD 60', 'CHAD 70', 'CE 8', 'CE 95', 'CE 112',
  
  // Communication & Economics
  'COMM 10', 'COMM 20', 'COMM 20EL', 'COMM 20N', 'ECON 1A', 'ECON 1B', 'ECON 101', 'ECON 102', 'ECON 132',
  
  // Computer Engineering
  'CMPE 30', 'CMPE 50', 'CMPE 102', 'CMPE 110', 'CMPE 124', 'CMPE 125', 'CMPE 126', 'CMPE 127', 'CMPE 130', 'CMPE 131', 'CMPE 132', 'CMPE 140', 'CMPE 142', 'CMPE 148', 'CMPE 152', 'CMPE 165', 'CMPE 172', 'CMPE 187',
  
  // Computer Science & Data Science
  'CS 22A', 'CS 46A', 'CS 46B', 'CS 47', 'CS 49C', 'CS 49J', 'CS 100W', 'CS 131', 'CS 146', 'CS 147', 'CS 149', 'CS 151', 'CS 152', 'CS 154', 'CS 157A', 'CS 157C', 'CS 160', 'CS 166', 'CS 171',
  'ISDA 20B', 'ISDA 140',
  
  // Electrical & General Engineering
  'EE 97', 'EE 98', 'ENGR 10', 'ENGR 100W', 'ENGR 195A',
  
  // Engineering Technology
  'TECH 30', 'TECH 60', 'TECH 65', 'TECH 66', 'TECH 67', 'TECH 145', 'TECH 165', 'TECH 170', 'TECH 171', 'TECH 173', 'TECH 179', 'TECH 198',
  
  // English & Humanities
  'ENGL 1A', 'ENGL 1B', 'ENGL 2', 'Undergraduate Writing', 'HUM 10', 'HIST 15', 'PHIL 12', 'PHIL 186',
  
  // Design & Kinesiology
  'DSGD 83', 'DSID 126', 'KIN 158',
  
  // Geology, Meteorology & Materials Eng
  'GEOL 1', 'GEOL 8', 'GEOL 9', 'METR 112', 'MATE 25',
  
  // Industrial Systems & Mechanical Engineering
  'ISE 130', 'ISE 164',
  'ME 20', 'ME 30', 'ME 41', 'ME 101', 'ME 111', 'ME 113', 'ME 114', 'ME 115', 'ME 130', 'ME 147', 'ME 154', 'ME 165', 'ME 190', 'ME 195A',
  
  // Math & Statistics
  'MATH 15', 'MATH 18A', 'MATH 18B', 'MATH 19', 'MATH 30', 'MATH 31', 'MATH 32', 'MATH 33A', 'MATH 33LA', 'MATH 34', 'MATH 39', 'MATH 42', 'MATH 70', 'MATH 71', 'MATH 142', 'MATH 161A', 'MATH 177', 
  'STAT 95', 'Statistics', 'UNVS 15',
  
  // Nutrition & Public Health
  'NUFS 1A', 'NUFS 8', 'NUFS 9', 'NUFS 10', 'NUFS 16', 'NUFS 21', 'NUFS 144',
  'PH 1', 'PH 15', 'PH 67', 'PH 99', 'PH 100W', 'PH 161', 'PH 165A', 'PH 167',
  
  // Physics
  'PHYS 1', 'PHYS 2A', 'PHYS 2B', 'PHYS 49', 'PHYS 50', 'PHYS 51', 'PHYS 52',
  
  // Political Science, Psychology, Sociology
  'POLS 3', 'POLS 15',
  'PSYC 1', 'PSYC 18', 'PSYC 30', 'PSYC 100W', 'PSYC 114', 'PSYC 117', 'PSYC 118', 'PSYC 135', 'PSYC 139', 'PSYC 153', 'PSYC 155', 'PSYC 173', 'PSYC 191',
  'SOCI 1', 'SOCI 15', 'SOCI 80', 'SOCI 100W', 'SOCI 101', 'SOCI 104', 'SOCI 116', 'SOCI 145', 'SOCI 165',
  
  // World Languages & Linguistics
  'LING 21', 'LING 26',
  'CHIN 1A', 'CHIN 1B', 'FREN 1A', 'FREN 1B', 'JPN 1A', 'JPN 1B', 'JPN 25A', 'JPN 25B', 'JPN 101C', 'VIET 1A', 'VIET 1B'
].sort();

const DEPARTMENT_NAMES: Record<string, string> = {
  AE: 'Aerospace Engineering',
  AMS: 'American Studies',
  ANTH: 'Anthropology',
  BIOL: 'Biological Sciences',
  MICR: 'Microbiology',
  BUS1: 'Business',
  BUS2: 'Business',
  BUS3: 'Business',
  BUS4: 'Business',
  BUS5: 'Business',
  CHE: 'Chemical Engineering',
  CHEM: 'Chemistry',
  CHAD: 'Child Development',
  CE: 'Civil Engineering',
  COMM: 'Communication',
  ECON: 'Economics',
  CMPE: 'Computer Engineering',
  CS: 'Computer Science',
  ISDA: 'Data Science',
  EE: 'Electrical Engineering',
  ENGR: 'General Engineering',
  TECH: 'Engineering Technology',
  ENGL: 'English',
  HUM: 'Humanities',
  HIST: 'History',
  PHIL: 'Philosophy',
  DSGD: 'Design',
  DSID: 'Design',
  KIN: 'Kinesiology',
  GEOL: 'Geology',
  METR: 'Meteorology',
  MATE: 'Materials Engineering',
  ISE: 'Industrial & Systems Engineering',
  ME: 'Mechanical Engineering',
  MATH: 'Mathematics',
  STAT: 'Statistics',
  UNVS: 'University Studies',
  NUFS: 'Nutrition & Food Science',
  PH: 'Public Health',
  PHYS: 'Physics',
  POLS: 'Political Science',
  PSYC: 'Psychology',
  SOCI: 'Sociology',
  LING: 'Linguistics',
  CHIN: 'Chinese',
  FREN: 'French',
  JPN: 'Japanese',
  VIET: 'Vietnamese',
  Undergraduate: 'Undergraduate Writing' 
};

export const AdminCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null); // NEW: Error tracking

  // --- NEW: Search, Filter, and Edit State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load courses on component mount
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setFetchError(null); // Reset error on new fetch
      const data = await getAllCourses();
      setCourses(data);
    } catch (error: any) {
      console.error("Error fetching courses:", error);
      setFetchError(error.message || "An unknown error occurred while fetching courses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleSubmitCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode || !courseName) return;

    try {
      setSubmitting(true);
      const courseData: Course = {
        id: courseCode,
        name: courseName,
        department: department || 'General'
      };
      
      await saveCourse(courseData);
      
      // Reset form options
      setCourseCode('');
      setCourseName('');
      setDepartment('');
      setEditingId(null);
      
      // Refresh list
      await fetchCourses();
    } catch (error) {
      console.error("Error saving course:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (course: Course) => {
    setCourseCode(course.id);
    setCourseName(course.name);
    setDepartment(course.department);
    setEditingId(course.id);
    // Scroll to top smoothly so admin easily sees the form changed
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setCourseCode('');
    setCourseName('');
    setDepartment('');
    setEditingId(null);
  };

  const handleDeleteCourse = async (id: string) => {
    if (!window.confirm(`Are you sure you want to remove ${id}?`)) return;
    
    try {
      await removeCourse(id);
      setCourses(prev => prev.filter(course => course.id !== id));
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  // --- NEW: Seeding Function ---
  const handleSeedDatabase = async () => {
    if (!window.confirm("Are you sure you want to seed the database? This will upload ~150 courses.")) return;
    
    try {
      setSubmitting(true);
      
      // Process sequentially instead of 150 at once to prevent Firebase from hanging
      for (const courseStr of AVAILABLE_COURSES) {
        const prefix = courseStr.split(' ')[0]; // Extract the prefix (e.g., "CS" from "CS 146")
        const dept = DEPARTMENT_NAMES[prefix] || prefix; // Find the full department name, default to the prefix
        
        await saveCourse({
          id: courseStr,
          name: courseStr, // Defaulting the descriptive name to the code for the seed
          department: dept
        });
      }

      alert("Database seeded successfully!");
      await fetchCourses(); // Refresh the table
    } catch (error) {
      console.error("Error seeding database:", error);
      alert("An error occurred during seeding. Check the console.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading course catalog...</div>;

  // --- NEW: Filter Logic ---
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          course.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = departmentFilter === '' || course.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const uniqueDepartments = Array.from(new Set(courses.map(c => c.department))).sort();

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Course Catalog Management</h2>

      {/* NEW: Explicit Error Display */}
      {fetchError && (
        <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b' }}>
          <h3 style={{ marginTop: 0 }}>⚠️ Database Access Denied</h3>
          <p><strong>Error details:</strong> {fetchError}</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            <strong>How to fix:</strong> Go to the Firebase Console &rarr; Firestore Database &rarr; Rules. Make sure you have a rule allowing read access to the `courses` collection!
          </p>
        </div>
      )}
      
      {/* Add / Edit Course Form */}
      <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, color: '#1e293b' }}>
          {editingId ? `Editing Course: ${editingId}` : 'Add New Course'}
        </h3>
        <form onSubmit={handleSubmitCourse} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Course Code (e.g., CS 46B)" 
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            required
            disabled={submitting || editingId !== null}
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', flex: '1 1 200px', backgroundColor: editingId ? '#f1f5f9' : 'white', cursor: editingId ? 'not-allowed' : 'text' }}
          />
          <input 
            type="text" 
            placeholder="Course Name (e.g., Introduction to Data Structures)" 
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            required
            disabled={submitting}
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', flex: '1 1 250px' }}
          />
          <input 
            type="text" 
            placeholder="Department (Optional)" 
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={submitting}
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', flex: '1 1 200px' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={submitting} style={{ padding: '0.75rem 1.5rem', backgroundColor: editingId ? '#f59e0b' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              {submitting ? 'Working...' : editingId ? 'Update Course' : 'Add Course'}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} disabled={submitting} style={{ padding: '0.75rem 1rem', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* NEW: Search and Filter Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        {/* Modern Search Input Wrapper */}
        <div style={{ position: 'relative', flex: 1 }}>
          {/* SVG Search Icon */}
          <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem', color: '#94a3b8' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          
          <input 
            type="text" 
            placeholder="Search peer educators by name..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            style={{ width: '100%', padding: '0.75rem 1rem 0.85rem 2.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }} 
          />
        </div>
        <select 
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: 'white', minWidth: '200px' }}
        >
          <option value="">All Departments</option>
          {uniqueDepartments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {/* Seed Button (Only shows if DB is empty and there's no fetch error) */}
      {courses.length === 0 && !fetchError && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0, color: '#166534' }}>Empty Database Detected</h3>
          <p style={{ color: '#15803d', marginBottom: '1rem' }}>It looks like your course catalog is empty. You can instantly populate it with your 150+ hardcoded default classes.</p>
          <button 
            onClick={handleSeedDatabase} 
            disabled={submitting} 
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {submitting ? 'Seeding Database...' : 'Seed Initial Courses'}
          </button>
        </div>
      )}

      {/* Courses List */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Active Courses ({filteredCourses.length})</h3>
        {courses.length !== filteredCourses.length && (
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Showing {filteredCourses.length} of {courses.length} total</span>
        )}
      </div>

      {courses.length === 0 && !fetchError ? (
        <p>No courses currently in the catalog.</p>
      ) : courses.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
          <thead style={{ backgroundColor: '#f8fafc' }}>
            <tr>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Code</th>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Name</th>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Department</th>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.map(course => (
              <tr key={course.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: editingId === course.id ? '#fef3c7' : 'transparent' }}>
                <td style={{ padding: '1rem', fontWeight: 'bold', color: '#1e293b' }}>{course.id}</td>
                <td style={{ padding: '1rem', color: '#475569' }}>{course.name}</td>
                <td style={{ padding: '1rem', color: '#475569' }}>
                  <span style={{ backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.875rem' }}>
                    {course.department}
                  </span>
                </td>
                <td style={{ padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={() => handleEditClick(course)}
                    style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteCourse(course.id)}
                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                    disabled={editingId === course.id} // Disable delete while actively editing this row
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {filteredCourses.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  No courses match your search or filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : null}
    </div>
  );
};