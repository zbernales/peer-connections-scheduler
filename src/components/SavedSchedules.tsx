import { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import type { Shift, Tutor } from '../types'; 

interface SavedScheduleDoc {
  id: string;
  name: string;
  createdAt: number;
  sortOrder?: number;
  shifts: Shift[];
  roster?: Tutor[]; 
}

interface SavedSchedulesProps {
  onLoadSchedule: (id: string, name: string, shifts: Shift[], roster?: Tutor[]) => void; 
  // --- NEW: Toast props ---
  showToast: (message: string) => void;
  showErrorToast: (message: string) => void;
}

export function SavedSchedules({ onLoadSchedule, showToast, showErrorToast }: SavedSchedulesProps) {
  const [savedSchedules, setSavedSchedules] = useState<SavedScheduleDoc[]>([]);
  const navigate = useNavigate();

  // --- NEW: Modal States ---
  const [scheduleToDelete, setScheduleToDelete] = useState<{id: string, name: string} | null>(null);
  const [scheduleToRename, setScheduleToRename] = useState<{id: string, currentName: string} | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      const schedulesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SavedScheduleDoc));
      
      schedulesData.sort((a, b) => {
        const orderA = a.sortOrder !== undefined ? a.sortOrder : a.createdAt;
        const orderB = b.sortOrder !== undefined ? b.sortOrder : b.createdAt;
        return orderB - orderA; 
      });

      setSavedSchedules(schedulesData);
    });

    return () => unsubscribe();
  }, []);

  // --- NEW: Delete Logic ---
  const handleDeleteClick = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScheduleToDelete({ id, name }); // Opens the delete modal
  };

  const confirmDelete = async () => {
    if (!scheduleToDelete) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'schedules', scheduleToDelete.id));
      showToast(`Schedule "${scheduleToDelete.name}" deleted.`);
      setScheduleToDelete(null);
    } catch (error) {
      console.error("Error deleting schedule:", error);
      showErrorToast("Failed to delete schedule. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- NEW: Rename Logic ---
  const handleRenameClick = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScheduleToRename({ id, currentName });
    setRenameInput(currentName); // Pre-fill the input
  };

  const confirmRename = async () => {
    if (!scheduleToRename) return;
    if (!renameInput || renameInput.trim() === "" || renameInput === scheduleToRename.currentName) {
      setScheduleToRename(null); // Cancel if empty or unchanged
      return;
    }

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'schedules', scheduleToRename.id), { name: renameInput.trim() });
      showToast(`Schedule renamed to "${renameInput.trim()}".`);
      setScheduleToRename(null);
    } catch (error) {
      console.error("Error renaming schedule:", error);
      showErrorToast("Failed to rename schedule. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= savedSchedules.length) return;

    const currentItem = savedSchedules[index];
    const targetItem = savedSchedules[targetIndex];

    const currentOrder = currentItem.sortOrder !== undefined ? currentItem.sortOrder : currentItem.createdAt;
    const targetOrder = targetItem.sortOrder !== undefined ? targetItem.sortOrder : targetItem.createdAt;

    let newCurrentOrder = targetOrder;
    let newTargetOrder = currentOrder;

    if (newCurrentOrder === newTargetOrder) {
      newCurrentOrder += direction === 'up' ? 1 : -1;
    }

    try {
      await updateDoc(doc(db, 'schedules', currentItem.id), { sortOrder: newCurrentOrder });
      await updateDoc(doc(db, 'schedules', targetItem.id), { sortOrder: newTargetOrder });
    } catch (error) {
      console.error("Error reordering schedules:", error);
      showErrorToast("Failed to reorder schedules.");
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
        <button onClick={() => navigate('/generate')} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
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
                <button 
                  onClick={(e) => handleRenameClick(schedule.id, schedule.name, e)}
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
                  onClick={(e) => handleDeleteClick(schedule.id, schedule.name, e)}
                  style={{ padding: '0.5rem 1rem', backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ------------------------- MODALS ---------------------------- */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Delete Confirmation Modal */}
      {scheduleToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.4rem' }}>Delete Schedule</h3>
            <p style={{ color: '#475569', marginBottom: '2rem', lineHeight: '1.5' }}>
              Are you sure you want to delete the schedule <strong>"{scheduleToDelete.name}"</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setScheduleToDelete(null)} 
                disabled={isProcessing}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                disabled={isProcessing}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer' }}
              >
                {isProcessing ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Rename Modal */}
      {scheduleToRename && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.4rem', marginBottom: '1rem' }}>Rename Schedule</h3>
            
            <input 
              type="text" 
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Enter new name..."
              disabled={isProcessing}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename();
                if (e.key === 'Escape') setScheduleToRename(null);
              }}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1.1rem', marginBottom: '2rem', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setScheduleToRename(null)} 
                disabled={isProcessing}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmRename} 
                disabled={isProcessing || !renameInput || renameInput.trim() === ""}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: (isProcessing || !renameInput || renameInput.trim() === "") ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
              >
                {isProcessing ? 'Saving...' : 'Save Name'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}