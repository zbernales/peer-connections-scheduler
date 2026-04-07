import { mockTutors } from './data/mockTutors';
import { generateSchedule } from './utils/scheduler';
import type { DayOfWeek } from './types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function App() {
  const schedule = generateSchedule(mockTutors);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Peer Connections Scheduler</h1>
      
      {/* --- Existing Roster Section --- */}
      <h2>Current Roster</h2>
      <ul style={{ marginBottom: '2rem' }}>
        {mockTutors.map(tutor => (
          <li key={tutor.id}>
            <strong>{tutor.name}</strong> - Subjects: {tutor.subjects.join(', ')} 
            <br />
            Hours: {tutor.minHours} to {tutor.maxHours}
          </li>
        ))}
      </ul>

      <hr />

      {/* --- New Schedule Output Section --- */}
      <h2>Generated Schedule</h2>
      
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
        {DAYS.map(day => {
          // Filter the total schedule to just get this day's shifts
          const daysShifts = schedule.filter(s => s.day === day);
          
          return (
            <div key={day} style={{ border: '1px solid #ccc', padding: '1rem', minWidth: '200px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0 }}>{day}</h3>
              
              {daysShifts.length === 0 ? (
                <p style={{ color: 'gray', fontStyle: 'italic' }}>No shifts scheduled.</p>
              ) : (
                daysShifts.map(shift => {
                  // Find the tutor's name to display instead of just their ID
                  const tutorName = mockTutors.find(t => t.id === shift.tutorId)?.name || 'Unknown';
                  
                  return (
                    <div key={shift.id} style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f0f4f8', borderRadius: '4px' }}>
                      <strong>{shift.startTime} - {shift.endTime}</strong>
                      <br />
                      👨‍🏫 Tutor: {tutorName}
                      <br />
                      📚 Subject: {shift.subject}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default App;