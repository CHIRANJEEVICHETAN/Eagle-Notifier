# Eagle Notifier - Push Notifications Implementation Guide

## Overview

This document outlines the implementation of push notifications in the Eagle Notifier application using Expo's notification system with Firebase Cloud Messaging (FCM).

## Changes Made

The following files have been modified/created to implement push notifications:

1. **app.json** - Added the expo-notifications plugin configuration and Firebase configuration for Android and iOS
2. **app/onboarding.tsx** - Added permission request code and token storage during onboarding
3. **app/NotificationProvider.tsx** - Created a notification context provider to manage notification state and listeners
4. **app/_layout.tsx** - Updated to use the NotificationProvider for app-wide notification handling
5. **assets/sounds/** - Created directory for notification sounds
6. **assets/images/notification-icon.png** (to be added) - Notification icon for Android

## Firebase Setup

1. **Create a Firebase Project:**
   - Go to the [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project" and follow the setup wizard
   - Name your project (e.g., "Eagle Notifier")
   - Enable Google Analytics if desired
   - Create the project

2. **Add Android App:**
   - In your Firebase project, click "Add app" and select Android
   - Enter your package name (typically `com.yourcompany.eaglenotifier`)
   - Enter a nickname for the app (e.g., "Eagle Notifier Android")
   - Download the `google-services.json` file
   - Place the file in the root directory of your project

3. **Add iOS App (if needed):**
   - In your Firebase project, click "Add app" and select iOS
   - Enter your bundle ID (typically `com.yourcompany.eaglenotifier`)
   - Enter a nickname for the app (e.g., "Eagle Notifier iOS")
   - Download the `GoogleService-Info.plist` file
   - Place the file in the root directory of your project

4. **Configure Service Account for FCM (for sending notifications):**
   - In Firebase, go to Project Settings > Service accounts
   - Click "Generate new private key" for your service account
   - Save the JSON file securely (DO NOT commit this to version control)
   - This file will be used by the backend to send push notifications

## Project Configuration

### app.json Changes

Added configuration for Expo notifications:

```json
"plugins": [
  "expo-router",
  [
    "expo-notifications",
    {
      "icon": "./assets/images/notification-icon.png",
      "color": "#2563EB",
      "sounds": ["./assets/sounds/notification.wav"]
    }
  ],
  "expo-secure-store"
],
```

Added Firebase configuration:

```json
"ios": {
  "supportsTablet": true,
  "googleServicesFile": "./GoogleService-Info.plist"
},
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/images/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  },
  "googleServicesFile": "./google-services.json"
}
```

### Implementation Components

1. **Notification Handler Setup:**
   - Configured in both `onboarding.tsx` and `NotificationProvider.tsx`
   - Sets up how notifications are displayed

2. **Permission Request:**
   - Implemented in `onboarding.tsx`
   - Requests notification permissions during app onboarding
   - Stores token temporarily in SecureStore

3. **Token Registration:**
   - Implemented in `NotificationProvider.tsx` with useAuth hook
   - Sends the token to the backend when a user is authenticated
   - Handles both scenarios: token from onboarding or getting a new token

4. **Notification Listeners:**
   - Set up in `NotificationProvider.tsx`
   - Listens for incoming notifications
   - Handles notification responses (when a user taps a notification)

## Next Steps

1. **Create Notification Assets:**
   - Create a 96x96 white PNG icon with transparency for Android
   - Add a notification sound file (.wav format)
   - Place them in the appropriate directories as configured in app.json

2. **Download Firebase Configuration Files:**
   - Download `google-services.json` for Android
   - Download `GoogleService-Info.plist` for iOS (if needed)
   - Place them in the project root directory

3. **Build and Test:**
   - Run `expo prebuild` to apply the native changes
   - Build the app with `eas build` or development build
   - Test push notifications using the backend API or Expo's notification testing tool

## Backend Implementation

The backend has endpoints for:

1. **Token Registration:**
   - `PUT /api/notifications/push-token` - Updates user's push token

2. **Notification Sending:**
   - Uses `expo-server-sdk` to send notifications
   - Implemented in the `NotificationService` class

## Additional Requirements

1. **Notification Icon:**
   - Create a 96x96 white PNG icon with transparency
   - Save it as `./assets/images/notification-icon.png`

2. **Notification Sound:**
   - Add a notification sound file
   - Save it as `./assets/sounds/notification.wav`

## Testing Push Notifications

1. **Using Expo's Push Notification Tool:**
   - Go to https://expo.dev/notifications
   - Enter your Expo Push Token
   - Configure a test message
   - Send to test notifications on a real device

2. **Using Backend Test Endpoint:**
   - Use the `POST /api/notifications/send-test` endpoint
   - This will create a test notification in the database and trigger a push notification

## Troubleshooting

1. **Token Not Generated:**
   - Ensure your app is running on a physical device, not an emulator
   - Make sure your project ID is correct in the code
   - Check that the EAS project ID matches the one in app.json

2. **Notifications Not Received:**
   - Verify that the Firebase configuration files are correctly placed
   - Check that you've granted notification permissions on the device
   - Ensure the device has an internet connection
   - Verify that the token is correctly stored in your backend

3. **Firebase Issues:**
   - Make sure the package name/bundle ID in Firebase matches your app's configuration
   - Check that you've added the correct Firebase files to the project root
   - Verify that the Firebase project is properly set up with FCM enabled 