export interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: Date;
  color?: string;
}

export interface PulseState {
  intensity: number;
  mood: string;
  genre: string;
  description: string;
  game?: string;
  region?: string;
  isGenerating: boolean;
}

export interface Highlight {
  id: string;
  timestamp: Date;
  mood: string;
  intensity: number;
  description: string;
  genre: string;
  game?: string;
  region?: string;
  vodId?: string;
  streamTime?: number;
  audioUrl?: string;
}

export const MOCK_MESSAGES: Message[] = [
  { id: '1', user: 'GamerX', text: 'LETS GOOOOOOO!', timestamp: new Date() },
  { id: '2', user: 'StreamWatcher', text: 'That play was insane!', timestamp: new Date() },
  { id: '3', user: 'NoobMaster', text: 'POGGERS', timestamp: new Date() },
  { id: '4', user: 'ChillVibes', text: 'Wait, what just happened?', timestamp: new Date() },
  { id: '5', user: 'ProPlayer', text: 'Calculated.', timestamp: new Date() },
];
