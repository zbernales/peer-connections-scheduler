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
import { AdminCoursesPage } from './components/AdminCoursesPage';
import { ScheduleGenerationPage } from './components/ScheduleGenerationPage';
import type { Tutor, DayOfWeek, ScheduleConfig, Shift } from './types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

function ProtectedRoute({ isAdmin, children }: { isAdmin: boolean, children: React.ReactNode }) {
  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function LoginScreen({ onLogin, showErrorToast }: { onLogin: (pin: string) => void, showErrorToast: (msg: string) => void }) {
  const [pin, setPin] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== ADMIN_PIN) {
      showErrorToast('Incorrect PIN.');
    }
    onLogin(pin);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '2rem', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0, textAlign: 'center', color: '#1e293b' }}>Admin Access</h2>
      <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem' }}>Enter the staff PIN to access the scheduling dashboard.</p>
      <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input 
          type="password" 
          value={pin} 
          onChange={(e) => setPin(e.target.value)} 
          placeholder="Enter PIN" 
          autoComplete="new-password"
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

function SectionHeader({ title, isOpen, onToggle }: { title: string, isOpen: boolean, onToggle: () => void }) {
  return (
    <div 
      onClick={onToggle}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '1rem 1.5rem', borderRadius: '8px', marginBottom: isOpen ? '1.5rem' : '0', border: '1px solid #e2e8f0', transition: 'background-color 0.2s', userSelect: 'none' }}
    >
      <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>{title}</h2>
      <span style={{ fontSize: '1.2rem', color: '#64748b', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
        ▼
      </span>
    </div>
  );
}

function ScheduleHeatmap({ schedule, config }: { schedule: Shift[], config: ScheduleConfig }) {
  const ALL_DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const times: number[] = [];
  for (let i = 9; i < 22; i += 0.5) {
    times.push(i);
  }

  const counts: Record<string, number> = {};
  schedule.forEach(shift => {
    const key = `${shift.day}-${timeToFloat(shift.startTime)}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  return (
    <div style={{ marginBottom: '3rem', backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Darker green = Closer to maximum capacity
        </span>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem', borderBottom: '2px solid #cbd5e1', color: '#475569', width: '100px' }}>Time</th>
              {ALL_DAYS.map(day => (
                <th key={day} style={{ 
                  padding: '0.75rem', 
                  borderBottom: '2px solid #cbd5e1', 
                  color: '#1e293b',
                  borderLeft: day === 'Saturday' ? '3px solid #334155' : 'none' 
                }}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map(t => {
              const isNightStart = t === 17;

              return (
                <tr key={t}>
                  <td style={{ 
                    padding: '0.5rem', 
                    borderBottom: '1px solid #e2e8f0', 
                    fontWeight: 'bold', 
                    color: '#64748b', 
                    borderRight: '2px solid #e2e8f0',
                  }}>
                    {format12Hour(floatToTime(t))}
                  </td>
                  {ALL_DAYS.map(day => {
                    const count = counts[`${day}-${t}`] || 0;
                    
                    let activeCap = config.tutorsPerHour;
                    if (t >= 17) activeCap = config.maxTutorsPerNightShift || 2;
                    if (day === 'Saturday' || day === 'Sunday') activeCap = config.maxTutorsPerWeekendShift || 2;
                    
                    const intensity = count / activeCap;
                    const bgColor = count === 0 ? '#f8fafc' : `rgba(16, 185, 129, ${Math.max(0.15, intensity)})`;
                    const textColor = intensity > 0.6 ? 'white' : '#1e293b';

                    const isWeekday = day !== 'Saturday' && day !== 'Sunday';

                    return (
                      <td key={day} style={{ 
                        padding: '0.5rem', 
                        borderBottom: '1px solid #e2e8f0',
                        borderRight: '1px solid #e2e8f0',
                        borderLeft: day === 'Saturday' ? '3px solid #334155' : 'none',
                        borderTop: (isNightStart && isWeekday) ? '3px solid #334155' : 'none', 
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SubjectCard({ subject, schedule, activeRoster, hoveredSubject, setHoveredSubject, setSelectedSubjectModal }: any) {
  
  // 1. Copy State
  const [isCopied, setIsCopied] = useState(false);

  // 2. Existing Variables
  const isHovered = hoveredSubject === subject;
  const subjectShifts = schedule.filter((s: any) => s.subjects.includes(subject));
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  // RESTORED: This merges 30-min blocks into clean, contiguous shifts!
  const mergedShifts = getMergedWeeklySchedule(subjectShifts); 

  // 3. Copy Function Logic
  const handleCopySubject = (e: React.MouseEvent) => {
    e.stopPropagation();

    let text = `${subject} Coverage Schedule\n\n`;

    if (subjectShifts.length === 0) {
      text += "No coverage scheduled.\n";
    } else {
      const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      ALL_DAYS.forEach(day => {
        const dayShifts = mergedShifts.filter((s: any) => s.day === day);
        if (dayShifts.length > 0) {
          text += `${day}:\n`;
          dayShifts.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
          
          dayShifts.forEach((shift: any) => {
            const tutor = activeRoster.find((t: any) => t.id === shift.tutorId);
            const tutorName = tutor ? tutor.name : 'Unknown Educator';
            const role = tutor && tutor.role ? tutor.role : 'Tutor';
            text += `- ${format12Hour(shift.startTime)} to ${format12Hour(shift.endTime)} (${tutorName}, ${role})\n`;
          });
          text += '\n';
        }
      });
    }

    const textArea = document.createElement("textarea");
    textArea.value = text.trim();
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy subject schedule', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div 
      onMouseEnter={() => setHoveredSubject(subject)}
      onMouseLeave={() => setHoveredSubject(null)}
      style={{ border: isHovered ? '2px solid #10b981' : '1px solid #e2e8f0', padding: '1.5rem', borderRadius: '8px', backgroundColor: isHovered ? '#ecfdf5' : '#f8fafc', cursor: 'default', transition: 'all 0.2s ease', boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none', transform: isHovered ? 'translateY(-4px)' : 'none', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ marginTop: 0, color: '#0f172a' }}>{subject}</h3>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          
          {/* --- COPY BUTTON --- */}
          <button
            onClick={handleCopySubject}
            style={{ 
              background: 'none', border: 'none', 
              color: isCopied ? '#10b981' : '#64748b', 
              cursor: 'pointer', fontSize: '1.1rem',
              opacity: (isHovered || isCopied) ? 1 : 0, 
              transition: 'all 0.2s', padding: 0
            }}
            title={`Copy ${subject} Coverage to Clipboard`}
          >
            {isCopied ? (
              // Modern Checkmark SVG
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              // Modern Copy/Clipboard SVG
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
          
          <span 
            onClick={() => setSelectedSubjectModal(subject)}
            style={{ color: isHovered ? '#10b981' : '#cbd5e1', fontSize: '1.2rem', transition: 'color 0.2s', cursor: 'pointer' }}
          >
            ↗
          </span>
        </div>
      </div>
      
      <div style={{ flexGrow: 1, marginTop: '1rem' }}>
        {subjectShifts.length === 0 ? (
          <p style={{ color: '#ef4444', fontWeight: 'bold', margin: 0 }}>No coverage scheduled</p>
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

  // Check if they initially submitted night/weekend availability
  const initiallyHasNight = tutor.availability.some((slot: any) => 
    timeToFloat(slot.endTime) > 17 && slot.day !== 'Saturday' && slot.day !== 'Sunday'
  );
  const initiallyHasWeekend = tutor.availability.some((slot: any) => 
    slot.day === 'Saturday' || slot.day === 'Sunday'
  );

  // Initialize from localStorage, falling back to initial availability
  const [showNight, setShowNight] = useState(() => {
    const saved = localStorage.getItem(`admin-pref-night-${tutor.id}`);
    return saved !== null ? JSON.parse(saved) : initiallyHasNight;
  });

  const [showWeekend, setShowWeekend] = useState(() => {
    const saved = localStorage.getItem(`admin-pref-weekend-${tutor.id}`);
    return saved !== null ? JSON.parse(saved) : initiallyHasWeekend;
  });

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`admin-pref-night-${tutor.id}`, JSON.stringify(showNight));
  }, [showNight, tutor.id]);

  useEffect(() => {
    localStorage.setItem(`admin-pref-weekend-${tutor.id}`, JSON.stringify(showWeekend));
  }, [showWeekend, tutor.id]);

  const activeEndHour = showNight ? 22 : 17; 
  const activeDays = showWeekend 
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    const initialSet = new Set<string>();
    currentSchedule.forEach((shift: any) => {
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
    const newShifts: any[] = Array.from(draftSlots).map(slot => {
      const [day, startTime] = slot.split('-');
      const endTime = floatToTime(timeToFloat(startTime) + 0.5);
      return {
        id: crypto.randomUUID(),
        tutorId: tutor.id,
        subjects: tutor.subjects,
        day: day,
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
        
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 0.5rem 0' }}><strong>Subjects:</strong> {tutor.subjects.join(', ')}</p>
            <p style={{ margin: '0 0 1rem 0' }}><strong>Hours Target:</strong> {tutor.minHours} - {tutor.maxHours} hrs/week</p>
            
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#475569' }}>
                <input 
                  type="checkbox" 
                  checked={showNight}
                  onChange={(e) => setShowNight(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Show night availability
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#475569' }}>
                <input 
                  type="checkbox" 
                  checked={showWeekend}
                  onChange={(e) => setShowWeekend(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Show weekend availability
              </label>
            </div>
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
          endHour={activeEndHour} 
          days={activeDays}
        />
        
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
  const navigate = useNavigate();

  // --- NEW: Custom Discard Modal State ---
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const handleNavClick = (e: React.MouseEvent, targetPath: string) => {
    if (hasUnsavedChanges && currentPath !== targetPath) {
      e.preventDefault(); 
      setPendingAction(targetPath); // Open modal instead of navigating
    }
  };

  const confirmDiscard = () => {
    onDiscardChanges();
    if (pendingAction) {
      navigate(pendingAction);
    }
    setPendingAction(null);
  };

  return (
    <>
      <nav style={{ backgroundColor: '#1e293b', padding: '1rem', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center', borderRadius: '0 0 8px 8px', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, marginRight: 'auto', color: 'white' }}>Peer Connections</h2>
        
        <Link onClick={(e) => handleNavClick(e, '/submit')} to="/submit" style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/submit' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}>
          Submission Form
        </Link>
        
        {isAdmin && (
          <>
            <Link onClick={(e) => handleNavClick(e, '/generate')} to="/generate" style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/generate' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}>
              Schedule Generator
            </Link>
            <Link onClick={(e) => handleNavClick(e, '/admin')} to="/admin" style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/admin' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}>
              Roster Dashboard
            </Link>
            <Link onClick={(e) => handleNavClick(e, '/courses')} to="/courses" style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/courses' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}>
              Course Catalog
            </Link>
            <Link onClick={(e) => handleNavClick(e, '/saved')} to="/saved" style={{ textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: currentPath === '/saved' ? '#3b82f6' : 'transparent', color: 'white', border: '1px solid #3b82f6', borderRadius: '4px' }}>
              Saved Schedules
            </Link>
            
            {/* --- RESTORED: Log Out Button --- */}
            <button onClick={onLogout} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Log Out
            </button>
          </>
        )}
      </nav>

      {/* --- NEW: Custom Discard Confirmation Modal --- */}
      {pendingAction && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '450px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.4rem' }}>Unsaved Changes</h3>
            <p style={{ color: '#475569', marginBottom: '2rem', lineHeight: '1.5' }}>
              You have a generated schedule that hasn't been saved! If you leave this page, your current schedule draft will be permanently lost.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setPendingAction(null)} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDiscard} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Leave & Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  // Session is forgotten on refresh by relying on basic state without localStorage
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const navigate = useNavigate();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastType('success');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showErrorToast = (message: string) => {
    setToastMessage(message);
    setToastType('error');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const location = useLocation();
  const showNavbar = location.pathname !== "/login";

  const handleLogin = (pin: string) => {
    if (pin === ADMIN_PIN) {
      setIsAdmin(true);
      navigate('/admin'); 
    } else {
      showErrorToast('Incorrect PIN.'); // Using custom toast instead of alert
    }
  };

  // --- RESTORED: handleLogout function ---
  const handleLogout = () => {
    setIsAdmin(false);
    navigate('/submit'); 
  };

  const [globalRoster, setGlobalRoster] = useState<Tutor[]>([]);
  const [activeRoster, setActiveRoster] = useState<Tutor[]>(() => {
    const saved = localStorage.getItem('activeRoster');
    return saved ? JSON.parse(saved) : [];
  });

  const [isTutorsOpen, setIsTutorsOpen] = useState(true);
  const [isHeatmapOpen, setIsHeatmapOpen] = useState(true);
  const [isSubjectsOpen, setIsSubjectsOpen] = useState(true);

  const [selectedTutorModal, setSelectedTutorModal] = useState<Tutor | null>(null);
  const [hoveredTutorId, setHoveredTutorId] = useState<string | null>(null);
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);
  const [selectedSubjectModal, setSelectedSubjectModal] = useState<string | null>(null);
  
  // --- NEW App-Level Modals ---
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');
  const [tutorToRemove, setTutorToRemove] = useState<{id: string, name: string} | null>(null);
  const [isProcessingSave, setIsProcessingSave] = useState(false);

  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    tutorsPerHour: 8,
    maxConsecutiveHours: 3,
    minCooldownHours: 1,
    maxHoursPerDay: 4,
    minHoursPerShift: 1,
    maxHoursPerWeek: 6
  });

  const [schedule, setSchedule] = useState<Shift[]>(() => {
    const saved = localStorage.getItem('activeSchedule');
    return saved ? JSON.parse(saved) : [];
  });
 const [activeScheduleMeta, setActiveScheduleMeta] = useState<{id: string, name: string} | null>(() => {
    const saved = localStorage.getItem('activeScheduleMeta');
    return saved ? JSON.parse(saved) : null;
  });

  const [saveStatus, setSaveStatus] = useState<string>('');

  const [tutorSearchQuery, setTutorSearchQuery] = useState(''); 
  const [tutorSubjectFilter, setTutorSubjectFilter] = useState('');
  const [tutorNightFilter, setTutorNightFilter] = useState(false);
  const [tutorWeekendFilter, setTutorWeekendFilter] = useState(false);

  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  const hasUnsavedChanges = schedule.length > 0 && activeScheduleMeta === null;

  const handleDiscardUnsavedChanges = () => {
    setSchedule([]);
    setActiveRoster([]);
    setActiveScheduleMeta(null);
    setTutorSearchQuery('');
    setTutorSubjectFilter('');
    setTutorNightFilter(false);
    setSubjectSearchQuery('');
    setExpandedDepartments(new Set());
  };

   // --- LOCAL STORAGE BACKUP HOOKS ---
  useEffect(() => {
    if (activeRoster.length > 0) {
      localStorage.setItem('activeRoster', JSON.stringify(activeRoster));
    } else {
      localStorage.removeItem('activeRoster');
    }
  }, [activeRoster]);

  useEffect(() => {
    if (schedule.length > 0) {
      localStorage.setItem('activeSchedule', JSON.stringify(schedule));
    } else {
      localStorage.removeItem('activeSchedule');
    }
  }, [schedule]);

  useEffect(() => {
    if (activeScheduleMeta) {
      localStorage.setItem('activeScheduleMeta', JSON.stringify(activeScheduleMeta));
    } else {
      localStorage.removeItem('activeScheduleMeta');
    }
  }, [activeScheduleMeta]);
  
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
    const allowedRoles = scheduleConfig.allowedRoles || ['Tutor', 'SI Leader', 'Mentor'];
    const filteredRoster = globalRoster.filter(tutor => {
      const role = (tutor as any).role || 'Tutor';
      return allowedRoles.includes(role);
    });
    const generated = generateSchedule(filteredRoster, scheduleConfig);
    setSchedule(generated);
    setActiveRoster(filteredRoster); 
    setSelectedTutorModal(null);
    setActiveScheduleMeta(null); 
    setTutorSearchQuery('');
    setTutorSubjectFilter('');
    setTutorNightFilter(false);
    setSubjectSearchQuery('');
    setExpandedDepartments(new Set());
    setIsTutorsOpen(true);
    setIsHeatmapOpen(true);
    setIsSubjectsOpen(true);
  };

  const handleSaveTutorSchedule = (tutorId: string, newTutorShifts: Shift[]) => {
    setSchedule(prevSchedule => {
      const filteredSchedule = prevSchedule.filter(s => s.tutorId !== tutorId);
      return [...filteredSchedule, ...newTutorShifts];
    });
    setSelectedTutorModal(null); 
  };

  // --- NEW: Save As New Modal Logic ---
  const handleSaveClick = () => {
    if (schedule.length === 0) {
      showErrorToast("There is no schedule to save! Generate one first.");
      return;
    }
    setSaveNameInput('');
    setIsSaveModalOpen(true);
  };

  const confirmSaveAsNew = async () => {
    if (!saveNameInput.trim()) return;

    setIsProcessingSave(true);
    try {
      const docRef = await addDoc(collection(db, 'schedules'), {
        name: saveNameInput.trim(),
        createdAt: Date.now(),
        shifts: schedule,
        roster: activeRoster 
      });
      setActiveScheduleMeta({ id: docRef.id, name: saveNameInput.trim() });
      showToast(`"${saveNameInput.trim()}" has been securely saved!`);
      setIsSaveModalOpen(false);
    } catch (error) {
      console.error("Error saving schedule:", error);
      showErrorToast("Failed to save schedule.");
    } finally {
      setIsProcessingSave(false);
    }
  };

  const [copiedTutorId, setCopiedTutorId] = useState<string | null>(null);

  const handleCopySchedule = (tutor: any, tutorShifts: any[], totalHours: number, e: React.MouseEvent) => {
    e.stopPropagation();

    let text = `Schedule for ${tutor.name}\n`;
    text += `Total Hours: ${totalHours}\n\n`;

    if (tutorShifts.length === 0) {
      text += "No shifts scheduled.\n";
    } else {
      DAYS.forEach(day => {
        const shiftsForThisDay = mergeShiftsForUI(tutorShifts).filter((s: any) => s.day === day);
        if (shiftsForThisDay.length > 0) {
          text += `${day}:\n`;
          shiftsForThisDay.forEach((block: any) => {
            text += `${format12Hour(block.startTime)} - ${format12Hour(block.endTime)}\n`;
          });
          text += '\n';
        }
      });
    }

    const textArea = document.createElement("textarea");
    textArea.value = text.trim();
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedTutorId(tutor.id);
      showToast('Schedule copied to clipboard!'); // Polish: Add toast confirming copy
      setTimeout(() => setCopiedTutorId(null), 2000); 
    } catch (err) {
      console.error('Failed to copy schedule', err);
      showErrorToast("Failed to copy schedule.");
    }
    document.body.removeChild(textArea);
  };

  // --- NEW: Remove Tutor Modal Logic ---
  const handleRemoveTutorClick = (tutorId: string, tutorName: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setTutorToRemove({ id: tutorId, name: tutorName });
  };

  const confirmRemoveTutor = () => {
    if (!tutorToRemove) return;
    setActiveRoster(prev => prev.filter(t => t.id !== tutorToRemove.id));
    setSchedule(prev => prev.filter(s => s.tutorId !== tutorToRemove.id));
    showToast(`${tutorToRemove.name} removed from the schedule.`);
    setTutorToRemove(null);
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

  const filteredTutors = activeRoster.filter(tutor => {
    const matchesName = tutor.name.toLowerCase().includes(tutorSearchQuery.toLowerCase());
    const matchesSubject = tutorSubjectFilter === '' || tutor.subjects.includes(tutorSubjectFilter);
    
    const hasNightAvailability = tutor.availability.some(slot => timeToFloat(slot.endTime) > 17);
    const matchesNight = !tutorNightFilter || hasNightAvailability;

    const hasWeekendAvailability = tutor.availability.some(slot => slot.day === 'Saturday' || slot.day === 'Sunday');
    const matchesWeekend = !tutorWeekendFilter || hasWeekendAvailability;

    return matchesName && matchesSubject && matchesNight && matchesWeekend;
  });

  const executeExport = async (exportFn: (safeName: string, rawName: string) => void) => {
    setShowExportModal(false);
    let sName: string | undefined | null = activeScheduleMeta?.name;

    if (!sName) {
      // Replaced ugly prompt chain with simple error toast
      showErrorToast("Please click 'Save to Database' to name and save this schedule before exporting.");
      return; 
    }

    const safeName = sName.replace(/[^a-z0-9]+/gi, '_').replace(/(^_|_$)/g, '').toLowerCase();
    exportFn(safeName, sName);
  };

  const getExportData = () => {
    const mergedShifts = getMergedWeeklySchedule(schedule);
    const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedShifts = [...mergedShifts].sort((a, b) => {
      if (a.day !== b.day) return ALL_DAYS.indexOf(a.day) - ALL_DAYS.indexOf(b.day);
      return a.startTime.localeCompare(b.startTime);
    });

    return sortedShifts.map(shift => {
      const tutor = activeRoster.find(t => t.id === shift.tutorId);
      return {
        Day: shift.day,
        'Start Time': format12Hour(shift.startTime),
        'End Time': format12Hour(shift.endTime),
        'Educator Name': tutor ? tutor.name : 'Unknown',
        Role: tutor && (tutor as any).role ? (tutor as any).role : 'Tutor',
        Subjects: shift.subjects.join(" | ")
      };
    });
  };

  const handleExportCSV = (safeName: string) => {
    const data = getExportData();
    let csvContent = "Day,Start Time,End Time,Educator Name,Role,Subjects\n";
    data.forEach(row => {
      csvContent += `"${row.Day}","${row['Start Time']}","${row['End Time']}","${row['Educator Name']}","${row.Role}","${row.Subjects}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${safeName}_master_schedule.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = (safeName: string) => {
    const data = getExportData();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");
    XLSX.writeFile(workbook, `${safeName}_master_schedule.xlsx`);
  };

  const handleExportPDF = (safeName: string, rawName: string) => {
    const data = getExportData();
    const doc = new jsPDF();
    doc.text(`${rawName} - Master Schedule`, 14, 15);
    const tableData = data.map(row => [row.Day, row['Start Time'], row['End Time'], row['Educator Name'], row.Role, row.Subjects]);
    autoTable(doc, {
      head: [['Day', 'Start Time', 'End Time', 'Educator Name', 'Role', 'Subjects']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] }
    });
    doc.save(`${safeName}_master_schedule.pdf`);
  };

  const getSubjectExportData = () => {
    const mergedShifts = getMergedWeeklySchedule(schedule);
    const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const unrolledData: any[] = [];

    mergedShifts.forEach((shift: any) => {
      const tutor = activeRoster.find(t => t.id === shift.tutorId);
      const tutorName = tutor ? tutor.name : 'Unknown';
      const role = tutor && (tutor as any).role ? (tutor as any).role : 'Tutor';
      const start = format12Hour(shift.startTime);
      const end = format12Hour(shift.endTime);

      shift.subjects.forEach((subject: string) => {
        unrolledData.push({
          Subject: subject,
          Day: shift.day,
          'Start Time': start,
          'End Time': end,
          'Educator Name': tutorName,
          Role: role,
          _rawStart: shift.startTime 
        });
      });
    });

    return unrolledData.sort((a, b) => {
      if (a.Subject !== b.Subject) return a.Subject.localeCompare(b.Subject);
      if (a.Day !== b.Day) return ALL_DAYS.indexOf(a.Day) - ALL_DAYS.indexOf(b.Day);
      return a._rawStart.localeCompare(b._rawStart);
    });
  };

  const handleExportSubjectCSV = (safeName: string) => {
    const data = getSubjectExportData();
    let csvContent = "Subject,Day,Start Time,End Time,Educator Name,Role\n";
    data.forEach(row => {
      csvContent += `"${row.Subject}","${row.Day}","${row['Start Time']}","${row['End Time']}","${row['Educator Name']}","${row.Role}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${safeName}_subject_coverage.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSubjectExcel = (safeName: string) => {
    const data = getSubjectExportData();
    const cleanData = data.map(({ _rawStart, ...rest }) => rest);
    const worksheet = XLSX.utils.json_to_sheet(cleanData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Subject Coverage");
    XLSX.writeFile(workbook, `${safeName}_subject_coverage.xlsx`);
  };

  const handleExportSubjectPDF = (safeName: string, rawName: string) => {
    const data = getSubjectExportData();
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${rawName} - Subject Coverage`, 14, 15);
    const uniqueSubjects = Array.from(new Set(data.map(item => item.Subject)));
    let currentY = 25;
    uniqueSubjects.forEach(subject => {
      const subjectData = data.filter(item => item.Subject === subject);
      const tableData = subjectData.map(row => [row.Day, row['Start Time'], row['End Time'], row['Educator Name'], row.Role]);
      doc.setFontSize(12);
      doc.text("Subject: " + subject, 14, currentY);
      autoTable(doc, {
        head: [['Day', 'Start Time', 'End Time', 'Educator Name', 'Role']],
        body: tableData,
        startY: currentY + 4,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { bottom: 20 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
    });
    doc.save(`${safeName}_subject_coverage.pdf`);
  };
  
const getEducatorTimesheetData = () => {
  const mergedShifts = getMergedWeeklySchedule(schedule);
  const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const shiftsByTutor = new Map<string, any[]>();
  mergedShifts.forEach((shift: any) => {
    if (!shiftsByTutor.has(shift.tutorId)) shiftsByTutor.set(shift.tutorId, []);
    shiftsByTutor.get(shift.tutorId)!.push(shift);
  });

  const timesheetData: any[] = [];

  const sortedRoster = [...activeRoster].sort((a, b) => a.name.localeCompare(b.name));

  sortedRoster.forEach(tutor => {
    const tutorShifts = shiftsByTutor.get(tutor.id) || [];
    if (tutorShifts.length === 0) return; 

    const role = (tutor as any).role || 'Tutor';
    const subjectsStr = tutor.subjects.join(", ");

    tutorShifts.sort((a, b) => {
      if (a.day !== b.day) return ALL_DAYS.indexOf(a.day) - ALL_DAYS.indexOf(b.day);
      return a.startTime.localeCompare(b.startTime);
    });

    tutorShifts.forEach(shift => {
      const duration = timeToFloat(shift.endTime) - timeToFloat(shift.startTime);
      
      timesheetData.push({
        'Educator Name': tutor.name,
        Role: role,
        Day: shift.day,
        'Start Time': format12Hour(shift.startTime),
        'End Time': format12Hour(shift.endTime),
        'Shift Duration (Hrs)': duration.toFixed(2),
        'Subjects Covered': subjectsStr
      });
    });
  });

  return timesheetData;
};

const handleExportEducatorCSV = (safeName: string) => {
    const data = getEducatorTimesheetData();
    let csvContent = "Educator Name,Role,Day,Start Time,End Time,Shift Duration (Hrs),Subjects Covered\n";
    data.forEach(row => {
      csvContent += `"${row['Educator Name']}","${row.Role}","${row.Day}","${row['Start Time']}","${row['End Time']}","${row['Shift Duration (Hrs)']}","${row['Subjects Covered']}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${safeName}_educator_timesheets.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportEducatorExcel = (safeName: string) => {
    const data = getEducatorTimesheetData();
    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: ["Educator Name", "Role", "Day", "Start Time", "End Time", "Shift Duration (Hrs)", "Subjects Covered"]
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Educator Timesheets");
    XLSX.writeFile(workbook, `${safeName}_educator_timesheets.xlsx`);
  };

  const handleExportEducatorPDF = (safeName: string, rawName: string) => {
    const doc = new jsPDF();
    const printDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    doc.setFontSize(18);
    doc.text(`${rawName} - Educator Itineraries`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${printDate}`, 14, 27);
    doc.setTextColor(0);
    const mergedShifts = getMergedWeeklySchedule(schedule);
    const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const roles = ['SI Leader', 'Mentor', 'Tutor']; 
    const existingRoles = Array.from(new Set(activeRoster.map(t => (t as any).role || 'Tutor')));
    const allRoles = Array.from(new Set([...roles, ...existingRoles])); 
    let currentY = 38;
    allRoles.forEach(role => {
      const tutorsInRole = activeRoster.filter(t => ((t as any).role || 'Tutor') === role);
      if (tutorsInRole.length === 0) return;
      tutorsInRole.sort((a, b) => a.name.localeCompare(b.name));
      const hasShiftsForRole = tutorsInRole.some(tutor => mergedShifts.some((s: any) => s.tutorId === tutor.id));
      if (!hasShiftsForRole) return;
      if (currentY > 260) { doc.addPage(); currentY = 20; }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 244, 248); 
      doc.rect(14, currentY - 5, 180, 8, 'F');
      doc.text(`--- ${role.toUpperCase()}S ---`, 16, currentY);
      currentY += 12;
      tutorsInRole.forEach(tutor => {
        const tutorShifts = mergedShifts.filter((s: any) => s.tutorId === tutor.id);
        if (tutorShifts.length === 0) return;
        if (currentY > 260) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${tutor.name}`, 14, currentY);
        currentY += 6;
        const shiftsByDay: Record<string, any[]> = {};
        tutorShifts.forEach((shift: any) => {
          if (!shiftsByDay[shift.day]) shiftsByDay[shift.day] = [];
          shiftsByDay[shift.day].push(shift);
        });
        ALL_DAYS.forEach(day => {
          const dayShifts = shiftsByDay[day];
          if (dayShifts && dayShifts.length > 0) {
            if (currentY > 270) { doc.addPage(); currentY = 20; }
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(day, 18, currentY);
            currentY += 5;
            doc.setFont("helvetica", "normal");
            dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
            dayShifts.forEach(shift => {
              if (currentY > 275) { doc.addPage(); currentY = 20; }
              doc.text(`${format12Hour(shift.startTime)} - ${format12Hour(shift.endTime)}`, 18, currentY);
              currentY += 5;
            });
            currentY += 2; 
          }
        });
        if (currentY > 275) { doc.addPage(); currentY = 20; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        const subjectsText = `Subjects: ${tutor.subjects.join(', ')}`;
        const splitSubjects = doc.splitTextToSize(subjectsText, 170);
        doc.text(splitSubjects, 18, currentY);
        currentY += (splitSubjects.length * 5) + 8; 
      });
      currentY += 4; 
    });
    doc.save(`${safeName}_educator_itineraries.pdf`);
  };


  return (
  <div style={{ fontFamily: 'sans-serif', width: '100%', boxSizing: 'border-box' }}>
      {/* --- NEW: Modern Toast Notification UI --- */}
    {toastMessage && (
    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', backgroundColor: toastType === 'error' ? '#ef4444' : '#10b981', color: 'white', padding: '1rem 1.5rem', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 1000, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      {toastType === 'error' ? (
        /* Error Alert SVG */
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      ) : (
        /* Checkmark SVG */
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      )}
      {toastMessage}
    </div>
  )}
    {showNavbar && (
      <NavBar
        hasUnsavedChanges={hasUnsavedChanges}
        onDiscardChanges={handleDiscardUnsavedChanges}
        isAdmin={isAdmin}
        onLogout={handleLogout} // <--- Make sure this line is here!
      />
    )}

    <div style={{ padding: '0 2rem 2rem 2rem' }}>
      <Routes>
           <Route path="/submit" element={
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
              <TutorForm 
                onSubmit={(newTutor) => {
                  showToast(`${newTutor.name}'s availability has been submitted.`);
                }} 
                showErrorToast={showErrorToast}
              />
            </div>
          } />


          {/* --- NEW: Course Catalog Route --- */}
          <Route path="/courses" element={
            <ProtectedRoute isAdmin={isAdmin}>
              <AdminCoursesPage 
                showToast={showToast}
                showErrorToast={showErrorToast}
              />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/submit" replace />} />
          <Route path="/" element={<Navigate to="/submit" replace />} />

          <Route path="/login" element={
            isAdmin ? <Navigate to="/admin" replace /> : <LoginScreen onLogin={handleLogin} showErrorToast={showErrorToast} />
          } />

         <Route path="/admin" element={
            <ProtectedRoute isAdmin={isAdmin}>
              <RosterDashboard 
                roster={globalRoster} 
                onSelectTutor={setSelectedTutorModal}
                showToast={showToast}
                showErrorToast={showErrorToast}
              />
            </ProtectedRoute>
          } />
          <Route path="/generate" element={
            <ProtectedRoute isAdmin={isAdmin}>
              <ScheduleGenerationPage 
                config={scheduleConfig} 
                onConfigChange={setScheduleConfig}
                onGenerate={handleGenerateSchedule} 
                globalRoster={globalRoster}
              />
            </ProtectedRoute>
          } />

          <Route path="/saved" element={
            <ProtectedRoute isAdmin={isAdmin}>
              <SavedSchedules 
                showToast={showToast}
                showErrorToast={showErrorToast}
                onLoadSchedule={(id, name, loadedShifts, loadedRoster) => { 
                setSchedule(loadedShifts);
                setActiveRoster(loadedRoster && loadedRoster.length > 0 ? loadedRoster : globalRoster);
                setSelectedTutorModal(null);
                setActiveScheduleMeta({ id, name }); 
                setTutorSearchQuery('');
                setTutorSubjectFilter('');
                setTutorNightFilter(false);
                setSubjectSearchQuery('');
                setExpandedDepartments(new Set());
                setIsTutorsOpen(true);
                setIsHeatmapOpen(true);
                setIsSubjectsOpen(true);
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
                        
                        <button onClick={handleSaveClick} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            fill="none" 
                            viewBox="0 0 24 24" 
                            strokeWidth={2.5} 
                            stroke="currentColor" 
                            style={{ width: '1.1rem', height: '1.1rem' }}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg> 
                          Save as New
                        </button>
                      </>
                    ) : (
                      <button onClick={handleSaveClick} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75C20.25 19.903 16.556 21.75 12 21.75s-8.25-1.847-8.25-4.125v-3.75" />
                        </svg>
                        Save to Database
                      </button>
                    )}

                    {/* --- NEW EXPORT MENU --- */}
                    <div style={{ position: 'relative' }}>
                    <button 
                      onClick={() => setShowExportModal(!showExportModal)} 
                      style={{ 
                        padding: '0.5rem 1rem', 
                        backgroundColor: '#3b82f6', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer', 
                        fontWeight: 'bold', 
                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg> 
                      Export ▾
                    </button>

                    {showExportModal && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        left: '50%', 
                        transform: 'translateX(-50%)', 
                        marginTop: '0.5rem', 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', 
                        zIndex: 50, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        overflow: 'hidden', 
                        minWidth: '200px' 
                      }}>
                        
                        
  
                        {/* SECTION: MASTER SCHEDULE */}
                        <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: '#f8fafc' }}>
                          Master Schedule
                        </div>
                        <button 
                          onClick={() => executeExport(handleExportCSV)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📄 CSV File
                        </button>
                        <button 
                          onClick={() => executeExport(handleExportExcel)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📊 Excel (.xlsx)
                        </button>
                        <button 
                          onClick={() => executeExport(handleExportPDF)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📕 PDF Document
                        </button>

                        <div style={{ borderTop: '1px solid #e2e8f0' }}></div>
                        
                        {/* SECTION: EDUCATOR BREAKDOWNS */}
                        <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: '#f8fafc' }}>
                          Educator Breakdowns
                        </div>
                        <button 
                          onClick={() => executeExport(handleExportEducatorCSV)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📄 CSV File
                        </button>
                        <button 
                          onClick={() => executeExport(handleExportEducatorExcel)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📊 Excel (.xlsx)
                        </button>
                        <button 
                          onClick={() => executeExport(handleExportEducatorPDF)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📕 PDF Document
                        </button>
  
                        <div style={{ borderTop: '1px solid #e2e8f0' }}></div>
                        
                        {/* SECTION: SUBJECT COVERAGE */}
                        <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: '#f8fafc' }}>
                          Subject Coverage
                        </div>
                        <button 
                          onClick={() => executeExport(handleExportSubjectCSV)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📄 CSV File
                        </button>
                        <button 
                          onClick={() => executeExport(handleExportSubjectExcel)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📊 Excel (.xlsx)
                        </button>
                        <button 
                          onClick={() => executeExport(handleExportSubjectPDF)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          📕 PDF Document
                        </button>

                      <div style={{ borderTop: '1px solid #e2e8f0' }}></div>

                      </div>
                    )}
                  </div>

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
                        <option value="" disabled>+ Import Missing Educator</option>
                        {missingTutors.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                    
                    <span style={{ backgroundColor: '#e2e8f0', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                      Total Educators: {activeRoster.length}
                    </span>
                  </div>
                </div>
                
                <hr style={{ margin: '1rem 0 2rem 0' }} />
               
                <SectionHeader title="Peer Educator Breakdowns" isOpen={isTutorsOpen} onToggle={() => setIsTutorsOpen(!isTutorsOpen)} />

                {isTutorsOpen && (
                  <div style={{ paddingBottom: '1rem' }}>
                  {/* --- Expanded Filter Controls --- */}
                  <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    
                    {/* Modern Search Input Wrapper */}
                    <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                      {/* SVG Search Icon */}
                      <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem', color: '#94a3b8' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                      </div>

                      <input 
                        type="text" 
                        placeholder="Search for a specific peer educator..." 
                        value={tutorSearchQuery}
                        onChange={(e) => setTutorSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}
                      />
                    </div>
                      
                      <select
                        value={tutorSubjectFilter}
                        onChange={(e) => setTutorSubjectFilter(e.target.value)}
                        style={{ padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: 'white', minWidth: '200px' }}
                      >
                        <option value="">All Subjects</option>
                        {allSubjects.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={tutorNightFilter}
                          onChange={(e) => setTutorNightFilter(e.target.checked)}
                          style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                        />
                        Available at Night
                      </label>

                      {/* --- Weekend Availability Checkbox --- */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={tutorWeekendFilter}
                          onChange={(e) => setTutorWeekendFilter(e.target.checked)}
                          style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                        />
                        Available on Weekends
                      </label>
                    </div>

                    {/* --- NEW: Grouped and Sorted Tutor Display --- */}
                    {filteredTutors.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                        {['Tutor', 'Mentor', 'SI Leader'].map(roleGroup => {
                          // Filter the educators that match the current role in the loop
                          const tutorsInRole = filteredTutors.filter(t => {
                            const tutorRole = (t as any).role || 'Tutor';
                            return tutorRole === roleGroup;
                          });

                          // If there are no educators in this role matching the search, skip rendering this section
                          if (tutorsInRole.length === 0) return null;

                          return (
                            <div key={roleGroup}>
                              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                                {roleGroup}s <span style={{ color: '#64748b', fontSize: '1rem', fontWeight: 'normal' }}>({tutorsInRole.length})</span>
                              </h3>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                                {tutorsInRole.map(tutor => {
                                  const tutorShifts = schedule.filter(s => s.tutorId === tutor.id);
                                  tutorShifts.sort((a, b) => {
                                    if (a.day !== b.day) return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
                                    return timeToFloat(a.startTime) - timeToFloat(b.startTime);
                                  });

                                  const totalHours = tutorShifts.length * 0.5;
                                  const isHovered = hoveredTutorId === tutor.id;
                                  
                                  const isOutOfBounds = totalHours < tutor.minHours || totalHours > tutor.maxHours;

                                  return (
                                    <div 
                                      key={tutor.id} 
                                      onMouseEnter={() => setHoveredTutorId(tutor.id)}
                                      onMouseLeave={() => setHoveredTutorId(null)}
                                      style={{ 
                                        border: isHovered ? '2px solid #3b82f6' : (isOutOfBounds ? '1px solid #fca5a5' : '1px solid #e2e8f0'), 
                                        backgroundColor: isOutOfBounds 
                                          ? (isHovered ? '#fee2e2' : '#fef2f2') 
                                          : (isHovered ? '#f8fafc' : '#fff'),
                                        padding: '1.5rem', 
                                        borderRadius: '8px', 
                                        cursor: 'default', 
                                        transition: 'all 0.2s ease', 
                                        boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0,0,0,0.05)', 
                                        transform: isHovered ? 'translateY(-4px)' : 'none', 
                                        display: 'flex', 
                                        flexDirection: 'column' 
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <h3 style={{ marginTop: 0, color: '#1e293b' }}>{tutor.name}</h3>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                          <button
                                            onClick={(e) => handleCopySchedule(tutor, tutorShifts, totalHours, e)}
                                            style={{ 
                                              background: 'none', border: 'none', 
                                              color: copiedTutorId === tutor.id ? '#10b981' : '#64748b', 
                                              cursor: 'pointer', fontSize: '1.1rem',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              opacity: (isHovered || copiedTutorId === tutor.id) ? 1 : 0, 
                                              transition: 'all 0.2s', padding: 0
                                            }}
                                            title="Copy Schedule to Clipboard"
                                          >
                                            {copiedTutorId === tutor.id ? (
                                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                              </svg>
                                            ) : (
                                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                              </svg>
                                            )}
                                          </button>

                                          <button
                                            onClick={(e) => handleRemoveTutorClick(tutor.id, tutor.name, e)}
                                            style={{ 
                                              background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              opacity: isHovered ? 0.7 : 0, transition: 'opacity 0.2s', padding: 0
                                            }}
                                            title="Remove from Schedule"
                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                              <polyline points="3 6 5 6 21 6"></polyline>
                                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                              <line x1="10" y1="11" x2="10" y2="17"></line>
                                              <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                          </button>

                                          <span 
                                            onClick={() => setSelectedTutorModal(tutor)}
                                            style={{ color: isHovered ? '#3b82f6' : '#cbd5e1', fontSize: '1.2rem', transition: 'color 0.2s', cursor: 'pointer' }}
                                          >
                                            ↗
                                          </span>
                                        </div>
                                      </div>
                                      
                                      <p style={{ margin: '0 0 1rem 0', color: isOutOfBounds ? '#ef4444' : '#10b981' }}>
                                        <strong>Scheduled: {totalHours} hrs</strong> (Target: {tutor.minHours}-{tutor.maxHours} hrs)
                                      </p>
                                      
                                      <div style={{ flexGrow: 1 }}>
                                        {tutorShifts.length === 0 ? (
                                          <p style={{ color: 'gray', fontStyle: 'italic', margin: 0 }}>Not scheduled this week.</p>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', color: '#475569' }}>
                                            {/* Explicitly list all 7 days to account for potential weekend shifts */}
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
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
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        <p style={{ color: '#64748b', fontStyle: 'italic', gridColumn: '1 / -1' }}>No tutors match your search criteria.</p>
                      </div>
                    )}
                  </div>
                )}
                
                <hr style={{ margin: '3rem 0' }} />

                <SectionHeader title="Coverage Heat Map" isOpen={isHeatmapOpen} onToggle={() => setIsHeatmapOpen(!isHeatmapOpen)} />
                
                {isHeatmapOpen && (
                  <div style={{ paddingBottom: '1rem' }}>
                    {schedule.length > 0 ? (
                      <ScheduleHeatmap schedule={schedule} config={scheduleConfig} />
                    ) : (
                      <p style={{ color: '#64748b', fontStyle: 'italic' }}>Generate a schedule to view the heat map.</p>
                    )}
                  </div>
                )}

                <hr style={{ margin: '3rem 0' }} />

                <SectionHeader title="Subject Coverage" isOpen={isSubjectsOpen} onToggle={() => setIsSubjectsOpen(!isSubjectsOpen)} />

                {isSubjectsOpen && (
                  <div style={{ paddingBottom: '1rem' }}>
                  <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
                    {/* SVG Search Icon */}
                    <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem', color: '#94a3b8' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                    </div>

                    <input 
                      type="text" 
                      placeholder="Search for a specific class (e.g., CS 146, Math)..." 
                      value={subjectSearchQuery}
                      onChange={(e) => setSubjectSearchQuery(e.target.value)}
                      style={{ width: '100%', padding: '1rem 1rem 1rem 2.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}
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

                {selectedSubjectModal && (() => {
                  const subjectShiftsForModal = schedule.filter(s => s.subjects.includes(selectedSubjectModal));
                  const hasNightShifts = subjectShiftsForModal.some(s => timeToFloat(s.endTime) > 17);
                  const activeSubjectEndHour = hasNightShifts ? 22 : 17;

                  return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <h2 style={{ margin: 0 }}>{selectedSubjectModal} Coverage</h2>
                          <button onClick={() => setSelectedSubjectModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
                        </div>
                        
                        <SubjectScheduleGrid 
                          subject={selectedSubjectModal} 
                          shifts={subjectShiftsForModal} 
                          roster={activeRoster} 
                          endHour={activeSubjectEndHour} 
                        />
                      </div>
                    </div>
                  );
                })()}

              </>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/submit" replace />} />

        </Routes>
      </div>

      {/* --- NEW App-Level Modals --- */}

      {/* 1. Save As New Modal */}
      {isSaveModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.4rem', marginBottom: '1rem' }}>Save Schedule</h3>
            
            <input 
              type="text" 
              value={saveNameInput}
              onChange={(e) => setSaveNameInput(e.target.value)}
              placeholder="Enter a name for this schedule..."
              disabled={isProcessingSave}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSaveAsNew();
                if (e.key === 'Escape') setIsSaveModalOpen(false);
              }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1.1rem', marginBottom: '2rem', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsSaveModalOpen(false)} 
                disabled={isProcessingSave}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: isProcessingSave ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmSaveAsNew} 
                disabled={isProcessingSave || !saveNameInput.trim()}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: (isProcessingSave || !saveNameInput.trim()) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
              >
                {isProcessingSave ? 'Saving...' : 'Save to Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Remove Tutor Modal */}
      {tutorToRemove && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '450px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.4rem' }}>Remove from Schedule</h3>
            <p style={{ color: '#475569', marginBottom: '2rem', lineHeight: '1.5' }}>
              Are you sure you want to remove <strong>{tutorToRemove.name}</strong> from this schedule? This will also delete all of their assigned shifts.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setTutorToRemove(null)} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmRemoveTutor} 
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
}

export default function AppEntry() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}