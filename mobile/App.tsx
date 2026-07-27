import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { registerForPushNotificationsAsync } from './src/lib/pushNotifications';

function PushNotificationBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) registerForPushNotificationsAsync();
  }, [user]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <PushNotificationBootstrap />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
