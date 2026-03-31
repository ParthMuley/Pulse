/**
 * Service to connect to Twitch IRC via WebSockets for real-time chat
 */
export class TwitchChatService {
  private socket: WebSocket | null = null;
  private onMessageCallback: (user: string, message: string) => void;

  constructor(onMessage: (user: string, message: string) => void) {
    this.onMessageCallback = onMessage;
  }

  connect(channel: string) {
    if (this.socket) {
      this.socket.close();
    }

    // Sanitize channel name (remove URL parts if user pasted a full link)
    const channelName = channel.replace(/^(https?:\/\/)?(www\.)?twitch\.tv\//, '').split('/')[0].toLowerCase();
    
    if (!channelName) return;

    this.socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this.socket.onopen = () => {
      console.log(`Twitch Chat: Connected to #${channelName}`);
      this.socket?.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      this.socket?.send('PASS SCHMOOPIIE'); // Anonymous pass
      this.socket?.send(`NICK justinfan${Math.floor(Math.random() * 100000)}`);
      this.socket?.send(`JOIN #${channelName}`);
    };

    this.socket.onmessage = (event) => {
      const data = event.data as string;
      
      // Basic IRC parsing for PRIVMSG
      if (data.includes('PRIVMSG')) {
        const parts = data.split(' ');
        
        // Extract username from :user!user@user.tmi.twitch.tv
        const userPart = parts[0];
        const username = userPart.substring(1, userPart.indexOf('!'));
        
        // Extract message (everything after the second colon)
        const messageIndex = data.indexOf(':', 1);
        const message = data.substring(messageIndex + 1).trim();

        if (username && message) {
          this.onMessageCallback(username, message);
        }
      }

      // Respond to PING to keep connection alive
      if (data.startsWith('PING')) {
        this.socket?.send('PONG :tmi.twitch.tv');
      }
    };

    this.socket.onerror = (error) => {
      console.error('Twitch Chat WebSocket Error:', error);
    };

    this.socket.onclose = () => {
      console.log('Twitch Chat: Disconnected');
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
