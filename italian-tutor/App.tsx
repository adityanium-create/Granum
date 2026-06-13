import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiKeys } from './src/types';
import { loadKeys } from './src/storage/keyStorage';
import SetupScreen from './src/screens/SetupScreen';
import ConversationScreen from './src/screens/ConversationScreen';

export default function App() {
  const [keys, setKeys] = useState<ApiKeys | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeys()
      .then((saved) => setKeys(saved))
      .finally(() => setLoading(false));
  }, []);

  const handleReset = () => setKeys(null);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color="#28A745" size="large" />
        </View>
      ) : keys ? (
        <ConversationScreen keys={keys} onReset={handleReset} />
      ) : (
        <SetupScreen onKeysSet={setKeys} />
      )}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#0F0E0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
