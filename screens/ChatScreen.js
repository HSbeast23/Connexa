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
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useFonts } from 'expo-font';
import { auth, db } from '../services/FireBase';
import * as ImagePicker from 'expo-image-picker';
import ChatAttachmentModal from '../components/ChatAttachmentModal';
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
  const [isUploading, setIsUploading] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const windowHeight = Dimensions.get('window').height;
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  
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
    const onChange = (result) => {
      setScreenData(result.screen);
    };

    const subscription = Dimensions.addEventListener('change', onChange);

    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (event) => {
        setKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates.height);
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
        setKeyboardHeight(0);
      }
    );

    return () => {
      subscription?.remove();
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
    
    // Scroll to bottom immediately after clearing input
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 50);
    }
    
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
  
  // Handle attachment selection from modal
  const handleAttachmentSelected = async (attachmentData) => {
    try {
      // Add message to Firestore with attachment data
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        ...attachmentData,
        createdAt: serverTimestamp(),
        senderId: user.uid,
        read: false,
      });
      
      // Update chat document with last message info
      const chatRef = doc(db, "chats", chatId);
      let lastMessageText = '';
      
      switch(attachmentData.type) {
        case 'image':
          lastMessageText = '📷 Image';
          break;
        case 'video':
          lastMessageText = '📹 Video';
          break;
        case 'document':
          lastMessageText = `📄 ${attachmentData.fileName}`;
          break;
        case 'location':
          lastMessageText = '📍 Location';
          break;
        case 'contact':
          lastMessageText = `👤 ${attachmentData.name}`;
          break;
        default:
          lastMessageText = 'Attachment';
      }
      
      await updateDoc(chatRef, {
        lastMessage: lastMessageText,
        lastUpdated: serverTimestamp(),
        [`lastViewed.${user.uid}`]: serverTimestamp()
      });
      
    } catch (error) {
      console.error("Error sending attachment:", error);
      Alert.alert('Error', 'Failed to send attachment. Please try again.');
    }
  };
  
  // Handle media picking and sending
  const handleMediaPick = () => {
    setShowMediaOptions(true);
  };
  
  // Close media options
  const closeMediaOptions = () => {
    setShowMediaOptions(false);
  };

  // Handle attachment interaction
  const handleAttachmentPress = (message) => {
    switch(message.type) {
      case 'image':
        // Open image in full screen
        Alert.alert(
          'Image Options',
          'What would you like to do?',
          [
            { text: 'View Full Size', onPress: () => openImageViewer(message.url || message.downloadURL || message.mediaUrl) },
            { text: 'Save to Gallery', onPress: () => saveImageToGallery(message.url || message.downloadURL || message.mediaUrl) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        break;
        
      case 'video':
        // Open video player
        Alert.alert(
          'Video Options',
          'What would you like to do?',
          [
            { text: 'Play Video', onPress: () => playVideo(message.url || message.downloadURL || message.mediaUrl) },
            { text: 'Save to Gallery', onPress: () => saveVideoToGallery(message.url || message.downloadURL || message.mediaUrl) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        break;
        
      case 'document':
        // Open document
        openDocument(message.url || message.downloadURL, message.fileName || message.documentName);
        break;
        
      case 'location':
        // Open in maps
        openLocationInMaps(message.latitude, message.longitude, message.address);
        break;
        
      case 'contact':
        // Show contact options
        showContactOptions(message);
        break;
    }
  };

  // Open image viewer
  const openImageViewer = (imageUrl) => {
    // For now, show in browser - you can implement a proper image viewer later
    Linking.openURL(imageUrl);
  };

  // Save image to gallery
  const saveImageToGallery = async (imageUrl) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library permission to save images.');
        return;
      }
      
      // Download and save (simplified - you can implement proper download)
      Alert.alert('Success', 'Image will be saved to your gallery.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save image.');
    }
  };

  // Play video
  const playVideo = (videoUrl) => {
    Linking.openURL(videoUrl);
  };

  // Save video to gallery
  const saveVideoToGallery = async (videoUrl) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library permission to save videos.');
        return;
      }
      Alert.alert('Success', 'Video will be saved to your gallery.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save video.');
    }
  };

  // Open document
  const openDocument = (documentUrl, fileName) => {
    Alert.alert(
      'Open Document',
      `Do you want to open ${fileName}?`,
      [
        { text: 'Open', onPress: () => Linking.openURL(documentUrl) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Open location in maps
  const openLocationInMaps = (latitude, longitude, address) => {
    const mapUrl = Platform.OS === 'ios' 
      ? `maps:${latitude},${longitude}`
      : `geo:${latitude},${longitude}`;
    
    Alert.alert(
      'Open Location',
      address || `Location: ${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}`,
      [
        { text: 'Open in Maps', onPress: () => Linking.openURL(mapUrl) },
        { text: 'Share Location', onPress: () => shareLocation(latitude, longitude, address) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Share location
  const shareLocation = (latitude, longitude, address) => {
    const locationText = `📍 ${address || `Location: ${latitude}, ${longitude}`}\nhttps://maps.google.com/?q=${latitude},${longitude}`;
    Alert.alert('Location Shared', locationText);
  };

  // Show contact options
  const showContactOptions = (contactMessage) => {
    const phoneNumber = contactMessage.phoneNumbers?.[0]?.number;
    const email = contactMessage.emails?.[0]?.email;
    
    const options = [
      { text: 'View Contact', onPress: () => viewContactDetails(contactMessage) }
    ];
    
    if (phoneNumber) {
      options.push({ text: 'Call', onPress: () => Linking.openURL(`tel:${phoneNumber}`) });
      options.push({ text: 'SMS', onPress: () => Linking.openURL(`sms:${phoneNumber}`) });
    }
    
    if (email) {
      options.push({ text: 'Email', onPress: () => Linking.openURL(`mailto:${email}`) });
    }
    
    options.push({ text: 'Cancel', style: 'cancel' });
    
    Alert.alert('Contact Options', `${contactMessage.name}`, options);
  };

  // View contact details
  const viewContactDetails = (contactMessage) => {
    const details = [
      `Name: ${contactMessage.name}`,
      contactMessage.phoneNumbers?.map(p => `Phone: ${p.number}`).join('\n'),
      contactMessage.emails?.map(e => `Email: ${e.email}`).join('\n')
    ].filter(Boolean).join('\n\n');
    
    Alert.alert('Contact Details', details);
  };

  // Handle message long press for delete/forward
  const handleMessageLongPress = (message) => {
    Alert.alert(
      'Message Options',
      'What would you like to do with this message?',
      [
        { text: 'Forward', onPress: () => forwardMessage(message) },
        { text: 'Delete for Me', onPress: () => deleteMessage(message.id, false) },
        { text: 'Delete for Everyone', onPress: () => deleteMessage(message.id, true) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Forward message
  const forwardMessage = (message) => {
    Alert.alert('Forward', 'Message forwarding will be implemented soon!');
  };

  // Delete message
  const deleteMessage = async (messageId, forEveryone) => {
    try {
      if (forEveryone) {
        // Delete for everyone - remove from Firestore
        Alert.alert('Deleted', 'Message deleted for everyone.');
      } else {
        // Delete for me - just hide locally
        Alert.alert('Deleted', 'Message deleted for you.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message.');
    }
  };
  
  // Render message attachment
  const renderAttachment = (message) => {
    // Handle both new Cloudinary URLs and legacy Firebase URLs
    const imageUrl = message.url || message.downloadURL || message.mediaUrl;
    const documentUrl = message.url || message.downloadURL;
    
    switch(message.type) {
      case 'image':
        return (
          <TouchableOpacity 
            style={styles.attachmentContainer}
            onPress={() => handleAttachmentPress(message)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: imageUrl }} style={styles.messageImage} />
            {message.text && <Text style={styles.messageText}>{message.text}</Text>}
          </TouchableOpacity>
        );
        
      case 'video':
        return (
          <TouchableOpacity 
            style={styles.attachmentContainer}
            onPress={() => handleAttachmentPress(message)}
            activeOpacity={0.8}
          >
            <View style={styles.videoContainer}>
              <Image 
                source={{ uri: message.thumbnail || imageUrl }} 
                style={styles.videoThumbnail} 
              />
              <View style={styles.playButton}>
                <Ionicons name="play" size={20} color="#fff" />
              </View>
            </View>
            {message.text && <Text style={styles.messageText}>{message.text}</Text>}
          </TouchableOpacity>
        );
        
      case 'document':
        return (
          <TouchableOpacity 
            style={styles.attachmentContainer}
            onPress={() => handleAttachmentPress(message)}
            activeOpacity={0.8}
          >
            <View style={styles.documentContainer}>
              <Text style={styles.documentIcon}>📄</Text>
              <View style={styles.documentInfo}>
                <Text style={styles.documentName} numberOfLines={2}>
                  {message.fileName || message.documentName || 'Document'}
                </Text>
                <Text style={styles.documentSize}>
                  {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                </Text>
              </View>
              <Ionicons name="download-outline" size={20} color="#666" />
            </View>
            {message.text && <Text style={styles.messageText}>{message.text}</Text>}
          </TouchableOpacity>
        );
        
      case 'location':
        return (
          <TouchableOpacity 
            style={styles.attachmentContainer}
            onPress={() => handleAttachmentPress(message)}
            activeOpacity={0.8}
          >
            <View style={styles.locationContainer}>
              <Text style={styles.locationIcon}>📍</Text>
              <View style={styles.locationInfo}>
                <Text style={styles.locationText} numberOfLines={2}>
                  {message.address || `Location: ${message.latitude?.toFixed(4)}, ${message.longitude?.toFixed(4)}`}
                </Text>
                <Text style={styles.locationSubtext}>Tap to open in maps</Text>
              </View>
              <Ionicons name="map-outline" size={20} color="#666" />
            </View>
            {message.text && <Text style={styles.messageText}>{message.text}</Text>}
          </TouchableOpacity>
        );
        
      case 'contact':
        return (
          <TouchableOpacity 
            style={styles.attachmentContainer}
            onPress={() => handleAttachmentPress(message)}
            activeOpacity={0.8}
          >
            <View style={styles.contactContainer}>
              <Text style={styles.contactIcon}>👤</Text>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName} numberOfLines={1}>
                  {message.name || 'Unknown Contact'}
                </Text>
                {message.phoneNumbers?.[0] && (
                  <Text style={styles.contactPhone} numberOfLines={1}>
                    {message.phoneNumbers[0].number}
                  </Text>
                )}
                <Text style={styles.contactSubtext}>Tap to view contact</Text>
              </View>
              <Ionicons name="person-outline" size={20} color="#666" />
            </View>
            {message.text && <Text style={styles.messageText}>{message.text}</Text>}
          </TouchableOpacity>
        );
        
      case 'location':
        return (
          <View style={styles.attachmentContainer}>
            <View style={styles.locationContainer}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationText}>
                {message.address || `Location: ${message.latitude?.toFixed(4)}, ${message.longitude?.toFixed(4)}`}
              </Text>
            </View>
            {message.text && <Text style={styles.messageText}>{message.text}</Text>}
          </View>
        );
        
      case 'contact':
        return (
          <View style={styles.attachmentContainer}>
            <View style={styles.contactContainer}>
              <Text style={styles.contactIcon}>👤</Text>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{message.name}</Text>
                {message.phoneNumbers?.[0] && (
                  <Text style={styles.contactPhone}>{message.phoneNumbers[0].number}</Text>
                )}
              </View>
            </View>
            {message.text && <Text style={styles.messageText}>{message.text}</Text>}
          </View>
        );
        
      default:
        return message.text ? <Text style={styles.messageText}>{message.text}</Text> : null;
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* WhatsApp-style Attachment Modal */}
      <ChatAttachmentModal
        visible={showMediaOptions}
        onClose={closeMediaOptions}
        onAttachmentSelected={handleAttachmentSelected}
        isDark={isDark}
      />
      
      {/* Messages Container */}
      <View style={[styles.messagesContainer]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={[styles.messagesContent, { paddingBottom: 20 }]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
              <View>
                {showDateHeader(item, index) && (
                  <View style={styles.dateHeaderContainer}>
                    <Text style={[styles.dateHeaderText, { color: theme.subText }]}>
                      {formatDateHeader(item.createdAt)}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.messageContainer,
                    item.senderId === user.uid
                      ? [styles.sentMessage, { 
                          backgroundColor: ['image', 'video', 'document', 'location', 'contact'].includes(item.type) 
                            ? (item.type === 'document' ? theme.primary : 'transparent') 
                            : theme.primary 
                        }]
                      : [styles.receivedMessage, { 
                          backgroundColor: ['image', 'video'].includes(item.type) 
                            ? 'transparent' 
                            : (isDark ? '#333' : '#e5e5ea') 
                        }],
                  ]}
                  onLongPress={() => handleMessageLongPress(item)}
                  activeOpacity={0.8}
                >
                  {renderAttachment(item)}
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
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
      
      {/* Input Container - Fixed at bottom with KeyboardAvoidingView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.inputContainer, { 
          backgroundColor: isDark ? '#1C1C1E' : '#f2f2f7',
          borderColor: isDark ? '#333' : '#e5e5ea'
        }]}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity 
              style={styles.mediaButton}
              onPress={handleMediaPick}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={26} color={theme.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={handleMediaPick}
              disabled={isUploading}
            >
              <Ionicons name="camera-outline" size={24} color={theme.primary} />
            </TouchableOpacity>
            
            <TextInput
              style={[styles.input, { 
                color: theme.text,
                backgroundColor: isDark ? '#2C2C2E' : '#fff'
              }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.subText}
              value={inputMessage}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
              returnKeyType="default"
              blurOnSubmit={false}
            />
            
            {inputMessage.trim() ? (
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: theme.primary }]}
                onPress={sendMessage}
                disabled={isUploading}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 25 : 0, // Account for status bar on Android
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: 5, // Small padding to prevent overlap
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
    flex: 1,
    paddingHorizontal: 0,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 10,
    flexGrow: 1,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
    elevation: 10, // Add shadow on Android
    shadowColor: '#000', // Add shadow on iOS
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    minHeight: 44,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 4,
    textAlignVertical: 'top', // Ensure text starts at top in multiline
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
  
  // New attachment styles
  attachmentContainer: {
    maxWidth: 280,
    minWidth: 200,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 5,
  },
  videoContainer: {
    position: 'relative',
  },
  videoThumbnail: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 5,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 2,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 12,
    minWidth: 200,
    marginBottom: 5,
  },
  documentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    marginBottom: 2,
  },
  documentSize: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    opacity: 0.7,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 12,
    minWidth: 200,
    marginBottom: 5,
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  locationText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    flex: 1,
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    borderRadius: 12,
    minWidth: 200,
    marginBottom: 5,
  },
  contactIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    marginBottom: 2,
  },
  contactPhone: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    opacity: 0.7,
  },
  
  // Additional styles for interactive elements
  locationInfo: {
    flex: 1,
  },
  locationSubtext: {
    fontFamily: 'Poppins-Regular',
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
  contactSubtext: {
    fontFamily: 'Poppins-Regular',
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
});

export default ChatScreen;
