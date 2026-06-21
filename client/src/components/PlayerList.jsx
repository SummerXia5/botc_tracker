import { useState, useMemo } from 'react';
import PlayerCard from './PlayerCard';
import { sortPlayers } from '../utils/stats';
import './PlayerList.css';

const SORT_TABS = [
  { key: 'power', label: '综合战力' },
  { key: 'winRate', label: '总胜率' },
  { key: 'correctVote', label: '正确投票率' },
  { key: 'finalRound', label: '决赛轮' },
  { key: 'games', label: '局数' },
];

export default function PlayerList({ players, onPlayerClick }) {
  const [activeSort, setActiveSort] = useState('power');
  const [searchQuery, setSearchQuery] = useState('');

  const sortedPlayers = useMemo(() => {
    let filtered = players;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = players.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    return sortPlayers(filtered, activeSort);
  }, [players, activeSort, searchQuery]);

  return (
    <section className="player-list-section">
      <div className="pl-header">
        <h2 className="pl-title">玩家总览</h2>
        <span className="pl-hint">点击卡片查看个人战力图</span>
      </div>

      <div className="pl-controls">
        <div className="pl-sort-tabs">
          {SORT_TABS.map(tab => (
            <button
              key={tab.key}
              className={`pl-sort-tab ${activeSort === tab.key ? 'pl-sort-tab--active' : ''}`}
              onClick={() => setActiveSort(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pl-search">
          <input
            type="text"
            placeholder="搜索玩家..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-search-input"
          />
        </div>
      </div>

      <div className="pl-stack">
        {sortedPlayers.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            onClick={onPlayerClick}
          />
        ))}
        {sortedPlayers.length === 0 && (
          <div className="pl-empty">
            <p className="pl-empty-text">没有找到匹配的玩家</p>
          </div>
        )}
      </div>
    </section>
  );
}
