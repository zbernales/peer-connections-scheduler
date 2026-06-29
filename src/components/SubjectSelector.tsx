// src/components/SubjectSelector.tsx
import { useState, useRef, useEffect } from 'react';
import { getAllCourses } from '../services/courseService';

interface SubjectSelectorProps {
  selectedSubjects: string[];
  onChange: (subjects: string[]) => void;
}

export function SubjectSelector({ selectedSubjects, onChange }: SubjectSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // --- NEW: Dynamic Courses State ---
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch courses from Firestore on mount
  useEffect(() => {
    const fetchDynamicCourses = async () => {
      try {
        setIsLoading(true);
        const data = await getAllCourses();
        // Extract just the IDs (e.g., 'CS 146') to use in our dropdown
        setAvailableCourses(data.map(course => course.id));
      } catch (error) {
        console.error("Failed to load courses from database:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDynamicCourses();
  }, []);

  // Magic to close the dropdown if the user clicks anywhere else on the screen
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter courses that match the search term AND haven't been selected yet
  const filteredCourses = availableCourses.filter(
    course => 
      !selectedSubjects.includes(course) && 
      course.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addSubject = (course: string) => {
    onChange([...selectedSubjects, course]);
    setSearchTerm('');
    setIsOpen(false); // Close dropdown after selection
  };

  const removeSubject = (courseToRemove: string) => {
    onChange(selectedSubjects.filter(c => c !== courseToRemove));
  };

  // Handle Enter Key for Custom Courses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Stop the form from submitting!
      
      /*
      // --- CUSTOM COURSE FEATURE TEMPORARILY DISABLED ---
      const customCourse = searchTerm.trim().toUpperCase();
      
      if (customCourse && !selectedSubjects.includes(customCourse)) {
        addSubject(customCourse);
      } else if (selectedSubjects.includes(customCourse)) {
        setSearchTerm(''); // Clear the input if they try to add a duplicate
      }
      // --------------------------------------------------
      */
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      
      {/* The main input box containing the pills and text field */}
      <div 
        onClick={() => setIsOpen(true)}
        style={{ 
          minHeight: '42px', 
          border: '1px solid #cbd5e1', 
          borderRadius: '4px', 
          padding: '4px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
          cursor: 'text',
          backgroundColor: '#fff'
        }}
      >
        {/* Render the Selected Subject Pills */}
        {selectedSubjects.map(subject => (
          <span 
            key={subject} 
            style={{ 
              backgroundColor: '#f1f5f9', 
              border: '1px solid #e2e8f0',
              padding: '2px 8px', 
              borderRadius: '16px', 
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#334155'
            }}
          >
            {subject}
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Prevents opening the dropdown when clicking X
                removeSubject(subject);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#94a3b8', fontSize: '1rem', lineHeight: '1' }}
            >
              &times;
            </button>
          </span>
        ))}

        {/* The actual text input */}
        <input 
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={isLoading ? "Loading courses..." : selectedSubjects.length === 0 ? "Search courses... (e.g., CS 146)" : ""}
          style={{ 
            border: 'none', 
            outline: 'none', 
            flex: 1, 
            minWidth: '120px',
            fontSize: '0.95rem',
            backgroundColor: 'transparent'
          }}
        />
      </div>

      {/* The Floating Dropdown Menu */}
      {isOpen && filteredCourses.length > 0 && (
        <ul style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          right: 0, 
          margin: '4px 0 0 0', 
          padding: 0, 
          listStyle: 'none', 
          backgroundColor: 'white', 
          border: '1px solid #cbd5e1', 
          borderRadius: '4px', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxHeight: '200px', 
          overflowY: 'auto',
          zIndex: 10 
        }}>
          {filteredCourses.map(course => (
            <li 
              key={course}
              onClick={() => addSubject(course)}
              style={{ 
                padding: '8px 12px', 
                cursor: 'pointer', 
                borderBottom: '1px solid #f1f5f9'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {course}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}