import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiKeys } from '../types';

const STORAGE_KEY = 'lucia_api_keys';

export async function saveKeys(keys: ApiKeys): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export async function loadKeys(): Promise<ApiKeys | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiKeys;
  } catch {
    return null;
  }
}

export async function clearKeys(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
