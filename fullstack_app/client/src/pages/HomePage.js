import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Books,
  DownloadSimple,
  Sparkle,
  Student,
  Trophy,
} from '@phosphor-icons/react';

const HomePage = () => {
  return (
    <div className="site-container page-stack">
      <section className="glass-card hero">
        <div className="hero-glow" />

        <div className="hero-chip">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--ok)',
              display: 'inline-block',
            }}
          />
          Yangi: AI Yordamchi ishga tushdi
        </div>

        <h1>
          Huquqiy bilimlaringizni
          <br />
          <span className="text-gradient">yangi darajaga olib chiqing</span>
        </h1>

        <p>
          Abituriyentlar va talabalar uchun digital ta'lim platformasi.
          Reytingda bellashing, kutubxonadan foydalaning va professional yurist
          bo'lish yo'lini tezlashtiring.
        </p>

        <div className="actions center" style={{ marginTop: 20 }}>
          <Link to="/tests" className="btn btn-primary">
            Boshlash <ArrowRight size={16} weight="bold" />
          </Link>
          <button type="button" className="btn btn-soft">
            <DownloadSimple size={16} weight="bold" /> Ilovani yuklash
          </button>
        </div>
      </section>

      <section className="page-stack">
        <div style={{ textAlign: 'center' }}>
          <h2 className="section-title">Siz uchun imkoniyatlar</h2>
          <p className="subtle" style={{ marginTop: 8 }}>
            Lawinate shunchaki sayt emas, bu to'liq ekotizim.
          </p>
        </div>

        <div className="grid cols-4">
          <Link to="/ranking" className="feature-card">
            <div className="icon-badge blue">
              <Trophy size={24} weight="fill" />
            </div>
            <h3 style={{ margin: 0 }}>Live Reyting</h3>
            <p className="subtle" style={{ marginTop: 8 }}>
              Ball to'plang va O'zbekiston bo'yicha TOP foydalanuvchilar qatoriga kiring.
            </p>
          </Link>

          <Link to="/library" className="feature-card">
            <div className="icon-badge purple">
              <Books size={24} weight="fill" />
            </div>
            <h3 style={{ margin: 0 }}>Smart Kutubxona</h3>
            <p className="subtle" style={{ marginTop: 8 }}>
              Huquqiy adabiyotlar, kodekslar va o'quv manbalarini tez toping.
            </p>
          </Link>

          <Link to="/tests" className="feature-card">
            <div className="icon-badge green">
              <Student size={24} weight="fill" />
            </div>
            <h3 style={{ margin: 0 }}>Test Platformasi</h3>
            <p className="subtle" style={{ marginTop: 8 }}>
              Konstitutsiya, jinoyat, mehnat va boshqa toifalarda bilimni tekshiring.
            </p>
          </Link>

          <Link to="/ai" className="feature-card">
            <div className="icon-badge cyan">
              <Sparkle size={24} weight="fill" />
            </div>
            <h3 style={{ margin: 0 }}>AI Advokat</h3>
            <p className="subtle" style={{ marginTop: 8 }}>
              AI orqali huquqiy savollarga tezkor javoblar oling.
            </p>
          </Link>
        </div>
      </section>

      <section className="glass-card card-pad">
        <div className="grid cols-3" style={{ textAlign: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '2rem' }}>5,000+</h3>
            <p className="subtle" style={{ margin: '6px 0 0' }}>
              Foydalanuvchilar
            </p>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '2rem' }}>120+</h3>
            <p className="subtle" style={{ margin: '6px 0 0' }}>
              Kitoblar
            </p>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '2rem' }}>TOP #1</h3>
            <p className="subtle" style={{ margin: '6px 0 0' }}>
              Huquqiy platforma yo'nalishi
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
