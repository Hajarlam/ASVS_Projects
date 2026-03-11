import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../services/ai.service';
import { ChatHistoryService, ChatMessage } from '../../services/chat-history.service';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.css']
})
export class AiChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('fileInputEl') fileInputEl!: ElementRef<HTMLInputElement>;

  isDragging = false;

  get messages(): ChatMessage[] { return this.chatHistory.getMessages(); }
  get history(): { role: string; text: string }[] { return this.chatHistory.getHistory(); }

  inputText = '';
  isLoading = false;
  fastMode = false;
  copiedId: string | null = null;
  sidebarOpen = true;
  private shouldScroll = false;

  suggestions = [
    '🔐 Comment implémenter JWT de manière sécurisée ?',
    '🛡️ Qu\'est-ce que l\'injection SQL et comment la prévenir ?',
    '🔑 Meilleures pratiques pour le hachage de mots de passe ?',
    '📡 Comment sécuriser les endpoints API ?'
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private aiService: AiService,
    private chatHistory: ChatHistoryService
  ) { }

  ngOnInit() {
    if (!this.chatHistory.hasMessages()) {
      this.chatHistory.addMessage({
        id: this.genId(), role: 'model', timestamp: new Date(),
        text: `👋 **Bonjour ! Je suis votre Assistant IA de Sécurité ASVS.**\n\nJe peux vous aider avec :\n- 🔐 **OWASP ASVS** — exigences et implémentation\n- 🛡️ **Bonnes pratiques** de sécurité\n- 💻 **Exemples de code** sécurisé\n- 🔍 **Analyse de vulnérabilités**\n\nPosez votre question !`
      });
    }
    this.shouldScroll = true;
  }

  // Drag and Drop handlers
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
      input.value = ''; // Reset
    }
  }

  triggerFileInput() {
    this.fileInputEl.nativeElement.click();
  }

  async handleFile(file: File) {
    if (this.isLoading) return;

    const ext = file.name.split('.').pop() || 'txt';
    const validExts = ['js', 'ts', 'php', 'py', 'java', 'cs', 'go', 'rb', 'html', 'css', 'json', 'sql', 'cpp', 'c'];

    if (!validExts.includes(ext.toLowerCase())) {
      this.chatHistory.addMessage({
        id: this.genId(), role: 'model',
        text: `⚠️ Le fichier **${file.name}** n'est pas un fichier de code supporté pour l'analyse.`,
        timestamp: new Date()
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const code = e.target?.result as string;
      if (!code) return;

      const promptText = `Analyse du fichier: ${file.name}`;
      this.chatHistory.addMessage({ id: this.genId(), role: 'user', text: promptText, timestamp: new Date() });
      this.shouldScroll = true;

      const loadingId = this.genId();
      this.chatHistory.addMessage({ id: loadingId, role: 'model', text: '', timestamp: new Date(), loading: true });
      this.isLoading = true;
      this.cdr.detectChanges();

      try {
        const responseText = await this.aiService.scanCode(code, ext);
        this.chatHistory.pushHistory('user', `Scan code: \n\`\`\`${ext}\n${code}\n\`\`\``);
        this.chatHistory.pushHistory('model', responseText);
        this.chatHistory.updateMessage(loadingId, { text: responseText, loading: false });
      } catch (err: any) {
        this.chatHistory.updateMessage(loadingId, { text: `❌ Erreur pendant le scan : ${err?.message || 'Réessayez.'}`, loading: false });
      }

      this.isLoading = false;
      this.shouldScroll = true;
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  async sendMessage() {
    const text = this.inputText.trim();
    if (!text || this.isLoading) return;

    this.chatHistory.addMessage({ id: this.genId(), role: 'user', text, timestamp: new Date() });
    this.inputText = '';
    this.shouldScroll = true;

    const loadingId = this.genId();
    this.chatHistory.addMessage({ id: loadingId, role: 'model', text: '', timestamp: new Date(), loading: true });
    this.isLoading = true;
    this.cdr.detectChanges();

    try {
      const history = this.chatHistory.getHistory();
      const responseText = await this.aiService.chat(text, history, { fastMode: this.fastMode });
      this.chatHistory.pushHistory('user', text);
      this.chatHistory.pushHistory('model', responseText);
      this.chatHistory.updateMessage(loadingId, { text: responseText, loading: false });
    } catch (e: any) {
      this.chatHistory.updateMessage(loadingId, { text: `❌ Erreur : ${e?.message || 'Réessayez.'}`, loading: false });
    }

    this.isLoading = false;
    this.shouldScroll = true;
    this.cdr.detectChanges();
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
  }

  parseMessage(text: string): { type: 'text' | 'code'; content: string; language?: string }[] {
    const segs: { type: 'text' | 'code'; content: string; language?: string }[] = [];
    const re = /```(\w+)?\n?([\s\S]*?)```/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segs.push({ type: 'text', content: text.slice(last, m.index) });
      segs.push({ type: 'code', language: m[1] || 'code', content: m[2].trim() });
      last = m.index + m[0].length;
    }
    if (last < text.length) segs.push({ type: 'text', content: text.slice(last) });
    return segs;
  }

  formatText(text: string): string {
    const safe = this.escapeHtml(text);
    return safe
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/^- (.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async copyCode(code: string, id: string) {
    try { await navigator.clipboard.writeText(code); } catch {
      const el = document.createElement('textarea');
      el.value = code; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    this.copiedId = id;
    setTimeout(() => { this.copiedId = null; this.cdr.detectChanges(); }, 2000);
    this.cdr.detectChanges();
  }

  async copyFullMessage(text: string, id: string) {
    // Retirer les artefacts de formatage Markdown avant copie si nécessaire, ou le laisser brut.
    // Pour une copie fidèle, laissons le texte brut tel quel.
    try { await navigator.clipboard.writeText(text); } catch {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    this.copiedId = id + '-full';
    setTimeout(() => { this.copiedId = null; this.cdr.detectChanges(); }, 2000);
    this.cdr.detectChanges();
  }

  downloadCode(code: string, language: string, messageId: string, blockIndex: number) {
    const ext = this.getCodeExtension(language);
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `snippet-${messageId}-${blockIndex + 1}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private getCodeExtension(language: string): string {
    const lang = (language || '').toLowerCase();
    const extensions: Record<string, string> = {
      ts: 'ts', typescript: 'ts',
      js: 'js', javascript: 'js',
      py: 'py', python: 'py',
      html: 'html',
      css: 'css',
      json: 'json',
      sh: 'sh', bash: 'sh', shell: 'sh',
      ps: 'ps1', powershell: 'ps1',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cs: 'cs', csharp: 'cs',
      go: 'go',
      rs: 'rs', rust: 'rs',
      rb: 'rb', ruby: 'rb',
      php: 'php',
      sql: 'sql',
      xml: 'xml',
      yml: 'yml', yaml: 'yml',
      md: 'md', markdown: 'md'
    };
    return extensions[lang] || (lang.replace(/[^a-z0-9]+/g, '') || 'txt');
  }

  clearChat() { this.chatHistory.clear(); this.ngOnInit(); }
  toggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }
  useSuggestion(s: string) { this.inputText = s.replace(/^[^\s]+\s/, '').trim(); this.sendMessage(); }
  private genId() { return Math.random().toString(36).slice(2, 10); }
  formatTime(d: Date): string { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  get messageCount() { return this.chatHistory.getMessages().length; }
  get exchangeCount() { return Math.floor(this.chatHistory.getHistory().length / 2); }
  scrollToBottom() { try { const el = this.messagesContainer?.nativeElement; if (el) el.scrollTop = el.scrollHeight; } catch { } }
}
