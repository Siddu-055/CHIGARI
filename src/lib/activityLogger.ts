import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';

export const logActivity = async (
  profile: UserProfile | null,
  action: string,
  details: string,
  fallbackUser?: { uid: string; email: string; role: string }
) => {
  try {
    const userToLog = profile || fallbackUser;
    if (!userToLog) return;
    await addDoc(collection(db, 'system_logs'), {
      userId: userToLog.uid,
      userEmail: userToLog.email,
      userRole: userToLog.role,
      action,
      details,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
