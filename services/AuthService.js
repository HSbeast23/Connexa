import { auth } from './FireBase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './FireBase';

/**
 * Updates the user's online status in Firestore
 * @param {string} userId - The user's ID
 * @param {boolean} isOnline - Whether the user is online or not
 * @returns {Promise<void>}
 */
export const updateOnlineStatus = async (userId, isOnline) => {
  if (!userId) return;
  
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      isOnline: isOnline,
      lastSeen: isOnline ? null : serverTimestamp()
    });
    console.log(`User ${userId} online status updated to ${isOnline}`);
  } catch (error) {
    console.error("Error updating online status:", error);
  }
};

/**
 * Signs out the current user and updates their online status
 * @returns {Promise<{ success: boolean, error: string | null }>}
 */
export const logoutUser = async () => {
  try {
    // Get current user before signing out
    const userId = auth.currentUser?.uid;
    
    // Sign out with Firebase Auth
    await signOut(auth);
    
    // Update the user's online status
    if (userId) {
      await updateOnlineStatus(userId, false);
    }
    
    return { success: true, error: null };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Setup online status tracking for the current user
 * This should be called when the app starts and the user is authenticated
 */
export const setupOnlineStatusTracking = (userId) => {
  if (!userId) return;
  
  // Update user status to online when connected
  updateOnlineStatus(userId, true);
  
  // Set up event listeners for app state changes
  // Note: For a complete implementation, you would integrate this with
  // AppState from react-native to detect when app goes to background
  
  // Handle page unload / app close
  const handleAppClose = () => {
    updateOnlineStatus(userId, false);
  };
  
  // Clean up when needed (in component unmount)
  return () => {
    handleAppClose();
  };
};
