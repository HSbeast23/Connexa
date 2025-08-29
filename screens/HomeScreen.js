import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { auth, db } from '../services/FireBase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  doc, 
  getDoc, 
  getDocs,
  Timestamp,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { setupOnlineStatusTracking } from '../services/AuthService';
import { useFonts } from 'expo-font';
import { useTheme } from '../context/ThemeContext';

const HomeScreen = ({ navigation }) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
  });

  useEffect(() => {
    // Check if user is authenticated
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (!currentUser) {
        navigation.replace('Login');
      } else {
        setUser(currentUser);
        // Once we have the user, fetch their chats
        fetchUserChats(currentUser.uid);
        
        // Setup online status tracking
        const cleanupOnlineStatus = setupOnlineStatusTracking(currentUser.uid);
        
        // Return cleanup function to be called when component unmounts
        return () => {
          if (cleanupOnlineStatus) cleanupOnlineStatus();
        };
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);
  
  // Function to fetch user's chats from Firestore
  const fetchUserChats = (userId) => {
    setLoading(true);
    
    try {
      // Create a query for chats where the current user is a participant
      const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", userId),
        orderBy("lastUpdated", "desc")
      );
      
      // Set up real-time listener for chats
      const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const chatsList = [];
        
        // Process each chat document
        const chatPromises = snapshot.docs.map(async (docSnapshot) => {
          const chatData = docSnapshot.data();
          const chatId = docSnapshot.id;
          
          // Find the other participant (not the current user)
          const otherParticipantId = chatData.participants.find(id => id !== userId);
          
          // Get the other user's profile
          try {
            const userDocRef = doc(db, "users", otherParticipantId);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              
              // Get unread message count
              const unreadQuery = query(
                collection(db, "chats", chatId, "messages"),
                where("senderId", "==", otherParticipantId),
                where("read", "==", false)
              );
              
              const unreadSnapshot = await getDocs(unreadQuery);
              const unreadCount = unreadSnapshot.size;
              
              // Check for typing status
              const isTyping = chatData.typingStatus && 
                               chatData.typingStatus[otherParticipantId] &&
                               Date.now() - chatData.typingStatus[otherParticipantId].toMillis() < 10000; // Consider typing active if within last 10 seconds
                               
              // Format the chat data with additional WhatsApp/Instagram-like features
              return {
                id: chatId,
                name: userData.displayName || "Unknown User",
                lastMessage: chatData.lastMessage || "No messages yet",
                timestamp: chatData.lastUpdated ? chatData.lastUpdated.toDate() : new Date(),
                avatar: userData.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(userData.displayName || "User"),
                unread: unreadCount,
                typing: isTyping,
                online: userData.isOnline || false,
                otherUserId: otherParticipantId,
                lastSeen: userData.lastSeen ? userData.lastSeen.toDate() : null
              };
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
          }
          
          return null;
        });
        
        // Wait for all promises to resolve
        const resolvedChats = await Promise.all(chatPromises);
        
        // Filter out any null values and update state
        setChats(resolvedChats.filter(chat => chat !== null));
        setLoading(false);
      }, (error) => {
        console.error("Error listening to chats:", error);
        setLoading(false);
      });
      
      // Return the unsubscribe function
      return unsubscribe;
    } catch (error) {
      console.error("Error setting up chats listener:", error);
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const messageDate = timestamp;
    
    // Check if the message was sent today
    if (now.toDateString() === messageDate.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if the message was sent yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === messageDate.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise, return the date
    return messageDate.toLocaleDateString();
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Handle searching for users
  const handleSearch = async (searchText) => {
    setSearchQuery(searchText);
    
    if (searchText.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    
    setSearching(true);
    
    try {
      // Query users collection
      const usersRef = collection(db, "users");
      // We'll filter client-side for more flexible search
      const usersQuery = query(usersRef);
      
      const querySnapshot = await getDocs(usersQuery);
      let results = [];
      
      // First, check for existing chats to mark users you're already chatting with
      const chatsRef = collection(db, "chats");
      const chatsQuery = query(
        chatsRef,
        where("participants", "array-contains", user.uid)
      );
      const chatsSnapshot = await getDocs(chatsQuery);
      
      // Extract all user IDs the current user is already chatting with
      const existingChatPartners = [];
      chatsSnapshot.forEach((doc) => {
        const chatData = doc.data();
        const otherUser = chatData.participants.find(id => id !== user.uid);
        if (otherUser) {
          existingChatPartners.push({
            userId: otherUser,
            chatId: doc.id
          });
        }
      });
      
      // Process user search results
      querySnapshot.forEach((userDoc) => {
        const userData = userDoc.data();
        
        // Skip current user
        if (userDoc.id === user.uid) return;
        
        // Check if displayName contains search query (case insensitive)
        if (userData.displayName && 
            userData.displayName.toLowerCase().includes(searchText.toLowerCase())) {
          
          // Check if already chatting with this user
          const existingChat = existingChatPartners.find(
            partner => partner.userId === userDoc.id
          );
          
          // Check if the user is authenticated (has logged in)
          const isAuthenticated = userData.lastLoginAt || userData.createdAt;
          
          results.push({
            id: userDoc.id,
            displayName: userData.displayName,
            photoURL: userData.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(userData.displayName || "User"),
            email: userData.email || "",
            bio: userData.bio || "",
            lastSeen: userData.lastSeen ? userData.lastSeen.toDate() : null,
            isOnline: userData.isOnline || false,
            isAuthenticated: !!isAuthenticated,
            existingChatId: existingChat ? existingChat.chatId : null
          });
        }
      });
      
      // Sort results: online users first, then alphabetically
      results = results.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
      
      setSearchResults(results);
      setSearching(false);
      
    } catch (error) {
      console.error("Error searching users:", error);
      setSearching(false);
    }
  };

  // Create or open chat with a user
  const startChat = async (otherUser) => {
    try {
      if (!user) return;
      
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
      
      // Check if chat already exists
      const chatsRef = collection(db, "chats");
      const chatsQuery = query(
        chatsRef,
        where("participants", "array-contains", user.uid)
      );
      
      const querySnapshot = await getDocs(chatsQuery);
      let existingChatId = null;
      
      querySnapshot.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        if (chatData.participants.includes(otherUser.id)) {
          existingChatId = chatDoc.id;
        }
      });
      
      if (existingChatId) {
        // Chat already exists, update last viewed timestamp and navigate to it
        await setDoc(doc(db, "chats", existingChatId), {
          lastViewed: {
            [user.uid]: serverTimestamp()
          }
        }, { merge: true });
        
        navigation.navigate('Chat', { 
          chatId: existingChatId, 
          otherUser: otherUser 
        });
      } else {
        // Create new chat with additional metadata for better WhatsApp/Instagram-like experience
        const newChatRef = doc(collection(db, "chats"));
        
        await setDoc(newChatRef, {
          participants: [user.uid, otherUser.id],
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          lastMessage: "",
          typingStatus: {},
          lastViewed: {
            [user.uid]: serverTimestamp(),
            [otherUser.id]: null
          }
        });
        
        navigation.navigate('Chat', { 
          chatId: newChatRef.id, 
          otherUser: otherUser 
        });
      }
      
    } catch (error) {
      console.error("Error starting chat:", error);
      Alert.alert("Error", "Failed to start chat. Please try again.");
    }
  };

  const handleNewChat = () => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleChatPress = (chat) => {
    navigation.navigate('Chat', {
      chatId: chat.id,
      otherUser: {
        id: chat.otherUserId,
        displayName: chat.name,
        photoURL: chat.avatar
      }
    });
  };

  if (!fontsLoaded) {
    return null;
  }

  // Use theme values directly from the ThemeContext
  const colors = {
    background: theme.background,
    text: theme.text,
    subText: isDark ? '#aaaaaa' : '#666666',
    card: theme.background,
    separator: isDark ? '#2a2a2a' : '#f0f0f0',
    primary: theme.primary,
    unread: theme.primary,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        {showSearch ? (
          <View style={styles.searchContainer}>
            <TouchableOpacity 
              onPress={() => {
                setShowSearch(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <TextInput
              style={[styles.searchInput, {color: colors.text, borderColor: colors.separator}]}
              placeholder="Search users..."
              placeholderTextColor={colors.subText}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
            />
          </View>
        ) : (
          <>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Connexa</Text>
            
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.headerButton} 
                onPress={toggleTheme}
              >
                <MaterialIcons 
                  name={isDark ? 'light-mode' : 'dark-mode'} 
                  size={24} 
                  color={colors.text} 
                />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => navigation.navigate('Profile')}
              >
                <MaterialIcons name="person" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
      
      {showSearch && (
        <View style={[styles.searchResultsContainer, {backgroundColor: colors.background}]}>
          {searching ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.searchingIndicator} />
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.searchResultItem, {backgroundColor: colors.card}]}
                  onPress={() => startChat(item)}
                >
                  <View style={styles.avatarContainer}>
                    <Image 
                      source={{ uri: item.photoURL }} 
                      style={styles.searchResultAvatar} 
                    />
                    {item.isOnline && <View style={styles.onlineIndicator} />}
                  </View>
                  <View style={styles.userInfoContainer}>
                    <View style={styles.userNameRow}>
                      <Text style={[styles.searchResultName, {color: colors.text}]}>
                        {item.displayName}
                      </Text>
                      {item.existingChatId && (
                        <Text style={[styles.chatExistsText, {color: colors.primary}]}>
                          Already chatting
                        </Text>
                      )}
                    </View>
                    {item.bio ? (
                      <Text 
                        numberOfLines={1} 
                        style={[styles.searchResultBio, {color: colors.subText}]}
                      >
                        {item.bio}
                      </Text>
                    ) : item.email ? (
                      <Text style={[styles.searchResultEmail, {color: colors.subText}]}>
                        {item.email}
                      </Text>
                    ) : null}
                    <View style={styles.userStatusContainer}>
                      {item.isOnline ? (
                        <Text style={[styles.onlineStatusText, {color: '#4CAF50'}]}>
                          • Online
                        </Text>
                      ) : item.lastSeen ? (
                        <Text style={[styles.lastSeenText, {color: colors.subText}]}>
                          Last seen: {formatTimestamp(item.lastSeen)}
                        </Text>
                      ) : null}
                      
                      {item.isAuthenticated && (
                        <View style={styles.authenticatedBadge}>
                          <Text style={styles.authenticatedText}>Connexa User</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={colors.subText} 
                    style={styles.chevronIcon}
                  />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { 
                  backgroundColor: colors.separator,
                  marginLeft: 80 // Align with user info
                }]} />
              )}
            />
          ) : searchQuery.trim().length > 0 ? (
            <Text style={[styles.noResultsText, {color: colors.subText}]}>
              No users found
            </Text>
          ) : null}
        </View>
      )}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.chatItem, { backgroundColor: colors.card }]}
              onPress={() => handleChatPress(item)}
            >
              <Image 
                source={{ uri: item.avatar }} 
                style={styles.avatar} 
              />
              
              <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                  <Text style={[styles.chatName, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.chatTime, { color: colors.subText }]}>
                    {formatTimestamp(item.timestamp)}
                  </Text>
                </View>
                
                <View style={styles.chatFooter}>
                  <View style={styles.messageContainer}>
                    {item.typing ? (
                      <Text style={[styles.typingIndicator, { color: colors.primary }]}>
                        Typing...
                      </Text>
                    ) : (
                      <Text 
                        style={[
                          styles.lastMessage, 
                          { color: item.unread > 0 ? colors.text : colors.subText }
                        ]}
                        numberOfLines={1}
                      >
                        {item.lastMessage}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.chatIndicators}>
                    {item.unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.separator }]} />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
      
      <TouchableOpacity 
        style={styles.newChatButton}
        onPress={handleNewChat}
      >
        <MaterialIcons name="chat" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginTop: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 22,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 20,
    padding: 5,  // Increase touch target area
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 90,  // Increased for better spacing at bottom
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chatContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chatName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
  },
  chatTime: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  messageContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  typingIndicator: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    fontStyle: 'italic',
  },
  chatIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: '#3498db',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#fff',
  },
  separator: {
    height: 1,
    marginLeft: 86, // Indent to align with message text
  },
  newChatButton: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 15,
    fontFamily: 'Poppins-Regular',
    borderWidth: 1,
    marginLeft: 10,
    fontSize: 15,
  },
  backButton: {
    padding: 8,
  },
  searchResultsContainer: {
    flex: 1,
    maxHeight: 450, // Larger for better visibility
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 1000,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingVertical: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  searchResultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  userInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  searchResultName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
  },
  searchResultEmail: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
  },
  searchResultBio: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    marginTop: 1,
  },
  lastSeenText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    marginTop: 3,
  },
  chatExistsText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
  },
  chevronIcon: {
    marginLeft: 10,
  },
  searchingIndicator: {
    padding: 24,
  },
  noResultsText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    textAlign: 'center',
    padding: 24,
  },
  userStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  onlineStatusText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    marginRight: 8,
  },
  authenticatedBadge: {
    backgroundColor: '#3498db',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  authenticatedText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 10,
    color: 'white',
  }
});

export default HomeScreen;
