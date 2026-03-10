import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LockKey, ShieldCheck, UserPlus } from '@phosphor-icons/react';
import api from '../api';
import { AuthContext } from '../contexts/AuthContext';

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
  const [googleEnabled, setGoogleEnabled] = useState(true);
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
        // Keep the fallback button visible when provider status cannot be loaded.
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
      } else {
        await register(form);
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
      await loginWithGoogle('/dashboard');
    } catch (err) {
      setError(resolveErrorMessage(err, 'Google login failed'));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="site-container page-stack">
      <section className="glass-card card-pad">
        <div className="grid cols-2">
          <article className="feature-card">
            <h2 className="section-title" style={{ fontSize: '1.8rem' }}>
              {mode === 'login' ? 'Xush kelibsiz' : "Platformaga qo'shiling"}
            </h2>
            <p className="subtle" style={{ marginTop: 10 }}>
              Test natijalaringizni saqlang, reytingda ishtirok eting va AI yordamchini ishlating.
            </p>

            <div className="page-stack" style={{ marginTop: 18 }}>
              <div className="result-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={20} weight="fill" style={{ color: 'var(--ok)' }} />
                Himoyalangan JWT asosidagi kirish
              </div>
              <div className="result-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserPlus size={20} weight="fill" style={{ color: 'var(--law-blue)' }} />
                Profil va statistika avtomatik shakllanadi
              </div>
              <div className="result-item" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LockKey size={20} weight="fill" style={{ color: 'var(--warning)' }} />
                Ma'lumotlar serverda xavfsiz saqlanadi
              </div>
            </div>
          </article>

          <article className="feature-card">
            <div className="actions" style={{ marginBottom: 14 }}>
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

            <form onSubmit={handleSubmit} className="form-grid">
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
                    <label htmlFor="bio">Bio</label>
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
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading
                    ? 'Yuklanmoqda...'
                    : mode === 'login'
                    ? 'Kirish'
                    : "Ro'yxatdan o'tish"}
                </button>
              </div>

              {googleEnabled ? (
                <div className="form-group full" style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    style={{ width: '100%' }}
                  >
                    {googleLoading ? 'Google yo\'naltirilmoqda...' : 'Google bilan kirish'}
                  </button>
                </div>
              ) : (
                <p className="notice form-group full" style={{ marginTop: 6 }}>
                  Google auth hozircha sozlanmagan.
                </p>
              )}
            </form>
          </article>
        </div>
      </section>
    </div>
  );
};

export default AuthPage;
