import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { generateSchedule, timeToFloat } from './utils/scheduler';
import { TutorForm } from './components/TutorForm';
import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { Tutor, DayOfWeek } from './types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <TutorForm onSubmit={(newTutor) => {
                  alert(`Success! ${newTutor.name}'s availability has been submitted to the database.`);
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
                          daysShifts
                            .sort((a, b) => timeToFloat(a.startTime) - timeToFloat(b.startTime))
                            .map(shift => {
                              const tutorName = roster.find(t => t.id === shift.tutorId)?.name || 'Unknown';
                              return (
                                <div key={shift.id} style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderLeft: '4px solid #3b82f6', borderRadius: '4px' }}>
                                  <strong>{shift.startTime} - {shift.endTime}</strong><br />
                                  👨‍🏫 {tutorName}<br />
                                  <span style={{ fontSize: '0.85em', color: '#555' }}>{shift.subjects.join(', ')}</span>
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
                            {tutorShifts.map(shift => (
                              <li key={shift.id} style={{ marginBottom: '0.25rem' }}>
                                <strong>{shift.day}:</strong> {shift.startTime} - {shift.endTime}
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
                            {subjectShifts.map(shift => {
                              const tutorName = roster.find(t => t.id === shift.tutorId)?.name || 'Unknown';
                              return (
                                <li key={shift.id} style={{ marginBottom: '0.25rem' }}>
                                  <strong>{shift.day} {shift.startTime}</strong> ({tutorName})
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