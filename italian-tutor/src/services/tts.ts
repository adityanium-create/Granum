import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

let currentSound: Audio.Sound | null = null;

export async function speakItalian(
  text: string,
  elevenLabsKey?: string,
  voiceId?: string,
): Promise<void> {
  if (elevenLabsKey) {
    try {
      await speakElevenLabs(text, elevenLabsKey, voiceId);
      return;
    } catch {
      // fall through to device TTS
    }
  }
  await speakDevice(text);
}

export function stopSpeaking(): void {
  Speech.stop();
  if (currentSound) {
    currentSound.stopAsync().catch(() => null);
    currentSound.unloadAsync().catch(() => null);
    currentSound = null;
  }
}

async function speakDevice(text: string): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(text, {
      language: 'it-IT',
      rate: 0.88,
      pitch: 1.0,
      onDone: resolve,
      onError: () => resolve(),
      onStopped: () => resolve(),
    });
  });
}

async function speakElevenLabs(
  text: string,
  apiKey: string,
  voiceId = 'pNInz6obpgDQGcFmaJgB',
): Promise<void> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!response.ok) throw new Error(`ElevenLabs ${response.status}`);

  const arrayBuffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);

  const fileUri = (FileSystem.cacheDirectory ?? '') + 'lucia_speech.mp3';
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
  currentSound = sound;

  await new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && (status.didJustFinish || !status.isPlaying)) {
        sound.unloadAsync().catch(() => null);
        currentSound = null;
        resolve();
      }
    });
    sound.playAsync().catch(() => resolve());
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
