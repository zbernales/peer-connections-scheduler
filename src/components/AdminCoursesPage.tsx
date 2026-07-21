import React, { useState, useEffect } from 'react';
import { getAllCourses, saveCourse, removeCourse, type Course } from '../services/courseService';

interface AdminCoursesPageProps {
  showToast: (message: string) => void;
  showErrorToast: (message: string) => void;
}

export function AdminCoursesPage({ showToast, showErrorToast }: AdminCoursesPageProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search, Filter, and Edit State
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal State
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  // Load courses on component mount
  const fetchCourses = async () => {
    try {
      setLoading(true);
      setFetchError(null); 
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
      
      const isUpdating = editingId !== null;
      
      setCourseCode('');
      setCourseName('');
      setDepartment('');
      setEditingId(null);
      
      await fetchCourses();
      showToast(isUpdating ? `${courseData.id} successfully updated.` : `${courseData.id} successfully added.`);
    } catch (error) {
      console.error("Error saving course:", error);
      showErrorToast("Failed to save course. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (course: Course) => {
    setCourseCode(course.id);
    setCourseName(course.name);
    setDepartment(course.department);
    setEditingId(course.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setCourseCode('');
    setCourseName('');
    setDepartment('');
    setEditingId(null);
  };

  const handleDeleteClick = (id: string) => {
    setCourseToDelete(id); 
  };

  const confirmDelete = async () => {
    if (!courseToDelete) return;
    
    try {
      await removeCourse(courseToDelete);
      setCourses(prev => prev.filter(course => course.id !== courseToDelete));
      showToast(`${courseToDelete} has been removed from the catalog.`);
      setCourseToDelete(null);
    } catch (error) {
      console.error("Error deleting course:", error);
      showErrorToast("Failed to delete course. Please try again.");
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading course catalog...</div>;

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
            placeholder="Course Name (e.g., Intro to Data Structures)" 
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

      {/* Search and Filter Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem', color: '#94a3b8' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          
          <input 
            type="text" 
            placeholder="Search courses by code or name..." 
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
                    onClick={() => handleDeleteClick(course.id)}
                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                    disabled={editingId === course.id}
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

      {/* ------------------------------------------------------------- */}
      {/* ------------------------- MODALS ---------------------------- */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Delete Confirmation Modal */}
      {courseToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.4rem' }}>Remove Course</h3>
            <p style={{ color: '#475569', marginBottom: '2rem', lineHeight: '1.5' }}>
              Are you sure you want to permanently remove <strong>{courseToDelete}</strong> from the catalog? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setCourseToDelete(null)} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};