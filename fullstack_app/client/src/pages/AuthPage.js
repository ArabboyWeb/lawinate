import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LockKey, ShieldCheck, UserPlus } from '@phosphor-icons/react';
import api from '../api';
import { AuthContext } from '../contexts/AuthContext';
import { trackEvent } from '../shared/analytics';

const MAX_PROFILE_IMAGE_SIZE = 4 * 1024 * 1024;

const AuthPage = () => {
  const { login, register, loginWithGoogle } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    university: '',
    course: '',
    city: '',
    bio: '',
    profile_image: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const googleError = searchParams.get('error');

  const resolveErrorMessage = (err, fallback = 'Xatolik yuz berdi') => {
    if (err?.response?.data?.error) return err.response.data.error;
    if (err?.code === 'ERR_NETWORK' || /Network Error/i.test(String(err?.message || ''))) {
      return "Server bilan aloqa yo'q. 5-10 soniyadan keyin qayta urinib ko'ring.";
    }
    return fallback;
  };

  useEffect(() => {
    let active = true;

    api.get('/api/auth/providers')
      .then((res) => {
        if (!active) return;
        setGoogleEnabled(Boolean(res.data?.google?.enabled));
      })
      .catch(() => {
        if (!active) return;
        setGoogleEnabled(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileImageFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Faqat rasm fayl yuklang (jpg/png/webp)');
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setError('Rasm hajmi 4MB dan katta bo`lmasligi kerak');
      return;
    }

    setImageLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setForm((prev) => ({ ...prev, profile_image: dataUrl }));
      setImageLoading(false);
    };
    reader.onerror = () => {
      setError('Rasmni o`qishda xatolik');
      setImageLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        trackEvent('login_success', {
          meta: {
            provider: 'local'
          }
        });
      } else {
        await register(form);
        trackEvent('register_success', {
          meta: {
            provider: 'local'
          }
        });
      }
      navigate('/dashboard');
    } catch (err) {
      setError(resolveErrorMessage(err, 'Xatolik yuz berdi'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    try {
      trackEvent('login_google_click');
      await loginWithGoogle('/dashboard');
    } catch (err) {
      setError(resolveErrorMessage(err, 'Google orqali kirish ishlamadi'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="site-container auth-page-shell">
      <section className="glass-card auth-shell">
        <article className="auth-form-card">
          <div className="auth-form-head">
            <div>
              <p className="auth-kicker">{mode === 'login' ? 'Qaytganingiz yaxshi' : 'Yangi akkaunt'}</p>
              <h2 className="section-title" style={{ fontSize: '1.8rem' }}>
                {mode === 'login' ? 'Akkauntingizga kiring' : "Ro'yxatdan o'ting"}
              </h2>
              <p className="subtle" style={{ marginTop: 10 }}>
                Testlar, reyting va AI yordamchi bir kirish bilan sizga tayyor bo'ladi.
              </p>
            </div>

            <div className="actions auth-mode-switch">
              <button
                type="button"
                className={mode === 'login' ? 'btn btn-primary' : 'btn btn-soft'}
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Kirish
              </button>
              <button
                type="button"
                className={mode === 'register' ? 'btn btn-primary' : 'btn btn-soft'}
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
              >
                Ro'yxatdan o'tish
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-grid auth-form-grid">
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label htmlFor="full_name">To'liq ism</label>
                  <input
                    id="full_name"
                    name="full_name"
                    className="input"
                    value={form.full_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Telefon</label>
                  <input
                    id="phone"
                    name="phone"
                    className="input"
                    value={form.phone}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="university">Universitet</label>
                  <input
                    id="university"
                    name="university"
                    className="input"
                    value={form.university}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="course">Kurs</label>
                  <input
                    id="course"
                    name="course"
                    className="input"
                    value={form.course}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="city">Shahar</label>
                  <input
                    id="city"
                    name="city"
                    className="input"
                    value={form.city}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bio">Qisqa bio</label>
                  <input
                    id="bio"
                    name="bio"
                    className="input"
                    value={form.bio}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group full">
                  <label htmlFor="profile_image">Profil rasmi</label>
                  <input
                    id="profile_image"
                    name="profile_image"
                    className="input"
                    placeholder="URL kiriting yoki pastdan local rasm tanlang"
                    value={form.profile_image}
                    onChange={handleChange}
                    required
                  />
                  <div className="upload-row">
                    <label htmlFor="profile_image_file" className="btn btn-soft btn-file">
                      {imageLoading ? 'Yuklanmoqda...' : 'Local rasm tanlash'}
                    </label>
                    <input
                      id="profile_image_file"
                      type="file"
                      accept="image/*"
                      className="file-input-hidden"
                      onChange={handleProfileImageFile}
                    />
                  </div>
                  {form.profile_image.trim() && (
                    <div className="profile-preview">
                      <img
                        src={form.profile_image}
                        alt="Profil preview"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div className={mode === 'login' ? 'form-group full' : 'form-group'}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className={mode === 'login' ? 'form-group full' : 'form-group'}>
              <label htmlFor="password">Parol</label>
              <input
                id="password"
                name="password"
                type="password"
                className="input"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            {(googleError || error) && <p className="notice error form-group full">{googleError || error}</p>}

            <div className="form-group full">
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading
                  ? 'Yuklanmoqda...'
                  : mode === 'login'
                  ? 'Kirish'
                  : "Ro'yxatdan o'tish"}
              </button>
            </div>

            {googleEnabled && (
              <div className="form-group full auth-secondary">
                <button
                  type="button"
                  className="btn btn-soft auth-submit"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                >
                  {googleLoading ? "Google yo'naltirilmoqda..." : 'Google bilan kirish'}
                </button>
              </div>
            )}
          </form>
        </article>

        <article className="auth-hero">
          <div className="auth-badge">Lawinate</div>
          <h3 className="section-title auth-hero-title">Bitta kirish bilan butun platforma ochiladi</h3>
          <p className="subtle auth-hero-copy">
            Natijalaringizni davom ettiring, reytingni kuzating va kerak paytda AI yordamchidan foydalaning.
          </p>

          <div className="auth-highlight-grid">
            <div className="auth-highlight">
              <span className="auth-highlight-icon auth-highlight-icon-ok">
                <ShieldCheck size={18} weight="fill" />
              </span>
              <div>
                <strong>Natijalar yo'qolmaydi</strong>
                <p>Test tarixi va reytingdagi holatingiz bir joyda saqlanadi.</p>
              </div>
            </div>

            <div className="auth-highlight">
              <span className="auth-highlight-icon auth-highlight-icon-blue">
                <UserPlus size={18} weight="fill" />
              </span>
              <div>
                <strong>Profil doim tayyor</strong>
                <p>Shaxsiy ma'lumotlaringiz va ko'rsatkichlaringiz avtomatik birikadi.</p>
              </div>
            </div>

            <div className="auth-highlight">
              <span className="auth-highlight-icon auth-highlight-icon-warn">
                <LockKey size={18} weight="fill" />
              </span>
              <div>
                <strong>Tez davom etish</strong>
                <p>Kutubxona, testlar va AI yordamchiga ortiqcha qadamlarsiz o'tasiz.</p>
              </div>
            </div>
          </div>

          <div className="auth-topic-list">
            <span>Testlar</span>
            <span>Reyting</span>
            <span>Kutubxona</span>
            <span>AI yordamchi</span>
          </div>
        </article>
      </section>
    </div>
  );
};

export default AuthPage;
