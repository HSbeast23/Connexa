// Firebase configuration and utility functions
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  updateProfile 
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDhFTcLi_EsHFGxPNv5UZlFus7YHNUxJpQ",
  authDomain: "connexa-chatapp-a0ba1.firebaseapp.com",
  projectId: "connexa-chatapp-a0ba1",
  storageBucket: "connexa-chatapp-a0ba1.appspot.com",
  messagingSenderId: "954750581479",
  appId: "1:954750581479:web:f6bb6f4e96aa826272c042",
  measurementId: "G-JEMC7ZYT3Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics
const analytics = getAnalytics(app);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Auth functions
export const registerUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error: error.message };
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateUserProfile = async (displayName, photoURL) => {
  try {
    await updateProfile(auth.currentUser, { displayName, photoURL });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Firestore functions
export const createUserProfile = async (userId, userData) => {
  try {
    await setDoc(doc(db, "users", userId), {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getUserProfile = async (userId) => {
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { data: docSnap.data(), error: null };
    } else {
      return { data: null, error: "No user profile found" };
    }
  } catch (error) {
    return { data: null, error: error.message };
  }
};

export const updateUserData = async (userId, userData) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: new Date(),
    });
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Storage functions
export const uploadProfilePicture = async (userId, uri) => {
  try {
    console.log("Starting upload for image:", uri);
    
    // Get the current user's ID token for authentication
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Create a unique filename
    const filename = `profile_${userId}_${Date.now()}.jpg`;
    const storagePath = `profile_pictures/${filename}`;
    
    // Convert the local file URI to a blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    if (blob.size === 0) {
      throw new Error("Cannot upload empty image file");
    }
    
    // Create a reference to the file in Firebase Storage
    const storageRef = ref(storage, storagePath);
    
    // Upload the file using Firebase Storage SDK
    const uploadTask = uploadBytesResumable(storageRef, blob, {
      contentType: 'image/jpeg',
    });
    
    // Wait for the upload to complete
    await uploadTask;
    
    // Get the download URL
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
    console.log('File uploaded successfully:', downloadURL);
    
    return { url: downloadURL, error: null };
    
  } catch (error) {
    console.error("Upload error:", error);
    return { 
      url: null, 
      error: error.message || "Failed to upload image. Please try again." 
    };
  }
};

export { 
  auth, 
  db, 
  storage
}