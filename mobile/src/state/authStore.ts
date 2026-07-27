import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'bem_control_token';
const ORG_KEY = 'bem_control_selected_org';

// SecureStore (not AsyncStorage) because this holds an auth token - it's
// backed by Keychain on iOS and the encrypted Keystore-backed prefs on Android.
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (token: string | null) =>
  token ? SecureStore.setItemAsync(TOKEN_KEY, token) : SecureStore.deleteItemAsync(TOKEN_KEY);

export const getSelectedOrgId = () => SecureStore.getItemAsync(ORG_KEY);
export const setSelectedOrgId = (orgId: string | null) =>
  orgId ? SecureStore.setItemAsync(ORG_KEY, orgId) : SecureStore.deleteItemAsync(ORG_KEY);
