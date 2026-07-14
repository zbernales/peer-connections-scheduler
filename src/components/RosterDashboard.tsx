import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TutorForm } from './TutorForm';
import type { Tutor } from '../types';
import { useState } from 'react';

interface RosterDashboardProps {
  roster: Tutor[];
  onSelectTutor: (tutor: Tutor) => void;
}

// Helper to color-code roles
const ROLE_COLORS: Record<string, { bg: string, text: string }> = {
  'Tutor': { bg: '#e0f2fe', text: '#0369a1' },       // Light Blue
  'SI Leader': { bg: '#f3e8ff', text: '#7e22ce' },   // Light Purple
  'Mentor': { bg: '#dcfce7', text: '#15803d' },      // Light Green
};

export function RosterDashboard({ roster, onSelectTutor }: RosterDashboardProps) { 
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

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

  const handleResetRoster = async () => {
    const confirmMessage = "Are you sure you want to clear the entire roster? \n\nThis will permanently delete ALL current tutors from the active database. \n\n(Your previously Saved Schedules will remain intact)";
    if (roster.length === 0) {
      alert("The roster is already empty.");
      return;
    }
    if (window.confirm(confirmMessage)) {
      try {
        const deletePromises = roster.map(tutor => deleteDoc(doc(db, 'tutors', tutor.id)));
        await Promise.all(deletePromises);
        alert("Roster successfully reset.");
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

  // Combined Filtering Logic
  const filteredRoster = roster.filter(tutor => {
    const matchesSearch = tutor.name.toLowerCase().includes(searchQuery.toLowerCase());
    const tutorRole = (tutor as any).role || 'Tutor';
    const matchesRole = roleFilter === 'All' || tutorRole === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Peer Educator Roster ({filteredRoster.length})</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleResetRoster} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #f87171', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Reset Roster</button>
        </div>
      </div>

      {/* Filters Container */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="🔍 Search peer educators by name..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.05rem', boxSizing: 'border-box' }} 
        />
        <select 
          value={roleFilter} 
          onChange={(e) => setRoleFilter(e.target.value)} 
          style={{ padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', backgroundColor: 'white', minWidth: '180px', cursor: 'pointer' }}
        >
          <option value="All">All Roles</option>
          <option value="Tutor">Tutors</option>
          <option value="SI Leader">SI Leaders</option>
          <option value="Mentor">Mentors</option>
        </select>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {filteredRoster.map(tutor => {
          const role = (tutor as any).role || 'Tutor';
          const colors = ROLE_COLORS[role] || ROLE_COLORS['Tutor'];

          return (
            <div key={tutor.id} onClick={() => onSelectTutor(tutor)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                 onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                 onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.3rem' }}>
                  {tutor.name}
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '12px', 
                    backgroundColor: colors.bg, 
                    color: colors.text, 
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {role}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#64748b' }}><strong>Target:</strong> {tutor.minHours}-{tutor.maxHours} hrs | <strong>Subjects:</strong> {tutor.subjects.length}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={(e) => { e.stopPropagation(); setEditingTutor(tutor); }} style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#475569', fontWeight: 'bold' }}>Edit Profile</button>
                <button onClick={(e) => handleDelete(tutor.id, tutor.name, e)} style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}>Remove</button>
              </div>
            </div>
          );
        })}
        {filteredRoster.length === 0 && (
          <div style={{ textAlign: 'center', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', padding: '3rem', borderRadius: '8px' }}>
            <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>
              No peer educators match your current filters.
            </p>
          </div>
        )}
      </div>
      
      {editingTutor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit {editingTutor.name}'s Profile</h2>
            <TutorForm initialData={editingTutor} onSubmit={handleSaveEdit} onCancel={() => setEditingTutor(null)} />
          </div>
        </div>
      )}
    </div>
  );
}