import { getPowerTier, ROLE_INFO } from '../utils/stats';
import './PlayerCard.css';

export default function PlayerCard({ player, onClick }) {
  const tier = getPowerTier(player.powerScore);

  const filledStars = '★'.repeat(player.starRating);
  const emptyStars = '☆'.repeat(5 - player.starRating);

  return (
    <div className="pc-card" onClick={() => onClick(player)}>
      <div className="pc-content">
        {/* Line 1: Name + Stars */}
        <div className="pc-line-name">
          <span className="pc-name">{player.name}</span>
          <span className="pc-stars">
            <span className="pc-stars-filled">{filledStars}</span>
            <span className="pc-stars-empty">{emptyStars}</span>
          </span>
        </div>

        {/* Line 2: Description + Game count */}
        <div className="pc-line-desc">
          {player.description && (
            <span className="pc-desc">{player.description}</span>
          )}
          <span className="pc-games">· {player.totalGames} 局</span>
        </div>

        {/* Line 3: Key stats */}
        <div className="pc-line-stats">
          胜率 {(player.winRate * 100).toFixed(0)}%
          {' · '}正确投票 {(player.correctVoteRate * 100).toFixed(0)}%
          {' · '}决赛轮 {(player.finalRoundRate * 100).toFixed(0)}%
        </div>

        {/* Line 4: Role pills */}
        <div className="pc-roles">
          {Object.entries(ROLE_INFO).map(([key, info]) => {
            const rs = player.roleStats?.[key];
            if (!rs || rs.games === 0) return null;
            return (
              <span
                key={key}
                className="pc-role-pill"
                data-role={key}
              >
                {info.label} {(rs.winRate * 100).toFixed(0)}%
              </span>
            );
          })}
        </div>
      </div>

      {/* Power score circle */}
      <div
        className="pc-power"
        style={{
          borderColor: tier.color,
          color: tier.color,
        }}
      >
        {player.powerScore}
      </div>
    </div>
  );
}
