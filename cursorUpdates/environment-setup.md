# Environment Setup Guide

## Required Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_APP_VERSION=1.0.0

# Push Notifications
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
EXPO_PUBLIC_PUSH_NOTIFICATION_ENDPOINT=https://exp.host/--/api/v2/push/send

# Authentication
EXPO_PUBLIC_AUTH_PERSISTENCE=true
EXPO_PUBLIC_JWT_REFRESH_INTERVAL=3600000
```

## Explanation of Variables

- `EXPO_PUBLIC_API_URL`: The base URL for your backend API. In development, this is typically `http://localhost:3000` or your local IP address like `http://192.168.1.100:3000`.

- `EXPO_PUBLIC_APP_VERSION`: The current version of your app.

- `EXPO_PUBLIC_PROJECT_ID`: Your Expo project ID. This is required for push notifications to work correctly. You can find it in your `app.json` file or in the Expo dashboard.

- `EXPO_PUBLIC_PUSH_NOTIFICATION_ENDPOINT`: The Expo push notification service endpoint.

- `EXPO_PUBLIC_AUTH_PERSISTENCE`: Whether to persist authentication state.

- `EXPO_PUBLIC_JWT_REFRESH_INTERVAL`: How often to refresh the JWT token (in milliseconds).

## Setting Up Your Environment

1. Copy the above variables into a `.env` file in the project root.
2. Replace `your-expo-project-id` with your actual Expo project ID.
3. If you're running the backend on a different port or host, update `EXPO_PUBLIC_API_URL` accordingly.

## Finding Your Expo Project ID

1. Open your `app.json` file
2. Look for the `expo.extra.eas.projectId` field
3. If it doesn't exist, you can create a new project in the Expo dashboard and get the ID from there

## Network Considerations

If you're experiencing API connection issues, particularly with notifications:

1. Make sure your backend server is running
2. Check that the API URL is accessible from your device
3. For mobile devices, you may need to use your computer's local IP address instead of `localhost`
4. Ensure the backend routes match the expected paths in the frontend code

## Troubleshooting Notification Issues

If you're having problems with push notifications:

1. Verify your `EXPO_PUBLIC_PROJECT_ID` is correct
2. Ensure the device has granted notification permissions
3. Check the backend logs for token registration issues
4. Try uninstalling and reinstalling the app on your device 