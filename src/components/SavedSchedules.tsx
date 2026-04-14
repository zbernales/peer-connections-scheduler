import { useState, useEffect } from 'react';
// --- ADDED updateDoc to imports ---
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import type { Shift, Tutor } from '../types'; 

interface SavedScheduleDoc {
  id: string;
  name: string;
  createdAt: number;
  sortOrder?: number; // --- NEW: Tracks manual ordering ---
  shifts: Shift[];
  roster?: Tutor[]; 
}

interface SavedSchedulesProps {
  onLoadSchedule: (id: string, name: string, shifts: Shift[], roster?: Tutor[]) => void; 
}

export function SavedSchedules({ onLoadSchedule }: SavedSchedulesProps) {
  const [savedSchedules, setSavedSchedules] = useState<SavedScheduleDoc[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      const schedulesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SavedScheduleDoc));
      
      // --- UPDATED: Sort by sortOrder first, falling back to createdAt ---
      schedulesData.sort((a, b) => {
        const orderA = a.sortOrder !== undefined ? a.sortOrder : a.createdAt;
        const orderB = b.sortOrder !== undefined ? b.sortOrder : b.createdAt;
        return orderB - orderA; // Descending (highest value goes to the top)
      });

      setSavedSchedules(schedulesData);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the schedule "${name}"?`)) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
      } catch (error) {
        console.error("Error deleting schedule:", error);
        alert("Failed to delete schedule.");
      }
    }
  };

  // --- NEW: Rename Logic ---
  const handleRename = async (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = window.prompt("Enter a new name for this schedule:", currentName);
    
    if (newName && newName.trim() !== "" && newName !== currentName) {
      try {
        await updateDoc(doc(db, 'schedules', id), { name: newName.trim() });
      } catch (error) {
        console.error("Error renaming schedule:", error);
        alert("Failed to rename schedule.");
      }
    }
  };

  // --- NEW: Reorder Logic ---
  const handleMove = async (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Safety check to ensure we aren't moving out of bounds
    if (targetIndex < 0 || targetIndex >= savedSchedules.length) return;

    const currentItem = savedSchedules[index];
    const targetItem = savedSchedules[targetIndex];

    const currentOrder = currentItem.sortOrder !== undefined ? currentItem.sortOrder : currentItem.createdAt;
    const targetOrder = targetItem.sortOrder !== undefined ? targetItem.sortOrder : targetItem.createdAt;

    let newCurrentOrder = targetOrder;
    let newTargetOrder = currentOrder;

    // Edge case: if they share the exact same timestamp/order, give it a tiny nudge so they actually swap
    if (newCurrentOrder === newTargetOrder) {
      newCurrentOrder += direction === 'up' ? 1 : -1;
    }

    try {
      // Swap their sorting values in the database
      await updateDoc(doc(db, 'schedules', currentItem.id), { sortOrder: newCurrentOrder });
      await updateDoc(doc(db, 'schedules', targetItem.id), { sortOrder: newTargetOrder });
    } catch (error) {
      console.error("Error reordering schedules:", error);
      alert("Failed to reorder schedules.");
    }
  };

  const handleLoad = (id: string, name: string, shifts: Shift[], roster?: Tutor[]) => {
    onLoadSchedule(id, name, shifts, roster);
    navigate('/schedule'); 
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Saved Schedules</h1>
        <button onClick={() => navigate('/admin')} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          + Generate New
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {savedSchedules.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
            <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No saved schedules yet.</p>
            <p style={{ margin: 0 }}>Go to the Roster Dashboard to generate and save your first schedule!</p>
          </div>
        ) : (
          savedSchedules.map((schedule, index) => (
            <div 
              key={schedule.id}
              onClick={() => handleLoad(schedule.id, schedule.name, schedule.shifts, schedule.roster)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
            >
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                {/* --- NEW: Up/Down Ordering Arrows --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <button 
                    disabled={index === 0}
                    onClick={(e) => handleMove(index, 'up', e)}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: index === 0 ? '#f8fafc' : '#f1f5f9', color: index === 0 ? '#cbd5e1' : '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: index === 0 ? 'default' : 'pointer' }}
                    title="Move Up"
                  >
                    ▲
                  </button>
                  <button 
                    disabled={index === savedSchedules.length - 1}
                    onClick={(e) => handleMove(index, 'down', e)}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', backgroundColor: index === savedSchedules.length - 1 ? '#f8fafc' : '#f1f5f9', color: index === savedSchedules.length - 1 ? '#cbd5e1' : '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: index === savedSchedules.length - 1 ? 'default' : 'pointer' }}
                    title="Move Down"
                  >
                    ▼
                  </button>
                </div>

                <div>
                  <h2 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>{schedule.name}</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                    <strong>Created:</strong> {new Date(schedule.createdAt).toLocaleString()} | <strong>Total Shifts:</strong> {schedule.shifts.length}
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {/* --- NEW: Rename Button --- */}
                <button 
                  onClick={(e) => handleRename(schedule.id, schedule.name, e)}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Rename
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleLoad(schedule.id, schedule.name, schedule.shifts, schedule.roster); }}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#ecfdf5', color: '#10b981', border: '1px solid #10b981', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Load
                </button>
                <button 
                  onClick={(e) => handleDelete(schedule.id, schedule.name, e)}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}