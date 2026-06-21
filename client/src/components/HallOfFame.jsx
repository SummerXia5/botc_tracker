import './HallOfFame.css';

export default function HallOfFame({ awards }) {
  if (!awards || awards.length === 0) return null;

  return (
    <section className="hall-of-fame-section">
      <div className="section-header">
        <h2 className="section-title">
          周五荣耀名人堂
          <span className="section-title-note">(已出赛 5 局以上)</span>
        </h2>
        <span className="section-subtitle">HALL OF FAME · 5+ GAMES REQUIRED</span>
      </div>

      <div className="awards-grid">
        {awards.map((award, index) => (
          <div
            key={award.key}
            className={`award-card ${award.isMvp ? 'award-card-mvp' : ''}`}
            style={{ animationDelay: `${index * 0.06}s` }}
          >
            <div className="award-emoji">{award.emoji}</div>
            <div className="award-title">{award.title}</div>
            <div className="award-subtitle">{award.subtitle}</div>
            <div className="award-player">
              <span className="award-player-name">{award.player.name}</span>
            </div>
            <div className="award-value">{award.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
