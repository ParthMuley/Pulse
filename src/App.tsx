/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, 
  MessageSquare, 
  Zap, 
  Play, 
  Pause, 
  RefreshCw, 
  Volume2, 
  VolumeX,
  Activity,
  Trophy,
  Flame,
  Radio,
  ExternalLink,
  Key,
  AlertCircle,
  Mic,
  MicOff
} from 'lucide-react';
import TwitchPlayer from './TwitchPlayer';
import { PulseAIService } from './services/pulseAIService';
import { AudioBridgeService } from './services/audioBridgeService';
import { Message, PulseState, MOCK_MESSAGES, Highlight } from './types';
import confetti from 'canvas-confetti';

import { TwitchChatService } from './services/twitchChatService';

const aiService = new PulseAIService();
let twitchService: TwitchChatService | null = null;

const USER_COLORS = [
  'text-red-400', 'text-blue-400', 'text-green-400', 
  'text-yellow-400', 'text-purple-400', 'text-pink-400', 
  'text-orange-400', 'text-cyan-400'
];

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    Twitch: any;
  }
}

const getTwitchParents = () => {
  const parents = [
    window.location.hostname, 
    'aistudio.google.com', 
    'ai.studio', 
    'aistudio.corp.google.com',
    'alkali.app',
    'makersuite.google.com',
    'localhost'
  ];
  if (typeof window !== 'undefined' && window.location.ancestorOrigins) {
    for (let i = 0; i < window.location.ancestorOrigins.length; i++) {
      try {
        const ancestorHost = new URL(window.location.ancestorOrigins[i]).hostname;
        if (!parents.includes(ancestorHost)) {
          parents.push(ancestorHost);
        }
      } catch (e) {}
    }
  }
  return parents;
};

export default function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pulse, setPulse] = useState<PulseState>({
    intensity: 20,
    mood: 'Ambient',
    genre: 'Lo-fi Chill',
    description: 'A calm, steady background beat for the waiting room.',
    game: 'Unknown',
    region: 'Global',
    isGenerating: false,
  });
  const [livePulse, setLivePulse] = useState<PulseState>({
    intensity: 20,
    mood: 'Ambient',
    genre: 'Lo-fi Chill',
    description: 'A calm, steady background beat for the waiting room.',
    game: 'Unknown',
    region: 'Global',
    isGenerating: false,
  });
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [liveAudioUrl, setLiveAudioUrl] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState('monstercat');
  const [volume, setVolume] = useState(0.5);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [isAudioCapturing, setIsAudioCapturing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'highlights'>('live');
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);
  
  const audioRef1 = useRef<HTMLAudioElement>(null);
  const audioRef2 = useRef<HTMLAudioElement>(null);
  const fadeIntervalRef = useRef<any>(null);
  const [audioState, setAudioState] = useState<{ url1: string | null, url2: string | null, active: 1 | 2 }>({ url1: null, url2: null, active: 1 });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const twitchPlayerRef = useRef<any>(null);
  const audioBridge = useRef<AudioBridgeService | null>(null);

  const twitchParents = getTwitchParents();

  // Initialize Services
  useEffect(() => {
    audioBridge.current = new AudioBridgeService((text) => {
      setTranscription(prev => (prev + " " + text).slice(-500));
    });

    return () => {
      audioBridge.current?.stop();
    };
  }, []);

  // Initialize Socket and Pulse Engine
  useEffect(() => {
    twitchService = new TwitchChatService((user, text) => {
      const newMsg: Message = {
        id: Math.random().toString(),
        user,
        text,
        timestamp: new Date(),
        color: USER_COLORS[Math.abs(user.length) % USER_COLORS.length]
      };
      setMessages(prev => [...prev.slice(-99), newMsg]);
    });

    // Initialize WebSocket Agent Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to Pulse Agent Server");
      setIsAgentActive(true);
      socket.send(JSON.stringify({ type: "join_stream", streamUrl }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // We no longer handle transcription as stream audio analysis is removed
      } catch (e) {
        console.error("Agent message error:", e);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from Pulse Agent Server");
      setIsAgentActive(false);
    };

    return () => {
      twitchService?.disconnect();
      liveSessionRef.current?.close();
      socketRef.current?.close();
    };
  }, [streamUrl]);

  // Handle Audio Crossfading State
  useEffect(() => {
    if (!audioUrl) return;

    setAudioState(prev => {
      if (prev.active === 1 && prev.url1 !== audioUrl) {
        if (!prev.url1) return { url1: audioUrl, url2: null, active: 1 };
        return { ...prev, url2: audioUrl, active: 2 };
      } else if (prev.active === 2 && prev.url2 !== audioUrl) {
        return { ...prev, url1: audioUrl, active: 1 };
      }
      return prev;
    });
  }, [audioUrl]);

  // Handle Audio Playback and Crossfading
  useEffect(() => {
    const shouldPlay = (isLive || activeTab === 'highlights') && !isMuted && isPlaying;
    const activeRef = audioState.active === 1 ? audioRef1.current : audioRef2.current;
    const inactiveRef = audioState.active === 1 ? audioRef2.current : audioRef1.current;

    if (!shouldPlay) {
      if (activeRef) activeRef.pause();
      if (inactiveRef) inactiveRef.pause();
      return;
    }

    // Start playing the active one
    if (activeRef) {
      const playPromise = activeRef.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          if (e.name === 'NotAllowedError' || e.name === 'AbortError') {
            // Browser paused media to save power or playback was aborted, safe to ignore
          } else {
            console.error("Playback failed", e);
          }
        });
      }
    }

    // If we just switched active player, we do a crossfade
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    let progress = 0;
    const fadeDuration = 2000; // 2 seconds
    const interval = 50;
    const steps = fadeDuration / interval;

    const isInactivePlaying = inactiveRef && !inactiveRef.paused;

    if (isInactivePlaying) {
      if (activeRef) activeRef.volume = 0;
      
      fadeIntervalRef.current = setInterval(() => {
        progress++;
        const ratio = progress / steps;
        
        if (activeRef) activeRef.volume = Math.min(volume * ratio, volume);
        if (inactiveRef) inactiveRef.volume = Math.max(volume * (1 - ratio), 0);
        
        if (progress >= steps) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
          if (inactiveRef) {
            inactiveRef.pause();
            inactiveRef.currentTime = 0;
          }
        }
      }, interval);
    } else {
      // Just set volume directly if no crossfade needed
      if (activeRef) activeRef.volume = volume;
    }

    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    };
  }, [audioState.active, audioState.url1, audioState.url2, isLive, isMuted, isPlaying, activeTab]);

  // Handle volume changes independently when not crossfading
  useEffect(() => {
    const activeRef = audioState.active === 1 ? audioRef1.current : audioRef2.current;
    if (activeRef && !fadeIntervalRef.current) {
      activeRef.volume = volume;
    }
  }, [volume, audioState.active]);

  const stateRef = useRef({
    messages,
    pulse,
    livePulse,
    audioUrl,
    activeTab
  });

  useEffect(() => {
    stateRef.current = { messages, pulse, livePulse, audioUrl, activeTab };
  }, [messages, pulse, livePulse, audioUrl, activeTab]);

  // Check for API Key on mount
  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        } else {
          // Fallback for standalone deployment or if platform API is missing
          console.warn("window.aistudio not found, falling back to true");
          setHasApiKey(true);
        }
      } catch (err) {
        console.error("Error checking API key:", err);
        setHasApiKey(true); // Fallback to avoid blank screen
      }
    };
    checkKey();
  }, []);

  // Cycle through highlights when not live
  useEffect(() => {
    if (isLive || highlights.length === 0) return;
    
    const interval = setInterval(() => {
      const randomHighlight = highlights[Math.floor(Math.random() * highlights.length)];
      setPulse({
        intensity: randomHighlight.intensity,
        mood: randomHighlight.mood,
        genre: randomHighlight.genre,
        description: randomHighlight.description,
        isGenerating: false
      });
      
      // If the highlight has a video, show it
      // (Removed videoUrl logic)
    }, 10000);

    return () => clearInterval(interval);
  }, [isLive, highlights]);

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    setHasApiKey(true); // Assume success as per instructions
  };

  // Scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const updatePulse = useCallback(async () => {
    const state = stateRef.current;
    if (!isLive || state.pulse.isGenerating) return;

    setPulse(prev => ({ ...prev, isGenerating: true }));
    setLivePulse(prev => ({ ...prev, isGenerating: true }));
    
    try {
      const chatTexts = state.messages.map(m => m.text);
      
      const moodData = await aiService.analyzeMood(chatTexts, streamUrl, transcription);
      
      // Detect significant change for highlight
      const intensityDiff = Math.abs(moodData.intensity - state.livePulse.intensity);
      const moodChanged = moodData.mood !== state.livePulse.mood;
      const genreChanged = moodData.genre !== state.livePulse.genre;
      
      const significantChange = intensityDiff > 15 || moodChanged || genreChanged;
      
      let highlightId: string | null = null;
      if (significantChange) {
        let currentVodId = undefined;
        let currentStreamTime = undefined;
        if (twitchPlayerRef.current && state.activeTab === 'live') {
          try {
            if (typeof twitchPlayerRef.current.getVideo === 'function') {
              currentVodId = twitchPlayerRef.current.getVideo();
            }
            if (typeof twitchPlayerRef.current.getCurrentTime === 'function') {
              currentStreamTime = twitchPlayerRef.current.getCurrentTime();
            }
          } catch (e) { console.error("Error getting player time:", e); }
        }

        highlightId = Math.random().toString();
        const newHighlight: Highlight = {
          id: highlightId,
          timestamp: new Date(),
          mood: moodData.mood,
          intensity: moodData.intensity,
          description: moodData.description,
          genre: moodData.genre,
          game: moodData.game,
          region: moodData.region,
          vodId: currentVodId,
          streamTime: currentStreamTime
        };
        setHighlights(prev => [newHighlight, ...prev].slice(0, 10));
      }

      setLivePulse({
        ...moodData,
        isGenerating: false,
      });
      if (state.activeTab === 'live') {
        setPulse({
          ...moodData,
          isGenerating: false,
        });
      }
      setLastUpdate(new Date());

      if (moodData.intensity > 80) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f97316', '#ffffff', '#000000']
        });
      }

      if (significantChange || !state.audioUrl) {
        try {
          setIsAudioLoading(true);
          const music = await aiService.generateMusic(moodData.description);
          setLiveAudioUrl(music.audioUrl);
          if (state.activeTab === 'live') {
            setAudioUrl(music.audioUrl);
          }
          console.log("New music generated and set:", music.audioUrl);

          if (highlightId) {
            setHighlights(prev => prev.map(h => h.id === highlightId ? { ...h, audioUrl: music.audioUrl } : h));
          }
        } catch (e: any) {
          console.error("Asset generation failed:", e);
          if (e?.message?.includes("permission") || e?.message?.includes("403")) {
            setHasApiKey(false);
          }
        } finally {
          setIsAudioLoading(false);
        }
      }

    } catch (error: any) {
      console.error("Pulse update failed", error);
      // If permission denied, prompt for key again
      if (error?.message?.includes("not found") || error?.message?.includes("permission")) {
        setHasApiKey(false);
      }
    } finally {
      setLivePulse(prev => ({ ...prev, isGenerating: false }));
      if (stateRef.current.activeTab === 'live') {
        setPulse(prev => ({ ...prev, isGenerating: false }));
      }
    }
  }, [isLive, streamUrl]);

  // Automatic Pulse Update Interval
  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      updatePulse();
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [isLive, updatePulse]);

  // Removed manual Twitch API initialization hooks as ReactPlayer handles this internally.

  const toggleLive = () => {
    const nextState = !isLive;
    setIsLive(nextState);
    if (nextState) {
      setMessages([]);
      twitchService?.connect(streamUrl);
      updatePulse();
    } else {
      twitchService?.disconnect();
      setAudioUrl(null);
      audioBridge.current?.stop();
      setIsAudioCapturing(false);
      setTranscription("");
    }
  };

  const toggleAudioCapture = async () => {
    if (!audioBridge.current) return;
    
    if (isAudioCapturing) {
      audioBridge.current.stop();
      setIsAudioCapturing(false);
    } else {
      try {
        await audioBridge.current.start();
        setIsAudioCapturing(true);
      } catch (err) {
        console.error("Failed to start audio capture:", err);
      }
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-[#0e0e10] flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-[#18181b] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto">
            <Key className="text-orange-500" size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">API Key Required</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Pulse uses Lyria 3.1 for music generation, which requires a paid Google Cloud project API key.
            </p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex gap-3 text-left">
            <AlertCircle className="text-orange-500 shrink-0" size={18} />
            <p className="text-[11px] text-orange-200/80 leading-normal">
              Please select a key from a paid project. You can find more info in the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-white">billing documentation</a>.
            </p>
          </div>
          <button 
            onClick={handleSelectKey}
            className="w-full py-4 bg-orange-500 text-black font-bold rounded-2xl hover:bg-orange-400 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            SELECT API KEY
          </button>
        </div>
      </div>
    );
  }

  if (hasApiKey === null) return null;

  return (
    <div className="relative h-screen bg-[#0e0e10] text-[#efeff1] font-sans overflow-hidden flex flex-col">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="w-full h-full bg-gradient-to-br from-purple-900/10 via-black to-blue-900/10" />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
      </div>

      {/* Top Navigation Bar */}
      <nav className="relative z-20 h-14 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.3)]">
            <Zap size={18} className="text-white fill-current" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter uppercase italic leading-none">Pulse</h1>
            <span className="text-[10px] text-orange-500 font-mono uppercase tracking-[0.2em]">Neural Stream DJ</span>
          </div>
        </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleAudioCapture}
                disabled={!isLive}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                  isAudioCapturing 
                    ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.2)]' 
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60 disabled:opacity-30'
                }`}
              >
                {isAudioCapturing ? <Mic size={14} /> : <MicOff size={14} />}
                <span className="text-[10px] font-mono uppercase tracking-widest hidden sm:inline">
                  {isAudioCapturing ? 'Listening to Streamer' : 'Enable Audio Context'}
                </span>
              </button>
            </div>
            
            <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">
            <Radio size={14} className={isLive ? 'text-red-500 animate-pulse' : 'text-white/20'} />
            <input 
              type="text" 
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-mono w-48 text-white/60 focus:text-white"
              placeholder="Stream URL..."
            />
            <ExternalLink size={12} className="text-white/20" />
          </div>
          
          <button 
            onClick={toggleLive}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${
              isLive 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]' 
              : 'bg-white text-black hover:bg-white/90'
            }`}
          >
            {isLive ? 'DISCONNECT' : 'CONNECT STREAM'}
          </button>
        </div>
      </nav>

      {/* Main Layout */}
      <main className="relative z-10 flex-1 flex overflow-hidden">
        
        {/* Left: Pulse Engine & Visuals */}
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Pulse Stats Card */}
            <section className="bg-[#18181b] border border-white/5 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Atmosphere</h2>
                    <p className="text-3xl font-bold tracking-tight">{pulse.mood}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Intensity</h2>
                    <p className="text-3xl font-mono font-bold text-orange-500">{pulse.intensity}%</p>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${pulse.intensity}%` }}
                    transition={{ type: 'spring', stiffness: 50 }}
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2">Context</h2>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                      <Radio size={14} className="text-orange-500" />
                      <span className="text-xs font-medium truncate">{pulse.game || 'Unknown'} • {pulse.region || 'Global'}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2">Neural Genre</h2>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                      <Music size={14} className="text-orange-500" />
                      <span className="text-xs font-medium truncate">{pulse.genre}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-white/60 leading-relaxed italic">
                    "{pulse.description}"
                  </p>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={updatePulse}
                  disabled={!isLive || pulse.isGenerating}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-black text-xs font-bold hover:bg-orange-400 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  <RefreshCw size={16} className={pulse.isGenerating ? 'animate-spin' : ''} />
                  {pulse.isGenerating ? 'GENERATING...' : 'RE-SYNC PULSE'}
                </button>
              </div>
            </section>

            {/* Visualizer / Stream Monitor */}
            <section className="bg-[#18181b] border border-white/5 rounded-2xl overflow-hidden relative shadow-xl flex flex-col">
              {/* Tabs */}
              <div className="flex bg-black/40 border-b border-white/5">
                <button
                  onClick={() => {
                    setActiveTab('live');
                    setPulse(livePulse);
                    if (liveAudioUrl) {
                      setAudioUrl(liveAudioUrl);
                    }
                  }}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'live' ? 'text-orange-500 border-b-2 border-orange-500 bg-white/5' : 'text-white/40 hover:text-white/60'}`}
                >
                  Live Stream
                </button>
                <button
                  onClick={() => setActiveTab('highlights')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'highlights' ? 'text-orange-500 border-b-2 border-orange-500 bg-white/5' : 'text-white/40 hover:text-white/60'}`}
                >
                  Highlights
                </button>
              </div>

              <div className="aspect-video relative bg-black min-h-[300px]">
                {/* Twitch Player Container (Always in DOM) */}
                <div 
                  className="absolute inset-0 z-0 w-full h-full" 
                  style={{ display: (isLive && activeTab === 'live') || activeTab === 'highlights' ? 'block' : 'none' }}
                >
                  <TwitchPlayer
                    channel={activeTab === 'live' || !activeHighlight?.vodId ? streamUrl.replace(/^(https?:\/\/)?(www\.)?twitch\.tv\//, '').split('/')[0] : undefined}
                    video={activeTab === 'highlights' && activeHighlight?.vodId ? activeHighlight.vodId : undefined}
                    time={activeTab === 'highlights' && activeHighlight?.vodId ? `${activeHighlight.streamTime || 0}s` : undefined}
                    parents={twitchParents}
                    onPlayerReady={(player) => {
                      twitchPlayerRef.current = player;
                    }}
                  />
                </div>

                {/* Overlay for Offline Live Tab */}
                {!isLive && activeTab === 'live' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#18181b] z-10">
                    <div className="text-center space-y-3">
                      <Activity size={48} className={`mx-auto ${highlights.length > 0 ? 'text-orange-500 animate-pulse' : 'text-white/10'}`} />
                      <p className="text-[10px] text-white/20 font-mono uppercase tracking-[0.3em]">
                        {highlights.length > 0 ? 'Playing Highlight Reel' : 'No Signal Detected'}
                      </p>
                      {highlights.length > 0 && (
                        <p className="text-[9px] text-orange-500/60 font-mono uppercase">
                          Atmosphere: {pulse.mood}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Message for Highlights without VOD */}
                {activeTab === 'highlights' && activeHighlight && !activeHighlight.vodId && (
                  <div className="absolute top-4 left-4 bg-black/80 text-white/80 text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/10 z-10 backdrop-blur-md">
                    Live Stream (Clip Unavailable)
                  </div>
                )}

                {/* Message when no highlight selected */}
                {activeTab === 'highlights' && !activeHighlight && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                    <p className="text-white/40 text-xs font-mono uppercase tracking-widest">Select a highlight below</p>
                  </div>
                )}
              </div>
              
              {/* Status Bar (Moved outside the video container to avoid obfuscation) */}
              <div className="p-4 bg-black/20 flex justify-between items-center border-t border-white/5">
                <div className="flex gap-2">
                  <div className="px-2 py-1 bg-red-600 text-[9px] font-bold rounded flex items-center gap-1">
                    <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                    {activeTab === 'live' ? 'LIVE' : 'VOD'}
                  </div>
                  <div className={`px-2 py-1 backdrop-blur-md text-[9px] font-mono rounded border ${isAgentActive ? 'bg-green-600/20 border-green-500/50 text-green-500' : 'bg-black/80 border-white/10 text-white/40'}`}>
                    {isAgentActive ? 'AGENT ACTIVE' : 'OFFLINE'}
                  </div>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <motion.div 
                      key={i}
                      animate={(isLive || highlights.length > 0) ? { height: [2, (pulse.intensity/100) * 20, 4, (pulse.intensity/100) * 24, 2] } : { height: 2 }}
                      transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.05 }}
                      className="w-0.5 bg-orange-500 rounded-full"
                    />
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Commentary & Audio Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Radio size={16} className="text-orange-500" />
                  <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Stream Audio Analysis</h2>
                </div>
                <div className="text-[9px] font-mono text-orange-500/80 uppercase flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse" />
                  {isLive ? 'Primary Source: Chat Reaction' : 'Disconnected'}
                </div>
              </div>
              <div className="bg-black/40 rounded-xl p-5 border border-white/5 min-h-[100px] flex flex-col justify-center relative overflow-hidden">
                {isLive ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                        <p className="text-xs font-mono text-white/40">Real-time Pulse Engine:</p>
                      </div>
                      {isAudioCapturing && (
                        <div className="flex gap-1 items-end h-3">
                          {[1, 2, 3, 4].map(i => (
                            <motion.div 
                              key={i}
                              animate={{ height: [2, 8, 4, 10, 2] }}
                              transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.1 }}
                              className="w-0.5 bg-green-500/50 rounded-full"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="text-lg font-medium text-white/90 italic leading-snug">
                      {transcription ? (
                        <span className="text-white/90">"{transcription.slice(-150)}..."</span>
                      ) : (
                        "Monitoring chat reactions and stream context to synchronize the soundtrack..."
                      )}
                    </p>
                    {isAudioCapturing && !transcription && (
                      <p className="text-[9px] font-mono text-green-500/50 animate-pulse uppercase tracking-widest">
                        Analyzing streamer audio...
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-white/20 text-center font-mono">Connect to a stream to begin audio analysis</p>
                )}
              </div>
            </div>

            <div className="bg-orange-500 rounded-2xl p-6 text-black flex flex-col justify-between shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-black uppercase tracking-tighter text-xl italic">Pulse Hub</h3>
                {(!isLive && highlights.length > 0) ? (
                  <div className="px-2 py-1 bg-black text-[9px] font-bold rounded flex items-center gap-1">
                    <Trophy size={10} />
                    HIGHLIGHT REEL
                  </div>
                ) : (
                  <Trophy size={24} />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold uppercase opacity-80">Current Status</div>
                <div className="text-2xl font-black italic tracking-tighter leading-none">
                  {pulse.intensity > 80 ? 'CRITICAL MASS' : pulse.intensity > 50 ? 'HEATING UP' : 'CHILLING'}
                </div>
              </div>
              <div className="text-[9px] font-mono uppercase font-bold opacity-60 mt-4 flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>Lyria 3.1 Adaptive Audio</span>
                  <span>Updated: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Highlights Section */}
          <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy size={16} className="text-orange-500" />
                <h2 className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Atmosphere Highlights</h2>
              </div>
              <div className="text-[9px] font-mono text-white/20 uppercase">
                {highlights.length} Moments Captured
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {highlights.length === 0 ? (
                <div className="col-span-full py-12 text-center text-white/10 italic text-xs border border-dashed border-white/5 rounded-xl">
                  No highlights captured yet. Start a stream to record atmosphere shifts.
                </div>
              ) : (
                highlights.map((h) => (
                  <motion.div 
                    key={h.id}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => {
                      setActiveHighlight(h);
                      setActiveTab('highlights');
                      setPulse({
                        intensity: h.intensity,
                        mood: h.mood,
                        genre: h.genre,
                        description: h.description,
                        game: h.game,
                        region: h.region,
                        isGenerating: false
                      });
                      if (h.audioUrl) {
                        setAudioUrl(h.audioUrl);
                      }
                    }}
                    className={`bg-black/40 border rounded-xl p-3 space-y-2 transition-all group cursor-pointer ${
                      activeHighlight?.id === h.id ? 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'border-white/5 hover:border-orange-500/30'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-mono text-orange-500">{h.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <div className="flex gap-1">
                        {h.vodId ? (
                          <div className="px-1.5 py-0.5 bg-purple-500/20 rounded text-[8px] font-bold text-purple-400 uppercase flex items-center gap-1">
                            <Play size={8} />
                            VOD
                          </div>
                        ) : (
                          <div className="px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-bold text-white/20 uppercase flex items-center gap-1">
                            <Activity size={8} />
                            LIVE
                          </div>
                        )}
                        <div className="px-1.5 py-0.5 bg-orange-500/10 rounded text-[8px] font-bold text-orange-500 uppercase">{h.mood}</div>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-white/90 truncate group-hover:text-orange-500 transition-colors">{h.genre}</div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${h.intensity}%` }}
                        className="h-full bg-orange-500" 
                      />
                    </div>
                    <p className="text-[9px] text-white/40 line-clamp-2 italic leading-tight">
                      {h.description}
                    </p>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Twitch-style Chat Feed */}
        <aside className="w-[340px] border-l border-white/5 bg-[#18181b] flex flex-col shadow-2xl">
          <div className="h-12 border-b border-white/5 flex items-center justify-center px-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/60">Stream Chat</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar bg-[#0e0e10]">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-white/10 italic text-xs">
                Welcome to the chat!
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="text-[13px] leading-relaxed py-0.5 hover:bg-white/5 px-1 rounded transition-colors">
                  <span className="text-[11px] text-white/30 mr-2 font-mono">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`font-bold ${msg.color || 'text-purple-400'} hover:underline cursor-pointer`}>
                    {msg.user}
                  </span>
                  <span className="text-white/90 font-medium">
                    : {msg.text}
                  </span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-white/5 bg-[#18181b]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsMuted(!isMuted)} className="text-white/40 hover:text-white transition-colors">
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <div className="flex-1">
                  <div className="text-[9px] font-mono text-white/30 uppercase mb-0.5">Audio Output</div>
                  <div className="text-[11px] font-bold text-orange-500 truncate">
                    {isAudioLoading ? 'GENERATING...' : isLive ? `AI: ${pulse.genre}` : 'Muted'}
                  </div>
                </div>
                <div className="flex gap-0.5 items-end h-4">
                  {[1, 2, 3].map(i => (
                    <motion.div 
                      key={i}
                      animate={isLive && !isMuted && !isAudioLoading ? { height: [2, 10, 4, 12, 2] } : { height: 2 }}
                      transition={{ repeat: Infinity, duration: 0.3, delay: i * 0.1 }}
                      className="w-1 bg-orange-500 rounded-full"
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)} 
                  className="text-white/40 hover:text-white transition-colors"
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <Volume2 size={12} className="text-white/20" />
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Audio Elements for Crossfading */}
      {audioState.url1 && (
        <audio 
          ref={audioRef1} 
          src={audioState.url1} 
          loop 
          muted={isMuted}
          onPlay={() => console.log("Music 1 started")}
        />
      )}
      {audioState.url2 && (
        <audio 
          ref={audioRef2} 
          src={audioState.url2} 
          loop 
          muted={isMuted}
          onPlay={() => console.log("Music 2 started")}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}} />
    </div>
  );
}
