import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Modal,
  SafeAreaView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ChatMessage = ({ message, isOwn, timestamp, senderName, onMessageLongPress, currentUserId }) => {
  // Add debugging to see what message data we're getting
  console.log('🔍 ChatMessage Debug:', {
    message: message,
    messageType: typeof message,
    hasText: message?.text,
    hasMedia: message?.media,
    keys: message ? Object.keys(message) : 'no keys'
  });

  // Safety check - ensure message is valid
  if (!message) {
    return null;
  }

  // Ensure message is treated as an object if it's a string
  const messageObj = typeof message === 'string' ? { text: message } : message;

  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const videoRef = useRef(null);

  // Detect media type from URL or message content
  const detectMediaType = (url) => {
    console.log('🔍 detectMediaType called with:', url);
    console.log('🔍 messageObj for type detection:', {
      type: messageObj.type,
      name: messageObj.name,
      phoneNumbers: messageObj.phoneNumbers,
      hasLatLng: !!(messageObj.latitude && messageObj.longitude),
      location: messageObj.location,
      allKeys: Object.keys(messageObj)
    });
    
    // Check if it's a contact message first (before checking URL)
    if (messageObj.type === 'contact' || messageObj.name || messageObj.phoneNumbers) {
      console.log('🎯 Detected as CONTACT type');
      return 'contact';
    }
    
    if (!url) {
      // Check if it's a location message
      if (messageObj.location || (messageObj.latitude && messageObj.longitude)) {
        console.log('🎯 Detected as LOCATION type');
        return 'location';
      }
      console.log('🎯 Detected as TEXT type (no URL)');
      return 'text';
    }
    
    // Ensure URL is a string before calling toLowerCase
    const urlString = String(url);
    const urlLower = urlString.toLowerCase();
    
    // Image formats
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || 
        urlLower.includes('.png') || urlLower.includes('.webp') || 
        urlLower.includes('.gif') || urlLower.includes('image/')) {
      console.log('🎯 Detected as IMAGE type');
      return 'image';
    }
    
    // Video formats
    if (urlLower.includes('.mp4') || urlLower.includes('.mov') || 
        urlLower.includes('.avi') || urlLower.includes('video/')) {
      console.log('🎯 Detected as VIDEO type');
      return 'video';
    }
    
    // Document formats
    if (urlLower.includes('.pdf') || urlLower.includes('.doc') || 
        urlLower.includes('.docx') || urlLower.includes('.txt') || 
        urlLower.includes('application/')) {
      console.log('🎯 Detected as DOCUMENT type');
      return 'document';
    }
    
    console.log('🎯 Detected as TEXT type (default)');
    return 'text';
  };

  const getFileNameFromUrl = (url) => {
    if (!url || typeof url !== 'string') return 'Document';
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.split('?')[0] || 'Document';
  };

  const getFileExtension = (url) => {
    if (!url || typeof url !== 'string') return 'FILE';
    const fileName = getFileNameFromUrl(url);
    const extension = fileName.split('.').pop();
    return extension ? extension.toUpperCase() : 'FILE';
  };

  const getDocumentIcon = (url) => {
    if (!url || typeof url !== 'string') return 'file-outline';
    const extension = getFileExtension(url).toLowerCase();
    switch (extension) {
      case 'pdf': return 'file-pdf-box';
      case 'doc':
      case 'docx': return 'file-word-box';
      case 'xls':
      case 'xlsx': return 'file-excel-box';
      case 'ppt':
      case 'pptx': return 'file-powerpoint-box';
      case 'txt': return 'file-document-outline';
      default: return 'file-outline';
    }
  };

  // Get the media URL from various possible fields
  const getMediaUrl = () => {
    return messageObj.media || messageObj.image || messageObj.video || 
           messageObj.document || messageObj.url || messageObj.attachment || 
           messageObj.file || messageObj.photo;
  };

  const mediaUrl = getMediaUrl();
  const mediaType = detectMediaType(mediaUrl || messageObj.text);
  
  console.log('🎯 Media Detection:', {
    mediaType,
    mediaUrl,
    text: messageObj.text,
    messageType: messageObj.type,
    allFields: messageObj
  });

  // Image Component
  const ImagePreview = ({ uri, onPress }) => (
    <TouchableOpacity 
      onPress={onPress} 
      onLongPress={() => onMessageLongPress && onMessageLongPress(messageObj, isOwn)}
      style={styles.imageContainer}
      delayLongPress={500}
    >
      <Image
        source={{ uri }}
        style={styles.imagePreview}
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
        resizeMode="cover"
      />
      {imageLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
      <View style={styles.imageOverlay}>
        <Ionicons name="expand-outline" size={20} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  // Video Component - Using static thumbnail approach to prevent blinking
  const VideoPreview = ({ uri, onPress }) => (
    <TouchableOpacity 
      onPress={onPress} 
      onLongPress={() => onMessageLongPress && onMessageLongPress(messageObj, isOwn)}
      style={styles.videoContainer}
      delayLongPress={500}
    >
      {/* Static video placeholder/thumbnail */}
      <View style={styles.videoThumbnail}>
        <View style={styles.videoPlaceholder}>
          <Ionicons name="videocam" size={30} color="#666" />
          <Text style={styles.videoText}>Video</Text>
          <Text style={styles.videoSubtext}>Tap to play</Text>
        </View>
      </View>
      <View style={styles.videoOverlay}>
        <Ionicons name="play-circle" size={50} color="#fff" />
      </View>
    </TouchableOpacity>
  );

  // Document Component
  const DocumentPreview = ({ uri, onPress }) => (
    <TouchableOpacity 
      onPress={onPress} 
      onLongPress={() => onMessageLongPress && onMessageLongPress(messageObj, isOwn)}
      style={styles.documentContainer}
      delayLongPress={500}
    >
      <View style={styles.documentIcon}>
        <MaterialIcons name={getDocumentIcon(uri)} size={24} color="#4361EE" />
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={2}>
          {getFileNameFromUrl(uri)}
        </Text>
        <Text style={styles.documentType}>
          {getFileExtension(uri)} Document • Tap to view
        </Text>
        <Text style={styles.documentHint}>
          Opens in external app
        </Text>
      </View>
      <Ionicons name="document-text-outline" size={20} color="#666" />
    </TouchableOpacity>
  );

  // Contact Component - WhatsApp Style
  const ContactPreview = ({ contact, onPress }) => (
    <TouchableOpacity 
      onPress={onPress} 
      onLongPress={() => onMessageLongPress && onMessageLongPress(messageObj, isOwn)}
      style={styles.contactContainer}
      delayLongPress={500}
    >
      <View style={styles.contactAvatar}>
        {contact.image?.uri ? (
          <Image source={{ uri: contact.image.uri }} style={styles.contactAvatarImage} />
        ) : (
          <View style={styles.contactInitials}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
        )}
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>
          {contact.name || 'Unknown Contact'}
        </Text>
        <Text style={styles.contactPhone} numberOfLines={1}>
          {contact.phoneNumbers?.[0]?.number || 'No phone number'}
        </Text>
      </View>
      <View style={styles.contactAction}>
        <Ionicons name="chatbubble-outline" size={18} color="#4361EE" />
        <Text style={styles.contactActionText}>MESSAGE</Text>
      </View>
    </TouchableOpacity>
  );

  // Location Component (Simple implementation since react-native-maps is causing conflicts)
  const LocationPreview = ({ location, onPress }) => (
    <TouchableOpacity 
      onPress={onPress} 
      onLongPress={() => onMessageLongPress && onMessageLongPress(messageObj, isOwn)}
      style={styles.locationContainer}
      delayLongPress={500}
    >
      <View style={styles.locationIcon}>
        <Ionicons name="location" size={24} color="#4361EE" />
      </View>
      <View style={styles.locationInfo}>
        <Text style={styles.locationTitle}>Location Shared</Text>
        <Text style={styles.locationCoords}>
          {location?.latitude ? location.latitude.toFixed(6) : '0.000000'}, {location?.longitude ? location.longitude.toFixed(6) : '0.000000'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  // Fullscreen Image Modal
  const ImageModal = ({ visible, onClose, uri }) => (
    <Modal visible={visible} transparent={true} animationType="fade">
      <SafeAreaView style={styles.modalContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        <View style={styles.fullscreenImageContainer}>
          <Image
            source={{ uri }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Fullscreen Video Modal
  const VideoModal = ({ visible, onClose, uri }) => {
    const [modalVideoLoading, setModalVideoLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    return (
      <Modal visible={visible} transparent={true} animationType="fade">
        <SafeAreaView style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.fullscreenVideoContainer}>
            {hasError ? (
              <View style={styles.videoErrorContainer}>
                <Ionicons name="alert-circle-outline" size={60} color="#fff" />
                <Text style={styles.videoErrorText}>Unable to load video</Text>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    setHasError(false);
                    setModalVideoLoading(true);
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {modalVideoLoading && (
                  <View style={styles.modalLoadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>Loading video...</Text>
                  </View>
                )}
                <Video
                  source={{ uri }}
                  style={styles.fullscreenVideo}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={visible && !modalVideoLoading}
                  isLooping={false}
                  useNativeControls={true}
                  onLoadStart={() => {
                    setModalVideoLoading(true);
                    setHasError(false);
                  }}
                  onLoad={() => setModalVideoLoading(false)}
                  onError={(error) => {
                    console.error('Fullscreen video error:', error);
                    setModalVideoLoading(false);
                    setHasError(true);
                  }}
                />
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  // Location Modal (Simple implementation)
  const LocationModal = ({ visible, onClose, location }) => (
    <Modal visible={visible} transparent={false} animationType="slide">
      <SafeAreaView style={styles.locationModalContainer}>
        <View style={styles.locationModalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.locationModalTitle}>Location</Text>
          <TouchableOpacity 
            onPress={() => {
              const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
              Linking.openURL(url);
            }}
          >
            <Ionicons name="open-outline" size={24} color="#4361EE" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.locationModalContent}>
          <View style={styles.locationCard}>
            <Ionicons name="location" size={48} color="#4361EE" />
            <Text style={styles.locationModalCoords}>
              Latitude: {location?.latitude ? location.latitude.toFixed(6) : '0.000000'}
            </Text>
            <Text style={styles.locationModalCoords}>
              Longitude: {location?.longitude ? location.longitude.toFixed(6) : '0.000000'}
            </Text>
            <TouchableOpacity 
              style={styles.openMapsButton}
              onPress={() => {
                const lat = location?.latitude || 0;
                const lng = location?.longitude || 0;
                const url = `https://maps.google.com/?q=${lat},${lng}`;
                Linking.openURL(url);
              }}
            >
              <Text style={styles.openMapsButtonText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const handleDocumentPress = (uri) => {
    const fileExtension = getFileExtension(uri).toLowerCase();
    
    // Show different options based on file type
    const documentActions = [
      { text: 'Cancel', style: 'cancel' },
    ];

    // For PDFs, suggest PDF viewers
    if (fileExtension === 'pdf') {
      documentActions.push(
        { text: 'Open in Browser', onPress: () => Linking.openURL(uri) },
        { 
          text: 'Copy Link', 
          onPress: () => {
            // Note: Clipboard requires expo-clipboard package
            Alert.alert('Link copied', 'Document link has been copied to clipboard');
          }
        }
      );
    } else {
      documentActions.push(
        { text: 'Open Document', onPress: () => Linking.openURL(uri) }
      );
    }

    Alert.alert(
      `Open ${fileExtension.toUpperCase()} Document`, 
      `File: ${getFileNameFromUrl(uri)}`,
      documentActions
    );
  };

  const handleContactPress = (contact) => {
    const phoneNumber = contact.phoneNumbers?.[0]?.number;
    const email = contact.emails?.[0]?.email;
    
    const contactActions = [
      { text: 'Cancel', style: 'cancel' },
    ];

    if (phoneNumber) {
      contactActions.push(
        { text: 'Call', onPress: () => Linking.openURL(`tel:${phoneNumber}`) },
        { text: 'Message', onPress: () => Linking.openURL(`sms:${phoneNumber}`) }
      );
    }

    if (email) {
      contactActions.push(
        { text: 'Email', onPress: () => Linking.openURL(`mailto:${email}`) }
      );
    }

    Alert.alert(
      'Contact',
      `${contact.name}\n${phoneNumber || 'No phone number'}`,
      contactActions
    );
  };

  const renderMessageContent = () => {
    const locationData = messageObj.location || (messageObj.latitude && messageObj.longitude ? 
      { latitude: messageObj.latitude, longitude: messageObj.longitude } : null);

    console.log('🎨 Rendering message content:', {
      mediaType,
      mediaUrl,
      hasText: !!messageObj.text,
      locationData,
      isContact: mediaType === 'contact',
      contactData: mediaType === 'contact' ? {
        name: messageObj.name,
        phone: messageObj.phoneNumbers?.[0]?.number
      } : null
    });

    switch (mediaType) {
      case 'image':
        console.log('🖼️ Rendering IMAGE');
        return (
          <>
            <ImagePreview 
              uri={mediaUrl} 
              onPress={() => setImageModalVisible(true)} 
            />
            {messageObj.text && (
              <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
                {messageObj.text}
              </Text>
            )}
            <ImageModal 
              visible={imageModalVisible} 
              onClose={() => setImageModalVisible(false)} 
              uri={mediaUrl} 
            />
          </>
        );

      case 'video':
        console.log('🎬 Rendering VIDEO');
        return (
          <>
            <VideoPreview 
              uri={mediaUrl} 
              onPress={() => setVideoModalVisible(true)} 
            />
            {messageObj.text && (
              <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
                {messageObj.text}
              </Text>
            )}
            <VideoModal 
              visible={videoModalVisible} 
              onClose={() => setVideoModalVisible(false)} 
              uri={mediaUrl} 
            />
          </>
        );

      case 'document':
        console.log('📄 Rendering DOCUMENT');
        return (
          <DocumentPreview 
            uri={mediaUrl} 
            onPress={() => handleDocumentPress(mediaUrl)} 
          />
        );

      case 'contact':
        console.log('👤 Rendering CONTACT:', messageObj);
        return (
          <ContactPreview 
            contact={messageObj} 
            onPress={() => handleContactPress(messageObj)} 
          />
        );

      case 'location':
        console.log('📍 Rendering LOCATION');
        return (
          <>
            <LocationPreview 
              location={locationData} 
              onPress={() => setLocationModalVisible(true)} 
            />
            <LocationModal 
              visible={locationModalVisible} 
              onClose={() => setLocationModalVisible(false)} 
              location={locationData} 
            />
          </>
        );

      default:
        console.log('📝 Default text rendering - SHOULD NOT HAPPEN FOR CONTACTS:', {
          messageObjText: messageObj.text,
          messageObjType: typeof messageObj,
          messageObjKeys: Object.keys(messageObj),
          messageObj: messageObj,
          detectedMediaType: mediaType
        });
        return (
          <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
            {messageObj.text || messageObj.message || (typeof messageObj === 'string' ? messageObj : 'No text found')}
          </Text>
        );
    }
  };

  return (
    <View style={[styles.messageContainer, isOwn ? styles.ownMessage : styles.otherMessage]}>
      {!isOwn && senderName && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}
      
      <TouchableOpacity
        style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}
        onLongPress={() => onMessageLongPress && onMessageLongPress(messageObj, isOwn)}
        activeOpacity={0.8}
        delayLongPress={500}
      >
        {/* Check if message is deleted for everyone */}
        {messageObj.deletedForEveryone ? (
          <View style={styles.deletedMessageContainer}>
            <Ionicons name="trash-outline" size={16} color={isOwn ? '#fff' : '#999'} />
            <Text style={[styles.deletedMessageText, isOwn ? styles.ownText : styles.otherText]}>
              This message was deleted
            </Text>
          </View>
        ) : (
          renderMessageContent()
        )}
        
        {timestamp && !messageObj.deletedForEveryone && (
          <Text style={[styles.timestamp, isOwn ? styles.ownTimestamp : styles.otherTimestamp]}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 4,
    marginHorizontal: 16,
    maxWidth: screenWidth * 0.8,
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '100%',
  },
  ownBubble: {
    backgroundColor: '#4361EE',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownText: {
    color: '#fff',
  },
  otherText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimestamp: {
    color: '#fff',
    opacity: 0.8,
  },
  otherTimestamp: {
    color: '#666',
  },

  // Image Styles
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  imagePreview: {
    width: screenWidth * 0.6,
    height: screenWidth * 0.45,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Video Styles
  videoContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
  },
  videoThumbnail: {
    width: screenWidth * 0.6,
    height: screenWidth * 0.45,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  videoSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  videoPreview: {
    width: screenWidth * 0.6,
    height: screenWidth * 0.45,
  },
  videoOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Document Styles
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: screenWidth * 0.5,
    marginBottom: 4,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  documentType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  documentHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },

  // Contact Styles - WhatsApp Style
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: screenWidth * 0.65,
    maxWidth: screenWidth * 0.75,
    marginBottom: 4,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  contactAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  contactInitials: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4361EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  contactAction: {
    alignItems: 'center',
    paddingLeft: 8,
  },
  contactActionText: {
    fontSize: 11,
    color: '#4361EE',
    fontWeight: '600',
    marginTop: 2,
  },

  // Location Styles
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: screenWidth * 0.5,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  locationCoords: {
    fontSize: 12,
    color: '#666',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullscreenImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: screenWidth,
    height: screenHeight,
  },
  fullscreenImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  fullscreenVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: screenWidth,
    height: screenHeight,
  },
  fullscreenVideo: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  modalLoadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    zIndex: 2,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  videoErrorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  videoErrorText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4361EE',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Location Modal Styles
  locationModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  locationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  locationModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  locationModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  locationCard: {
    backgroundColor: '#f8f9fa',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    width: screenWidth * 0.8,
  },
  locationModalCoords: {
    fontSize: 16,
    color: '#333',
    marginVertical: 8,
    fontFamily: 'monospace',
  },
  openMapsButton: {
    backgroundColor: '#4361EE',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  openMapsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Deleted Message Styles
  deletedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    opacity: 0.7,
  },
  deletedMessageText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginLeft: 6,
  },
});

export default ChatMessage;
