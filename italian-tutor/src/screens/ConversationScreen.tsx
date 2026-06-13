import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Message, AppStatus, ApiKeys } from '../types';
import { sendToLucia } from '../services/claude';
import { transcribeAudio } from '../services/whisper';
import { speakItalian, stopSpeaking } from '../services/tts';
import { clearKeys } from '../storage/keyStorage';

const C = {
  bg: '#0F0E0D',
  surface: '#1C1A18',
  surface2: '#252320',
  border: '#2E2B26',
  accent: '#28A745',
  accentDim: '#1A3D22',
  red: '#CE2B37',
  redDim: '#3D1A1A',
  text: '#F0EDE8',
  muted: '#7A7570',
  userBubble: '#1A2E20',
  userBubbleBorder: '#2A4A30',
  aiBubbleBorder: '#2E2B26',
  gold: '#C8A84B',
};

const STATUS_TEXT: Record<AppStatus, string> = {
  idle: 'Tocca per parlare',
  recording: 'Sto ascoltando...',
  transcribing: 'Capito...',
  thinking: 'Sto pensando...',
  speaking: 'Lucia sta parlando — tocca per interrompere',
};

let counter = 0;
const uid = () => `m${++counter}`;

const TRIGGER_ID = '__start__';

type Props = {
  keys: ApiKeys;
  onReset: () => void;
};

export default function ConversationScreen({ keys, onReset }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // Pulse animation while recording
  useEffect(() => {
    if (status === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [status]);

  // Initial greeting from Lucia
  useEffect(() => {
    (async () => {
      setStatus('thinking');
      try {
        const trigger: Message = {
          id: TRIGGER_ID,
          role: 'user',
          content: '[INIZIO]',
          timestamp: new Date(),
        };
        const reply = await sendToLucia([trigger], keys.anthropic);
        const greeting: Message = {
          id: uid(),
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
        };
        setMessages([greeting]);
        setStatus('speaking');
        await speakItalian(reply, keys.elevenlabs, keys.elevenLabsVoiceId);
      } catch (e) {
        Alert.alert('Connection error', 'Could not reach the AI. Check your Anthropic API key and internet connection.');
      } finally {
        setStatus('idle');
      }
    })();
  }, []);

  const startRecording = useCallback(async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Microphone access needed', 'Please allow microphone access in your device settings.');
      return;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording: rec } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    setRecording(rec);
    setStatus('recording');
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    setStatus('transcribing');

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (!uri) {
      setStatus('idle');
      return;
    }

    try {
      const transcript = await transcribeAudio(uri, keys.openai);
      if (!transcript) {
        setStatus('idle');
        return;
      }

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: transcript,
        timestamp: new Date(),
      };

      // Build conversation history for Claude (exclude the hidden trigger)
      setMessages((prev) => {
        const next = [...prev, userMsg];
        sendReply(next);
        return next;
      });
    } catch (e) {
      Alert.alert('Transcription error', 'Could not understand that. Check your OpenAI key and try again.');
      setStatus('idle');
    }
  }, [recording, keys]);

  const sendReply = useCallback(
    async (history: Message[]) => {
      setStatus('thinking');
      try {
        // Reconstruct full history: hidden trigger → Lucia greeting → all subsequent turns
        const triggerMsg: Message = {
          id: TRIGGER_ID,
          role: 'user',
          content: '[INIZIO]',
          timestamp: new Date(),
        };
        const withTrigger: Message[] = [triggerMsg, ...history];

        const reply = await sendToLucia(withTrigger, keys.anthropic);
        const assistantMsg: Message = {
          id: uid(),
          role: 'assistant',
          content: reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStatus('speaking');
        await speakItalian(reply, keys.elevenlabs, keys.elevenLabsVoiceId);
      } catch {
        Alert.alert('Error', 'Could not get a response. Check your connection and API key.');
      } finally {
        setStatus('idle');
      }
    },
    [keys],
  );

  const handleMicPress = useCallback(() => {
    if (status === 'speaking') {
      stopSpeaking();
      setStatus('idle');
      return;
    }
    if (status === 'recording') {
      stopRecording();
      return;
    }
    if (status === 'idle') {
      startRecording();
    }
  }, [status, startRecording, stopRecording]);

  const handleReset = () => {
    Alert.alert('Reset', 'Clear your API keys and start over?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          stopSpeaking();
          await clearKeys();
          onReset();
        },
      },
    ]);
  };

  const micColor =
    status === 'recording'
      ? C.red
      : status === 'idle' || status === 'speaking'
        ? C.accent
        : C.surface2;

  const micDisabled =
    status === 'transcribing' || status === 'thinking';

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.flag}>🇮🇹</Text>
          <View>
            <Text style={s.appName}>LUCIA</Text>
            <Text style={s.appSub}>tutor italiano</Text>
          </View>
        </View>
        <Pressable onPress={handleReset} style={s.resetBtn}>
          <Text style={s.resetTxt}>⚙</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && status === 'thinking' && (
          <View style={s.loadingRow}>
            <ActivityIndicator color={C.muted} />
            <Text style={s.loadingTxt}>Lucia si sta preparando...</Text>
          </View>
        )}

        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              s.bubbleRow,
              msg.role === 'user' ? s.bubbleRight : s.bubbleLeft,
            ]}
          >
            {msg.role === 'assistant' && (
              <View style={s.avatar}>
                <Text style={s.avatarText}>L</Text>
              </View>
            )}
            <View
              style={[
                s.bubble,
                msg.role === 'user' ? s.userBubble : s.aiBubble,
              ]}
            >
              <Text
                style={[
                  s.bubbleText,
                  msg.role === 'user' && s.userBubbleText,
                ]}
              >
                {msg.content}
              </Text>
            </View>
          </View>
        ))}

        {/* Typing indicator when thinking */}
        {status === 'thinking' && messages.length > 0 && (
          <View style={[s.bubbleRow, s.bubbleLeft]}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>L</Text>
            </View>
            <View style={[s.bubble, s.aiBubble, s.thinkingBubble]}>
              <Text style={s.thinkingDots}>• • •</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom controls */}
      <View style={s.bottom}>
        <Text style={s.statusText}>{STATUS_TEXT[status]}</Text>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[s.mic, { backgroundColor: micColor }, micDisabled && s.micDisabled]}
            onPress={handleMicPress}
            disabled={micDisabled}
            activeOpacity={0.85}
          >
            <Text style={s.micIcon}>
              {status === 'recording' ? '■' : status === 'speaking' ? '▮▮' : '●'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
        {status === 'recording' && (
          <Text style={s.tapToStop}>Tocca per finire</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flag: { fontSize: 28 },
  appName: { fontSize: 18, fontWeight: '700', color: C.text, letterSpacing: 3 },
  appSub: { fontSize: 10, color: C.muted, letterSpacing: 2, marginTop: 1 },
  resetBtn: { padding: 8 },
  resetTxt: { fontSize: 20, color: C.muted },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8, gap: 12 },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
  },
  loadingTxt: { color: C.muted, fontSize: 14 },

  // Bubbles
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  avatarText: { color: C.accent, fontSize: 13, fontWeight: '700' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  aiBubble: {
    backgroundColor: C.surface,
    borderColor: C.aiBubbleBorder,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: C.userBubble,
    borderColor: C.userBubbleBorder,
    borderBottomRightRadius: 4,
  },
  bubbleText: { color: C.text, fontSize: 15, lineHeight: 22 },
  userBubbleText: { color: '#D4EDD9' },
  thinkingBubble: { paddingVertical: 14 },
  thinkingDots: { color: C.muted, fontSize: 16, letterSpacing: 4 },

  // Bottom
  bottom: {
    paddingVertical: 20,
    paddingBottom: 28,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 14,
  },
  statusText: { fontSize: 12, color: C.muted, letterSpacing: 1 },
  mic: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  micDisabled: { opacity: 0.35 },
  micIcon: { fontSize: 22, color: '#fff' },
  tapToStop: { fontSize: 11, color: C.red, letterSpacing: 1 },
});
