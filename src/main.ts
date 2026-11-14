import "./style.css";
import * as api from "./api";
import { ChatClient, type ChatMessage } from "./chat";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const authView = $("auth-view");
const chatView = $("chat-view");
const authForm = $<HTMLFormElement>("auth-form");
const usernameEl = $<HTMLInputElement>("username");
const passwordEl = $<HTMLInputElement>("password");
const authError = $("auth-error");
const meEl = $("me");
const messagesEl = $("messages");
const sendForm = $<HTMLFormElement>("send-form");
const textEl = $<HTMLInputElement>("text");
const statusEl = $("status");

const MAX_RETRIES = 5;
let loggedIn = false;
let retries = 0;
let retryTimer: number | undefined;

const chat = new ChatClient({
  onAuth(username) {
    retries = 0;
    meEl.textContent = username;
    statusEl.textContent = "";
  },
  onMessage: addMessage,
  onClose(wasAuthenticated) {
    if (!loggedIn) return;
    if (!wasAuthenticated && ++retries > MAX_RETRIES) {
      doLogout("Не удалось подключиться к чату, войдите снова");
      return;
    }
    statusEl.textContent = "Соединение потеряно, переподключение…";
    retryTimer = window.setTimeout(startChat, wasAuthenticated ? 1000 : 3000);
  },
});

function showChat(show: boolean) {
  authView.hidden = show;
  chatView.hidden = !show;
}

function addMessage(m: ChatMessage) {
  const row = document.createElement("div");
  row.className = "msg";

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = `${m.sender} · ${new Date(m.timestamp).toLocaleTimeString()}`;

  const body = document.createElement("div");
  body.textContent = m.text; // textContent защищает от XSS

  row.append(meta, body);
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function startChat() {
  const token = await api.getValidAccess();
  if (!loggedIn) return;
  if (!token) {
    doLogout("Сессия истекла, войдите снова");
    return;
  }
  chat.connect(token);
}

function enterChat() {
  loggedIn = true;
  retries = 0;
  messagesEl.innerHTML = "";
  statusEl.textContent = "Подключение…";
  showChat(true);
  startChat();
}

function doLogout(message = "") {
  loggedIn = false;
  clearTimeout(retryTimer);
  chat.disconnect();
  showChat(false);
  authError.textContent = message;
  passwordEl.value = "";
  void api.logout(); // удаляет refresh-cookie на сервере
}

// ---------- события ----------
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  try {
    await api.login(usernameEl.value.trim(), passwordEl.value);
    enterChat();
  } catch (err) {
    authError.textContent = (err as Error).message;
  }
});

$("register-btn").addEventListener("click", async () => {
  authError.textContent = "";
  if (!authForm.reportValidity()) return;
  try {
    await api.register(usernameEl.value.trim(), passwordEl.value);
    enterChat();
  } catch (err) {
    authError.textContent = (err as Error).message;
  }
});

sendForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = textEl.value.trim();
  if (!text) return;
  chat.send(text);
  textEl.value = "";
});

$("logout-btn").addEventListener("click", () => doLogout());

// Автовход: если refresh-cookie ещё действует, сразу открываем чат
api.refreshAccess().then((ok) => {
  if (ok) enterChat();
});