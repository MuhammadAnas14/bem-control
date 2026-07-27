import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

// EXPO_PUBLIC_* env vars (from mobile/.env, loaded automatically by Expo)
// take priority so you can point a physical device at your dev machine's
// LAN IP without editing app.json.
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:4000';
export const WS_URL: string =
  process.env.EXPO_PUBLIC_WS_URL ?? extra.wsUrl ?? 'ws://localhost:4001';
