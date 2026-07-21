import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TutorForm } from './TutorForm';
import type { Tutor } from '../types';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

interface RosterDashboardProps {
  roster: Tutor[];
  onSelectTutor: (tutor: Tutor) => void;
  // --- NEW: Toast props ---
  showToast: (message: string) => void;
  showErrorToast: (message: string) => void;
}

// Helper to color-code roles
const ROLE_COLORS: Record<string, { bg: string, text: string }> = {
  'Tutor': { bg: '#e0f2fe', text: '#0369a1' },       // Light Blue
  'SI Leader': { bg: '#f3e8ff', text: '#7e22ce' },   // Light Purple
  'Mentor': { bg: '#dcfce7', text: '#15803d' },      // Light Green
};

export function RosterDashboard({ roster, onSelectTutor, showToast, showErrorToast }: RosterDashboardProps) {
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  // --- NEW: Modal States ---
  const [tutorToDelete, setTutorToDelete] = useState<{id: string, name: string} | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // --- NEW: Delete Logic ---
  const handleDeleteClick = (tutorId: string, tutorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTutorToDelete({ id: tutorId, name: tutorName }); // Opens the delete modal
  };

  const confirmDelete = async () => {
    if (!tutorToDelete) return;
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'tutors', tutorToDelete.id));
      showToast(`${tutorToDelete.name} has been permanently deleted.`);
      setTutorToDelete(null);
    } catch (error) {
      console.error("Error deleting tutor:", error);
      showErrorToast("Failed to delete tutor. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- NEW: Reset Logic ---
  const handleResetClick = () => {
    if (roster.length === 0) {
      showErrorToast("The roster is already empty.");
      return;
    }
    setResetInput('');
    setIsResetModalOpen(true); // Opens the reset modal
  };

  const confirmReset = async () => {
    if (resetInput !== 'RESET') {
      showErrorToast("You must type RESET exactly to confirm.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const deletePromises = roster.map(tutor => deleteDoc(doc(db, 'tutors', tutor.id)));
      await Promise.all(deletePromises);
      showToast("Roster successfully reset.");
      setIsResetModalOpen(false);
    } catch (error) {
      console.error("Error resetting roster:", error);
      showErrorToast("Failed to reset roster. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdit = async (updatedTutorData: any) => {
    try {
      await updateDoc(doc(db, 'tutors', updatedTutorData.id), updatedTutorData);
      setEditingTutor(null);
      showToast(`${updatedTutorData.name}'s profile has been updated.`);
    } catch (error) {
      console.error("Error updating tutor:", error);
      showErrorToast("Failed to update profile. Please try again.");
    }
  };

  // --- ROSTER EXPORT LOGIC ---
  const getRosterExportData = () => {
    // 1. Sort roster alphabetically by name first
    const sortedRoster = [...roster].sort((a, b) => a.name.localeCompare(b.name));

    return sortedRoster.map(tutor => {
      const role = (tutor as any).role || 'Tutor';
      
      // 2. Check for weekend availability
      const hasWeekends = tutor.availability?.some(s => s.day === 'Saturday' || s.day === 'Sunday') ? 'Yes' : 'No';
      
      // 3. Check for night availability (Mon-Fri, end time after 17:00 / 5:00 PM)
      const hasNights = tutor.availability?.some(s => {
        if (s.day === 'Saturday' || s.day === 'Sunday') return false;
        const [hours, mins] = s.endTime.split(':').map(Number);
        return hours + (mins / 60) > 17; 
      }) ? 'Yes' : 'No';

      return {
        Name: tutor.name,
        Role: role,
        'Min Hours': tutor.minHours,
        'Max Hours': tutor.maxHours,
        'Night Availability': hasNights,
        'Weekend Availability': hasWeekends,
        'Subject Count': tutor.subjects.length,
        'Subjects': tutor.subjects.join(" | ")
      };
    });
  };

  const handleExportCSV = () => {
    const data = getRosterExportData();
    let csvContent = "Name,Role,Min Hours,Max Hours,Night Availability,Weekend Availability,Subject Count,Subjects\n";

    data.forEach(row => {
      csvContent += `"${row.Name}","${row.Role}","${row['Min Hours']}","${row['Max Hours']}","${row['Night Availability']}","${row['Weekend Availability']}","${row['Subject Count']}","${row.Subjects}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'educator_roster.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const data = getRosterExportData();
    const worksheet = XLSX.utils.json_to_sheet(data, { 
        header: ["Name", "Role", "Min Hours", "Max Hours", "Night Availability", "Weekend Availability", "Subject Count", "Subjects"] 
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Educator Roster");
    XLSX.writeFile(workbook, "educator_roster.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Peer Educator Roster", 14, 20);

    let currentY = 30;
    const data = getRosterExportData();

    // We use a custom loop here instead of autoTable to create the "Profile" look
    data.forEach(row => {
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${row.Name} (${row.Role})`, 14, currentY);
      
      currentY += 7;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Target Hours: ${row['Min Hours']} - ${row['Max Hours']} hrs/week | Nights: ${row['Night Availability']} | Weekends: ${row['Weekend Availability']}`, 14, currentY);
      
      currentY += 6;
      // Replace the standard pipes with commas so it reads like a standard sentence
      const subjectsText = `Subjects Supported (${row['Subject Count']}): ${row.Subjects.replace(/ \| /g, ', ')}`;
      const splitSubjects = doc.splitTextToSize(subjectsText, 180);
      doc.text(splitSubjects, 14, currentY);
      
      // Add dynamic padding based on how many lines of subjects there were
      currentY += (splitSubjects.length * 6) + 8; 
    });

    doc.save("educator_roster.pdf");
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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          
          {/* --- MODERN EXPORT MENU --- */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowExportModal(!showExportModal)} 
              style={{ padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.1rem', height: '1.1rem' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Roster ▾
            </button>

            {showExportModal && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: '160px' }}>
                <button 
                  onClick={() => { handleExportCSV(); setShowExportModal(false); }} 
                  style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📄 CSV File
                </button>
                <button 
                  onClick={() => { handleExportExcel(); setShowExportModal(false); }} 
                  style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📊 Excel (.xlsx)
                </button>
                <button 
                  onClick={() => { handleExportPDF(); setShowExportModal(false); }} 
                  style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: '500', color: '#334155' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📕 PDF Document
                </button>
              </div>
            )}
          </div>

          <button onClick={handleResetClick} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #f87171', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Reset Roster</button>
        </div>
      </div>

      {/* Filters Container */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: '1.2rem', height: '1.2rem', color: '#94a3b8' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          
          <input 
            type="text" 
            placeholder="Search peer educators by name..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.05rem', boxSizing: 'border-box' }} 
          />
        </div>
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
                <button onClick={(e) => handleDeleteClick(tutor.id, tutor.name, e)} style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }}>Remove</button>
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
      
      {/* ------------------------------------------------------------- */}
      {/* ------------------------- MODALS ---------------------------- */}
      {/* ------------------------------------------------------------- */}

      {/* 1. Edit Tutor Modal */}
      {editingTutor && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Edit {editingTutor.name}'s Profile</h2>
            <TutorForm initialData={editingTutor} onSubmit={handleSaveEdit} onCancel={() => setEditingTutor(null)} showToast={showToast} showErrorToast={showErrorToast} />
          </div>
        </div>
      )}

      {/* 2. Delete Confirmation Modal */}
      {tutorToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.4rem' }}>Remove Peer Educator</h3>
            <p style={{ color: '#475569', marginBottom: '2rem', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete <strong>{tutorToDelete.name}</strong> from the database? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setTutorToDelete(null)} 
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
                {isProcessing ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Reset Roster Modal */}
      {isResetModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2.5rem', borderRadius: '8px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#ef4444', marginBottom: '1rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Reset Entire Roster</h3>
            </div>
            
            <p style={{ color: '#475569', marginBottom: '1rem', lineHeight: '1.5' }}>
              This will permanently delete <strong>ALL {roster.length} peer educators</strong> from the active database. Your previously Saved Schedules will remain intact.
            </p>
            <p style={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              To confirm, type "RESET" in the box below:
            </p>
            
            <input 
              type="text" 
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder="RESET"
              disabled={isProcessing}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1.1rem', marginBottom: '2rem', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsResetModalOpen(false)} 
                disabled={isProcessing}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmReset} 
                disabled={isProcessing || resetInput !== 'RESET'}
                style={{ padding: '0.6rem 1.25rem', backgroundColor: resetInput === 'RESET' ? '#ef4444' : '#fca5a5', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: (isProcessing || resetInput !== 'RESET') ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
              >
                {isProcessing ? 'Clearing Database...' : 'Permanently Reset Roster'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}