import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchProfile, updateProfile } from '../api';
import { computePlayerStats, getRadarDimensions, getPowerTier, ROLE_INFO } from '../utils/stats';
import RadarChart from './RadarChart';
import { useToast } from './Toast';
import './MyProfile.css';

const AVATAR_OPTIONS = ['😈', '👻', '🧙', '🧔', '🦹', '🧚', '👹', '👺', '🎃', '🎭', '🔮', '⚔️', '🗡️', '💀', '🧠', '👑', '🌟', '🔥', '🎯', '🏆'];

export default function MyProfile({ onClose }) {
  const { user, login, token } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  
  // Editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchProfile();
      setProfile(data);
      setEditName(data.user?.display_name || data.user?.username || '');
      setEditAvatar(data.user?.avatar || '😈');
      if (data.memberships?.length > 0) {
        setActiveGroup(data.memberships[0].group_id);
      }
    } catch (err) {
      console.error('Profile load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const result = await updateProfile({
        display_name: editName.trim(),
        avatar: editAvatar,
      });
      // Update AuthContext with new user data
      login({ ...user, ...result.user }, token);
      setProfile(prev => ({ ...prev, user: result.user }));
      setEditing(false);
      toast.success('个人信息已更新');
    } catch (err) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Compute aggregate stats across all groups
  const aggregateStats = useMemo(() => {
    if (!profile || !profile.claimedPlayers?.length) return null;
    const virtualPlayer = {
      id: 'aggregate',
      name: user?.display_name || user?.username || 'Me',
    };
    const allGames = profile.games || [];
    const myPlayerIds = profile.claimedPlayers.map(p => p.id);
    return computePlayerStats(virtualPlayer, allGames, myPlayerIds);
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

        {/* User Header - Editable */}
        <div className="mp-header">
          {editing ? (
            <>
              <div className="mp-avatar-edit" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
                <span>{editAvatar}</span>
                <span className="mp-avatar-edit-hint">点击换</span>
              </div>
              {showAvatarPicker && (
                <div className="mp-avatar-picker">
                  {AVATAR_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      className={`mp-avatar-option ${editAvatar === emoji ? 'mp-avatar-selected' : ''}`}
                      onClick={() => { setEditAvatar(emoji); setShowAvatarPicker(false); }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <div className="mp-edit-fields">
                <input
                  className="mp-edit-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="显示名称"
                  autoFocus
                />
                <div className="mp-edit-actions">
                  <button className="btn btn-filled mp-save-btn" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setEditing(false); setShowAvatarPicker(false); }}>
                    取消
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mp-avatar">{profile.user?.avatar || '👤'}</div>
              <div className="mp-user-info">
                <h2 className="mp-name">{profile.user?.display_name || profile.user?.username}</h2>
                <span className="mp-role-badge" data-role={profile.user?.role}>
                  {profile.user?.role === 'storyteller' ? '📖 说书人' : '🎮 玩家'}
                </span>
                <p className="mp-username">@{profile.user?.username}</p>
              </div>
              <button className="btn btn-ghost mp-edit-btn" onClick={() => setEditing(true)}>✏️ 编辑</button>
            </>
          )}
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
                    {claimed ? (
                      <span className="mp-group-player">→ {claimed.name}</span>
                    ) : (
                      <span className="mp-group-unclaimed">→ 未认领档案</span>
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

            <div className="pm-radar">
              <RadarChart dimensions={getRadarDimensions(aggregateStats)} size={220} />
            </div>
          </div>
        )}

        {/* Per-group detail */}
        {activeGroup && groupStats[activeGroup] && (() => {
          const gs = groupStats[activeGroup];
          const membership = memberships.find(m => m.group_id === activeGroup);
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

              {/* Top characters */}
              {gs.topCharacters?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="mp-section-title">擅长角色</h4>
                  {gs.topCharacters.map((c, i) => (
                    <div key={i} className="pm-char-row">
                      <span className="pm-char-name">{c.name || c.id}</span>
                      <span className="pm-char-games">{c.games}局</span>
                      <div className="pm-char-bar">
                        <div className="pm-char-bar-fill" style={{ width: `${c.winRate * 100}%` }} />
                      </div>
                      <span className="pm-char-rate">{(c.winRate * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
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
