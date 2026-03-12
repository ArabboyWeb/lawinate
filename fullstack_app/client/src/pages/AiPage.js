import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUp,
  Broom,
  Robot,
  Scales,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';
import { trackEvent } from '../shared/analytics';

const STORAGE_KEY = 'lawinate_ultra_v1';
const GLM_MODEL_ID = 'z-ai/glm-4.5-air:free';
const GLM_MODEL_NAME = 'GLM 4.5 Air';
const QUICK_ASKS = [
  { tag: 'JINOYAT HUQUQI', text: "Og'irlashtiruvchi holatlar nima?" },
  { tag: 'OILAVIY NIZOLAR', text: 'Aliment undirish tartibi qanday?' },
  { tag: 'BIZNES VA SOLIQ', text: 'YTT ochish uchun nima kerak?' },
  { tag: 'MEHNAT HUQUQI', text: "Ta'til puli qanday hisoblanadi?" },
];

const parseSavedMessages = (rawValue) => {
  try {
    const parsed = JSON.parse(rawValue || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
      .map((item) => ({
        role: item.role,
        text: String(item.text || item.content || ''),
        model_name: item.model_name || '',
      }))
      .filter((item) => item.text.trim().length > 0);
  } catch (_err) {
    return [];
  }
};

const AiPage = () => {
  const { user } = useContext(AuthContext);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    const restored = parseSavedMessages(saved);
    if (restored.length > 0) {
      setMessages(restored);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    const nextHeight = Math.min(inputRef.current.scrollHeight, 200);
    inputRef.current.style.height = `${nextHeight}px`;
  }, [prompt]);

  const sendPrompt = async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: 'user', text }];
    setMessages(nextMessages);
    setPrompt('');
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/api/ai', {
        prompt: text,
        model: GLM_MODEL_ID,
        messages: nextMessages,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.data.response || 'Javob topilmadi',
          model_name: res.data.model_name || GLM_MODEL_NAME,
        },
      ]);
      trackEvent('ai_prompt', {
        meta: {
          model: res.data?.model || GLM_MODEL_ID,
          model_name: res.data?.model_name || GLM_MODEL_NAME,
          tokens_used: res.data?.tokens_used || 0
        }
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
      if (wrapperRef.current) {
        wrapperRef.current.scrollTop = wrapperRef.current.scrollHeight;
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendPrompt(prompt);
  };

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setPrompt('');
    setError('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  if (!user) {
    return (
      <div className="site-container page-stack">
        <section className="glass-card card-pad">
          <h1 className="section-title">AI Assistant</h1>
          <p className="subtle" style={{ marginTop: 8 }}>
            AI yordamchisidan foydalanish uchun tizimga kiring.
          </p>
          <div className="actions" style={{ marginTop: 14 }}>
            <Link to="/auth" className="btn btn-primary">Kirish</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="ai-ultra-root">
      <header className="ai-ultra-topbar">
        <div className="ai-ultra-brand-wrap">
          <Link to="/" className="ai-ultra-brand">
            <Scales size={18} weight="fill" />
            <span>Lawinate</span>
          </Link>
          <span className="ai-ultra-divider" />
          <span className="ai-ultra-title">AI Assistant</span>
        </div>

        <div className="ai-ultra-top-actions">
          <button
            type="button"
            onClick={clearHistory}
            className="ai-ultra-clear-btn"
            disabled={messages.length === 0 || loading}
          >
            <Broom size={16} />
            <span>Tozalash</span>
          </button>
          <Link to="/" className="ai-ultra-close-btn" aria-label="Yopish">
            <X size={14} weight="bold" />
          </Link>
        </div>
      </header>

      <main ref={wrapperRef} className="ai-ultra-chat-wrapper">
        {messages.length === 0 && (
          <section className="ai-ultra-welcome-state">
            <div className="ai-ultra-welcome-icon">
              <Sparkle size={26} weight="fill" />
            </div>
            <h1>Yuridik maslahatchi</h1>
            <p>
              Men O&apos;zbekiston qonunchiligi asosida o&apos;qitilganman.
              Murakkab savollarni oddiy tilda tushuntiraman.
            </p>

            <div className="ai-ultra-quick-grid">
              {QUICK_ASKS.map((item) => (
                <button
                  key={item.text}
                  type="button"
                  onClick={() => sendPrompt(item.text)}
                  className="ai-ultra-quick-card"
                  disabled={loading}
                >
                  <span className="ai-ultra-quick-tag">{item.tag}</span>
                  <span className="ai-ultra-quick-text">{item.text}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className={messages.length > 0 ? 'ai-ultra-message-list' : 'ai-ultra-message-list hidden'}>
          {messages.map((message, index) => {
            if (message.role === 'user') {
              return (
                <article key={`user-${index}`} className="ai-ultra-user-row">
                  <div className="ai-ultra-user-bubble">{message.text}</div>
                </article>
              );
            }

            return (
              <article key={`assistant-${index}`} className="ai-ultra-assistant-row">
                <div className="ai-ultra-ai-icon">
                  <Robot size={12} weight="bold" />
                </div>
                <div className="ai-ultra-assistant-bubble">
                  <div className="ai-ultra-assistant-head">{message.model_name || GLM_MODEL_NAME}</div>
                  <p>{message.text}</p>
                </div>
              </article>
            );
          })}
        </section>

        {loading && (
          <div className="ai-ultra-loading-row">
            <div className="ai-ultra-ai-icon">
              <Robot size={12} weight="bold" />
            </div>
            <div className="ai-ultra-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </main>

      <footer className="ai-ultra-footer">
        <form className="ai-ultra-input-shell" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            id="user-input"
            className="ai-ultra-input"
            rows={1}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            placeholder="Savolingizni bu yerga yozing..."
          />

          <button
            type="submit"
            className="ai-ultra-send-btn"
            disabled={!prompt.trim() || loading}
            aria-label="Yuborish"
          >
            <ArrowUp size={16} weight="bold" />
          </button>
        </form>

        {error && <p className="notice error ai-ultra-error">{error}</p>}
        <p className="ai-ultra-disclaimer">
          AI xato qilishi mumkin. Muhim qarorlar uchun yurist bilan maslahatlashing.
        </p>
      </footer>
    </div>
  );
};

export default AiPage;
