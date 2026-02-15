import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart } from 'chart.js/auto';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';

const DashboardPage = () => {
  const { user } = useContext(AuthContext);
  const [history, setHistory] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [themeVersion, setThemeVersion] = useState(0);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => setThemeVersion((prev) => prev + 1);

    if (media.addEventListener) {
      media.addEventListener('change', handleThemeChange);
      return () => media.removeEventListener('change', handleThemeChange);
    }

    media.addListener(handleThemeChange);
    return () => media.removeListener(handleThemeChange);
  }, []);

  useEffect(() => {
    if (!user) return;

    api
      .get('/api/history')
      .then((res) => setHistory(res.data.history || []))
      .catch(() => setHistory([]));

    api
      .get('/api/blog/my-posts')
      .then((res) => setMyPosts(res.data.posts || []))
      .catch(() => setMyPosts([]));
  }, [user]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    const grouped = {};
    history.forEach((item) => {
      grouped[item.category] = (grouped[item.category] || 0) + item.correct;
    });

    const labels = Object.keys(grouped);
    if (!labels.length) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const getToken = (name, fallback) => rootStyles.getPropertyValue(name).trim() || fallback;
    const palette = {
      barBg: getToken('--panel-active-bg', 'rgba(59, 130, 246, 0.24)'),
      barBorder: getToken('--law-blue', '#2563eb'),
      legend: getToken('--text-main', '#0f172a'),
      ticks: getToken('--text-soft', '#64748b'),
      grid: getToken('--table-border', 'rgba(148, 163, 184, 0.2)'),
    };

    const values = labels.map((label) => grouped[label]);
    const ctx = chartRef.current.getContext('2d');

    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: "To'g'ri javoblar",
            data: values,
            backgroundColor: palette.barBg,
            borderColor: palette.barBorder,
            borderWidth: 1,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: palette.legend },
          },
        },
        scales: {
          x: {
            ticks: { color: palette.ticks },
            grid: { color: palette.grid },
          },
          y: {
            beginAtZero: true,
            ticks: { color: palette.ticks },
            grid: { color: palette.grid },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [history, themeVersion]);

  const recentHistory = useMemo(() => history.slice(0, 8), [history]);

  if (!user) {
    return (
      <div className="site-container page-stack">
        <section className="glass-card card-pad">Dashboard uchun tizimga kirish kerak.</section>
      </div>
    );
  }

  return (
    <div className="site-container page-stack">
      <section className="glass-card card-pad">
        <h1 className="section-title">Shaxsiy kabinet</h1>
        <p className="subtle" style={{ marginTop: 8 }}>
          Profil, progress va test natijalaringiz bir joyda.
        </p>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <h3>Testlar soni</h3>
          <div className="stat-value">{user.total_tests || 0}</div>
        </article>
        <article className="stat-card">
          <h3>To'plangan ball</h3>
          <div className="stat-value">{user.points || 0}</div>
        </article>
        <article className="stat-card">
          <h3>Aniqlik</h3>
          <div className="stat-value">{user.accuracy || 0}%</div>
        </article>
        <article className="stat-card">
          <h3>Streak</h3>
          <div className="stat-value">{user.streak_days || 0} kun</div>
        </article>
      </section>

      <section className="grid cols-2">
        <article className="glass-card card-pad">
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Profil ma'lumotlari</h2>
          <ul className="result-list">
            <li className="result-item"><b>Ism:</b> {user.full_name}</li>
            <li className="result-item"><b>Email:</b> {user.email}</li>
            <li className="result-item"><b>Telefon:</b> {user.phone || '-'}</li>
            <li className="result-item"><b>Universitet:</b> {user.university || '-'}</li>
            <li className="result-item"><b>Kurs:</b> {user.course || '-'}</li>
            <li className="result-item"><b>Shahar:</b> {user.city || '-'}</li>
          </ul>
        </article>

        <article className="glass-card card-pad">
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Qisqa xulosa</h2>
          <ul className="result-list">
            <li className="result-item"><b>To'g'ri javoblar:</b> {user.correct_answers || 0}</li>
            <li className="result-item"><b>Jami savollar:</b> {user.total_questions || 0}</li>
            <li className="result-item"><b>Ro'yxatdan o'tgan sana:</b> {user.registration_date ? new Date(user.registration_date).toLocaleDateString() : '-'}</li>
            <li className="result-item"><b>Bio:</b> {user.bio || '-'}</li>
          </ul>
        </article>
      </section>

      <section className="glass-card card-pad">
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Natijalar grafikasi</h2>
        {history.length === 0 ? (
          <p className="subtle" style={{ marginTop: 12 }}>Hozircha test tarixingiz yo'q.</p>
        ) : (
          <div style={{ height: 320, marginTop: 16 }}>
            <canvas ref={chartRef} />
          </div>
        )}
      </section>

      <section className="glass-card card-pad">
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>So'nggi natijalar</h2>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Kategoriya</th>
                <th>Natija</th>
                <th>Foiz</th>
                <th>Ball</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {recentHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="subtle">Tarix mavjud emas</td>
                </tr>
              ) : (
                recentHistory.map((item, index) => (
                  <tr key={`${item.date}-${index}`}>
                    <td>{item.category}</td>
                    <td>{item.correct}/{item.total}</td>
                    <td>{item.score}%</td>
                    <td>{item.points}</td>
                    <td>{new Date(item.date).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card card-pad">
        <div className="actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Mening blog postlarim</h2>
          <Link to="/blog/create" className="btn btn-primary">Yangi post</Link>
        </div>

        {myPosts.length === 0 ? (
          <p className="subtle" style={{ marginTop: 12 }}>
            Hali post yo&apos;q. Birinchi postingizni yarating.
          </p>
        ) : (
          <div className="blog-dash-list">
            {myPosts.map((post) => (
              <article key={post.id} className="blog-dash-item">
                <div>
                  <h3 style={{ margin: 0 }}>
                    {post.status === 'published' ? (
                      <Link to={post.link}>{post.title}</Link>
                    ) : (
                      post.title
                    )}
                  </h3>
                  <p className="subtle" style={{ margin: '6px 0 0' }}>
                    {post.category} • {post.status} • {new Date(post.updated_at || post.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="actions">
                  {post.status === 'published' ? (
                    <a className="btn btn-soft" href={post.absolute_link} target="_blank" rel="noopener noreferrer">
                      Link
                    </a>
                  ) : (
                    <span className="btn btn-soft" style={{ pointerEvents: 'none' }}>Draft</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
