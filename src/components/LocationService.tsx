import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Location } from '../types';

const LOCATIONS_COLLECTION = 'locations';

export const getAllLocations = async (): Promise<Location[]> => {
  const locationsRef = collection(db, LOCATIONS_COLLECTION);
  const querySnapshot = await getDocs(locationsRef);
  
  const locations = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Location));

  return locations.sort((a, b) => a.name.localeCompare(b.name));
};

export const saveLocation = async (location: Location): Promise<void> => {
  const locationRef = doc(db, LOCATIONS_COLLECTION, location.id);
  await setDoc(locationRef, {
    id: location.id,
    name: location.name.trim(),
    type: location.type,
    updatedAt: Date.now()
  });
};

export const removeLocation = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, LOCATIONS_COLLECTION, id));
};