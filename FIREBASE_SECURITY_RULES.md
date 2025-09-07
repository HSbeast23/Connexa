# Firebase Security Rules for WhatsApp-Style Message Deletion

## Firestore Security Rules

Add these rules to your Firebase Firestore Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chat documents
    match /chats/{chatId} {
      allow read, write: if request.auth != null &&
        (request.auth.uid in resource.data.participants);

      // Messages subcollection
      match /messages/{messageId} {
        // Allow read for chat participants
        allow read: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;

        // Allow create for chat participants
        allow create: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants &&
          request.auth.uid == resource.data.senderId;

        // Allow update for deletion operations
        allow update: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants &&
          (
            // Delete for me - any participant can mark as deleted for themselves
            (request.data.diff(resource.data).affectedKeys().hasOnly(['deletedFor', 'deletedAt']) &&
             request.data.deletedFor[request.auth.uid] == true) ||

            // Delete for everyone - only sender can delete for everyone within 1 hour
            (request.data.diff(resource.data).affectedKeys().hasOnly(['deletedForEveryone', 'deletedAt']) &&
             request.auth.uid == resource.data.senderId &&
             request.data.deletedForEveryone == true &&
             request.time < resource.data.createdAt + duration.value(1, 'h'))
          );

        // Prevent deletion of documents (we only mark as deleted)
        allow delete: if false;
      }
    }

    // User documents
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Message Data Structure

Messages should have this structure to support deletion:

```javascript
{
  id: "message_id",
  senderId: "user_uid",
  text: "message content",
  type: "text|image|video|document|contact|location",
  createdAt: timestamp,

  // Deletion fields
  deletedForEveryone: false, // Boolean - if true, message shows as "deleted" for all users
  deletedFor: { // Object mapping user IDs to deletion status
    "user_uid_1": true,
    "user_uid_2": false
  },
  deletedAt: { // Object mapping user IDs to deletion timestamps
    "user_uid_1": timestamp,
    "user_uid_2": null
  }
}
```

## Key Security Features

1. **Participant-Only Access**: Only chat participants can read/write messages
2. **Sender Verification**: Only the message sender can delete for everyone
3. **Time Limitation**: Delete for everyone only works within 1 hour of sending
4. **Selective Deletion**: Delete for me works for any participant at any time
5. **No Physical Deletion**: Messages are never actually deleted, only marked as such
6. **Audit Trail**: Deletion timestamps are preserved for all operations

## Implementation Notes

- The `deletedFor` object allows granular control over who sees each message
- The `deletedForEveryone` flag takes precedence over individual deletion settings
- Messages marked as `deletedForEveryone` show "This message was deleted" to all users
- Messages in a user's `deletedFor` list are filtered out during query processing
- Security rules prevent unauthorized deletion attempts and enforce time limits
