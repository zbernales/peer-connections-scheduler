import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { generateSchedule, timeToFloat, floatToTime } from './utils/scheduler';
import { TutorForm } from './components/TutorForm';
import { RosterDashboard } from './components/RosterDashboard';
import { SavedSchedules } from './components/SavedSchedules'; 
import { collection, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore'; 
import { db } from './firebase';
import { TutorScheduleGrid } from './components/TutorScheduleGrid';
import { SubjectScheduleGrid } from './components/SubjectScheduleGrid';
import type { Tutor, DayOfWeek, ScheduleConfig, Shift } from './types';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const ADMIN_PIN = 'SJSU2026';

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

function format12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const hr12 = h % 12 || 12;
  const minStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
  return `${hr12}${minStr}${ampm}`;
}

function mergeShiftsForUI(shifts: any[]) {
  if (shifts.length === 0) return [];
  const merged = [];
  let currentBlock = { ...shifts[0], shiftIds: [shifts[0].id] };
  for (let i = 1; i < shifts.length; i++) {
    const nextShift = shifts[i];
    if (nextShift.day === currentBlock.day && nextShift.startTime === currentBlock.endTime && nextShift.tutorId === currentBlock.tutorId) {
      currentBlock.endTime = nextShift.endTime;
      currentBlock.shiftIds.push(nextShift.id); 
    } else {
      merged.push(currentBlock);
      currentBlock = { ...nextShift, shiftIds: [nextShift.id] };
    }
  }
  merged.push(currentBlock);
  return merged;
}

function getMergedWeeklySchedule(weeklyShifts: any[]) {
  if (weeklyShifts.length === 0) return [];
  const groupedByTutor = [...weeklyShifts].sort((a, b) => {
    if (a.tutorId !== b.tutorId) return a.tutorId.localeCompare(b.tutorId); 
    if (a.day !== b.day) return DAYS.indexOf(a.day) - DAYS.indexOf(b.day); 
    return timeToFloat(a.startTime) - timeToFloat(b.startTime); 
  });
  const mergedBlocks = mergeShiftsForUI(groupedByTutor);
  return mergedBlocks.sort((a, b) => {
    if (a.day !== b.day) return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    return timeToFloat(a.startTime) - timeToFloat(b.startTime);
  });
}

// --- Security Guard Wrapper for Admin Routes ---
function ProtectedRoute({ isAdmin, children }: { isAdmin: boolean, children: React.ReactNode }) {
  if (!isAdmin) {
    return <Navigate to="/submit" replace />;
  }
  return <>{children}</>;
}

// --- Login Screen ---
function LoginScreen({ onLogin }: { onLogin: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(pin);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0, textAlign: 'center', color: '#1e293b' }}>Admin Access</h2>
      <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem' }}>Enter the staff PIN to access the scheduling dashboard.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input 
          type="password" 
          value={pin} 
          onChange={(e) => setPin(e.target.value)} 
          placeholder="Enter PIN" 
          autoFocus
          style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1.1rem', textAlign: 'center', letterSpacing: '0.2rem' }} 
        />
        <button type="submit" style={{ padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' }}>
          Unlock Dashboard
        </button>
      </form>
    </div>
  );
}

function ScheduleHeatmap({ schedule, config }: { schedule: Shift[], config: ScheduleConfig }) {
  const times: number[] = [];
  for (let i = 9; i < 17; i += 0.5) {
    times.push(i);
  }

  const counts: Record<string, number> = {};
  schedule.forEach(shift => {
    const key = `${shift.day}-${timeToFloat(shift.startTime)}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  return (
    <div style={{ marginBottom: '3rem', backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: '#1e293b' }}>Coverage Heat Map</h3>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Darker green = Closer to maximum capacity ({config.tutorsPerHour} tutors)
        </span>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', width: '100px' }}>Time</th>
              {DAYS.map(day => (
                <th key={day} style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#1e293b' }}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map(t => (
              <tr key={t}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: '#64748b', borderRight: '2px solid #e2e8f0' }}>
                  {format12Hour(floatToTime(t))}
                </td>
                {DAYS.map(day => {
                  const count = counts[`${day}-${t}`] || 0;
                  
                  const intensity = count / config.tutorsPerHour;
                  
                  const bgColor = count === 0 
                    ? '#f8fafc' 
                    : `rgba(16, 185, 129, ${Math.max(0.15, intensity)})`;
                  
                  const textColor = intensity > 0.6 ? 'white' : '#1e293b';

                  return (
                    <td key={day} style={{ 
                      padding: '0.5rem', 
                      borderBottom: '1px solid #e2e8f0',
                      borderRight: '1px solid #e2e8f0',
                      backgroundColor: bgColor,
                      color: textColor,
                      transition: 'background-color 0.2s',
                      fontWeight: count > 0 ? 'bold' : 'normal'
                    }}>
                      {count > 0 ? count : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubjectCard({ subject, schedule, activeRoster, hoveredSubject, setHoveredSubject, setSelectedSubjectModal }: any) {
  const subjectShifts = schedule.filter((s: any) => s.subjects.includes(subject));
  const isHovered = hoveredSubject === subject;
  const mergedShifts = getMergedWeeklySchedule(subjectShifts);

  return (
    <div 
      onMouseEnter={() => setHoveredSubject(subject)}
      onMouseLeave={() => setHoveredSubject(null)}
      style={{ border: isHovered ? '2px solid #10b981' : '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '8px', backgroundColor: isHovered ? '#ecfdf5' : '#f8fafc', cursor: 'default', transition: 'all 0.2s ease', boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none', transform: isHovered ? 'translateY(-4px)' : 'none', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ marginTop: 0, color: '#0f172a' }}>📚 {subject}</h3>
        <span 
          onClick={() => setSelectedSubjectModal(subject)}
          style={{ color: isHovered ? '#10b981' : '#cbd5e1', fontSize: '1.2rem', transition: 'color 0.2s', cursor: 'pointer' }}
        >
          ↗
        </span>
      </div>
      <div style={{ flexGrow: 1, marginTop: '1rem' }}>
        {subjectShifts.length === 0 ? (
          <p style={{ color: '#ef4444', fontWeight: 'bold', margin: 0 }}>⚠️ No coverage this week!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: '#475569' }}>
            {DAYS.map(day => {
              const dayShifts = mergedShifts.filter((s: any) => s.day === day);
              if (dayShifts.length === 0) return null;

              return (
                <div key={day}>
                  <strong style={{ display: 'block', color: '#1e293b', marginBottom: '0.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.15rem' }}>{day}</strong>
                  {dayShifts.map((block: any, index: number) => {
                    const tutorName = activeRoster.find((t: any) => t.id === block.tutorId)?.name || 'Unknown';
                    return (
                      <div key={index} style={{ fontSize: '0.95rem', marginBottom: '0.15rem' }}>
                        {format12Hour(block.startTime)} - {format12Hour(block.endTime)}: <span style={{ color: '#3b82f6', fontWeight: '500' }}>{tutorName}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div 
        onClick={() => setSelectedSubjectModal(subject)}
        style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', color: '#10b981', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center', opacity: isHovered ? 1 : 0.7, transition: 'opacity 0.2s', cursor: 'pointer' }}
      >
        Click to view coverage map
      </div>
    </div>
  );
}

function TutorScheduleEditorModal({ tutor, currentSchedule, onSave, onClose }: any) {
  const [draftSlots, setDraftSlots] = useState<Set<string>>(new Set());

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
        <TutorScheduleGrid tutor={tutor} selectedSlots={draftSlots} onChange={setDraftSlots} />
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
          <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '1rem', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function NavBar({ hasUnsavedChanges, onDiscardChanges, isAdmin, onLogout }: { hasUnsavedChanges: boolean, onDiscardChanges: () => void, isAdmin: boolean, onLogout: () => void }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const handleNavClick = (e: React.MouseEvent) => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("You have a generated schedule that hasn't been saved! If you leave this page, your schedule will be lost. Are you sure you want to leave?");
      if (!confirmLeave) {
        e.preventDefault(); 
      } else {
        onDiscardChanges();
      }
    }
  };

  return (
    <nav style={{ backgroundColor: '#1e293b', padding: '1rem', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center', borderRadius: '0 0 8px 8px', marginBottom: '2rem' }}>
      <h2 style={{ margin: 0, marginRight: 'auto', color: 'white' }}>Peer Connections</h2>
      
      {/* Student Link - Always visible */}
      <Link onClick={handleNavClick} to="/submit" style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/submit' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}>
        Tutor Submission Form
      </Link>
      
      {/* Admin Links - Only visible if logged in */}
      {isAdmin ? (
        <>
          <Link onClick={handleNavClick} to="/admin" style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/admin' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}>
            Roster Dashboard
          </Link>
          <Link onClick={handleNavClick} to="/saved" style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/saved' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}>
            Saved Schedules
          </Link>
          <button onClick={onLogout} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Lock App
          </button>
        </>
      ) : (
        // Login Link - Visible to public (subtle styling so students ignore it)
        <Link to="/login" style={{ textDecoration: 'none', padding: '0.5rem 1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
          Admin Login
        </Link>
      )}
    </nav>
  );
}

function App() {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('peerConnectionsAdmin') === 'true';
  });

  const navigate = useNavigate();

  const handleLogin = (pin: string) => {
    if (pin === ADMIN_PIN) {
      localStorage.setItem('peerConnectionsAdmin', 'true');
      setIsAdmin(true);
      navigate('/admin'); 
    } else {
      alert('Incorrect PIN.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('peerConnectionsAdmin');
    setIsAdmin(false);
    navigate('/submit'); 
  };

  const [globalRoster, setGlobalRoster] = useState<Tutor[]>([]);
  const [activeRoster, setActiveRoster] = useState<Tutor[]>([]); 

  const [selectedTutorModal, setSelectedTutorModal] = useState<Tutor | null>(null);
  const [hoveredTutorId, setHoveredTutorId] = useState<string | null>(null);
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);
  const [selectedSubjectModal, setSelectedSubjectModal] = useState<string | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    tutorsPerHour: 8,
    maxConsecutiveHours: 3,
    minCooldownHours: 1,
    maxHoursPerDay: 4,
    minHoursPerShift: 1,
    maxHoursPerWeek: 6
  });

  const [schedule, setSchedule] = useState<Shift[]>([]);
  const [activeScheduleMeta, setActiveScheduleMeta] = useState<{id: string, name: string} | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const [tutorSearchQuery, setTutorSearchQuery] = useState(''); 
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());

  const hasUnsavedChanges = schedule.length > 0 && activeScheduleMeta === null;

  const handleDiscardUnsavedChanges = () => {
    setSchedule([]);
    setActiveRoster([]);
    setActiveScheduleMeta(null);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tutors'), (snapshot) => {
      const tutorsData = snapshot.docs.map(doc => doc.data() as Tutor);
      setGlobalRoster(tutorsData); 
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!activeScheduleMeta || schedule.length === 0) return;

    setSaveStatus('Saving...');
    const timeoutId = setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'schedules', activeScheduleMeta.id), {
          shifts: schedule,
          roster: activeRoster,
          updatedAt: Date.now() 
        });
        setSaveStatus('Saved');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSaveStatus('Error saving');
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [schedule, activeRoster, activeScheduleMeta]);
  
  const handleGenerateSchedule = () => {
    const generated = generateSchedule(globalRoster, scheduleConfig);
    setSchedule(generated);
    setActiveRoster(globalRoster); 
    setSelectedTutorModal(null);
    setActiveScheduleMeta(null); 
  };

  const handleSaveTutorSchedule = (tutorId: string, newTutorShifts: Shift[]) => {
    setSchedule(prevSchedule => {
      const filteredSchedule = prevSchedule.filter(s => s.tutorId !== tutorId);
      return [...filteredSchedule, ...newTutorShifts];
    });
    setSelectedTutorModal(null); 
  };

  const handleSaveAsNew = async () => {
    if (schedule.length === 0) {
      alert("There is no schedule to save! Generate one first.");
      return;
    }

    const scheduleName = window.prompt("Enter a name for this schedule:");
    if (!scheduleName) return; 

    try {
      const docRef = await addDoc(collection(db, 'schedules'), {
        name: scheduleName,
        createdAt: Date.now(),
        shifts: schedule,
        roster: activeRoster 
      });
      setActiveScheduleMeta({ id: docRef.id, name: scheduleName });
      alert(`"${scheduleName}" has been securely saved to the database!`);
    } catch (error) {
      console.error("Error saving schedule:", error);
      alert("Failed to save schedule.");
    }
  };

  const handleRemoveTutorFromSchedule = (tutorId: string, tutorName: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    
    if (window.confirm(`Are you sure you want to remove ${tutorName} from this schedule? This will also delete all of their assigned shifts.`)) {
      setActiveRoster(prev => prev.filter(t => t.id !== tutorId));
      setSchedule(prev => prev.filter(s => s.tutorId !== tutorId));
    }
  };

  const missingTutors = globalRoster.filter(globalTutor => 
    !activeRoster.some(activeTutor => activeTutor.id === globalTutor.id)
  );

  const allSubjects = Array.from(
    new Set(activeRoster.flatMap(tutor => tutor.subjects))
  ).sort();

  const toggleDepartment = (dept: string) => {
    setExpandedDepartments(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const subjectsByDept = allSubjects.reduce((acc, subject) => {
    const prefix = subject.split(' ')[0]; 
    const deptName = DEPARTMENT_NAMES[prefix] || prefix; 
    
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(subject);
    return acc;
  }, {} as Record<string, string[]>);

  const filteredSubjects = allSubjects.filter(sub => 
    sub.toLowerCase().includes(subjectSearchQuery.toLowerCase())
  );

  const filteredTutors = activeRoster.filter(tutor => 
    tutor.name.toLowerCase().includes(tutorSearchQuery.toLowerCase())
  );

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', boxSizing: 'border-box' }}>
    
      <NavBar hasUnsavedChanges={hasUnsavedChanges} onDiscardChanges={handleDiscardUnsavedChanges} isAdmin={isAdmin} onLogout={handleLogout} />

      <div style={{ padding: '0 2rem 2rem 2rem' }}>
        <Routes>
          
          <Route path="/submit" element={
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
              <TutorForm onSubmit={(newTutor) => {
                alert(`${newTutor.name}'s availability has been submitted.`);
              }} />
            </div>
          } />

          <Route path="/login" element={
            isAdmin ? <Navigate to="/admin" replace /> : <LoginScreen onLogin={handleLogin} />
          } />

          {/* --- UPDATED: Admin Routes wrapped in ProtectedRoute --- */}
          <Route path="/admin" element={
            <ProtectedRoute isAdmin={isAdmin}>
              <RosterDashboard 
                roster={globalRoster} 
                config={scheduleConfig} 
                onConfigChange={setScheduleConfig}
                onSelectTutor={setSelectedTutorModal}
                onGenerate={handleGenerateSchedule} 
              />
            </ProtectedRoute>
          } />

          <Route path="/saved" element={
            <ProtectedRoute isAdmin={isAdmin}>
              <SavedSchedules onLoadSchedule={(id, name, loadedShifts, loadedRoster) => {
                setSchedule(loadedShifts);
                setActiveRoster(loadedRoster && loadedRoster.length > 0 ? loadedRoster : globalRoster);
                setSelectedTutorModal(null);
                setActiveScheduleMeta({ id, name }); 
              }} />
            </ProtectedRoute>
          } />

          <Route path="/schedule" element={
            <ProtectedRoute isAdmin={isAdmin}>
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h1>Master Schedule Dashboard</h1>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    
                    {activeScheduleMeta ? (
                      <>
                        <span style={{ fontSize: '0.95rem', color: '#64748b', marginRight: '0.5rem', fontStyle: 'italic' }}>
                          Editing: <strong>{activeScheduleMeta.name}</strong> 
                          {saveStatus && <span style={{ marginLeft: '6px', color: saveStatus === 'Error saving' ? '#ef4444' : '#10b981' }}>({saveStatus})</span>}
                        </span>
                        
                        <button onClick={handleSaveAsNew} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>📝 Save as New</button>
                      </>
                    ) : (
                      <button onClick={handleSaveAsNew} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>💾 Save to Database</button>
                    )}

                    {missingTutors.length > 0 && (
                      <select 
                        value="" 
                        onChange={(e) => {
                          const tId = e.target.value;
                          const tutorToImport = globalRoster.find(x => x.id === tId);
                          if (tutorToImport) {
                            setActiveRoster([...activeRoster, tutorToImport]);
                          }
                        }}
                        style={{ padding: '0.5rem', borderRadius: '20px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#3b82f6', cursor: 'pointer' }}
                      >
                        <option value="" disabled>+ Import Missing Tutor</option>
                        {missingTutors.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    
                    <span style={{ backgroundColor: '#e2e8f0', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                      Total Tutors: {activeRoster.length}
                    </span>
                  </div>
                </div>
                
                <hr style={{ margin: '1rem 0 2rem 0' }} />
                <h2>Tutor Breakdowns</h2>

                <div style={{ marginBottom: '1.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="🔍 Search for a specific tutor..." 
                    value={tutorSearchQuery}
                    onChange={(e) => setTutorSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {filteredTutors.length > 0 ? (
                    filteredTutors.map(tutor => {
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
                          onMouseEnter={() => setHoveredTutorId(tutor.id)}
                          onMouseLeave={() => setHoveredTutorId(null)}
                          style={{ border: isHovered ? '2px solid #3b82f6' : '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '8px', backgroundColor: isHovered ? '#f8fafc' : '#fff', cursor: 'default', transition: 'all 0.2s ease', boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0,0,0,0.05)', transform: isHovered ? 'translateY(-4px)' : 'none', display: 'flex', flexDirection: 'column' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <h3 style={{ marginTop: 0, color: '#1e293b' }}>{tutor.name}</h3>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <button
                                onClick={(e) => handleRemoveTutorFromSchedule(tutor.id, tutor.name, e)}
                                style={{ 
                                  background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.1rem',
                                  opacity: isHovered ? 0.7 : 0, transition: 'opacity 0.2s', padding: 0
                                }}
                                title="Remove from Schedule"
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                              >
                                🗑️
                              </button>
                              <span 
                                onClick={() => setSelectedTutorModal(tutor)}
                                style={{ color: isHovered ? '#3b82f6' : '#cbd5e1', fontSize: '1.2rem', transition: 'color 0.2s', cursor: 'pointer' }}
                              >
                                ↗
                              </span>
                            </div>
                          </div>
                          <p style={{ margin: '0 0 1rem 0', color: totalHours < tutor.minHours || totalHours > tutor.maxHours ? '#ef4444' : '#10b981' }}>
                            <strong>Scheduled: {totalHours} hrs</strong> (Target: {tutor.minHours}-{tutor.maxHours} hrs)
                          </p>
                          <div style={{ flexGrow: 1 }}>
                            {tutorShifts.length === 0 ? (
                              <p style={{ color: 'gray', fontStyle: 'italic', margin: 0 }}>Not scheduled this week.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: '#475569' }}>
                                {DAYS.map(day => {
                                  const shiftsForThisDay = mergeShiftsForUI(tutorShifts).filter(s => s.day === day);
                                  if (shiftsForThisDay.length === 0) return null;
                                  return (
                                    <div key={day}>
                                      <strong style={{ display: 'block', color: '#1e293b', marginBottom: '0.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.15rem' }}>{day}</strong>
                                      {shiftsForThisDay.map((block: any, index: number) => (
                                        <div key={index} style={{ fontSize: '0.95rem', marginBottom: '0.15rem' }}>
                                          {format12Hour(block.startTime)} - {format12Hour(block.endTime)}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div 
                            onClick={() => setSelectedTutorModal(tutor)}
                            style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', color: '#3b82f6', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center', opacity: isHovered ? 1 : 0.7, transition: 'opacity 0.2s', cursor: 'pointer' }}
                          >
                            Click to edit schedule
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ color: '#64748b', fontStyle: 'italic', gridColumn: '1 / -1' }}>No tutors match your search.</p>
                  )}
                </div>
                
                {schedule.length > 0 && (
                  <ScheduleHeatmap schedule={schedule} config={scheduleConfig} />
                )}

                <hr style={{ margin: '3rem 0' }} />

                <h2>Subject Coverage</h2>

                <div style={{ marginBottom: '1.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="🔍 Search for a specific class (e.g., CS 146, Math)..." 
                    value={subjectSearchQuery}
                    onChange={(e) => setSubjectSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                  />
                </div>

                {subjectSearchQuery ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', paddingBottom: '3rem' }}>
                    {filteredSubjects.length > 0 ? (
                      filteredSubjects.map(subject => (
                        <SubjectCard key={subject} subject={subject} schedule={schedule} activeRoster={activeRoster} hoveredSubject={hoveredSubject} setHoveredSubject={setHoveredSubject} setSelectedSubjectModal={setSelectedSubjectModal} />
                      ))
                    ) : (
                      <p style={{ color: '#64748b', fontStyle: 'italic', gridColumn: '1 / -1' }}>No subjects match your search.</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '3rem' }}>
                    {Object.entries(subjectsByDept).sort().map(([dept, deptSubjects]) => {
                      const isExpanded = expandedDepartments.has(dept);
                      return (
                        <div key={dept} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'white', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          
                          <button 
                            onClick={() => toggleDepartment(dept)}
                            style={{ width: '100%', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isExpanded ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background-color 0.2s' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>{dept}</h3>
                              <span style={{ backgroundColor: '#e2e8f0', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>
                                {deptSubjects.length} classes
                              </span>
                            </div>
                            <span style={{ fontSize: '1.2rem', color: '#64748b', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
                              ▼
                            </span>
                          </button>

                          {isExpanded && (
                            <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {deptSubjects.map(subject => (
                                  <SubjectCard key={subject} subject={subject} schedule={schedule} activeRoster={activeRoster} hoveredSubject={hoveredSubject} setHoveredSubject={setHoveredSubject} setSelectedSubjectModal={setSelectedSubjectModal} />
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedTutorModal && (
                  <TutorScheduleEditorModal 
                    tutor={selectedTutorModal}
                    currentSchedule={schedule.filter(s => s.tutorId === selectedTutorModal.id)}
                    onSave={(newShifts: Shift[]) => handleSaveTutorSchedule(selectedTutorModal.id, newShifts)}
                    onClose={() => setSelectedTutorModal(null)}
                  />
                )}

                {selectedSubjectModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h2 style={{ margin: 0 }}>📚 {selectedSubjectModal} Coverage</h2>
                        <button onClick={() => setSelectedSubjectModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
                      </div>
                      <SubjectScheduleGrid subject={selectedSubjectModal} shifts={schedule.filter(s => s.subjects.includes(selectedSubjectModal))} roster={activeRoster} />
                    </div>
                  </div>
                )}

              </>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/submit" replace />} />

        </Routes>
      </div>
    </div>
  );
}

export default function AppEntry() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}