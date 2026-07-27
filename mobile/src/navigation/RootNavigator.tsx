import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../state/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { DeviceListScreen } from '../screens/DeviceListScreen';
import { DeviceDetailScreen } from '../screens/DeviceDetailScreen';
import { ScanProvisionScreen } from '../screens/ScanProvisionScreen';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  DeviceList: undefined;
  DeviceDetail: { deviceId: string };
  ScanProvision: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="DeviceList" component={DeviceListScreen} />
          <Stack.Screen
            name="DeviceDetail"
            component={DeviceDetailScreen}
            options={{ headerShown: true, title: '' }}
          />
          <Stack.Screen
            name="ScanProvision"
            component={ScanProvisionScreen}
            options={{ headerShown: true, title: 'Scan device' }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
