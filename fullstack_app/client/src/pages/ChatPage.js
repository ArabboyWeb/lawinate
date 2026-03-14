import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChatCircleDots, Microphone, PaperPlaneTilt, Plus, SpeakerHigh, Stop } from '@phosphor-icons/react';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';

const ChatPage = () => {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [text, setText] = useState('');
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recordSecondsRef = useRef(0);
  const endRef = useRef(null);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const fetchGroups = async () => {
    setLoadingGroups(true);
    setError('');
    try {
      const res = await api.get('/api/chat/groups');
      const incoming = res.data.groups || [];
      setGroups(incoming);
      if (!selectedGroupId && incoming.length > 0) {
        setSelectedGroupId(incoming[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Chat guruhlarini yuklashda xatolik');
    } finally {
      setLoadingGroups(false);
    }
  };

  const fetchMessages = async (groupId) => {
    if (!groupId) return;
    setLoadingMessages(true);
    setError('');
    try {
      await api.post(`/api/chat/groups/${groupId}/join`);
      const res = await api.get(`/api/chat/groups/${groupId}/messages`);
      setMessages(res.data.messages || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Xabarlarni yuklashda xatolik');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchGroups();
  }, [user]);

  useEffect(() => {
    if (!selectedGroupId) return;
    fetchMessages(selectedGroupId);
  }, [selectedGroupId]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const createGroup = async (event) => {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    setCreating(true);
    setError('');
    try {
      const res = await api.post('/api/chat/groups', { name });
      const group = res.data.group;
      setGroups((prev) => [group, ...prev]);
      setSelectedGroupId(group.id);
      setNewGroupName('');
    } catch (err) {
      setError(err.response?.data?.error || 'Guruh yaratilmadi');
    } finally {
      setCreating(false);
    }
  };

  const sendTextMessage = async () => {
    const body = text.trim();
    if (!body || !selectedGroupId) return;

    setSending(true);
    setError('');
    try {
      const res = await api.post(`/api/chat/groups/${selectedGroupId}/messages`, { message: body });
      setMessages((prev) => [...prev, res.data.message]);
      setText('');
    } catch (err) {
      setError(err.response?.data?.error || 'Xabar yuborilmadi');
    } finally {
      setSending(false);
    }
  };

  const uploadVoiceMessage = async (audioBlob, mimeType, durationSec) => {
    if (!selectedGroupId) return;
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result || '');
        resolve(dataUrl.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    setSending(true);
    setError('');
    try {
      const res = await api.post(`/api/chat/groups/${selectedGroupId}/messages`, {
        voice_blob_base64: base64,
        voice_mime_type: mimeType,
        voice_duration_sec: durationSec
      });
      setMessages((prev) => [...prev, res.data.message]);
    } catch (err) {
      setError(err.response?.data?.error || 'Voice xabar yuborilmadi');
    } finally {
      setSending(false);
    }
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Brauzer ovoz yozishni qo‘llab-quvvatlamaydi');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      setRecordSeconds(0);
      recordSecondsRef.current = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setRecording(false);

        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await uploadVoiceMessage(blob, mimeType, recordSecondsRef.current);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setRecording(true);
      timerRef.current = setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);
      }, 1000);
    } catch (_err) {
      setError('Mikrofonga ruxsat berilmadi');
    }
  };

  const stopVoiceRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
  };

  if (!user) {
    return (
      <div className="site-container page-stack">
        <section className="glass-card card-pad">
          <h1 className="section-title">Global Chat</h1>
          <p className="subtle" style={{ marginTop: 8 }}>
            Chatdan foydalanish uchun tizimga kiring.
          </p>
          <div className="actions" style={{ marginTop: 14 }}>
            <Link to="/auth" className="btn btn-primary">Kirish</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="site-container">
      <section className="chat-clean">
        <header className="chat-clean-header">
          <div>
            <h1>Global Chat</h1>
            <p>Guruhlar bilan tez muloqot qiling</p>
          </div>
        </header>

        <div className="chat-clean-topbar">
          <select
            className="select"
            value={selectedGroupId || ''}
            onChange={(event) => setSelectedGroupId(Number(event.target.value))}
            disabled={loadingGroups || groups.length === 0}
          >
            {groups.length === 0 ? (
              <option value="">Guruh yo‘q</option>
            ) : (
              groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.member_count})
                </option>
              ))
            )}
          </select>

          <form className="chat-clean-create" onSubmit={createGroup}>
            <input
              className="input"
              placeholder="Yangi guruh nomi"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
            />
            <button type="submit" className="btn btn-soft" disabled={creating}>
              <Plus size={16} weight="bold" />
            </button>
          </form>
        </div>

        <div className="chat-clean-messages">
          {loadingMessages ? (
            <p className="subtle">Xabarlar yuklanmoqda...</p>
          ) : messages.length === 0 ? (
            <div className="chat-clean-empty">
              <ChatCircleDots size={16} weight="fill" /> Birinchi xabarni yuboring.
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.user_id === user.id;
              return (
                <div key={message.id} className={isMe ? 'chat-clean-bubble me' : 'chat-clean-bubble'}>
                  <div className="chat-clean-bubble-head">
                    <span>{isMe ? 'Siz' : message.sender_name || 'User'}</span>
                    <small>{new Date(message.created_at).toLocaleTimeString()}</small>
                  </div>
                  {message.message_type === 'voice' && message.voice_url ? (
                    <div className="chat-clean-voice">
                      <SpeakerHigh size={16} weight="fill" />
                      <audio controls src={message.voice_url} />
                    </div>
                  ) : (
                    <p>{message.message}</p>
                  )}
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="chat-clean-composer">
          <input
            className="input"
            placeholder="Xabar yozing..."
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendTextMessage();
              }
            }}
            disabled={!selectedGroup || sending}
          />

          {recording ? (
            <button type="button" className="btn btn-danger" onClick={stopVoiceRecording} disabled={sending}>
              <Stop size={16} weight="bold" /> {recordSeconds}s
            </button>
          ) : (
            <button type="button" className="btn btn-soft" onClick={startVoiceRecording} disabled={!selectedGroup || sending}>
              <Microphone size={16} weight="bold" />
            </button>
          )}

          <button type="button" className="btn btn-primary" onClick={sendTextMessage} disabled={!selectedGroup || sending}>
            <PaperPlaneTilt size={16} weight="bold" /> Yuborish
          </button>
        </div>

        {error && <p className="notice error">{error}</p>}
      </section>
    </div>
  );
};

export default ChatPage;
