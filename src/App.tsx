import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { generateSchedule, timeToFloat, floatToTime } from './utils/scheduler';
import { TutorForm } from './components/TutorForm';
import { RosterDashboard } from './components/RosterDashboard';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { TutorScheduleGrid } from './components/TutorScheduleGrid';
import { SubjectScheduleGrid } from './components/SubjectScheduleGrid';
import type { Tutor, DayOfWeek, ScheduleConfig, Shift } from './types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// 1. Upgraded Merger: Now tracks the underlying shift IDs!
function mergeShiftsForUI(shifts: any[]) {
  if (shifts.length === 0) return [];

  const merged = [];
  let currentBlock = { ...shifts[0], shiftIds: [shifts[0].id] };

  for (let i = 1; i < shifts.length; i++) {
    const nextShift = shifts[i];

    // Merge ONLY if it's the same day, touches end-to-start, AND is the exact same tutor
    if (
      nextShift.day === currentBlock.day && 
      nextShift.startTime === currentBlock.endTime &&
      nextShift.tutorId === currentBlock.tutorId 
    ) {
      currentBlock.endTime = nextShift.endTime;
      currentBlock.shiftIds.push(nextShift.id); // Save the ID of the merged shift
    } else {
      merged.push(currentBlock);
      currentBlock = { ...nextShift, shiftIds: [nextShift.id] };
    }
  }
  merged.push(currentBlock);

  return merged;
}

// 2. NEW HELPER: Checks if a block violates a tutor's availability
function isOutsideAvailability(tutor: Tutor | undefined, block: any): boolean {
  if (!tutor) return true;
  
  let current = timeToFloat(block.startTime);
  const end = timeToFloat(block.endTime);
  
  // Check every 30-min chunk inside this block
  while (current < end) {
    const isAvail = tutor.availability.some(avail => 
      avail.day === block.day &&
      timeToFloat(avail.startTime) <= current &&
      timeToFloat(avail.endTime) >= (current + 0.5)
    );
    if (!isAvail) return true; // If ANY part of the shift is outside availability, flag it!
    current += 0.5;
  }
  return false;
}

// Helper specifically for the Subject Matrix
function getMergedWeeklySchedule(weeklyShifts: any[]) {
  if (weeklyShifts.length === 0) return [];

  const groupedByTutor = [...weeklyShifts].sort((a, b) => {
    if (a.tutorId !== b.tutorId) {
      return a.tutorId.localeCompare(b.tutorId); 
    }
    if (a.day !== b.day) {
      return DAYS.indexOf(a.day) - DAYS.indexOf(b.day); 
    }
    return timeToFloat(a.startTime) - timeToFloat(b.startTime); 
  });

  const mergedBlocks = mergeShiftsForUI(groupedByTutor);

  return mergedBlocks.sort((a, b) => {
    if (a.day !== b.day) {
      return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    }
    return timeToFloat(a.startTime) - timeToFloat(b.startTime);
  });
}

// Helper specifically for the Master Schedule
function getMergedDailySchedule(dailyShifts: any[]) {
  if (dailyShifts.length === 0) return [];

  const groupedByTutor = [...dailyShifts].sort((a, b) => {
    if (a.tutorId === b.tutorId) {
      return timeToFloat(a.startTime) - timeToFloat(b.startTime);
    }
    return a.tutorId.localeCompare(b.tutorId);
  });

  const mergedBlocks = mergeShiftsForUI(groupedByTutor);

  return mergedBlocks.sort((a, b) => timeToFloat(a.startTime) - timeToFloat(b.startTime));
}

// NEW: A self-contained modal that manages draft edits before saving to the global schedule
function TutorScheduleEditorModal({ tutor, currentSchedule, onSave, onClose }: any) {
  const [draftSlots, setDraftSlots] = useState<Set<string>>(new Set());

  // When the modal opens, convert the global Shift[] into a flat Set of "Day-Time" strings
  useEffect(() => {
    const initialSet = new Set<string>();
    currentSchedule.forEach((shift: Shift) => {
      let current = timeToFloat(shift.startTime);
      const end = timeToFloat(shift.endTime);
      while(current < end) {
        initialSet.add(`${shift.day}-${floatToTime(current)}`);
        current += 0.5;
      }
    });
    setDraftSlots(initialSet);
  }, [currentSchedule]);

  const handleSave = () => {
    // Convert the draft Set back into an array of 30-min Shift objects
    const newShifts: Shift[] = Array.from(draftSlots).map(slot => {
      const [day, startTime] = slot.split('-');
      const endTime = floatToTime(timeToFloat(startTime) + 0.5);
      return {
        id: crypto.randomUUID(),
        tutorId: tutor.id,
        subjects: tutor.subjects,
        day: day as DayOfWeek,
        startTime,
        endTime
      };
    });
    onSave(newShifts);
  };

  const scheduledHours = draftSlots.size * 0.5;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Edit {tutor.name}'s Schedule</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>

        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ margin: '0 0 0.5rem 0' }}><strong>Subjects:</strong> {tutor.subjects.join(', ')}</p>
            <p style={{ margin: 0 }}><strong>Hours Target:</strong> {tutor.minHours} - {tutor.maxHours} hrs/week</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: scheduledHours > tutor.maxHours || scheduledHours < tutor.minHours ? '#ef4444' : '#10b981' }}>
              Draft: {scheduledHours} hrs
            </p>
          </div>
        </div>

        <TutorScheduleGrid 
          tutor={tutor} 
          selectedSlots={draftSlots} 
          onChange={setDraftSlots} 
        />

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>
            Save Changes
          </button>
          <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '1rem', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}

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
        Roster Dashboard
      </Link>
    </nav>
  );
}

function App() {
  // --- Global State ---
  const [roster, setRoster] = useState<Tutor[]>([]);
  const [selectedTutorModal, setSelectedTutorModal] = useState<Tutor | null>(null);
  const [hoveredTutorId, setHoveredTutorId] = useState<string | null>(null);
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);
  const [selectedSubjectModal, setSelectedSubjectModal] = useState<string | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    tutorsPerHour: 3,
    maxConsecutiveHours: 3,
    minCooldownHours: 1.5,
    maxHoursPerDay: 4
  });

  // --- Stateful Schedule & Editing ---
  const [schedule, setSchedule] = useState<Shift[]>([]);
  const [editingShiftBlock, setEditingShiftBlock] = useState<any>(null);

  // Set up the real-time listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tutors'), (snapshot) => {
      const tutorsData = snapshot.docs.map(doc => doc.data() as Tutor);
      setRoster(tutorsData);
    });

    return () => unsubscribe();
  }, []);
  
  // This function takes a snapshot of the algorithm's output and saves it to state
  const handleGenerateSchedule = () => {
    const generated = generateSchedule(roster, scheduleConfig);
    setSchedule(generated);
  };

  // --- Manual Grid Override Logic for the Tutor Modal ---
  // --- Bulk Save Logic for the Tutor Modal ---
  const handleSaveTutorSchedule = (tutorId: string, newTutorShifts: Shift[]) => {
    setSchedule(prevSchedule => {
      // 1. Strip out ALL existing shifts for this specific tutor
      const filteredSchedule = prevSchedule.filter(s => s.tutorId !== tutorId);
      // 2. Inject their newly edited shifts
      return [...filteredSchedule, ...newTutorShifts];
    });
    setSelectedTutorModal(null); // Close the modal
  };

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

            {/* THE NEW MAIN PAGE */}
            <Route path="/admin" element={
              <RosterDashboard 
                roster={roster} 
                config={scheduleConfig} 
                onConfigChange={setScheduleConfig}
                onSelectTutor={setSelectedTutorModal}
                onGenerate={handleGenerateSchedule} /* <-- Make sure to add this to your RosterDashboard props! */
              />
            } />

            {/* --- ROUTE 2: THE SCHEDULER DASHBOARD (/schedule) --- */}
            <Route path="/schedule" element={
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
                        getMergedDailySchedule(daysShifts).map((block, index) => {
                          const tutor = roster.find(t => t.id === block.tutorId);
                          const tutorName = tutor?.name || 'Unknown';
                          
                          // Check for forced overrides!
                          const isForced = isOutsideAvailability(tutor, block);
                          const bgColor = isForced ? '#fef2f2' : '#f8fafc'; // Light Red vs Light Gray
                          const borderColor = isForced ? '#ef4444' : '#3b82f6'; // Solid Red vs Solid Blue

                          return (
                            <div key={index} style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: bgColor, borderLeft: `4px solid ${borderColor}`, borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', position: 'relative' }}>
                          

                              <strong>{block.startTime} - {block.endTime}</strong><br />
                              👨‍🏫 {tutorName} {isForced && <span style={{ color: '#ef4444', fontSize: '0.8em', fontWeight: 'bold' }}><br/>(Outside Availability)</span>}<br />
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
                    const isHovered = hoveredTutorId === tutor.id;

                    return (
                      <div 
                        key={tutor.id} 
                        onClick={() => setSelectedTutorModal(tutor)}
                        onMouseEnter={() => setHoveredTutorId(tutor.id)}
                        onMouseLeave={() => setHoveredTutorId(null)}
                        style={{ 
                          border: isHovered ? '2px solid #3b82f6' : '1px solid #e2e8f0', 
                          padding: '1.5rem', 
                          borderRadius: '8px', 
                          backgroundColor: isHovered ? '#f8fafc' : '#fff', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s ease', 
                          boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                          transform: isHovered ? 'translateY(-4px)' : 'none',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h3 style={{ marginTop: 0, color: '#1e293b' }}>{tutor.name}</h3>
                          <span style={{ color: isHovered ? '#3b82f6' : '#cbd5e1', fontSize: '1.2rem', transition: 'color 0.2s' }}>↗</span>
                        </div>

                        <p style={{ margin: '0 0 1rem 0', color: totalHours < tutor.minHours || totalHours > tutor.maxHours ? '#ef4444' : '#10b981' }}>
                          <strong>Scheduled: {totalHours} hrs</strong> (Target: {tutor.minHours}-{tutor.maxHours} hrs)
                        </p>
                        
                        <div style={{ flexGrow: 1 }}>
                          {tutorShifts.length === 0 ? (
                            <p style={{ color: 'gray', fontStyle: 'italic', margin: 0 }}>Not scheduled this week.</p>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569' }}>
                              {mergeShiftsForUI(tutorShifts).map((block, index) => (
                                <li key={index} style={{ marginBottom: '0.25rem' }}>
                                  <strong>{block.day}:</strong> {block.startTime} - {block.endTime}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div style={{ 
                          marginTop: '1.5rem', 
                          paddingTop: '1rem', 
                          borderTop: '1px solid #e2e8f0', 
                          color: '#3b82f6', 
                          fontSize: '0.9rem', 
                          fontWeight: 'bold', 
                          textAlign: 'center',
                          opacity: isHovered ? 1 : 0.7,
                          transition: 'opacity 0.2s'
                        }}>
                          Click to edit schedule
                        </div>
                      </div>
                    );
                  })}
                </div>

                <hr style={{ margin: '3rem 0' }} />

                <h2>3. Subject Coverage Matrix</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', paddingBottom: '3rem' }}>
                  {allSubjects.map(subject => {
                    const subjectShifts = schedule.filter(s => s.subjects.includes(subject));
                    const isHovered = hoveredSubject === subject;

                    return (
                      <div 
                        key={subject} 
                        onClick={() => setSelectedSubjectModal(subject)}
                        onMouseEnter={() => setHoveredSubject(subject)}
                        onMouseLeave={() => setHoveredSubject(null)}
                        style={{ 
                          border: isHovered ? '2px solid #10b981' : '1px solid #e2e8f0', 
                          padding: '1.5rem', 
                          borderRadius: '8px', 
                          backgroundColor: isHovered ? '#ecfdf5' : '#f8fafc', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s ease', 
                          boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
                          transform: isHovered ? 'translateY(-4px)' : 'none',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <h3 style={{ marginTop: 0, color: '#0f172a' }}>📚 {subject}</h3>
                          <span style={{ color: isHovered ? '#10b981' : '#cbd5e1', fontSize: '1.2rem', transition: 'color 0.2s' }}>↗</span>
                        </div>

                        <div style={{ flexGrow: 1, marginTop: '1rem' }}>
                          {subjectShifts.length === 0 ? (
                            <p style={{ color: '#ef4444', fontWeight: 'bold', margin: 0 }}>⚠️ No coverage this week!</p>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569' }}>
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

                        <div style={{ 
                          marginTop: '1.5rem', 
                          paddingTop: '1rem', 
                          borderTop: '1px solid #e2e8f0', 
                          color: '#10b981', 
                          fontSize: '0.9rem', 
                          fontWeight: 'bold', 
                          textAlign: 'center',
                          opacity: isHovered ? 1 : 0.7,
                          transition: 'opacity 0.2s'
                        }}>
                          Click to view coverage map
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* --- TUTOR DETAILS MODAL --- */}
                {selectedTutorModal && (
                  <TutorScheduleEditorModal 
                    tutor={selectedTutorModal}
                    currentSchedule={schedule.filter(s => s.tutorId === selectedTutorModal.id)}
                    onSave={(newShifts: Shift[]) => handleSaveTutorSchedule(selectedTutorModal.id, newShifts)}
                    onClose={() => setSelectedTutorModal(null)}
                  />
                )}

                {/* --- SUBJECT DETAILS MODAL --- */}
                {selectedSubjectModal && (
                  <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
                  }}>
                    <div style={{
                      backgroundColor: 'white', padding: '2rem', borderRadius: '8px',
                      maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0 }}>📚 {selectedSubjectModal} Coverage</h2>
                        <button 
                          onClick={() => setSelectedSubjectModal(null)}
                          style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}
                        >
                          &times;
                        </button>
                      </div>

                      <SubjectScheduleGrid 
                        subject={selectedSubjectModal} 
                        shifts={schedule.filter(s => s.subjects.includes(selectedSubjectModal))} 
                        roster={roster}
                      />

                    </div>
                  </div>
                )}
              </>
            } />

            {/* --- DEFAULT ROUTE --- */}
            <Route path="*" element={<Navigate to="/submit" replace />} />

          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;