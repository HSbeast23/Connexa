import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Common emojis for chat
const EMOJI_GROUPS = {
  recent: {
    title: 'Recent',
    data: ['😀', '😂', '❤️', '👍', '😊']
  },
  smileys: {
    title: 'Smileys',
    data: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘']
  },
  gestures: {
    title: 'Gestures',
    data: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🖐️', '👐', '🙌', '👏', '🤝']
  },
  hearts: {
    title: 'Hearts',
    data: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝']
  },
};

const EmojiPicker = ({ isVisible, onClose, onEmojiSelected }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');

  const renderEmojiCategory = ({ item }) => (
    <TouchableOpacity 
      style={styles.categoryTab} 
      onPress={() => setActiveCategory(item)}
    >
      <Text style={[
        styles.categoryText, 
        activeCategory === item && styles.activeCategoryText
      ]}>
        {EMOJI_GROUPS[item].title}
      </Text>
    </TouchableOpacity>
  );

  const renderEmoji = ({ item }) => (
    <TouchableOpacity 
      style={styles.emojiButton} 
      onPress={() => onEmojiSelected(item)}
    >
      <Text style={styles.emoji}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.pickerContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Emojis</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <FlatList
            horizontal
            data={Object.keys(EMOJI_GROUPS)}
            renderItem={renderEmojiCategory}
            keyExtractor={item => item}
            style={styles.categoriesList}
            showsHorizontalScrollIndicator={false}
          />
          
          <FlatList
            data={EMOJI_GROUPS[activeCategory].data}
            renderItem={renderEmoji}
            keyExtractor={(item, index) => `${item}_${index}`}
            numColumns={8}
            style={styles.emojiList}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoriesList: {
    marginBottom: 10,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  activeCategoryText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  emojiList: {
    flex: 1,
  },
  emojiButton: {
    width: '12.5%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
  },
});

export default EmojiPicker;
