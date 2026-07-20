import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ScheduleConfig, Tutor } from '../types';

interface ScheduleGenerationPageProps {
  config: ScheduleConfig;
  onConfigChange: (newConfig: ScheduleConfig) => void;
  onGenerate: () => void;
  globalRoster: Tutor[];
}

export function ScheduleGenerationPage({ config, onConfigChange, onGenerate, globalRoster }: ScheduleGenerationPageProps) {
  const navigate = useNavigate();
  const allowedRoles = config.allowedRoles || ['Tutor', 'SI Leader', 'Mentor'];

  const handleRoleToggle = (role: string) => {
    const newRoles = allowedRoles.includes(role)
      ? allowedRoles.filter(r => r !== role)
      : [...allowedRoles, role];
    onConfigChange({ ...config, allowedRoles: newRoles });
  };

  const isGenerateDisabled = allowedRoles.length === 0;
  const prioritySubjects = config.prioritySubjects || [];
  const [subjectSearchTerm, setSubjectSearchTerm] = useState('');
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const subjectWrapperRef = useRef<HTMLDivElement>(null);

  // 1. Generate unique list of all subjects currently supported by the active roster
  const allAvailableSubjects = useMemo(() => {
    const subjects = new Set<string>();
    globalRoster.forEach((tutor: Tutor) => {
      tutor.subjects.forEach((sub: string) => subjects.add(sub));
    });
    return Array.from(subjects).sort();
  }, [globalRoster]);

  // 2. Filter subjects based on search, excluding ones already selected
  const filteredSubjectsForDropdown = useMemo(() => {
    return allAvailableSubjects.filter(
      sub => sub.toLowerCase().includes(subjectSearchTerm.toLowerCase()) && !prioritySubjects.includes(sub)
    );
  }, [allAvailableSubjects, subjectSearchTerm, prioritySubjects]);

  // 3. Handle outside clicks to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (subjectWrapperRef.current && !subjectWrapperRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [subjectWrapperRef]);

  // 4. Add / Remove Handlers
  const addPrioritySubject = (subject: string) => {
    onConfigChange({ ...config, prioritySubjects: [...prioritySubjects, subject] });
    setSubjectSearchTerm('');
    setIsSubjectDropdownOpen(false);
  };

  const removePrioritySubject = (subjectToRemove: string) => {
    onConfigChange({
      ...config,
      prioritySubjects: prioritySubjects.filter(sub => sub !== subjectToRemove)
    });
  };

  const clearAllPrioritySubjects = () => {
    if (prioritySubjects.length === 0) return;
    if (window.confirm("Are you sure you want to clear all high-priority subjects?")) {
      onConfigChange({ ...config, prioritySubjects: [] });
    }
  };

  // 5. Handle Enter Key for quick adding
  const handleSubjectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const customSub = subjectSearchTerm.trim().toUpperCase();
      if (customSub && !prioritySubjects.includes(customSub) && allAvailableSubjects.includes(customSub)) {
        addPrioritySubject(customSub);
      }
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Schedule Generation</h2>
        <button
          onClick={() => {
            if (isGenerateDisabled) return;
            onGenerate();
            navigate('/schedule');
          }}
          disabled={isGenerateDisabled}
          style={{
            padding: '0.75rem 2rem',
            backgroundColor: isGenerateDisabled ? '#94a3b8' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            cursor: isGenerateDisabled ? 'not-allowed' : 'pointer',
            boxShadow: isGenerateDisabled ? 'none' : '0 4px 6px -1px rgba(16, 185, 129, 0.4)'
          }}
        >
          Generate Schedule
        </button>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0, marginBottom: '1.5rem', color: '#1e293b', fontSize: '1.4rem' }}>
          {/* Modern Gear/Cog SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '1.6rem', height: '1.6rem', color: '#64748b' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Algorithm Parameters
        </h3>

        <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <h4 style={{ marginTop: 0, marginBottom: '1rem', color: '#475569', fontSize: '1.05rem' }}>Included Roles</h4>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Only peer educators with the selected roles will be included in the generated schedule.
          </p>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {['Tutor', 'SI Leader', 'Mentor'].map(role => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowedRoles.includes(role)}
                  onChange={() => handleRoleToggle(role)}
                  style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '1.05rem', color: '#1e293b', fontWeight: '500' }}>{role}</span>
              </label>
            ))}
          </div>
          {allowedRoles.length === 0 && (
            <p style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: '1rem', marginBottom: 0, fontWeight: 'bold' }}>
              ⚠️ You must select at least one role to generate a schedule.
            </p>
          )}
        </div>

        {/* Night Settings */}
        <div style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: config.autoScheduleNightHours ? '1rem' : '0' }}>
            <input
              type="checkbox"
              checked={config.autoScheduleNightHours || false}
              onChange={e => onConfigChange({
                ...config,
                autoScheduleNightHours: e.target.checked,
                maxTutorsPerNightShift: config.maxTutorsPerNightShift || 2
              })}
              style={{ width: '1.3rem', height: '1.3rem', cursor: 'pointer', marginTop: '2px' }}
            />
            <strong style={{ fontSize: '1.05rem', color: '#1e293b', lineHeight: '1.3' }}>Automatically schedule night hours (Mon-Fri 5PM - 10PM)</strong>
          </label>

          {config.autoScheduleNightHours && (
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', color: '#475569', fontWeight: 'bold' }}>Max Tutors Per Night Shift</label>
              <input
                type="number"
                min="1"
                value={config.maxTutorsPerNightShift || 2}
                onChange={e => onConfigChange({...config, maxTutorsPerNightShift: Number(e.target.value)})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }}
              />
            </div>
          )}
        </div>

        {/* Weekend Settings */}
        <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: config.autoScheduleWeekendHours ? '1rem' : '0' }}>
            <input
              type="checkbox"
              checked={config.autoScheduleWeekendHours || false}
              onChange={e => onConfigChange({
                ...config,
                autoScheduleWeekendHours: e.target.checked,
                maxTutorsPerWeekendShift: config.maxTutorsPerWeekendShift || 2
              })}
              style={{ width: '1.3rem', height: '1.3rem', cursor: 'pointer', marginTop: '2px' }}
            />
            <strong style={{ fontSize: '1.05rem', color: '#1e293b', lineHeight: '1.3' }}>Automatically schedule weekend hours (Sat-Sun 9AM - 10PM)</strong>
          </label>

          {config.autoScheduleWeekendHours && (
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', color: '#475569', fontWeight: 'bold' }}>Max Tutors Per Weekend Shift</label>
              <input
                type="number"
                min="1"
                value={config.maxTutorsPerWeekendShift || 2}
                onChange={e => onConfigChange({...config, maxTutorsPerWeekendShift: Number(e.target.value)})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }}
              />
            </div>
          )}
        </div>

        {/* Grid for Number Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Max Hours Per Week (Global Target)</label>
            <input type="number" min="0.5" step="0.5" value={config.maxHoursPerWeek || 6} onChange={e => onConfigChange({...config, maxHoursPerWeek: Number(e.target.value)})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Max Hours Per Day (Per Educator)</label>
            <input type="number" min="1" step="0.5" value={config.maxHoursPerDay} onChange={e => onConfigChange({...config, maxHoursPerDay: Number(e.target.value)})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Max Hours Per Shift</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={config.maxConsecutiveHours}
              onChange={(e) => {
                const value = Math.max(Number(e.target.value), config.minHoursPerShift || 0.5);
                onConfigChange({ ...config, maxConsecutiveHours: value });
              }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Min Hours Per Shift</label>
            <input
              type="number"
              min="0.5"
              max={config.maxConsecutiveHours}
              step="0.5"
              value={config.minHoursPerShift || 0.5}
              onChange={(e) => {
                const value = Math.min(Number(e.target.value), config.maxConsecutiveHours);
                onConfigChange({ ...config, minHoursPerShift: value });
              }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Min Break/Cooldown Hours</label>
            <input type="number" min="0.5" step="0.5" value={config.minCooldownHours} onChange={e => onConfigChange({...config, minCooldownHours: Number(e.target.value)})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Max Educators per Hour (Daytime Cap)</label>
            <input type="number" min="1" value={config.tutorsPerHour} onChange={e => onConfigChange({...config, tutorsPerHour: Number(e.target.value)})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }} />
          </div>
        </div>
      </div>

      {/* --- NEW: High Demand Subject Prioritization --- */}
      <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#475569', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
               High Demand Subjects (Optional)
            </h4>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: 0, marginBottom: '1rem', maxWidth: '500px' }}>
              The algorithm will prioritize scheduling educators who can support these specific subjects to ensure they have maximum coverage throughout the week.
            </p>
          </div>

          {prioritySubjects.length > 0 && (
            <button
              onClick={clearAllPrioritySubjects}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '4px' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Clear All
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Search Input */}
          <div ref={subjectWrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
             <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </div>
            <input
              type="text"
              placeholder="Search subjects to prioritize..."
              value={subjectSearchTerm}
              onChange={(e) => {
                setSubjectSearchTerm(e.target.value);
                setIsSubjectDropdownOpen(true);
              }}
              onFocus={() => setIsSubjectDropdownOpen(true)}
              onKeyDown={handleSubjectKeyDown}
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.2rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
                boxSizing: 'border-box'
              }}
            />

            {/* Dropdown Results */}
            {isSubjectDropdownOpen && subjectSearchTerm.trim() !== '' && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto'
              }}>
                {filteredSubjectsForDropdown.length > 0 ? (
                  filteredSubjectsForDropdown.map(sub => (
                    <div
                      key={sub}
                      onClick={() => addPrioritySubject(sub)}
                      style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '0.95rem' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {sub}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.95rem' }}>
                    No matching subjects found in roster.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Priority Tags */}
          {prioritySubjects.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {prioritySubjects.map(sub => (
                <div key={sub} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  backgroundColor: '#e0f2fe', color: '#0369a1', // Light blue tint to signify priority
                  padding: '0.35rem 0.75rem', borderRadius: '20px',
                  fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid #bae6fd'
                }}>
                  {sub}
                  <button
                    onClick={() => removePrioritySubject(sub)}
                    style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#0284c7'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#0ea5e9'}
                    title={`Remove ${sub}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
              No subjects prioritized. The algorithm will balance all subjects equally.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}