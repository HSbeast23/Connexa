import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  Linking,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useFonts } from 'expo-font';
import { auth, db } from '../services/FireBase';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const ChatScreen = ({ route, navigation }) => {
  const { chatId, otherUser } = route.params;
  const { theme, isDark } = useTheme();
  
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(auth.currentUser);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const windowHeight = Dimensions.get('window').height;
  
  const flatListRef = useRef();
  
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  });
  
  // Set up the header
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: otherUser.photoURL }}
              style={styles.headerAvatar}
            />
            {otherUserOnline && (
              <View style={styles.onlineIndicator} />
            )}
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>
              {otherUser.displayName}
            </Text>
            {otherUserTyping ? (
              <Text style={styles.typingIndicatorText}>Typing...</Text>
            ) : otherUserOnline ? (
              <Text style={styles.onlineText}>Online</Text>
            ) : null}
          </View>
        </View>
      ),
      headerStyle: {
        backgroundColor: theme.background,
      },
      headerTintColor: theme.text,
    });
  }, [navigation, otherUser, theme, otherUserTyping, otherUserOnline]);
  
  // Setup keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // Scroll to bottom when keyboard appears
        if (flatListRef.current) {
          setTimeout(() => {
            flatListRef.current.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Listen for messages
  useEffect(() => {
    if (!chatId) return;
    
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = [];
      snapshot.docs.forEach((doc) => {
        const messageData = doc.data();
        const message = {
          id: doc.id,
          ...messageData,
          createdAt: messageData.createdAt ? messageData.createdAt.toDate() : new Date(),
        };
        messagesList.push(message);
      });
      
      setMessages(messagesList);
      setLoading(false);
      
      // Mark messages as read
      markMessagesAsRead();
      
      // Scroll to bottom when new messages come in
      if (flatListRef.current && messagesList.length > 0) {
        setTimeout(() => {
          flatListRef.current.scrollToEnd({ animated: true });
        }, 100);
      }
    });
    
    return () => unsubscribe();
  }, [chatId]);
  
  // Listen for typing status and online status
  useEffect(() => {
    if (!chatId || !otherUser.id) return;
    
    // Update chat when we open it to show we're looking at it
    const updateLastViewed = async () => {
      try {
        const chatRef = doc(db, "chats", chatId);
        await updateDoc(chatRef, {
          [`lastViewed.${user.uid}`]: serverTimestamp()
        });
      } catch (error) {
        console.error("Error updating last viewed:", error);
      }
    };
    
    updateLastViewed();
    
    // Listen for typing status changes
    const chatRef = doc(db, "chats", chatId);
    const unsubscribeChat = onSnapshot(chatRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const chatData = docSnapshot.data();
        
        // Check if other user is typing
        if (chatData.typingStatus && chatData.typingStatus[otherUser.id]) {
          const typingTimestamp = chatData.typingStatus[otherUser.id];
          // Consider typing active if within last 5 seconds
          const isCurrentlyTyping = (Date.now() - typingTimestamp.toMillis()) < 5000;
          setOtherUserTyping(isCurrentlyTyping);
        } else {
          setOtherUserTyping(false);
        }
      }
    });
    
    // Listen for other user's online status
    const userRef = doc(db, "users", otherUser.id);
    const unsubscribeUser = onSnapshot(userRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        setOtherUserOnline(userData.isOnline || false);
      }
    });
    
    return () => {
      unsubscribeChat();
      unsubscribeUser();
    };
  }, [chatId, otherUser.id]);
  
  // Mark messages as read
  const markMessagesAsRead = async () => {
    try {
      const messagesRef = collection(db, "chats", chatId, "messages");
      const unreadQuery = query(
        messagesRef,
        where("senderId", "==", otherUser.id),
        where("read", "==", false)
      );
      
      const snapshot = await getDocs(unreadQuery);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };
  
  // Handle input changes and update typing status
  const handleInputChange = (text) => {
    setInputMessage(text);
    
    // Update typing status in Firestore
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }
    
    // Clear previous timeout
    if (typingTimeout) clearTimeout(typingTimeout);
    
    // Set new timeout to stop typing indicator after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 3000);
    
    setTypingTimeout(timeout);
  };
  
  // Update typing status in Firestore
  const updateTypingStatus = async (isTyping) => {
    try {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        [`typingStatus.${user.uid}`]: isTyping ? serverTimestamp() : null
      });
    } catch (error) {
      console.error("Error updating typing status:", error);
    }
  };
  
  // Send a message
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    const message = inputMessage.trim();
    setInputMessage('');
    
    // Clear typing status when sending message
    setIsTyping(false);
    updateTypingStatus(false);
    if (typingTimeout) clearTimeout(typingTimeout);
    
    try {
      // Add message to subcollection
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        text: message,
        createdAt: serverTimestamp(),
        senderId: user.uid,
        read: false,
      });
      
      // Update chat document with last message info
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: message,
        lastUpdated: serverTimestamp(),
        [`lastViewed.${user.uid}`]: serverTimestamp()
      });
      
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
  
  // State for media picker modal
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  
  // Handle media picking and sending
  const handleMediaPick = () => {
    // Show our custom media picker UI
    setShowMediaOptions(true);
  };
  
  // Close media options sheet
  const closeMediaOptions = () => {
    setShowMediaOptions(false);
  };
  
  // Media option selection
  const handleMediaOptionSelect = async (option) => {
    closeMediaOptions();
    
    try {
      switch(option) {
        case 'photos':
          const { status: photoStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (photoStatus !== 'granted') {
            Alert.alert('Permission Needed', 'We need permission to access your media.');
            return;
          }
          launchMediaPicker(ImagePicker.MediaTypeOptions.Images);
          break;
          
        case 'videos':
          const { status: videoStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (videoStatus !== 'granted') {
            Alert.alert('Permission Needed', 'We need permission to access your media.');
            return;
          }
          launchMediaPicker(ImagePicker.MediaTypeOptions.Videos);
          break;
          
        case 'document':
          handleDocumentPick();
          break;
          
        case 'camera':
          launchCamera();
          break;
          
        case 'location':
          Alert.alert("Coming soon", "Location sharing will be available in the next update!");
          break;
          
        case 'contact':
          Alert.alert("Coming soon", "Contact sharing will be available in the next update!");
          break;
      }
    } catch (error) {
      console.error('Error with media picker option:', error);
      Alert.alert('Error', 'Failed to process your selection. Please try again.');
    }
  };
  
  // Launch media picker with specific type
  const launchMediaPicker = async (mediaType) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 60, // 60 seconds max for videos
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Check if it's a video or image
        if (asset.type === 'video') {
          sendMedia(asset.uri, 'video');
        } else {
          sendMedia(asset.uri, 'image');
        }
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };
  
  // Launch camera
  const launchCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'We need camera permission to take photos.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        sendMedia(result.assets[0].uri, 'image');
      }
    } catch (error) {
      console.error('Error with camera:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };
  
  // Handle document picking
  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true
      });
      
      if (result.canceled === false && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Get file size
        const fileInfo = await FileSystem.getInfoAsync(asset.uri);
        
        // Check if file is too large (10MB limit for example)
        if (fileInfo.size > 10 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a file smaller than 10MB.');
          return;
        }
        
        // Send document
        sendDocument(asset);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };
  
  // Send a document message
  const sendDocument = async (document) => {
    try {
      setImageUploading(true);
      
      // For simplicity, we'll just send the document name and type
      // In a real app, you would upload the document to storage
      
      // Determine document type icon
      let documentIcon = '📄';
      if (document.mimeType.includes('pdf')) {
        documentIcon = '📕';
      } else if (document.mimeType.includes('word')) {
        documentIcon = '📝';
      } else if (document.mimeType.includes('text/plain')) {
        documentIcon = '📃';
      }
      
      // Add document message to Firestore
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        documentName: document.name,
        documentSize: document.size,
        documentType: document.mimeType,
        createdAt: serverTimestamp(),
        senderId: user.uid,
        read: false,
        type: 'document'
      });
      
      // Update chat document with last message info
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: `${documentIcon} Document`,
        lastUpdated: serverTimestamp(),
        [`lastViewed.${user.uid}`]: serverTimestamp()
      });
      
    } catch (error) {
      console.error('Error sending document:', error);
      Alert.alert('Error', 'Failed to send document. Please try again.');
    } finally {
      setImageUploading(false);
    }
  };
  
  // Upload media to cloud storage and send message
  const sendMedia = async (uri, mediaType) => {
    try {
      setImageUploading(true);
      
      // Upload media to Cloudinary
      const mediaUrl = await uploadMediaToCloud(uri, mediaType);
      
      if (mediaUrl) {
        // Add message with media to Firestore
        const messagesRef = collection(db, "chats", chatId, "messages");
        await addDoc(messagesRef, {
          mediaUrl: mediaUrl,
          createdAt: serverTimestamp(),
          senderId: user.uid,
          read: false,
          type: mediaType
        });
        
        // Update chat document with last message info
        const chatRef = doc(db, "chats", chatId);
        await updateDoc(chatRef, {
          lastMessage: mediaType === 'image' ? '📷 Image' : '📹 Video',
          lastUpdated: serverTimestamp(),
          [`lastViewed.${user.uid}`]: serverTimestamp()
        });
      }
    } catch (error) {
      console.error(`Error sending ${mediaType}:`, error);
      Alert.alert('Error', `Failed to send ${mediaType}. Please try again.`);
    } finally {
      setImageUploading(false);
    }
  };
  
  // Upload media to cloud storage (Cloudinary in this case)
  const uploadMediaToCloud = async (uri, mediaType) => {
    const CLOUD_NAME = 'dofb3wbqz'; // Use your Cloudinary cloud name
    const UPLOAD_PRESET = 'ConnexaChat';
    
    try {
      // Determine mime type and resource type based on the media type and URI
      let resourceType = mediaType === 'video' ? 'video' : 'image';
      let mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
      let fileName = `chat_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
      
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: mimeType,
        name: fileName,
      });
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('cloud_name', CLOUD_NAME);
      
      // Upload the media to the appropriate endpoint based on resource type
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
        {
          method: 'POST',
          body: formData
        }
      );
      
      const data = await response.json();
      
      if (!data.secure_url) {
        throw new Error('No URL returned from Cloudinary');
      }
      
      return data.secure_url;
    } catch (error) {
      console.error(`Error uploading ${mediaType} to Cloudinary:`, error);
      throw error;
    }
  };
  
  // Format timestamp for messages
  const formatMessageTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Calculate if we should show the date header
  const showDateHeader = (message, index) => {
    if (index === 0) return true;
    
    const prevMessage = messages[index - 1];
    const messageDate = message.createdAt.toDateString();
    const prevMessageDate = prevMessage.createdAt.toDateString();
    
    return messageDate !== prevMessageDate;
  };
  
  // Format date for headers
  const formatDateHeader = (date) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (date.toDateString() === today) {
      return 'Today';
    } else if (date.toDateString() === yesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  };
  
  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    
    return `${bytes.toFixed(1)} ${units[i]}`;
  };
  
  // Handle document view/download
  const handleDocumentView = (document) => {
    Alert.alert(
      "Document",
      `${document.documentName}`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "View",
          onPress: () => {
            Alert.alert("Document View", "In a real app, this would open the document viewer or download the document.");
          }
        }
      ]
    );
  };
  
  // Handle media preview
  const handleMediaPreview = (mediaUrl, type) => {
    if (type === 'image') {
      // For images, show a full-screen preview
      Alert.alert(
        "Image Preview",
        "Would you like to view this image full screen?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "View",
            onPress: () => {
              // You could navigate to a media preview screen here
              // navigation.navigate('MediaPreview', { mediaUrl, type });
              
              // For now, let's just open it in browser
              Linking.openURL(mediaUrl);
            }
          }
        ]
      );
    } else if (type === 'video') {
      // For videos, you might want to use a video player component
      // For simplicity, we'll just open it in the device's video player
      Linking.openURL(mediaUrl);
    }
  };
  
  if (!fontsLoaded) {
    return null;
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* WhatsApp-like Media Options Modal */}
      <Modal
        visible={showMediaOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={closeMediaOptions}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeMediaOptions}
        >
          <View style={[styles.mediaOptionsContainer, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.mediaOptionsHeader}>
              <Text style={[styles.mediaOptionsTitle, { color: theme.text }]}>Share</Text>
              <TouchableOpacity onPress={closeMediaOptions}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.mediaOptionsGrid}>
              <TouchableOpacity 
                style={styles.mediaOptionItem}
                onPress={() => handleMediaOptionSelect('document')}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#5E5CE6' }]}>
                  <MaterialIcons name="insert-drive-file" size={24} color="#fff" />
                </View>
                <Text style={[styles.mediaOptionText, { color: theme.text }]}>Document</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.mediaOptionItem}
                onPress={() => handleMediaOptionSelect('camera')}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#FF9500' }]}>
                  <MaterialIcons name="camera-alt" size={24} color="#fff" />
                </View>
                <Text style={[styles.mediaOptionText, { color: theme.text }]}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.mediaOptionItem}
                onPress={() => handleMediaOptionSelect('photos')}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#34C759' }]}>
                  <MaterialIcons name="photo-library" size={24} color="#fff" />
                </View>
                <Text style={[styles.mediaOptionText, { color: theme.text }]}>Photos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.mediaOptionItem}
                onPress={() => handleMediaOptionSelect('videos')}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#FF2D55' }]}>
                  <MaterialIcons name="videocam" size={24} color="#fff" />
                </View>
                <Text style={[styles.mediaOptionText, { color: theme.text }]}>Videos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.mediaOptionItem}
                onPress={() => handleMediaOptionSelect('location')}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#FF3B30' }]}>
                  <MaterialIcons name="location-on" size={24} color="#fff" />
                </View>
                <Text style={[styles.mediaOptionText, { color: theme.text }]}>Location</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.mediaOptionItem}
                onPress={() => handleMediaOptionSelect('contact')}
              >
                <View style={[styles.mediaOptionIcon, { backgroundColor: '#007AFF' }]}>
                  <MaterialIcons name="person" size={24} color="#fff" />
                </View>
                <Text style={[styles.mediaOptionText, { color: theme.text }]}>Contact</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item, index }) => (
              <View>
                {showDateHeader(item, index) && (
                  <View style={styles.dateHeaderContainer}>
                    <Text style={[styles.dateHeaderText, { color: theme.subText }]}>
                      {formatDateHeader(item.createdAt)}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.messageContainer,
                    item.senderId === user.uid
                      ? [styles.sentMessage, { 
                          backgroundColor: ['image', 'video', 'document'].includes(item.type) 
                            ? (item.type === 'document' ? theme.primary : 'transparent') 
                            : theme.primary 
                        }]
                      : [styles.receivedMessage, { 
                          backgroundColor: ['image', 'video'].includes(item.type) 
                            ? 'transparent' 
                            : (isDark ? '#333' : '#e5e5ea') 
                        }],
                  ]}
                >
                  {item.type === 'image' ? (
                    <TouchableOpacity 
                      onPress={() => handleMediaPreview(item.mediaUrl, 'image')}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: item.mediaUrl }}
                        style={styles.messageImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : item.type === 'video' ? (
                    <TouchableOpacity
                      onPress={() => handleMediaPreview(item.mediaUrl, 'video')}
                      activeOpacity={0.9}
                      style={styles.videoContainer}
                    >
                      <Image
                        source={{ uri: item.mediaUrl.replace('.mp4', '.jpg') }}
                        style={styles.messageVideo}
                        resizeMode="cover"
                      />
                      <View style={styles.playButtonOverlay}>
                        <Ionicons name="play-circle" size={40} color="#fff" />
                      </View>
                    </TouchableOpacity>
                  ) : item.type === 'document' ? (
                    <TouchableOpacity
                      style={styles.documentContainer}
                      activeOpacity={0.8}
                      onPress={() => handleDocumentView(item)}
                    >
                      <View style={styles.documentIconContainer}>
                        {item.documentType && item.documentType.includes('pdf') ? (
                          <MaterialIcons name="picture-as-pdf" size={30} color="#FF5252" />
                        ) : item.documentType && item.documentType.includes('word') ? (
                          <MaterialIcons name="description" size={30} color="#2196F3" />
                        ) : item.documentType && item.documentType.includes('text/plain') ? (
                          <MaterialIcons name="text-snippet" size={30} color="#4CAF50" />
                        ) : (
                          <MaterialIcons name="insert-drive-file" size={30} color="#FFC107" />
                        )}
                      </View>
                      <View style={styles.documentInfo}>
                        <Text 
                          style={[styles.documentName, { color: item.senderId === user.uid ? '#fff' : theme.text }]} 
                          numberOfLines={1}
                        >
                          {item.documentName}
                        </Text>
                        <Text 
                          style={[styles.documentSize, { color: item.senderId === user.uid ? 'rgba(255,255,255,0.7)' : theme.subText }]}
                        >
                          {formatFileSize(item.documentSize)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        {
                          color: item.senderId === user.uid ? '#fff' : theme.text,
                        },
                      ]}
                    >
                      {item.text}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.messageTime,
                      {
                        color: item.senderId === user.uid ? 'rgba(255,255,255,0.7)' : theme.subText,
                        marginTop: ['image', 'video'].includes(item.type) ? 4 : 2,
                      },
                    ]}
                  >
                    {formatMessageTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            )}
            contentContainerStyle={styles.messagesList}
          />
        )}
        
        <View style={[styles.inputContainer, { 
          backgroundColor: isDark ? '#1C1C1E' : '#f2f2f7',
          borderColor: isDark ? '#333' : '#e5e5ea'
        }]}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity 
              style={styles.mediaButton}
              onPress={handleMediaPick}
              disabled={imageUploading}
            >
              {imageUploading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={26} color={theme.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={launchCamera}
              disabled={imageUploading}
            >
              <Ionicons name="camera-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.subText}
              value={inputMessage}
              onChangeText={handleInputChange}
              multiline
            />
            
            {inputMessage.trim() ? (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.primary }]}
                onPress={sendMessage}
                disabled={imageUploading}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.recordButton]}
                onPress={() => Alert.alert('Voice Messages', 'Voice message recording coming soon!')}
              >
                <Ionicons name="mic-outline" size={24} color={theme.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  headerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
  },
  typingIndicatorText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
  },
  onlineText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#4CAF50',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 20,
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  dateHeaderText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  messageContainer: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
  },
  sentMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  receivedMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
  },
  messageTime: {
    fontFamily: 'Poppins-Regular',
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  inputContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 24,
    paddingHorizontal: 5,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
  },
  mediaButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  cameraButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  recordButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  imageButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginVertical: 2,
  },
  messageVideo: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginVertical: 2,
  },
  videoContainer: {
    position: 'relative',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    maxWidth: 240,
  },
  documentIconContainer: {
    marginRight: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    marginBottom: 4,
  },
  documentSize: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  // Media options modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  mediaOptionsContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 30,
  },
  mediaOptionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  mediaOptionsTitle: {
    fontFamily: 'Poppins-Medium',
    fontSize: 18,
  },
  mediaOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  mediaOptionItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 24,
  },
  mediaOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mediaOptionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
  },
});

export default ChatScreen;
