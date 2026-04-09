// src/components/SubjectSelector.tsx
import { useState, useRef, useEffect } from 'react';

interface SubjectSelectorProps {
  selectedSubjects: string[];
  onChange: (subjects: string[]) => void;
}

// Our predefined "database" of available courses
const AVAILABLE_COURSES = [
  // Aerospace Engineering
  'AE 20', 'AE 30', 'AE 112', 'AE 114', 'AE 138', 'AE 160', 'AE 162', 'AE 164', 'AE 165',
  
  // American Studies & Anthropology
  'AMS 139', 'ANTH 11', 'ANTH 12', 'ANTH 100W', 'ANTH 115', 'ANTH 140', 'ANTH 146', 'ANTH 160', 'ANTH 168', 'ANTH 176', 'ANTH 193',
  
  // Biological Sciences & Microbiology
  'BIOL 10', 'BIOL 21', 'BIOL 30', 'BIOL 31', 'BIOL 54', 'BIOL 65', 'BIOL 66', 'BIOL 115', 'BIOL 124', 'BIOL 155', 'BIOL 167', 'MICR 20', 'MICR 101',
  
  // Business (BUS1 - BUS5)
  'BUS1-20', 'BUS1-21', 'BUS1-120A', 'BUS1-120B', 'BUS1-121A', 'BUS1-121B', 'BUS1-122A', 'BUS1-123A', 'BUS1-123C', 'BUS1-124', 'BUS1-127A', 'BUS1-129A', 'BUS1-170', 'BUS1-172A', 'BUS1-173A', 'BUS1-173B',
  'BUS2-90', 'BUS2-130', 'BUS2-190', 'BUS2-194A', 'BUS2-194B', 'BUS2-195A', 'BUS2-195B',
  'BUS3-10', 'BUS3-12', 'BUS3-80', 'BUS3-150', 'BUS3-160', 'BUS3-161A', 'BUS3-161B', 'BUS3-186',
  'BUS4-91L', 'BUS4-92', 'BUS4-188',
  'BUS5-140', 'BUS5-187',
  
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

export function SubjectSelector({ selectedSubjects, onChange }: SubjectSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  const filteredCourses = AVAILABLE_COURSES.filter(
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
          placeholder={selectedSubjects.length === 0 ? "Search for courses..." : ""}
          style={{ 
            border: 'none', 
            outline: 'none', 
            flex: 1, 
            minWidth: '120px',
            fontSize: '0.95rem'
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