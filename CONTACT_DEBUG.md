# Contact Sharing Debug Guide 🐛

## Issues Fixed:

### 1. **TypeError: url.toLowerCase is not a function**

**Problem**: ChatMessage trying to process contact data as media URL
**Fix**: Added contact type detection and string validation in `detectMediaType`

### 2. **TypeError: Cannot read property 'scrollToEnd' of null**

**Problem**: FlatList ref was null when trying to scroll
**Fix**: Added proper null checks with optional chaining (`?.`)

### 3. **Contact selection not sending**

**Problem**: Contact messages weren't being rendered properly
**Fix**: Added proper contact case in message rendering

## Debug Steps:

### Check Contact Data Structure:

1. **In ChatScreen**: Look for console logs showing attachment data
2. **In ChatMessage**: Check if contact type is detected properly
3. **In Firebase**: Verify contact messages are saved correctly

### Test Contact Flow:

1. **Tap green + button** → Should open attachment modal
2. **Select Contact** → Should show contact picker with all contacts
3. **Search contacts** → Should filter in real-time
4. **Select a contact** → Should send and display contact card
5. **Tap contact card** → Should show call/message options

## Console Logs to Watch:

### In ChatMessage.js:

```
🔍 ChatMessage Debug: {contact data structure}
🔍 detectMediaType called with: {media detection}
🎯 Media Detection: {final type and data}
🎨 Rendering message content: {rendering decision}
```

### In ChatAttachmentModal.js:

```
Loading contacts... (when fetching)
X of Y contacts (when displaying count)
```

### In ChatScreen.js:

```
Error sending attachment (if sending fails)
```

## Expected Behavior:

### Contact Card Display:

```
┌─────────────────────────────────────┐
│ [👤] John Doe                    [>] │
│      +1 (555) 123-4567              │
│      Tap to view contact            │
└─────────────────────────────────────┘
```

### Contact Actions (when tapped):

- **Call** (if phone number exists)
- **Message** (if phone number exists)
- **Email** (if email exists)
- **Cancel**

## Troubleshooting:

### If contacts don't show:

1. Check permissions are granted
2. Look for "Loading contacts..." message
3. Verify device has contacts with phone numbers

### If contact cards don't display:

1. Check console for ChatMessage errors
2. Verify contact type detection is working
3. Check if contact data structure is correct

### If contact selection doesn't work:

1. Check console for sending errors
2. Verify attachment handler is called
3. Check Firebase for saved contact messages

## Test Commands:

### Clear React Native Cache:

```bash
cd connexa
npx expo start --clear
```

### Debug Mode:

1. Open developer menu in app
2. Enable "Debug JS Remotely"
3. Open browser console to see logs

## Expected Console Output:

When sending a contact, you should see:

1. Contact data being prepared
2. Firebase message being sent
3. ChatMessage detecting contact type
4. Contact card being rendered
5. Chat scrolling to show new message

If any step fails, check the corresponding console logs for error details!
