import React from 'react';
import { Link } from 'react-router-dom';

const PUBLIC_URL = process.env.PUBLIC_URL || '';

const GAMES = [
  {
    id: 'mental-math',
    title: 'Aqlni Sinash',
    badge: 'Live',
    href: `${PUBLIC_URL}/games/mental-math.html`,
    description: "Tez hisoblash va diqqat uchun qisqa challenge.",
    saveNote: 'Best score brauzerda saqlanadi.',
  },
  {
    id: 'swing-hook',
    title: 'Swing Hook',
    badge: 'New',
    href: `${PUBLIC_URL}/games/swing-hook.html`,
    description: "Hook bilan uchib level'larni tozalaydigan arcade platformer.",
    saveNote: "Har level uchun best time brauzerda saqlanadi.",
  },
];

const GameZonePage = () => {
  return (
    <div className="site-container page-stack game-zone-minimal">
      <section className="glass-card card-pad game-zone-minimal-head">
        <div>
          <p className="game-zone-kicker">Game Zone</p>
          <h1 className="section-title">O&apos;yinni tanlang</h1>
          <p className="subtle">Hozircha 2 ta o&apos;yin tayyor.</p>
        </div>
        <Link to="/ranking" className="btn btn-soft">
          Reytingga qaytish
        </Link>
      </section>

      <section className="game-zone-link-grid">
        {GAMES.map((game) => (
          <a key={game.id} href={game.href} className="game-zone-link-card">
            <div>
              <span className="game-zone-link-badge">{game.badge}</span>
              <h2>{game.title}</h2>
              <p>{game.description}</p>
            </div>
            <div className="game-zone-link-meta">
              <span>{game.saveNote}</span>
              <strong>O&apos;yinni ochish</strong>
            </div>
          </a>
        ))}
      </section>
    </div>
  );
};

export default GameZonePage;
