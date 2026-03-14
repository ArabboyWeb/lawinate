import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const PUBLIC_URL = process.env.PUBLIC_URL || '';

const GAME_ITEMS = [
  {
    id: 'mental-math',
    title: 'Aqlni Sinash',
    status: 'live',
    statusLabel: 'Live',
    subtitle: 'Tez hisoblash va diqqat uchun mini challenge',
    description:
      "Vaqtga qarshi ishlang, ketma-ket to'g'ri javoblar bilan combo yig'ing va shaxsiy rekordni yangilang.",
    src: `${PUBLIC_URL}/games/mental-math.html`,
    tips: [
      "Oson, o'rta va qiyin rejimlar bor.",
      "To'g'ri javoblar streak va bonus ball beradi.",
      "Yordam va o'tkazib yuborish funksiyalari ham bor.",
    ],
    benefits: [
      'Diqqatni tez jamlashga yordam beradi.',
      'Mental math tezligini oshiradi.',
      "Testlar orasida qisqa, foydali tanaffus beradi.",
    ],
  },
  {
    id: 'game-2',
    title: "Keyingi o'yin",
    status: 'soon',
    statusLabel: 'Kutilmoqda',
    subtitle: "Ikkinchi o'yin kodi hali tayyor emas",
    description:
      "Siz yuborgan game2 fayli hozir bo'sh. Kod kelishi bilan shu joyga xavfsiz integratsiya qilinadi.",
    tips: [
      "Hozircha bu karta placeholder sifatida turadi.",
      "Tayyor bo'lganda alohida preview va integratsiya qilinadi.",
      "Asosiy Game Zone strukturasi keyingi o'yinlar uchun tayyorlandi.",
    ],
    benefits: [
      "Yangi o'yinlar qo'shish uchun alohida nav link kerak bo'lmaydi.",
      "Har bir o'yin izolyatsiya qilingan holda yuklanadi.",
      'Responsive sahifa keyingi kengayishlarga tayyor.',
    ],
  },
];

const GameZonePage = () => {
  const [activeGameId, setActiveGameId] = useState('mental-math');
  const [frameLoading, setFrameLoading] = useState(true);
  const [frameError, setFrameError] = useState('');
  const frameTimeoutRef = useRef(null);

  const activeGame = useMemo(
    () => GAME_ITEMS.find((item) => item.id === activeGameId) || GAME_ITEMS[0],
    [activeGameId]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    if (frameTimeoutRef.current) {
      window.clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }

    if (activeGame.status !== 'live') {
      setFrameLoading(false);
      setFrameError('');
      return undefined;
    }

    setFrameLoading(true);
    setFrameError('');

    frameTimeoutRef.current = window.setTimeout(() => {
      setFrameLoading(false);
      setFrameError("O'yin oynasini yuklash cho'zildi. Sahifani yangilab qayta urinib ko'ring.");
    }, 8000);

    return () => {
      if (frameTimeoutRef.current) {
        window.clearTimeout(frameTimeoutRef.current);
        frameTimeoutRef.current = null;
      }
    };
  }, [activeGame]);

  const handleFrameLoad = () => {
    if (frameTimeoutRef.current) {
      window.clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }
    setFrameLoading(false);
    setFrameError('');
  };

  return (
    <div className="site-container page-stack game-zone-page">
      <section className="glass-card card-pad game-zone-hero">
        <div className="game-zone-hero-copy">
          <p className="game-zone-kicker">Game Zone</p>
          <h1 className="section-title">Lawinate uchun mini o&apos;yinlar maydoni</h1>
          <p className="subtle">
            Live reytingdan chiqmasdan, diqqat va tezlikni charxlaydigan mini o&apos;yinlar shu yerda
            jamlanadi. Hozircha birinchi o&apos;yin tayyor, keyingilari bosqichma-bosqich qo&apos;shiladi.
          </p>
          <div className="actions">
            <Link to="/ranking" className="btn btn-soft">
              Reytingga qaytish
            </Link>
            <Link to="/tests" className="btn btn-primary">
              Testlarga o&apos;tish
            </Link>
          </div>
        </div>

        <div className="game-zone-stats">
          <article className="stat-card">
            <h3>Live O&apos;yinlar</h3>
            <div className="stat-value">{GAME_ITEMS.filter((item) => item.status === 'live').length}</div>
          </article>
          <article className="stat-card">
            <h3>Keyingilari</h3>
            <div className="stat-value">{GAME_ITEMS.filter((item) => item.status !== 'live').length}</div>
          </article>
          <article className="stat-card">
            <h3>Responsive</h3>
            <div className="stat-value">Ha</div>
          </article>
        </div>
      </section>

      <section className="game-zone-catalog">
        {GAME_ITEMS.map((game) => (
          <button
            key={game.id}
            type="button"
            className={game.id === activeGame.id ? 'game-zone-card active' : 'game-zone-card'}
            onClick={() => setActiveGameId(game.id)}
            aria-pressed={game.id === activeGame.id}
          >
            <div className="game-zone-card-top">
              <span className={`game-zone-badge ${game.status === 'live' ? 'live' : 'soon'}`}>
                {game.statusLabel}
              </span>
              <span className="game-zone-card-title">{game.title}</span>
            </div>
            <p className="game-zone-card-subtitle">{game.subtitle}</p>
            <p className="game-zone-card-description">{game.description}</p>
          </button>
        ))}
      </section>

      <section className="game-zone-stage">
        <article className="glass-card card-pad game-zone-player">
          <div className="game-zone-player-head">
            <div>
              <p className="game-zone-kicker">{activeGame.statusLabel}</p>
              <h2 className="section-title" style={{ fontSize: '1.8rem' }}>{activeGame.title}</h2>
              <p className="subtle">{activeGame.subtitle}</p>
            </div>
          </div>

          {activeGame.status === 'live' ? (
            <div className="game-zone-frame-shell">
              {frameLoading && (
                <div className="game-zone-frame-state">
                  <p>O&apos;yin yuklanmoqda...</p>
                </div>
              )}
              {frameError && (
                <div className="game-zone-frame-state error">
                  <p>{frameError}</p>
                </div>
              )}
              <iframe
                title={activeGame.title}
                src={activeGame.src}
                className="game-zone-frame"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms"
                onLoad={handleFrameLoad}
              />
            </div>
          ) : (
            <div className="game-zone-placeholder">
              <h3>Bu o&apos;yin hali tayyor emas</h3>
              <p className="subtle">
                Ikkinchi o&apos;yin fayli hozir bo&apos;sh bo&apos;lgani uchun sahifaga chiqarilmadi. Kod tayyor bo&apos;lsa,
                shu kartani to&apos;liq o&apos;yinga aylantiramiz.
              </p>
            </div>
          )}
        </article>

        <aside className="page-stack game-zone-side">
          <section className="glass-card card-pad">
            <h3 style={{ marginTop: 0 }}>Qanday ishlaydi</h3>
            <ul className="result-list">
              {activeGame.tips.map((tip) => (
                <li key={tip} className="result-item">{tip}</li>
              ))}
            </ul>
          </section>

          <section className="glass-card card-pad">
            <h3 style={{ marginTop: 0 }}>Nima uchun foydali</h3>
            <ul className="result-list">
              {activeGame.benefits.map((benefit) => (
                <li key={benefit} className="result-item">{benefit}</li>
              ))}
            </ul>
          </section>
        </aside>
      </section>
    </div>
  );
};

export default GameZonePage;
