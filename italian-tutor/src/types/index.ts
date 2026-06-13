export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export type AppStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking';

export type SkillLevel = 'unknown' | 'beginner' | 'intermediate' | 'advanced';

export type ApiKeys = {
  anthropic: string;
  openai: string;
  elevenlabs?: string;
  elevenLabsVoiceId?: string;
};
