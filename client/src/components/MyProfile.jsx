import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchProfile } from '../api';
import { computePlayerStats, getRadarDimensions, getPowerTier, ROLE_INFO } from '../utils/stats';
import RadarChart from './RadarChart';
import { CHARACTERS } from '../data/characters';
import './MyProfile.css';

export default function MyProfile({ onClose }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchProfile();
      setProfile(data);
      if (data.memberships?.length > 0) {
        setActiveGroup(data.memberships[0].group_id);
      }
    } catch (err) {
      console.error('Profile load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compute aggregate stats across all groups
  const aggregateStats = useMemo(() => {
    if (!profile || !profile.claimedPlayers?.length) return null;
    // Create a virtual player combining all claimed players
    const virtualPlayer = {
      id: 'aggregate',
      name: user?.display_name || user?.username || 'Me',
    };
    // Use all games from profile
    const allGames = profile.games || [];
    // Merge participations: filter to only the user's claimed player IDs
    const myPlayerIds = profile.claimedPlayers.map(p => p.id);
    // For computePlayerStats, we need to create a compatible format
    // Modify games so they have participants with our player IDs
    const stats = computePlayerStats(virtualPlayer, allGames, myPlayerIds);
    return stats;
  }, [profile, user]);

  // Per-group stats
  const groupStats = useMemo(() => {
    if (!profile) return {};
    const result = {};
    for (const membership of (profile.memberships || [])) {
      const player = profile.claimedPlayers?.find(p => p.group_id === membership.group_id);
      if (!player) continue;
      const groupGames = (profile.games || []).filter(g => g.group_id === membership.group_id);
      result[membership.group_id] = computePlayerStats(player, groupGames);
    }
    return result;
  }, [profile]);

  if (loading) {
    return (
      <div className="mp-overlay" onClick={onClose}>
        <div className="mp-modal" onClick={e => e.stopPropagation()}>
          <div className="mp-loading">加载中...</div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const { memberships = [], claimedPlayers = [], games: allGames = [] } = profile;
  const totalGames = aggregateStats?.totalGames || 0;

  return (
    <div className="mp-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <button className="pm-close" onClick={onClose}>×</button>

        {/* User Header */}
        <div className="mp-header">
          <div className="mp-avatar">{profile.user?.avatar || '👤'}</div>
          <div className="mp-user-info">
            <h2 className="mp-name">{profile.user?.display_name || profile.user?.username}</h2>
            <span className="mp-role-badge" data-role={profile.user?.role}>
              {profile.user?.role === 'storyteller' ? '📖 说书人' : '🎮 玩家'}
            </span>
            <p className="mp-username">@{profile.user?.username}</p>
          </div>
        </div>

        {/* Groups */}
        <div className="mp-section">
          <h3 className="mp-section-title">所属战队</h3>
          <div className="mp-groups">
            {memberships.map(m => {
              const claimed = claimedPlayers.find(p => p.group_id === m.group_id);
              const gs = groupStats[m.group_id];
              return (
                <div
                  key={m.group_id}
                  className={`mp-group-card ${activeGroup === m.group_id ? 'mp-group-active' : ''}`}
                  onClick={() => setActiveGroup(m.group_id)}
                >
                  <span className="mp-group-emoji">{m.group_avatar || '🎲'}</span>
                  <div className="mp-group-info">
                    <span className="mp-group-name">{m.group_name}</span>
                    {claimed && (
                      <span className="mp-group-player">→ {claimed.name}</span>
                    )}
                  </div>
                  {gs && (
                    <span className="mp-group-rank">Rank #{gs.rank || '—'}</span>
                  )}
                </div>
              );
            })}
            {memberships.length === 0 && (
              <p className="mp-empty">还没有加入任何组</p>
            )}
          </div>
        </div>

        {/* Aggregate Stats */}
        {aggregateStats && totalGames > 0 && (
          <div className="mp-section">
            <h3 className="mp-section-title">跨组综合数据</h3>
            <div className="pm-stat-grid">
              <div className="pm-stat-cell">
                <span className="pm-stat-label">总对战</span>
                <span className="pm-stat-value">{totalGames} 局</span>
              </div>
              <div className="pm-stat-cell">
                <span className="pm-stat-label">综合胜率</span>
                <span className="pm-stat-value pm-stat-value--accent">
                  {(aggregateStats.winRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="pm-stat-cell">
                <span className="pm-stat-label">🏆 MVP</span>
                <span className="pm-stat-value pm-stat-value--gold">
                  {aggregateStats.mvpCount || 0} 次
                </span>
              </div>
              <div className="pm-stat-cell">
                <span className="pm-stat-label">生存率</span>
                <span className="pm-stat-value">
                  {(aggregateStats.survivalRate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Per-group detail */}
        {activeGroup && groupStats[activeGroup] && (() => {
          const gs = groupStats[activeGroup];
          const membership = memberships.find(m => m.group_id === activeGroup);
          const radarDims = getRadarDimensions(gs);
          const tier = getPowerTier(gs.powerScore);
          return (
            <div className="mp-section">
              <h3 className="mp-section-title">{membership?.group_name} 详细数据</h3>
              
              <div className="mp-power-row">
                <span className="mp-power-score" style={{ color: tier.color }}>
                  {gs.powerScore}
                </span>
                <span className="mp-power-label">战力分</span>
              </div>

              <div className="pm-radar">
                <RadarChart dimensions={radarDims} size={220} />
              </div>

              {/* Role stats */}
              <div className="pm-role-grid">
                {Object.entries(ROLE_INFO).map(([key, info]) => {
                  const rs = gs.roleStats?.[key] || { games: 0, wins: 0, winRate: 0 };
                  return (
                    <div key={key} className="pm-role-cell" data-role={key}>
                      <div className="pm-role-name">
                        <span className="pm-role-cn">{info.label}</span>
                      </div>
                      <div className="pm-role-data">
                        <span className="pm-role-count">{rs.games} 局</span>
                        <span className="pm-role-rate" data-role={key}>
                          {rs.games > 0 ? `${(rs.winRate * 100).toFixed(0)}%` : '—'}
                        </span>
                      </div>
                      {rs.games > 0 && (
                        <div className="pm-role-bar">
                          <div className="pm-role-bar-fill" data-role={key} style={{ width: `${rs.winRate * 100}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Recent Games */}
        {allGames.length > 0 && (
          <div className="mp-section">
            <h3 className="mp-section-title">全部历史战绩 ({allGames.length}局)</h3>
            <div className="pm-history-list">
              {allGames.slice(0, 20).map((game, i) => {
                const myPlayerIds = claimedPlayers.map(p => p.id);
                const myParticipation = game.participants?.find(p => myPlayerIds.includes(p.player_id));
                const won = myParticipation && game.winner === (
                  ['townsfolk', 'outsider'].includes(myParticipation.role_type) ? 'good' : 'evil'
                );
                return (
                  <div key={game.id || i} className="pm-history-row">
                    <div className="pm-history-left">
                      <span className="pm-history-script">{game.script || '标准'}</span>
                      <span className="pm-history-date">{new Date(game.date).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div className="pm-history-right">
                      {myParticipation && (
                        <span className="pm-history-role" data-role={myParticipation.role_type}>
                          {ROLE_INFO[myParticipation.role_type]?.label}
                        </span>
                      )}
                      <span className={`pm-history-result ${won ? 'pm-result--win' : 'pm-result--lose'}`}>
                        {won ? '胜' : '负'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
