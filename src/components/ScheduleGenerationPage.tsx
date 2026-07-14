import { useNavigate } from 'react-router-dom';
import type { ScheduleConfig } from '../types';

interface ScheduleGenerationPageProps {
  config: ScheduleConfig;
  onConfigChange: (newConfig: ScheduleConfig) => void;
  onGenerate: () => void; 
}

export function ScheduleGenerationPage({ config, onConfigChange, onGenerate }: ScheduleGenerationPageProps) {
  const navigate = useNavigate();

  const allowedRoles = config.allowedRoles || ['Tutor', 'SI Leader', 'Mentor'];

  const handleRoleToggle = (role: string) => {
    const newRoles = allowedRoles.includes(role)
      ? allowedRoles.filter(r => r !== role)
      : [...allowedRoles, role];
    onConfigChange({ ...config, allowedRoles: newRoles });
  };

  const isGenerateDisabled = allowedRoles.length === 0;

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
          ✨ Generate Master Schedule
        </button>
      </div>

      <div style={{ backgroundColor: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1e293b', fontSize: '1.4rem' }}>⚙️ Algorithm Parameters</h3>

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
            <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Max Consecutive Hours</label>
            <input type="number" min="0.5" step="0.5" value={config.maxConsecutiveHours} onChange={e => onConfigChange({...config, maxConsecutiveHours: Number(e.target.value)})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>Min Hours Per Shift</label>
            <input type="number" min="0.5" step="0.5" value={config.minHoursPerShift || 0.5} onChange={e => onConfigChange({...config, minHoursPerShift: Number(e.target.value)})} style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '1rem' }} />
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
    </div>
  );
}