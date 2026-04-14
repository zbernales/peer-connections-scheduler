import { useNavigate } from 'react-router-dom';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TutorForm } from './TutorForm';
import type { Tutor, ScheduleConfig } from '../types';
import { useState } from 'react';

interface RosterDashboardProps {
  roster: Tutor[];
  config: ScheduleConfig;
  onConfigChange: (newConfig: ScheduleConfig) => void;
  onSelectTutor: (tutor: Tutor) => void;
  onGenerate: () => void; 
}

export function RosterDashboard({ roster, config, onConfigChange, onSelectTutor, onGenerate }: RosterDashboardProps) { 
  const navigate = useNavigate();
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);

  const handleDelete = async (tutorId: string, tutorName: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (window.confirm(`Are you sure you want to permanently delete ${tutorName}?`)) {
      try {
        await deleteDoc(doc(db, 'tutors', tutorId));
      } catch (error) {
        console.error("Error deleting tutor:", error);
        alert("Failed to delete tutor.");
      }
    }
  };

  // --- NEW: Reset Roster Logic ---
  const handleResetRoster = async () => {
    const confirmMessage = "Are you sure you want to clear the entire roster? \n\nThis will permanently delete ALL current tutors from the active database. \n\n(Your previously Saved Schedules will remain intact)";
    
    if (roster.length === 0) {
      alert("The roster is already empty.");
      return;
    }

    if (window.confirm(confirmMessage)) {
      try {
        // Create an array of delete promises for every tutor in the roster
        const deletePromises = roster.map(tutor => deleteDoc(doc(db, 'tutors', tutor.id)));
        
        // Wait for all deletions to finish
        await Promise.all(deletePromises);
        alert("Roster successfully reset for the new semester.");
      } catch (error) {
        console.error("Error resetting roster:", error);
        alert("Failed to reset roster.");
      }
    }
  };

  const handleSaveEdit = async (updatedTutorData: any) => {
    try {
      await updateDoc(doc(db, 'tutors', updatedTutorData.id), updatedTutorData);
      setEditingTutor(null); 
    } catch (error) {
      console.error("Error updating tutor:", error);
      alert("Failed to update tutor.");
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      
      {/* LEFT COLUMN: Settings & Actions */}
      <div style={{ flex: '0 0 350px', position: 'sticky', top: '2rem' }}>
        <button 
          onClick={() => {
            onGenerate(); 
            navigate('/schedule'); 
          }}
          style={{ width: '100%', padding: '1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)' }}
        >
          Generate Schedule
        </button>

        <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0 }}>⚙️ Algorithm Settings</h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Max Consecutive Hours</label>
            <input type="number" min="0.5" step="0.5" value={config.maxConsecutiveHours} onChange={e => onConfigChange({...config, maxConsecutiveHours: Number(e.target.value)})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Min Hours Per Shift</label>
            <input 
              type="number" 
              min="0.5" 
              step="0.5" 
              value={config.minHoursPerShift || 0.5} 
              onChange={e => onConfigChange({...config, minHoursPerShift: Number(e.target.value)})} 
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
            />
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Min Cooldown Hours (Gap Between Shifts)</label>
            <input type="number" min="0.5" step="0.5" value={config.minCooldownHours} onChange={e => onConfigChange({...config, minCooldownHours: Number(e.target.value)})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Max Hours Per Day (Per Tutor)</label>
            <input type="number" min="1" step="0.5" value={config.maxHoursPerDay} onChange={e => onConfigChange({...config, maxHoursPerDay: Number(e.target.value)})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Ideal Tutors per Hour</label>
            <input type="number" min="1" value={config.tutorsPerHour} onChange={e => onConfigChange({...config, tutorsPerHour: Number(e.target.value)})} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN: Roster List */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Tutor Roster ({roster.length})</h2>
          
          {/* --- UPDATED BUTTON GROUP --- */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleResetRoster} 
              style={{ padding: '0.5rem 1rem', backgroundColor: 'red', color: 'white', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Reset Roster
            </button>
            <button 
              onClick={() => navigate('/submit')} 
              style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + Add Tutor
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {roster.map(tutor => (
            <div 
              key={tutor.id} 
              onClick={() => onSelectTutor(tutor)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            >
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0' }}>{tutor.name}</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  <strong>Target:</strong> {tutor.minHours}-{tutor.maxHours} hrs | <strong>Subjects:</strong> {tutor.subjects.length}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                    onClick={(e) => { 
                    e.stopPropagation(); 
                    setEditingTutor(tutor); 
                    }} 
                    style={{ padding: '0.5rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#475569' }}
                >
                    Edit
                </button>
                <button onClick={(e) => handleDelete(tutor.id, tutor.name, e)} style={{ padding: '0.5rem', backgroundColor: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#ef4444' }}>Delete</button>
              </div>
            </div>
          ))}
          {roster.length === 0 && <p style={{ color: '#64748b' }}>No tutors found. Click "+ Add Tutor" to get started.</p>}
        </div>
      </div>
      
      {/* THE EDIT TUTOR MODAL */}
      {editingTutor && (
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
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit {editingTutor.name}'s Profile</h2>
            
            <TutorForm 
              initialData={editingTutor} 
              onSubmit={handleSaveEdit} 
              onCancel={() => setEditingTutor(null)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}