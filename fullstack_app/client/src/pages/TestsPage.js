import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowsClockwise,
  Exam,
  GraduationCap,
  Gavel,
  ListChecks,
  NotePencil,
  Shuffle,
} from '@phosphor-icons/react';
import { AuthContext } from '../contexts/AuthContext';
import api from '../api';

const CATEGORIES = [
  { key: 'konstitutsiya', title: 'Konstitutsiya testlari', icon: ListChecks },
  { key: 'jinoyat', title: 'Jinoyat huquqi testlari', icon: Gavel },
  { key: 'fuqarolik', title: 'Fuqarolik huquqi testlari', icon: Exam },
  { key: 'dtm', title: 'DTM testlari', icon: GraduationCap },
  { key: 'mehnat', title: 'Mehnat huquqi testlari', icon: ListChecks },
  { key: 'mixed', title: 'Aralash testlar', icon: Shuffle },
];

const TestsPage = () => {
  const { category } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [emptyState, setEmptyState] = useState(false);

  useEffect(() => {
    if (!category) return;

    setLoading(true);
    setError('');
    setEmptyState(false);
    setResult(null);

    api
      .get(`/api/tests/${category}`)
      .then((res) => {
        const incoming = res.data.questions || [];
        setQuestions(incoming);
        setAnswers(new Array(incoming.length).fill(null));
        setEmptyState(incoming.length === 0);
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Savollarni olishda xatolik');
      })
      .finally(() => setLoading(false));
  }, [category]);

  const categoryInfo = useMemo(
    () => CATEGORIES.find((item) => item.key === category),
    [category]
  );

  const handleSelect = (questionIndex, optionIndex) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (questions.length === 0) {
      setError("Bu kategoriyada hozircha savollar mavjud emas.");
      return;
    }

    if (answers.some((answer) => answer === null)) {
      setError("Iltimos, barcha savollarga javob bering.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post(`/api/tests/${category}/submit`, {
        answers,
        question_ids: questions.map((q) => q.id).filter(Boolean),
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Natijani yuborishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  if (!category) {
    return (
      <div className="site-container page-stack">
        <section className="glass-card card-pad">
          <h1 className="section-title">Test kategoriyalarini tanlang</h1>
          <p className="subtle" style={{ marginTop: 8 }}>
            Har bir bo'lim bo'yicha savollar to'plami mavjud. Aralash test ham mavjud.
          </p>
        </section>

        <section className="category-grid">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link to={`/tests/${cat.key}`} key={cat.key} className="category-item">
                <div className="icon-badge blue" style={{ marginBottom: 10 }}>
                  <Icon size={22} weight="fill" />
                </div>
                <h3 style={{ margin: 0 }}>{cat.title}</h3>
                <p className="subtle" style={{ marginTop: 8 }}>
                  {cat.key === 'mixed'
                    ? "Turli bo'limlardan random savollar"
                    : `${cat.title.split(' ')[0]} bo'limi bo'yicha testlar`}
                </p>
              </Link>
            );
          })}
        </section>

        <section className="glass-card card-pad">
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Blog platforma</h2>
          <p className="subtle" style={{ marginTop: 8 }}>
            Testdan tashqari yuridik postlar yozing yoki boshqa foydalanuvchilar maqolalarini o&apos;qing.
          </p>
          <div className="actions" style={{ marginTop: 14 }}>
            <Link to="/blog" className="btn btn-soft">Postlarni o&apos;qish</Link>
            {user ? (
              <Link to="/blog/create" className="btn btn-primary">
                <NotePencil size={16} weight="bold" /> Post yaratish
              </Link>
            ) : (
              <Link to="/auth" className="btn btn-primary">Post yozish uchun kirish</Link>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="site-container page-stack">
        <section className="glass-card card-pad">
          <h1 className="section-title">Kirish talab etiladi</h1>
          <p className="subtle" style={{ marginTop: 8 }}>
            Test ishlash va natijani saqlash uchun tizimga kiring.
          </p>
          <div className="actions" style={{ marginTop: 14 }}>
            <Link to="/auth" className="btn btn-primary">Kirish</Link>
          </div>
        </section>
      </div>
    );
  }

  if (loading && !result) {
    return (
      <div className="site-container page-stack">
        <section className="glass-card card-pad">Savollar yuklanmoqda...</section>
      </div>
    );
  }

  if (result) {
    return (
      <div className="site-container page-stack">
        <section className="glass-card card-pad">
          <h1 className="section-title">Natijangiz</h1>
          <ul className="result-list">
            <li className="result-item"><b>To'g'ri javoblar:</b> {result.correct} / {result.total}</li>
            <li className="result-item"><b>Foiz:</b> {result.score}%</li>
            <li className="result-item"><b>Olingan ball:</b> {result.points_earned}</li>
            <li className="result-item"><b>Streak:</b> {result.streak_days} kun</li>
          </ul>

          {Array.isArray(result.mistakes) && result.mistakes.length > 0 && (
            <div className="mistake-wrap">
              <h2 style={{ margin: '16px 0 8px', fontSize: '1.15rem' }}>Xatolar tahlili</h2>
              <div className="mistake-list">
                {result.mistakes.map((mistake, index) => (
                  <article key={`${mistake.question_id}-${index}`} className="mistake-card">
                    <p className="mistake-question">
                      {index + 1}. {mistake.question}
                    </p>
                    <p className="mistake-answer wrong">
                      <b>Sizning javobingiz:</b>{' '}
                      {mistake.selected_option
                        ? `${mistake.selected_option}) ${mistake.selected_answer || '-'}`
                        : 'Javob belgilanmagan'}
                    </p>
                    <p className="mistake-answer correct">
                      <b>To'g'ri javob:</b> {mistake.correct_option}) {mistake.correct_answer}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
            <button type="button" className="btn btn-soft" onClick={() => navigate('/tests')}>
              <ArrowsClockwise size={16} weight="bold" /> Boshqa test
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="site-container page-stack">
      <section className="glass-card card-pad">
        <h1 className="section-title">{categoryInfo?.title || 'Test'}</h1>
        <p className="subtle" style={{ marginTop: 8 }}>
          Savollar soni: {questions.length}
        </p>
        <div className="actions" style={{ marginTop: 12 }}>
          <Link to="/blog" className="btn btn-soft">Blog postlarni ko&apos;rish</Link>
          <Link to="/blog/create" className="btn btn-primary">
            <NotePencil size={16} weight="bold" /> Post yozish
          </Link>
        </div>
        {error && <p className="notice error" style={{ marginTop: 10 }}>{error}</p>}
      </section>

      <section className="page-stack">
        {questions.map((q, qIndex) => (
          <article key={q.id || qIndex} className="quiz-card">
            <p style={{ margin: 0, fontWeight: 700 }}>
              {qIndex + 1}. {q.q}
            </p>
            <div style={{ marginTop: 10 }}>
              {q.a.map((option, optionIndex) => (
                <label key={`${qIndex}-${optionIndex}`} className="quiz-option">
                  <input
                    type="radio"
                    name={`q${qIndex}`}
                    value={optionIndex}
                    checked={answers[qIndex] === optionIndex}
                    onChange={() => handleSelect(qIndex, optionIndex)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </article>
        ))}
      </section>

      {emptyState && (
        <section className="glass-card card-pad">
          Bu bo'limda hozircha e'lon qilingan savollar yo'q.
        </section>
      )}

      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading || questions.length === 0}>
          {loading ? 'Yuborilmoqda...' : 'Yakunlash'}
        </button>
      </div>
    </div>
  );
};

export default TestsPage;
