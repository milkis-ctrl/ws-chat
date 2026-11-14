import { WS_URL } from "./config";

export interface ChatMessage {
  sender: string;
  text: string;
  timestamp: number;
}

interface Handlers {
  onAuth: (username: string) => void;
  onMessage: (m: ChatMessage) => void;
  onClose: (wasAuthenticated: boolean) => void;
}

export class ChatClient {
  private ws: WebSocket | null = null;
  private authenticated = false;

  constructor(private handlers: Handlers) {}

  connect(accessToken: string) {
    this.authenticated = false;
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      // Первое сообщение обязательно AUTH
      ws.send(JSON.stringify({ type: "AUTH", payload: { token: accessToken } }));
    };

    ws.onmessage = (ev) => {
      let msg: any;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "AUTH_SUCCESS") {
        this.authenticated = true;
        this.handlers.onAuth(msg.payload.username);
      } else if (msg.type === "NEW_MESSAGE") {
        this.handlers.onMessage(msg.payload as ChatMessage);
      }
    };

    ws.onclose = () => {
      // Игнорируем закрытие старого сокета, если уже открыт новый или мы вышли сами
      if (this.ws !== ws) return;
      this.ws = null;
      this.handlers.onClose(this.authenticated);
    };
  }

  send(text: string) {
    if (!this.authenticated || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "CHAT_MESSAGE", payload: { text } }));
  }

  /** Закрывает соединение без вызова onClose (используется при logout). */
  disconnect() {
    const ws = this.ws;
    this.ws = null;
    this.authenticated = false;
    ws?.close();
  }
}