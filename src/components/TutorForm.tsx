import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AvailabilityGrid } from './AvailabilityGrid';
import { SubjectSelector } from './SubjectSelector';
import type { Tutor, TimeSlot, DayOfWeek } from '../types';

interface TutorFormProps {
  onSubmit: (newTutor: Tutor) => void;
}

export function TutorForm({ onSubmit }: TutorFormProps) {
  const [name, setName] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [minHours, setMinHours] = useState<number>(2);
  const [maxHours, setMaxHours] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // This Set holds strings like "Monday-09:30"
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSlots.size === 0) {
      alert("Please highlight at least one available time slot!");
      return;
    }

    setIsSubmitting(true);

    if (selectedSubjects.length === 0) {
      alert("Please select at least one subject!");
      setIsSubmitting(false);
      return;
    }

    // Convert the Grid Set back into the TimeSlot array our algorithm expects
    const availability: TimeSlot[] = Array.from(selectedSlots).map(slotId => {
      const [day, startTime] = slotId.split('-'); // e.g., "Monday" and "09:30"
      
      // Calculate end time (add 30 minutes)
      const [hours, mins] = startTime.split(':').map(Number);
      let endHours = hours;
      let endMins = mins + 30;
      if (endMins === 60) {
        endHours += 1;
        endMins = 0;
      }
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins === 0 ? '00' : '30'}`;

      return {
        day: day as DayOfWeek,
        startTime,
        endTime
      };
    });

    const newTutor: Tutor = {
      id: crypto.randomUUID(),
      name,
      subjects: selectedSubjects,
      minHours,
      maxHours,
      availability
    };

    try {
      await setDoc(doc(db, 'tutors', newTutor.id), newTutor);
      onSubmit(newTutor);

      // Reset form
      setName('');
      setSelectedSubjects([]);
      setSelectedSlots(new Set());
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Failed to save to database. Check the console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#fff', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
      <h2 style={{ marginTop: 0, color: '#0f172a' }}>Add New Tutor</h2>
      
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label><strong>Name:</strong></label><br/>
          <input required value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} placeholder="e.g., Jane Doe" />
        </div>
        
        <div>
          <label><strong>Courses Tutoring:</strong></label><br/>
          <SubjectSelector 
            selectedSubjects={selectedSubjects} 
            onChange={setSelectedSubjects} 
          />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div>
            <label><strong>Min Hours:</strong></label><br/>
            <input type="number" required min="1" value={minHours} onChange={e => setMinHours(Number(e.target.value))} style={{ width: '80px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
          </div>
          <div>
            <label><strong>Max Hours:</strong></label><br/>
            <input type="number" required min={minHours} value={maxHours} onChange={e => setMaxHours(Number(e.target.value))} style={{ width: '80px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
          </div>
        </div>
      </div>

      <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

      <h3 style={{ marginBottom: '0.5rem' }}>Availability</h3>
      
      {/* Inject the Grid Here */}
      <AvailabilityGrid 
        selectedSlots={selectedSlots} 
        onChange={setSelectedSlots} 
      />

      <br />
      <button 
        type="submit" 
        disabled={isSubmitting}
        style={{ 
          padding: '0.75rem 2rem', 
          backgroundColor: isSubmitting ? '#94a3b8' : '#3b82f6', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px', 
          cursor: isSubmitting ? 'not-allowed' : 'pointer', 
          fontSize: '1.1rem', 
          width: '100%',
          marginTop: '1rem'
        }}
      >
        {isSubmitting ? 'Saving...' : 'Save Tutor & Update Schedule'}
      </button>
    </form>
  );
}