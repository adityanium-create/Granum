import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiKeys } from '../types';
import { saveKeys } from '../storage/keyStorage';

const C = {
  bg: '#0F0E0D',
  surface: '#1C1A18',
  border: '#2E2B26',
  accent: '#28A745',
  text: '#F0EDE8',
  muted: '#7A7570',
  red: '#CE2B37',
};

type Props = {
  onKeysSet: (keys: ApiKeys) => void;
};

export default function SetupScreen({ onKeysSet }: Props) {
  const [anthropic, setAnthropic] = useState('');
  const [openai, setOpenai] = useState('');
  const [elevenlabs, setElevenlabs] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStart = async () => {
    if (!anthropic.trim()) {
      Alert.alert('Missing key', 'An Anthropic API key is required.');
      return;
    }
    if (!openai.trim()) {
      Alert.alert('Missing key', 'An OpenAI API key is required for speech recognition.');
      return;
    }

    setSaving(true);
    const keys: ApiKeys = {
      anthropic: anthropic.trim(),
      openai: openai.trim(),
      elevenlabs: elevenlabs.trim() || undefined,
      elevenLabsVoiceId: voiceId.trim() || undefined,
    };

    try {
      await saveKeys(keys);
      onKeysSet(keys);
    } catch {
      Alert.alert('Error', 'Could not save keys. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={s.flag}>🇮🇹</Text>
            <Text style={s.title}>Lucia</Text>
            <Text style={s.subtitle}>il tuo tutor italiano</Text>
          </View>

          <Text style={s.intro}>
            Lucia uses Claude to hold real Italian conversations with you and
            Whisper to understand your speech with high accuracy.{'\n\n'}Enter
            your API keys below to get started — they're stored only on your
            device.
          </Text>

          <View style={s.section}>
            <Text style={s.label}>ANTHROPIC API KEY *</Text>
            <Text style={s.hint}>console.anthropic.com → API Keys</Text>
            <TextInput
              style={s.input}
              value={anthropic}
              onChangeText={setAnthropic}
              placeholder="sk-ant-..."
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          <View style={s.section}>
            <Text style={s.label}>OPENAI API KEY *</Text>
            <Text style={s.hint}>platform.openai.com → API Keys</Text>
            <TextInput
              style={s.input}
              value={openai}
              onChangeText={setOpenai}
              placeholder="sk-..."
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          <View style={s.section}>
            <Text style={s.label}>ELEVENLABS API KEY (optional)</Text>
            <Text style={s.hint}>elevenlabs.io — for a higher quality Italian voice</Text>
            <TextInput
              style={s.input}
              value={elevenlabs}
              onChangeText={setElevenlabs}
              placeholder="Leave blank to use device voice"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
          </View>

          {elevenlabs.trim().length > 0 && (
            <View style={s.section}>
              <Text style={s.label}>ELEVENLABS VOICE ID</Text>
              <Text style={s.hint}>Leave blank for default (Adam multilingual)</Text>
              <TextInput
                style={s.input}
                value={voiceId}
                onChangeText={setVoiceId}
                placeholder="pNInz6obpgDQGcFmaJgB"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          <TouchableOpacity
            style={[s.btn, saving && s.btnDisabled]}
            onPress={handleStart}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={s.btnText}>
              {saving ? 'Salvataggio...' : 'Iniziamo →'}
            </Text>
          </TouchableOpacity>

          <Text style={s.footer}>
            Your keys never leave your device. They are used only to call the
            respective APIs directly.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 32, marginTop: 16 },
  flag: { fontSize: 48, marginBottom: 8 },
  title: {
    fontSize: 36,
    fontWeight: '300',
    color: C.text,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  subtitle: { fontSize: 13, color: C.muted, letterSpacing: 2, marginTop: 4 },
  intro: { fontSize: 14, color: C.muted, lineHeight: 22, marginBottom: 28 },
  section: { marginBottom: 20 },
  label: {
    fontSize: 10,
    color: C.muted,
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  hint: { fontSize: 11, color: C.muted, marginBottom: 8, opacity: 0.7 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
    color: C.text,
    fontSize: 14,
  },
  btn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#0F0E0D', fontWeight: '600', fontSize: 16, letterSpacing: 1 },
  footer: { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 18, opacity: 0.7 },
});
