import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import ChatMessage from '../components/ChatMessage';

// Example of how to integrate ChatMessage component in your ChatScreen
const ChatMessageList = ({ messages, currentUserId, otherUser }) => {
  const renderMessage = ({ item }) => {
    // Determine if message is from current user
    const isOwn = item.senderId === currentUserId;
    
    // Get sender name for non-own messages
    const senderName = isOwn ? null : (otherUser.displayName || otherUser.email || 'Unknown');
    
    return (
      <ChatMessage
        message={item}
        isOwn={isOwn}
        timestamp={item.createdAt}
        senderName={senderName}
      />
    );
  };

  return (
    <FlatList
      data={messages}
      renderItem={renderMessage}
      keyExtractor={(item) => item.id}
      style={styles.messagesList}
      contentContainerStyle={styles.messagesContainer}
      showsVerticalScrollIndicator={false}
      inverted={true} // Show newest messages at bottom
    />
  );
};

const styles = StyleSheet.create({
  messagesList: {
    flex: 1,
    paddingHorizontal: 8,
  },
  messagesContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
});

// Example message data structures that work with ChatMessage:
const exampleMessages = [
  // Text message
  {
    id: '1',
    text: 'Hello! How are you?',
    senderId: 'user1',
    createdAt: new Date().toISOString(),
  },
  
  // Image message with caption
  {
    id: '2',
    media: 'https://res.cloudinary.com/your-cloud/image/upload/sample.jpg',
    text: 'Check out this photo!',
    senderId: 'user2',
    createdAt: new Date().toISOString(),
  },
  
  // Video message
  {
    id: '3',
    media: 'https://res.cloudinary.com/your-cloud/video/upload/sample.mp4',
    senderId: 'user1',
    createdAt: new Date().toISOString(),
  },
  
  // Document message
  {
    id: '4',
    media: 'https://res.cloudinary.com/your-cloud/raw/upload/document.pdf',
    senderId: 'user2',
    createdAt: new Date().toISOString(),
  },
  
  // Location message
  {
    id: '5',
    location: { latitude: 40.7128, longitude: -74.0060 },
    senderId: 'user1',
    createdAt: new Date().toISOString(),
  },
];

export default ChatMessageList;
