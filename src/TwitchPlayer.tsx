import React, { useEffect, useRef } from 'react';

interface TwitchPlayerProps {
  channel?: string;
  video?: string;
  time?: string;
  parents: string[];
  onPlayerReady?: (player: any) => void;
}

export default function TwitchPlayer({ channel, video, time, parents, onPlayerReady }: TwitchPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerId = useRef(`twitch-${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!isMounted || playerRef.current || !containerRef.current) return;
      if (!window.Twitch || !window.Twitch.Player) {
        setTimeout(initPlayer, 100);
        return;
      }
      
      containerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.id = playerId.current;
      playerDiv.style.width = '100%';
      playerDiv.style.height = '100%';
      containerRef.current.appendChild(playerDiv);

      const options: any = {
        width: '100%',
        height: '100%',
        muted: true,
        autoplay: true,
        parent: parents,
      };

      // We use refs to get the latest props if they changed before init
      if (video) {
        options.video = video;
        options.time = time || '0s';
      } else if (channel) {
        options.channel = channel;
      } else {
        // Fallback to a default channel if somehow both are missing
        options.channel = 'monstercat';
      }

      try {
        const player = new window.Twitch.Player(playerId.current, options);
        playerRef.current = player;
        
        player.addEventListener(window.Twitch.Player.READY, () => {
          if (isMounted && onPlayerReady) {
            onPlayerReady(player);
          }
        });
      } catch (err) {
        console.error("Twitch init error:", err);
      }
    };

    if (!window.Twitch) {
      const existingScript = document.querySelector('script[src="https://player.twitch.tv/js/embed/v1.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', initPlayer);
      } else {
        const script = document.createElement('script');
        script.src = 'https://player.twitch.tv/js/embed/v1.js';
        script.async = true;
        script.onload = initPlayer;
        document.body.appendChild(script);
      }
    } else {
      initPlayer();
    }

    return () => {
      isMounted = false;
      playerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Handle prop updates for already initialized player
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (video) {
        playerRef.current.setVideo(video, time || '0s');
      } else if (channel) {
        playerRef.current.setChannel(channel);
      }
    } catch (err) {
      console.error("Twitch update error:", err);
    }
  }, [channel, video, time]);

  return <div ref={containerRef} className="w-full h-full" />;
}
