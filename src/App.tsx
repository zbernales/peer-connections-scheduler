import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { generateSchedule, timeToFloat } from './utils/scheduler';
import { TutorForm } from './components/TutorForm';
import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { Tutor, DayOfWeek } from './types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function mergeShiftsForUI(shifts: any[]) {
  if (shifts.length === 0) return [];

  const merged = [];
  let currentBlock = { ...shifts[0] };

  for (let i = 1; i < shifts.length; i++) {
    const nextShift = shifts[i];

    // Merge ONLY if it's the same day, touches end-to-start, AND is the exact same tutor
    if (
      nextShift.day === currentBlock.day && 
      nextShift.startTime === currentBlock.endTime &&
      nextShift.tutorId === currentBlock.tutorId 
    ) {
      currentBlock.endTime = nextShift.endTime;
    } else {
      merged.push(currentBlock);
      currentBlock = { ...nextShift };
    }
  }
  merged.push(currentBlock);

  return merged;
}

// Helper specifically for the Subject Matrix to handle weekly overlapping tutors
function getMergedWeeklySchedule(weeklyShifts: any[]) {
  if (weeklyShifts.length === 0) return [];

  // 1. Group by Tutor FIRST, then by Day, then by Time
  const groupedByTutor = [...weeklyShifts].sort((a, b) => {
    if (a.tutorId !== b.tutorId) {
      return a.tutorId.localeCompare(b.tutorId); // Group all of Bob's shifts, then Dan's
    }
    if (a.day !== b.day) {
      return DAYS.indexOf(a.day) - DAYS.indexOf(b.day); // Keep days in order
    }
    return timeToFloat(a.startTime) - timeToFloat(b.startTime); // Keep times in order
  });

  // 2. Now that the blocks are safely grouped, merge them!
  const mergedBlocks = mergeShiftsForUI(groupedByTutor);

  // 3. Finally, sort the merged blocks chronologically for the UI (Day first, then Time)
  return mergedBlocks.sort((a, b) => {
    if (a.day !== b.day) {
      return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    }
    return timeToFloat(a.startTime) - timeToFloat(b.startTime);
  });
}

// Helper specifically for the Master Schedule to fix interleaved tutors
function getMergedDailySchedule(dailyShifts: any[]) {
  if (dailyShifts.length === 0) return [];

  // 1. Sort by Tutor ID first, THEN by Time
  // This groups all of Alice's shifts together, followed by all of George's, etc.
  const groupedByTutor = [...dailyShifts].sort((a, b) => {
    if (a.tutorId === b.tutorId) {
      return timeToFloat(a.startTime) - timeToFloat(b.startTime);
    }
    return a.tutorId.localeCompare(b.tutorId);
  });

  // 2. Now that they are grouped, our merger will catch every continuous block
  const mergedBlocks = mergeShiftsForUI(groupedByTutor);

  // 3. Finally, sort the merged blocks chronologically so the column reads top-to-bottom
  return mergedBlocks.sort((a, b) => timeToFloat(a.startTime) - timeToFloat(b.startTime));
}

// We extract the Navigation into its own component so it has access to useLocation()
// This lets us highlight the active tab based on the URL!
function NavBar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <nav style={{ backgroundColor: '#1e293b', padding: '1rem', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center', borderRadius: '0 0 8px 8px', marginBottom: '2rem' }}>
      <h2 style={{ margin: 0, marginRight: 'auto', color: 'white' }}>Peer Connections</h2>
      
      <Link 
        to="/submit"
        style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/submit' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}
      >
        Student Submission Page
      </Link>
      
      <Link 
        to="/admin"
        style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/admin' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}
      >
        Schedule Dashboard
      </Link>
    </nav>
  );
}

function App() {
  // --- Global State ---
 // Start with an empty array instead of mock data
  const [roster, setRoster] = useState<Tutor[]>([]);

  // Set up the real-time listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tutors'), (snapshot) => {
      // Every time the database changes, this runs and updates our state
      const tutorsData = snapshot.docs.map(doc => doc.data() as Tutor);
      setRoster(tutorsData);
    });

    // Cleanup the listener when the app closes
    return () => unsubscribe();
  }, []);
  
  // --- Derived Data (Only used by Admin Dashboard) ---
  const schedule = generateSchedule(roster);
  const allSubjects = Array.from(
    new Set(roster.flatMap(tutor => tutor.subjects))
  ).sort();

  return (
    <BrowserRouter>
      <div style={{ fontFamily: 'sans-serif', width: '100%', boxSizing: 'border-box' }}>
        
        <NavBar />

        <div style={{ padding: '0 2rem 2rem 2rem' }}>
          <Routes>
            
            {/* --- ROUTE 1: THE STUDENT FORM (/submit) --- */}
            <Route path="/submit" element={
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <TutorForm onSubmit={(newTutor) => {
                  alert(`${newTutor.name}'s availability has been submitted.`);
                }} />
              </div>
            } />

            {/* --- ROUTE 2: THE SCHEDULER DASHBOARD (/admin) --- */}
            <Route path="/admin" element={
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h1>Master Schedule Dashboard</h1>
                  <span style={{ backgroundColor: '#e2e8f0', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                    Total Tutors: {roster.length}
                  </span>
                </div>
                
                <hr style={{ margin: '1rem 0 2rem 0' }} />

                <h2>1. Master Schedule</h2>
                <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                  {DAYS.map(day => {
                    const daysShifts = schedule.filter(s => s.day === day);
                    return (
                      <div key={day} style={{ border: '1px solid #ccc', padding: '1rem', minWidth: '220px', borderRadius: '8px', flex: 1 }}>
                        <h3 style={{ marginTop: 0, borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>{day}</h3>
                        {daysShifts.length === 0 ? (
                          <p style={{ color: 'gray', fontStyle: 'italic' }}>No shifts scheduled.</p>
                        ) : (
                        // Pass the daily shifts through our new 3-step pipeline!
                        getMergedDailySchedule(daysShifts).map((block, index) => {
                          const tutorName = roster.find(t => t.id === block.tutorId)?.name || 'Unknown';
                          return (
                            <div key={index} style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderLeft: '4px solid #3b82f6', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                              <strong>{block.startTime} - {block.endTime}</strong><br />
                              👨‍🏫 {tutorName}<br />
                              <span style={{ fontSize: '0.85em', color: '#555' }}>{block.subjects.join(', ')}</span>
                            </div>
                          );
                        })
                      )}
                      </div>
                    );
                  })}
                </div>

                <hr style={{ margin: '3rem 0' }} />

                <h2>2. Tutor Breakdowns</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {roster.map(tutor => {
                    const tutorShifts = schedule.filter(s => s.tutorId === tutor.id);
                    tutorShifts.sort((a, b) => {
                      if (a.day !== b.day) return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
                      return timeToFloat(a.startTime) - timeToFloat(b.startTime);
                    });

                    const totalHours = tutorShifts.length * 0.5;

                    return (
                      <div key={tutor.id} style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#fff' }}>
                        <h3 style={{ marginTop: 0, color: '#1e293b' }}>{tutor.name}</h3>
                        <p style={{ margin: '0 0 1rem 0', color: totalHours < tutor.minHours ? '#ef4444' : '#10b981' }}>
                          <strong>Scheduled: {totalHours} hrs</strong> (Target: {tutor.minHours}-{tutor.maxHours} hrs)
                        </p>
                        {tutorShifts.length === 0 ? (
                          <p style={{ color: 'gray', fontStyle: 'italic', margin: 0 }}>Not scheduled this week.</p>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569' }}>
                            {/* Pass the sorted shifts through our merger before rendering */}
                            {mergeShiftsForUI(tutorShifts).map((block, index) => (
                              <li key={index} style={{ marginBottom: '0.25rem' }}>
                                <strong>{block.day}:</strong> {block.startTime} - {block.endTime}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>

                <hr style={{ margin: '3rem 0' }} />

                <h2>3. Subject Coverage Matrix</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', paddingBottom: '3rem' }}>
                  {allSubjects.map(subject => {
                    const subjectShifts = schedule.filter(s => s.subjects.includes(subject));
                    subjectShifts.sort((a, b) => {
                      if (a.day !== b.day) return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
                      return timeToFloat(a.startTime) - timeToFloat(b.startTime);
                    });

                    return (
                      <div key={subject} style={{ border: '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                        <h3 style={{ marginTop: 0, color: '#0f172a' }}>📚 {subject}</h3>
                        {subjectShifts.length === 0 ? (
                          <p style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ No coverage this week!</p>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569' }}>
    {/* Pass subjectShifts through our new Weekly Pipeline! */}
    {getMergedWeeklySchedule(subjectShifts).map((block, index) => {
      const tutorName = roster.find(t => t.id === block.tutorId)?.name || 'Unknown';
      return (
        <li key={index} style={{ marginBottom: '0.25rem' }}>
          <strong>{block.day}: {block.startTime} - {block.endTime}</strong> <span style={{ color: '#3b82f6' }}>({tutorName})</span>
        </li>
      );
    })}
  </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            } />

            {/* --- DEFAULT ROUTE (Redirects to /submit if URL is empty) --- */}
            <Route path="*" element={<Navigate to="/submit" replace />} />

          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;