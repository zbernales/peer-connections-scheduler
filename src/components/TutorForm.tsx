import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AvailabilityGrid } from './AvailabilityGrid';
import { SubjectSelector } from './SubjectSelector';
import { timeToFloat, floatToTime } from '../utils/scheduler';
import type { Tutor, TimeSlot, DayOfWeek } from '../types';

interface TutorFormProps {
  onSubmit: (newTutor: Tutor) => void;
  initialData?: Tutor; 
  onCancel?: () => void; 
}

export function TutorForm({ onSubmit, initialData, onCancel }: TutorFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(initialData?.subjects || []);
  const [minHours, setMinHours] = useState<number>(initialData?.minHours || 2);
  const [maxHours, setMaxHours] = useState<number>(initialData?.maxHours || 6);
  
  // NEW: State to track if the night grid should be shown
  const [canTutorAtNight, setCanTutorAtNight] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultSlots = new Set<string>();
  if (initialData?.availability) {
    initialData.availability.forEach(slot => {
      let current = timeToFloat(slot.startTime);
      const end = timeToFloat(slot.endTime);

      while (current < end) {
        defaultSlots.add(`${slot.day}-${floatToTime(current)}`);
        current += 0.5;
      }
    });
  }
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(defaultSlots);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSlots.size === 0) {
      alert("Please highlight at least one available time slot!");
      return;
    }

    if (selectedSubjects.length === 0) {
      alert("Please select at least one subject!");
      return;
    }

    setIsSubmitting(true);

    const availability: TimeSlot[] = Array.from(selectedSlots).map(slotId => {
      const [day, startTime] = slotId.split('-'); 
      
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
      id: initialData?.id || crypto.randomUUID(), 
      name,
      subjects: selectedSubjects,
      minHours,
      maxHours,
      availability
    };

    try {
      await setDoc(doc(db, 'tutors', newTutor.id), newTutor);
      onSubmit(newTutor);

      if (!initialData) {
        setName('');
        setSelectedSubjects([]);
        setSelectedSlots(new Set());
        setMinHours(2);
        setMaxHours(6);
        setCanTutorAtNight(false); // Reset the toggle
      }
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Failed to save to database. Check the console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#fff', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
      <h2 style={{ marginTop: 0, color: '#0f172a' }}>
        {initialData ? `Edit ${initialData.name}` : 'Add New Tutor'}
      </h2>
      
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

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            <strong>Target Weekly Hours for Tutoring</strong>
          </label>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', color: '#475569' }}>Low:</label><br/>
              <input 
                type="number" 
                required 
                min="2" 
                max="6" 
                value={minHours} 
                onChange={e => setMinHours(Number(e.target.value))} 
                style={{ width: '80px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '0.25rem' }} 
              />
            </div>
            
            <span style={{ color: '#94a3b8', marginTop: '1.5rem' }}>—</span>
            
            <div>
              <label style={{ fontSize: '0.9rem', color: '#475569' }}>High:</label><br/>
              <input 
                type="number" 
                required 
                min={minHours} 
                max="10" 
                value={maxHours} 
                onChange={e => setMaxHours(Number(e.target.value))} 
                style={{ width: '80px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', marginTop: '0.25rem' }} 
              />
            </div>
          </div>
        </div>
      </div>

      <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

      <h3 style={{ marginBottom: '0.5rem' }}>Daytime Availability</h3>
      
      <AvailabilityGrid 
        selectedSlots={selectedSlots} 
        onChange={setSelectedSlots} 
        startHour={9}  // Starts at 9:00 AM
        endHour={17}   // Ends at 5:00 PM
      />

      {/* --- NEW: Night Tutoring Block --- */}
      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={canTutorAtNight} 
            onChange={(e) => setCanTutorAtNight(e.target.checked)} 
            style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
          />
          <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>I am available to tutor at night (5:00 PM - 10:00 PM)</strong>
        </label>

        {canTutorAtNight && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginTop: 0, marginBottom: '0.5rem', color: '#475569' }}>Night Availability</h4>
            <AvailabilityGrid 
              selectedSlots={selectedSlots} 
              onChange={setSelectedSlots} 
              startHour={17} // Starts at 5:00 PM
              endHour={22}   // Ends at 10:00 PM
            />
          </div>
        )}
      </div>
      {/* --------------------------------- */}

      <br />
      
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button 
          type="submit" 
          disabled={isSubmitting}
          style={{ 
            flex: 1,
            padding: '0.75rem 2rem', 
            backgroundColor: isSubmitting ? '#94a3b8' : '#3b82f6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: isSubmitting ? 'not-allowed' : 'pointer', 
            fontSize: '1.1rem', 
          }}
        >
          {isSubmitting ? 'Saving...' : (initialData ? 'Save Changes' : 'Save Tutor')}
        </button>

        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel} 
            style={{ 
              padding: '0.75rem 1.5rem', 
              backgroundColor: '#f1f5f9', 
              color: '#475569', 
              border: '1px solid #cbd5e1', 
              borderRadius: '4px', 
              fontSize: '1rem', 
              cursor: 'pointer' 
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}