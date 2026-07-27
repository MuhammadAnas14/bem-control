import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests permission, obtains an Expo push token, and registers it with the
 * backend so device-offline alerts (sent from mqtt/handlers.js on the
 * backend via pushNotifications.service.js) can reach this phone even when
 * the app is backgrounded - the WebSocket-based live updates only work while
 * the app is open and connected.
 */
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
  await apiClient.registerPushToken(expoPushToken).catch((err) => {
    console.warn('Failed to register push token with backend:', err.message);
  });
}
