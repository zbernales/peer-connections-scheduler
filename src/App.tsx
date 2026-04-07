import { mockTutors } from './data/mockTutors';
import { generateSchedule, timeToFloat } from './utils/scheduler';
import type { DayOfWeek } from './types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function App() {
  // Run the algorithm
  const schedule = generateSchedule(mockTutors);

  // --- Derived Data for our new views ---
  
  // 1. Extract a list of all unique subjects taught by our tutors
  const allSubjects = Array.from(
    new Set(mockTutors.flatMap(tutor => tutor.subjects))
  ).sort();

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Peer Connections Scheduler</h1>
      
      <hr style={{ margin: '2rem 0' }} />

      {/* --- 1. THE MASTER SCHEDULE (By Day) --- */}
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
                // Sort shifts by start time so they appear in chronological order
                daysShifts
                  .sort((a, b) => timeToFloat(a.startTime) - timeToFloat(b.startTime))
                  .map(shift => {
                    const tutorName = mockTutors.find(t => t.id === shift.tutorId)?.name || 'Unknown';
                    return (
                      <div key={shift.id} style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderLeft: '4px solid #3b82f6', borderRadius: '4px' }}>
                        <strong>{shift.startTime} - {shift.endTime}</strong>
                        <br />
                        👨‍🏫 {tutorName}
                        <br />
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

      {/* --- 2. TUTOR REPORTS (By Tutor) --- */}
      <h2>2. Tutor Breakdowns</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {mockTutors.map(tutor => {
          // Find all shifts assigned to this specific tutor
          const tutorShifts = schedule.filter(s => s.tutorId === tutor.id);
          // Sort them by day, then by time
          tutorShifts.sort((a, b) => {
            if (a.day !== b.day) return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
            return timeToFloat(a.startTime) - timeToFloat(b.startTime);
          });

         // Multiply the number of shifts by 0.5 to get true hours
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

      {/* --- 3. SUBJECT COVERAGE (By Subject) --- */}
      <h2>3. Subject Coverage Matrix</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', paddingBottom: '3rem' }}>
        {allSubjects.map(subject => {
          // Find every shift where the scheduled tutor teaches this subject
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
                    const tutorName = mockTutors.find(t => t.id === shift.tutorId)?.name || 'Unknown';
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

    </div>
  );
}

export default App;