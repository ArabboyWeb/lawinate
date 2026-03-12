import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, FloppyDiskBack, LinkSimple, UploadSimple } from '@phosphor-icons/react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import api from '../api';
import { AuthContext } from '../contexts/AuthContext';

const BLOG_CATEGORIES = [
  { key: 'jinoyat', title: 'Jinoyat huquqi' },
  { key: 'fuqarolik', title: 'Fuqarolik huquqi' },
  { key: 'konstitutsiya', title: 'Konstitutsiya' },
  { key: 'mehnat', title: 'Mehnat huquqi' },
  { key: 'xalqaro', title: 'Xalqaro huquq' },
  { key: 'talim', title: "Ta'lim" },
];

const COVER_MAX_SIZE = 4 * 1024 * 1024;

marked.setOptions({
  gfm: true,
  breaks: true,
});

const getDraftKey = (userId) => `lawinate_blog_draft_v1_${userId || 'guest'}`;

const toSafeHtml = (markdownText) => DOMPurify.sanitize(marked.parse(markdownText || ''));

const BlogCreatePage = () => {
  const { user } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', tone: 'success' });
  const [status, setStatus] = useState('draft');
  const [savedPostId, setSavedPostId] = useState(null);
  const [savedLink, setSavedLink] = useState('');
  const [form, setForm] = useState({
    title: '',
    category: 'jinoyat',
    tags: '',
    content: '',
    cover_image: '',
  });

  const draftKey = useMemo(() => getDraftKey(user?.id), [user?.id]);

  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      setForm({
        title: String(parsed.title || ''),
        category: String(parsed.category || 'jinoyat'),
        tags: String(parsed.tags || ''),
        content: String(parsed.content || ''),
        cover_image: String(parsed.cover_image || ''),
      });
      setStatus(parsed.status === 'published' ? 'published' : 'draft');
      setSavedPostId(parsed.saved_post_id || null);
      setSavedLink(String(parsed.saved_link || ''));
    } catch (_err) {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        ...form,
        status,
        saved_post_id: savedPostId,
        saved_link: savedLink,
      })
    );
  }, [draftKey, form, status, savedPostId, savedLink]);

  const previewHtml = useMemo(() => toSafeHtml(form.content), [form.content]);

  const onField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const showFeedback = (text, tone = 'success') => {
    setFeedback({ text, tone });
  };

  const clearFeedback = () => {
    setFeedback({ text: '', tone: 'success' });
  };

  const goStep = (nextStep) => {
    if (nextStep === 2 && !form.title.trim()) {
      showFeedback("Step 2 ga o'tish uchun sarlavha kiriting.", 'error');
      return;
    }
    if (nextStep === 3 && !form.content.trim()) {
      showFeedback("Step 3 ga o'tish uchun post matnini kiriting.", 'error');
      return;
    }
    clearFeedback();
    setStep(nextStep);
  };

  const loadDraft = () => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) {
      showFeedback('Draft topilmadi.', 'error');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setForm({
        title: String(parsed.title || ''),
        category: String(parsed.category || 'jinoyat'),
        tags: String(parsed.tags || ''),
        content: String(parsed.content || ''),
        cover_image: String(parsed.cover_image || ''),
      });
      setStatus(parsed.status === 'published' ? 'published' : 'draft');
      setSavedPostId(parsed.saved_post_id || null);
      setSavedLink(String(parsed.saved_link || ''));
      showFeedback('Draft yuklandi.');
    } catch (_err) {
      showFeedback("Draft noto'g'ri formatda.", 'error');
    }
  };

  const clearAll = () => {
    setForm({
      title: '',
      category: 'jinoyat',
      tags: '',
      content: '',
      cover_image: '',
    });
    setStatus('draft');
    setSavedPostId(null);
    setSavedLink('');
    showFeedback('Forma tozalandi.');
    localStorage.removeItem(draftKey);
  };

  const handleCoverFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showFeedback('Faqat rasm fayl yuklang.', 'error');
      return;
    }

    if (file.size > COVER_MAX_SIZE) {
      showFeedback("Cover rasm hajmi 4MB dan katta bo'lmasligi kerak.", 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onField('cover_image', String(reader.result || ''));
    reader.onerror = () => showFeedback("Cover rasmni o'qishda xatolik.", 'error');
    reader.readAsDataURL(file);
  };

  const savePost = async (targetStatus) => {
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title || !content) {
      showFeedback('Sarlavha va matn majburiy.', 'error');
      return;
    }

    setSaving(true);
    clearFeedback();

    try {
      const payload = {
        ...form,
        title,
        content,
        status: targetStatus,
      };

      const res = savedPostId
        ? await api.put(`/api/blog/posts/${savedPostId}`, payload)
        : await api.post('/api/blog/posts', payload);

      const post = res.data?.post;
      setSavedPostId(post?.id || null);
      setSavedLink(String(post?.link || res.data?.link || ''));
      setStatus(targetStatus);

      if (targetStatus === 'published') {
        showFeedback('Post publish qilindi. Link tayyor.');
      } else {
        showFeedback('Draft serverda saqlandi.');
      }
    } catch (err) {
      const backendError = err.response?.data?.error;
      const isNetwork = err?.code === 'ERR_NETWORK' || /Network Error/i.test(String(err?.message || ''));
      if (backendError) {
        showFeedback(backendError, 'error');
      } else if (isNetwork) {
        showFeedback("Server bilan aloqa yo'q. 5-10 soniyadan keyin qayta urinib ko'ring.", 'error');
      } else {
        showFeedback('Postni saqlashda xatolik.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="site-container page-stack blog-create-page">
      <section className="glass-card card-pad blog-create-head">
        <div>
          <h1 className="section-title">Blog post yaratish</h1>
          <p className="subtle" style={{ marginTop: 8 }}>
            Wizard: Meta, Matn, Preview. Draft saqlash va publish qilish tayyor.
          </p>
        </div>
        <div className="actions">
          <Link to="/tests" className="btn btn-soft">
            <ArrowLeft size={16} weight="bold" /> Testlar
          </Link>
          <button type="button" className="btn btn-soft" onClick={loadDraft}>
            Draft yuklash
          </button>
          <button type="button" className="btn btn-soft" onClick={clearAll}>
            Tozalash
          </button>
        </div>
      </section>

      <section className="blog-stepper">
        <button type="button" className={step === 1 ? 'blog-step active' : 'blog-step'} onClick={() => goStep(1)}>
          1. Meta
        </button>
        <button type="button" className={step === 2 ? 'blog-step active' : 'blog-step'} onClick={() => goStep(2)}>
          2. Matn
        </button>
        <button type="button" className={step === 3 ? 'blog-step active' : 'blog-step'} onClick={() => goStep(3)}>
          3. Preview
        </button>
      </section>

      <section className="blog-create-grid">
        <article className="glass-card card-pad">
          {step === 1 && (
            <div className="page-stack">
              <h2 className="blog-block-title">Meta ma&apos;lumot</h2>

              <div className="form-group">
                <label htmlFor="post-title">Sarlavha</label>
                <input
                  id="post-title"
                  className="input"
                  value={form.title}
                  maxLength={120}
                  onChange={(event) => onField('title', event.target.value)}
                  placeholder="Masalan: Shartnoma tushunchasi va turlari"
                />
              </div>

              <div className="form-group">
                <label htmlFor="post-category">Kategoriya</label>
                <select
                  id="post-category"
                  className="select"
                  value={form.category}
                  onChange={(event) => onField('category', event.target.value)}
                >
                  {BLOG_CATEGORIES.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="post-tags">Taglar (vergul bilan)</label>
                <input
                  id="post-tags"
                  className="input"
                  value={form.tags}
                  maxLength={160}
                  onChange={(event) => onField('tags', event.target.value)}
                  placeholder="mulk, shartnoma, protsess"
                />
              </div>

              <div className="form-group">
                <label htmlFor="post-cover-file">Cover rasm</label>
                <div className="upload-row">
                  <label htmlFor="post-cover-file" className="btn btn-soft btn-file">
                    <UploadSimple size={16} weight="bold" /> Local rasm tanlash
                  </label>
                  <input
                    id="post-cover-file"
                    type="file"
                    accept="image/*"
                    className="file-input-hidden"
                    onChange={handleCoverFile}
                  />
                  {form.cover_image && (
                    <button type="button" className="btn btn-soft btn-file" onClick={() => onField('cover_image', '')}>
                      Rasmni olib tashlash
                    </button>
                  )}
                </div>
                {form.cover_image && (
                  <img src={form.cover_image} alt="Cover preview" className="blog-cover-preview" />
                )}
              </div>

              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={() => goStep(2)}>
                  Keyingi
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="page-stack">
              <h2 className="blog-block-title">Post matni</h2>
              <p className="subtle">Markdown ishlatishingiz mumkin.</p>
              <div className="form-group">
                <textarea
                  className="textarea blog-content-area"
                  value={form.content}
                  onChange={(event) => onField('content', event.target.value)}
                  placeholder={"### Kirish\nBu postda..."}
                />
              </div>
              <div className="actions">
                <button type="button" className="btn btn-soft" onClick={() => goStep(1)}>
                  Orqaga
                </button>
                <button type="button" className="btn btn-primary" onClick={() => goStep(3)}>
                  Keyingi
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="page-stack">
              <h2 className="blog-block-title">Preview va yuborish</h2>
              <p className="subtle">Draft yoki Publish holatida serverga saqlashingiz mumkin.</p>

              <div className="actions">
                <button type="button" className="btn btn-soft" disabled={saving} onClick={() => savePost('draft')}>
                  <FloppyDiskBack size={16} weight="bold" /> Draft
                </button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => savePost('published')}>
                  <CheckCircle size={16} weight="bold" /> Publish
                </button>
              </div>

              {status === 'published' && savedLink && (
                <div className="blog-link-box">
                  <p className="subtle" style={{ margin: 0 }}>Post sahifasi:</p>
                  <Link to={savedLink} className="blog-link-anchor">
                    <LinkSimple size={14} weight="bold" /> {savedLink}
                  </Link>
                </div>
              )}

              <div className="actions">
                <button type="button" className="btn btn-soft" onClick={() => goStep(2)}>
                  Orqaga
                </button>
              </div>
            </div>
          )}

          {feedback.text && <p className={feedback.tone === 'error' ? 'notice error' : 'notice success'}>{feedback.text}</p>}
        </article>

        <article className="glass-card card-pad blog-preview-card">
          <div className="blog-preview-meta">
            <span className="blog-chip">{BLOG_CATEGORIES.find((item) => item.key === form.category)?.title || 'Kategoriya'}</span>
            <span className="blog-chip">{status}</span>
            <span className="blog-chip">{(form.tags || '').trim() || 'tag yo‘q'}</span>
          </div>

          {form.cover_image && (
            <img src={form.cover_image} alt="Post cover preview" className="blog-preview-cover" />
          )}

          <h2 className="blog-preview-title">{form.title.trim() || 'Sarlavha'}</h2>
          <p className="subtle" style={{ margin: 0 }}>
            Muallif: {user?.full_name || 'Foydalanuvchi'}
          </p>

          <div className="markdown-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </article>
      </section>
    </main>
  );
};

export default BlogCreatePage;
