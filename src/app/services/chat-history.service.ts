import { Injectable } from '@angular/core';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  loading?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ChatHistoryService {
  private _messages: ChatMessage[] = [];
  private _history: { role: string; text: string }[] = [];

  getMessages(): ChatMessage[] { return this._messages; }
  getHistory(): { role: string; text: string }[] { return this._history; }
  hasMessages(): boolean { return this._messages.length > 0; }

  addMessage(msg: ChatMessage) { this._messages.push(msg); }

  updateMessage(id: string, updates: Partial<ChatMessage>) {
    const idx = this._messages.findIndex(m => m.id === id);
    if (idx !== -1) this._messages[idx] = { ...this._messages[idx], ...updates };
  }

  pushHistory(role: string, text: string) {
    this._history.push({ role, text });
    if (this._history.length > 40) this._history = this._history.slice(-40);
  }

  clear() { this._messages = []; this._history = []; }
}
