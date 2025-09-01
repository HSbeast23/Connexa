import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../services/FireBase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { logoutUser } from '../services/AuthService';

// Cloudinary config
const CLOUD_NAME = 'dofb3wbqz';
const UPLOAD_PRESET = 'ConnexaProfile';

const ProfileScreen = ({ navigation, route = {} }) => {
  const { isNewUser = false } = route.params || {};
  
  const [formData, setFormData] = useState({
    displayName: auth.currentUser?.displayName || '',
    bio: '',
    email: auth.currentUser?.email || '',
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatar, setAvatar] = useState(auth.currentUser?.photoURL || null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const timeoutRef = useRef(null);

  useEffect(() => {
    const loadUserData = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFormData(prev => ({
            ...prev,
            displayName: userData.displayName || '',
            bio: userData.bio || '',
            email: userData.email || auth.currentUser?.email || ''
          }));
          setPhoneNumber(userData.phoneNumber || '');
          if (userData.photoURL) setAvatar(userData.photoURL);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        Alert.alert('Error', 'Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();

    // Cleanup timeout on unmount
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const uploadImageToCloudinary = async (uri) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'image/jpeg',
        name: `profile_${Date.now()}.jpg`,
      });
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('cloud_name', CLOUD_NAME);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Upload failed');
      return data.secure_url;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.displayName.trim()) errors.displayName = 'Display name is required';
    if (!phoneNumber.trim()) errors.phoneNumber = 'Phone number is required';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setIsUploading(true);

      let photoURL = avatar;
      if (avatar && (avatar.startsWith('file:') || avatar.startsWith('content:'))) {
        photoURL = await uploadImageToCloudinary(avatar);
      }

      const userData = {
        displayName: formData.displayName.trim(),
        bio: formData.bio.trim(),
        phoneNumber: phoneNumber.trim(),
        email: formData.email.trim(),
        photoURL,
        updatedAt: new Date().toISOString(),
      };

      await Promise.all([
        updateProfile(auth.currentUser, { displayName: userData.displayName, photoURL }),
        setDoc(doc(db, 'users', auth.currentUser.uid), userData, { merge: true })
      ]);

      // Navigate safely after save
      timeoutRef.current = setTimeout(() => {
        if (navigation?.navigate) navigation.navigate('Home');
      }, 500);

    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4361EE" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {isNewUser ? 'Complete Your Profile' : 'Edit Profile'}
            </Text>
          </View>

          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={pickImage} style={styles.avatarButton}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <MaterialIcons name="add-a-photo" size={32} color="#666" />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.avatarText}>{avatar ? 'Change Photo' : 'Add Photo'}</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={[styles.input, validationErrors.displayName && styles.inputError]}
              value={formData.displayName}
              onChangeText={(text) => handleInputChange('displayName', text)}
              placeholder="Enter your name"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              autoCapitalize="words"
              returnKeyType="next"
            />
            {validationErrors.displayName && <Text style={styles.errorText}>{validationErrors.displayName}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput 
              style={[styles.input, styles.disabledInput]} 
              value={formData.email} 
              editable={false} 
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={formData.bio}
              onChangeText={(text) => handleInputChange('bio', text)}
              placeholder="Tell us about yourself"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, validationErrors.phoneNumber && styles.inputError]}
              placeholder="Enter your phone number"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              returnKeyType="done"
            />
            {validationErrors.phoneNumber && <Text style={styles.errorText}>{validationErrors.phoneNumber}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isUploading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isUploading}
            activeOpacity={0.8}
          >
            {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{isNewUser ? 'Continue' : 'Save Profile'}</Text>}
          </TouchableOpacity>
          
          {!isNewUser && (
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={async () => {
                Alert.alert(
                  'Logout',
                  'Are you sure you want to logout?',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel'
                    },
                    {
                      text: 'Logout',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          setLoading(true);
                          const result = await logoutUser();
                          if (result.success) {
                            navigation.replace('Login');
                          } else {
                            Alert.alert('Error', result.error || 'Failed to logout');
                            setLoading(false);
                          }
                        } catch (error) {
                          console.error('Logout error:', error);
                          Alert.alert('Error', 'An unexpected error occurred');
                          setLoading(false);
                        }
                      }
                    }
                  ]
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#302b63' 
  },
  scrollContainer: { 
    padding: 24, 
    paddingBottom: 40 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#302b63'
  },
  header: { 
    marginBottom: 24,
    paddingTop: 16
  },
  headerTitle: { 
    fontSize: 28, 
    fontFamily: 'Poppins-SemiBold', 
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: -0.5,
  },
  avatarContainer: { 
    alignItems: 'center', 
    marginBottom: 32 
  },
  avatarButton: { 
    borderRadius: 75, 
    overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  avatar: { 
    width: 120, 
    height: 120, 
    borderRadius: 60 
  },
  avatarPlaceholder: { 
    width: 120, 
    height: 120, 
    borderRadius: 60, 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  avatarText: { 
    marginTop: 12, 
    fontFamily: 'Poppins-Medium', 
    color: '#a5b4fc',
    fontSize: 14
  },
  formGroup: { 
    marginBottom: 20 
  },
  label: { 
    fontFamily: 'Poppins-Medium', 
    fontSize: 14,
    marginBottom: 8, 
    color: '#a5b4fc',
    marginLeft: 4
  },
  input: { 
    borderWidth: 1.5, 
    borderColor: 'rgba(255, 255, 255, 0.2)', 
    borderRadius: 12, 
    padding: 16, 
    fontFamily: 'Poppins-Medium', 
    fontSize: 16,
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
    height: 56
  },
  disabledInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bioInput: { 
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16
  },
  inputError: { 
    borderColor: '#ef4444' 
  },
  errorText: { 
    color: '#ef4444', 
    marginTop: 4, 
    marginLeft: 4,
    fontFamily: 'Poppins-Regular',
    fontSize: 12
  },
  saveButton: { 
    backgroundColor: '#6366f1', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 16,
    height: 56,
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: { 
    backgroundColor: 'rgba(255, 255, 255, 0.3)' 
  },
  saveButtonText: { 
    color: '#fff', 
    fontFamily: 'Poppins-SemiBold', 
    fontSize: 16 
  },
  logoutButton: { 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    height: 56,
    justifyContent: 'center'
  },
  logoutButtonText: { 
    color: '#ef4444', 
    fontFamily: 'Poppins-SemiBold', 
    fontSize: 16 
  },
});

export default ProfileScreen;
