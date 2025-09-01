import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';

const { width, height } = Dimensions.get('window');

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'dofb3wbqz';
const CLOUDINARY_UPLOAD_PRESET = 'connexaupload';

const ChatAttachmentModal = ({
  visible,
  onClose,
  onAttachmentSelected,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Animation values
  const slideAnim = React.useRef(new Animated.Value(height)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Upload to Cloudinary
  const uploadToCloudinary = async (uri, resourceType = 'auto') => {
    try {
      setUploadProgress('Uploading...');
      
      const formData = new FormData();
      const fileExtension = uri.split('.').pop();
      const fileName = `chat_attachment_${Date.now()}.${fileExtension}`;
      
      formData.append('file', {
        uri: uri,
        type: resourceType === 'video' ? `video/${fileExtension}` : resourceType === 'image' ? `image/${fileExtension}` : 'application/octet-stream',
        name: fileName,
      });
      
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
      formData.append('resource_type', resourceType);
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error?.message || 'Upload failed');
      }
      
      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        url: result.url,
        resourceType: result.resource_type,
        format: result.format,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        duration: result.duration,
        fileName: fileName,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('Failed to upload file. Please try again.');
    }
  };

  // Handle document picker
  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.size > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a file smaller than 10MB.');
          return;
        }

        setIsUploading(true);
        
        try {
          const uploadResult = await uploadToCloudinary(asset.uri, 'raw');

          const attachmentData = {
            type: 'document',
            fileName: asset.name,
            fileSize: asset.size,
            mimeType: asset.mimeType,
            url: uploadResult.secureUrl,
            cloudinaryPublicId: uploadResult.publicId,
            timestamp: Date.now(),
          };

          onAttachmentSelected(attachmentData);
          onClose();
        } catch (error) {
          Alert.alert('Upload Failed', error.message);
        } finally {
          setIsUploading(false);
          setUploadProgress('');
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  // Handle camera
  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permission.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await handleMediaUpload(asset);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera.');
    }
  };

  // Handle photos
  const handlePhotos = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library permission.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await handleMediaUpload(asset);
      }
    } catch (error) {
      console.error('Photo picker error:', error);
      Alert.alert('Error', 'Failed to pick photo.');
    }
  };

  // Handle videos
  const handleVideos = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library permission.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await handleMediaUpload(asset);
      }
    } catch (error) {
      console.error('Video picker error:', error);
      Alert.alert('Error', 'Failed to pick video.');
    }
  };

  // Handle media upload
  const handleMediaUpload = async (asset) => {
    try {
      setIsUploading(true);
      
      const isVideo = asset.type === 'video';
      const resourceType = isVideo ? 'video' : 'image';

      const uploadResult = await uploadToCloudinary(asset.uri, resourceType);

      const attachmentData = {
        type: isVideo ? 'video' : 'image',
        url: uploadResult.secureUrl,
        cloudinaryPublicId: uploadResult.publicId,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.bytes,
        width: asset.width || uploadResult.width,
        height: asset.height || uploadResult.height,
        duration: asset.duration || uploadResult.duration || null,
        format: uploadResult.format,
        timestamp: Date.now(),
      };

      onAttachmentSelected(attachmentData);
      onClose();
    } catch (error) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Handle location
  const handleLocation = async () => {
    try {
      setIsUploading(true);
      setUploadProgress('Getting location...');

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant location permission.');
        setIsUploading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const addressResults = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let address = 'Location';
      if (addressResults.length > 0) {
        const addr = addressResults[0];
        address = [addr.street, addr.city, addr.region, addr.country]
          .filter(Boolean)
          .join(', ');
      }

      const attachmentData = {
        type: 'location',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: address,
        accuracy: location.coords.accuracy,
        timestamp: Date.now(),
      };

      onAttachmentSelected(attachmentData);
      onClose();
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get location.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  // Handle contacts
  const handleContact = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant contacts permission.');
        return;
      }

      setIsUploading(true);
      setUploadProgress('Loading contacts...');

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      setIsUploading(false);
      setUploadProgress('');

      if (data.length === 0) {
        Alert.alert('No Contacts', 'No contacts found on this device.');
        return;
      }

      const validContacts = data.filter(contact => {
        const hasName = contact.name || contact.firstName || contact.lastName;
        const hasPhone = contact.phoneNumbers && contact.phoneNumbers.length > 0;
        return hasName && hasPhone;
      }).map(contact => {
        const displayName = contact.name || 
                           (contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : 
                            contact.firstName || contact.lastName || 'Unknown Contact');
        
        return {
          ...contact,
          displayName: displayName
        };
      });

      if (validContacts.length === 0) {
        Alert.alert('No Contacts', 'No valid contacts with phone numbers found.');
        return;
      }

      showContactSelection(validContacts);

    } catch (error) {
      setIsUploading(false);
      setUploadProgress('');
      console.error('Contact error:', error);
      Alert.alert('Error', 'Failed to load contacts.');
    }
  };

  // Show contact selection
  const showContactSelection = (contacts) => {
    Alert.alert(
      'Select Contact',
      `Choose a contact to share (${contacts.length} contacts found):`,
      [
        ...contacts.slice(0, 10).map((contact) => ({
          text: `${contact.displayName} (${contact.phoneNumbers[0].number})`,
          onPress: () => {
            const attachmentData = {
              type: 'contact',
              name: contact.displayName,
              phoneNumbers: contact.phoneNumbers || [],
              emails: contact.emails || [],
              timestamp: Date.now(),
            };
            onAttachmentSelected(attachmentData);
            onClose();
          }
        })),
        ...(contacts.length > 10 ? [{
          text: `📋 View All ${contacts.length} Contacts`,
          onPress: () => showAllContacts(contacts)
        }] : []),
        { text: 'Cancel', style: 'cancel' }
      ],
      { cancelable: true }
    );
  };

  // Show all contacts in batches
  const showAllContacts = (contacts) => {
    const batchSize = 15;

    const showBatch = (startIndex) => {
      const endIndex = Math.min(startIndex + batchSize, contacts.length);
      const batch = contacts.slice(startIndex, endIndex);
      
      const options = batch.map((contact) => ({
        text: `${contact.displayName} (${contact.phoneNumbers[0].number})`,
        onPress: () => {
          const attachmentData = {
            type: 'contact',
            name: contact.displayName,
            phoneNumbers: contact.phoneNumbers || [],
            emails: contact.emails || [],
            timestamp: Date.now(),
          };
          onAttachmentSelected(attachmentData);
          onClose();
        }
      }));

      if (endIndex < contacts.length) {
        options.push({
          text: `📄 Next ${Math.min(batchSize, contacts.length - endIndex)} Contacts`,
          onPress: () => showBatch(endIndex)
        });
      }
      
      if (startIndex > 0) {
        options.push({
          text: '⬅️ Previous Contacts',
          onPress: () => showBatch(Math.max(0, startIndex - batchSize))
        });
      }

      options.push({ text: 'Cancel', style: 'cancel' });

      Alert.alert(
        `Contacts ${startIndex + 1}-${endIndex} of ${contacts.length}`,
        'Select a contact to share:',
        options,
        { cancelable: true }
      );
    };

    showBatch(0);
  };

  // Attachment options
  const attachmentOptions = [
    {
      id: 'document',
      title: 'Document',
      icon: 'insert-drive-file',
      color: '#5E5CE6',
      onPress: handleDocumentPick,
    },
    {
      id: 'camera',
      title: 'Camera',
      icon: 'camera-alt',
      color: '#FF9500',
      onPress: handleCamera,
    },
    {
      id: 'photos',
      title: 'Photos',
      icon: 'photo-library',
      color: '#34C759',
      onPress: handlePhotos,
    },
    {
      id: 'videos',
      title: 'Videos',
      icon: 'videocam',
      color: '#FF2D55',
      onPress: handleVideos,
    },
    {
      id: 'location',
      title: 'Location',
      icon: 'location-on',
      color: '#FF3B30',
      onPress: handleLocation,
    },
    {
      id: 'contact',
      title: 'Contact',
      icon: 'contact-phone',
      color: '#007AFF',
      onPress: handleContact,
    },
  ];

  const handleClose = () => {
    if (!isUploading) {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={handleClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {isUploading && (
            <View style={styles.uploadContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.uploadText}>{uploadProgress}</Text>
            </View>
          )}

          <View style={styles.optionsContainer}>
            <View style={styles.optionsGrid}>
              {attachmentOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.optionItem}
                  onPress={option.onPress}
                  disabled={isUploading}
                >
                  <View style={[styles.optionIcon, { backgroundColor: option.color }]}>
                    <MaterialIcons
                      name={option.icon}
                      size={24}
                      color="white"
                    />
                  </View>
                  <Text style={styles.optionText}>{option.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.safeArea} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '50%',
  },
  uploadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  uploadText: {
    marginLeft: 10,
    fontSize: 14,
  },
  optionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 25,
  },
  optionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  safeArea: {
    height: 30,
  },
});

export default ChatAttachmentModal;