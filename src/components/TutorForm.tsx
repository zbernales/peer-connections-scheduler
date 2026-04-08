// src/components/TutorForm.tsx
import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Tutor, TimeSlot, DayOfWeek } from '../types';

interface TutorFormProps {
  onSubmit: (newTutor: Tutor) => void;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function TutorForm({ onSubmit }: TutorFormProps) {
  // --- Basic Info State ---
  const [name, setName] = useState('');
  const [subjectsInput, setSubjectsInput] = useState(''); // We'll split this by comma later
  const [minHours, setMinHours] = useState<number>(2);
  const [maxHours, setMaxHours] = useState<number>(10);

  // --- Dynamic Availability State ---
  const [availability, setAvailability] = useState<TimeSlot[]>([
    { day: 'Monday', startTime: '09:00', endTime: '12:00' } // Start with one default slot
  ]);

  // Helper to update a specific time slot
  const updateSlot = (index: number, field: keyof TimeSlot, value: string) => {
    const newAvailability = [...availability];
    newAvailability[index] = { ...newAvailability[index], [field]: value };
    setAvailability(newAvailability);
  };

  // Helper to add a new blank time slot
  const addSlot = () => {
    setAvailability([...availability, { day: 'Monday', startTime: '09:00', endTime: '12:00' }]);
  };

  // Helper to remove a time slot
  const removeSlot = (index: number) => {
    setAvailability(availability.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Hello');

    const subjectsArray = subjectsInput
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s !== '');

    const newTutor: Tutor = {
      id: crypto.randomUUID(),
      name,
      subjects: subjectsArray,
      minHours,
      maxHours,
      availability
    };

    try {
      // Send the data to the 'tutors' collection in Firestore!
      await setDoc(doc(db, 'tutors', newTutor.id), newTutor);
      
      // Tell App.tsx we finished (optional, but good for showing the success alert)
      onSubmit(newTutor);

      // Reset form
      setName('');
      setSubjectsInput('');
      setAvailability([{ day: 'Monday', startTime: '09:00', endTime: '12:00' }]);
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Failed to save to database. Check the console.");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#f8fafc', marginBottom: '2rem' }}>
      <h2 style={{ marginTop: 0 }}>Add New Tutor</h2>
      
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label><strong>Name:</strong></label><br/>
          <input required value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g., Jane Doe" />
        </div>
        
        <div>
          <label><strong>Subjects (comma separated):</strong></label><br/>
          <input required value={subjectsInput} onChange={e => setSubjectsInput(e.target.value)} style={{ width: '100%', padding: '0.5rem' }} placeholder="e.g., CS146, MATH32" />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div>
            <label><strong>Min Hours:</strong></label><br/>
            <input type="number" required min="1" value={minHours} onChange={e => setMinHours(Number(e.target.value))} style={{ width: '80px', padding: '0.5rem' }} />
          </div>
          <div>
            <label><strong>Max Hours:</strong></label><br/>
            <input type="number" required min={minHours} value={maxHours} onChange={e => setMaxHours(Number(e.target.value))} style={{ width: '80px', padding: '0.5rem' }} />
          </div>
        </div>
      </div>

      <hr />

      <h3>Availability</h3>
      {availability.map((slot, index) => (
        <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <select value={slot.day} onChange={e => updateSlot(index, 'day', e.target.value)} style={{ padding: '0.5rem' }}>
            {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
          </select>
          
          <input type="time" required value={slot.startTime} onChange={e => updateSlot(index, 'startTime', e.target.value)} style={{ padding: '0.5rem' }} />
          <span>to</span>
          <input type="time" required value={slot.endTime} onChange={e => updateSlot(index, 'endTime', e.target.value)} style={{ padding: '0.5rem' }} />
          
          {availability.length > 1 && (
            <button type="button" onClick={() => removeSlot(index)} style={{ padding: '0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              X
            </button>
          )}
        </div>
      ))}
      
      <button type="button" onClick={addSlot} style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
        + Add Time Slot
      </button>

      <br />
      <button type="submit" style={{ padding: '0.75rem 2rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1.1rem', width: '100%' }}>
        Save Tutor & Update Schedule
      </button>
    </form>
  );
}