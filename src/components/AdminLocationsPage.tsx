import React, { useState, useEffect } from 'react';
import { getAllLocations, saveLocation, removeLocation } from '../services/locationService';
import type { Location } from '../types';

interface AdminLocationsPageProps {
  showToast: (message: string) => void;
  showErrorToast: (message: string) => void;
}

export function AdminLocationsPage({ showToast, showErrorToast }: AdminLocationsPageProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationName, setLocationName] = useState('');
  const [locationType, setLocationType] = useState<'In-Person' | 'Virtual'>('In-Person');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const data = await getAllLocations();
      setLocations(data);
    } catch (error: any) {
      console.error("Error fetching locations:", error);
      showErrorToast("Failed to fetch locations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationName.trim()) return;

    try {
      setSubmitting(true);
      const locId = editingId || crypto.randomUUID();
      const locData: Location = {
        id: locId,
        name: locationName.trim(),
        type: locationType
      };
      
      await saveLocation(locData);
      
      const isUpdating = editingId !== null;
      
      setLocationName('');
      setLocationType('In-Person');
      setEditingId(null);
      
      await fetchLocations();
      showToast(isUpdating ? `${locData.name} successfully updated.` : `${locData.name} successfully added.`);
    } catch (error) {
      console.error("Error saving location:", error);
      showErrorToast("Failed to save location. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (loc: Location) => {
    setLocationName(loc.name);
    setLocationType(loc.type || 'In-Person');
    setEditingId(loc.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setLocationName('');
    setLocationType('In-Person');
    setEditingId(null);
  };

  const handleDeleteClick = (loc: Location) => {
    setLocationToDelete(loc); 
  };

  const confirmDelete = async () => {
    if (!locationToDelete) return;
    
    try {
      await removeLocation(locationToDelete.id);
      setLocations(prev => prev.filter(loc => loc.id !== locationToDelete.id));
      showToast(`${locationToDelete.name} has been removed.`);
      setLocationToDelete(null);
    } catch (error) {
      console.error("Error deleting location:", error);
      showErrorToast("Failed to delete location. Please try again.");
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading locations...</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.8rem' }}>Location Management</h2>
      </div>
      
      {/* Add / Edit Form */}
      <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0, color: '#1e293b' }}>
          {editingId ? `Editing Location` : 'Add New Location'}
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 'bold' }}>Location Name / Building / URL</label>
            <input 
              type="text" 
              placeholder="e.g., SSC 600" 
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              required
              disabled={submitting}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: '0 0 150px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', color: '#475569', marginBottom: '0.25rem', fontWeight: 'bold' }}>Type</label>
            <select 
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as 'In-Person' | 'Virtual')}
              disabled={submitting}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
            >
              <option value="In-Person">In-Person</option>
              <option value="Virtual">Virtual / Zoom</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={submitting} style={{ padding: '0.75rem 1.5rem', backgroundColor: editingId ? '#f59e0b' : '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              {submitting ? 'Working...' : editingId ? 'Update' : 'Add Location'}
            </button>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} disabled={submitting} style={{ padding: '0.75rem 1rem', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Locations List */}
      <h3 style={{ margin: '0 0 1rem 0' }}>Active Locations ({locations.length})</h3>

      {locations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
          No locations added yet. You can add default locations like SSC 600 or Zoom here.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {locations.map(loc => (
            <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div>
                <h4 style={{ margin: '0 0 0.25rem 0', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {loc.name}
                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '12px', backgroundColor: loc.type === 'Virtual' ? '#ede9fe' : '#e0f2fe', color: loc.type === 'Virtual' ? '#059669' : '#0284c7', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {loc.type}
                  </span>
                </h4>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => handleEditClick(loc)}
                  style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteClick(loc)}
                  style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {locationToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ marginTop: 0, color: '#0f172a', fontSize: '1.4rem' }}>Remove Location</h3>
            <p style={{ color: '#475569', marginBottom: '2rem', lineHeight: '1.5' }}>
              Are you sure you want to permanently remove <strong>{locationToDelete.name}</strong>? 
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setLocationToDelete(null)} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                style={{ padding: '0.6rem 1.25rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}