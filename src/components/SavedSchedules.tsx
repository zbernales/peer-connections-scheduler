import { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import type { Shift } from '../types';

interface SavedScheduleDoc {
  id: string;
  name: string;
  createdAt: number;
  shifts: Shift[];
}

interface SavedSchedulesProps {
  // NEW: Now passes the ID and Name back to App.tsx
  onLoadSchedule: (id: string, name: string, shifts: Shift[]) => void; 
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
      
      schedulesData.sort((a, b) => b.createdAt - a.createdAt);
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

  // NEW: Passes the metadata along with the shifts
  const handleLoad = (id: string, name: string, shifts: Shift[]) => {
    onLoadSchedule(id, name, shifts);
    navigate('/schedule'); 
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
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
          savedSchedules.map(schedule => (
            <div 
              key={schedule.id}
              onClick={() => handleLoad(schedule.id, schedule.name, schedule.shifts)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
            >
              <div>
                <h2 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>{schedule.name}</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                  <strong>Created:</strong> {new Date(schedule.createdAt).toLocaleString()} | <strong>Total Shifts:</strong> {schedule.shifts.length}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleLoad(schedule.id, schedule.name, schedule.shifts); }}
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