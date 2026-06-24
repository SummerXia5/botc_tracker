import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchProfile, updateProfile, leaveGroup, unclaimPlayer } from '../api';
import { computePlayerStats, getRadarDimensions, getPowerTier, ROLE_INFO } from '../utils/stats';
import RadarChart from './RadarChart';
import { useToast } from './Toast';
import './MyProfile.css';

const AVATAR_OPTIONS = ['😈', '👻', '🧙', '🧔', '🦹', '🧚', '👹', '👺', '🎃', '🎭', '🔮', '⚔️', '🗡️', '💀', '🧠', '👑', '🌟', '🔥', '🎯', '🏆', '🐉', '🦊', '🐺', '🦇'];

export default function MyProfile({ onBack }) {
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
      setActiveGroup('all');
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
      login({ ...user, ...result.user }, token);
      setProfile(prev => ({ ...prev, user: result.user }));
      setEditing(false);
      setShowAvatarPicker(false);
      toast.success('个人信息已更新');
    } catch (err) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLeaveGroup = async (e, groupId) => {
    e.stopPropagation();
    if (!confirm('确定退出该战队？')) return;
    try {
      // Unclaim player first if claimed
      const claimed = profile.claimedPlayers?.find(p => p.group_id === groupId);
      if (claimed) await unclaimPlayer(claimed.id);
      await leaveGroup(groupId);
      toast.success('已退出战队');
      loadProfile();
      if (activeGroup === groupId) setActiveGroup('all');
    } catch (err) {
      toast.error(err.message || '退出失败');
    }
  };

  const handleUnclaim = async (e, playerId) => {
    e.stopPropagation();
    if (!confirm('确定解除认领？')) return;
    try {
      await unclaimPlayer(playerId);
      toast.success('已解除认领');
      loadProfile();
    } catch (err) {
      toast.error(err.message || '解除失败');
    }
  };

  // Aggregate stats across all groups
  const aggregateStats = useMemo(() => {
    if (!profile || !profile.claimedPlayers?.length) return null;
    const virtualPlayer = { id: 'aggregate', name: 'Me' };
    const myPlayerIds = profile.claimedPlayers.map(p => p.id);
    return computePlayerStats(virtualPlayer, profile.games || [], myPlayerIds);
  }, [profile]);

  // Per-group stats
  const groupStats = useMemo(() => {
    if (!profile) return {};
    const result = {};
    for (const m of (profile.memberships || [])) {
      const player = profile.claimedPlayers?.find(p => p.group_id === m.group_id);
      if (!player) continue;
      const groupGames = (profile.games || []).filter(g => g.group_id === m.group_id);
      result[m.group_id] = computePlayerStats(player, groupGames);
    }
    return result;
  }, [profile]);

  if (loading) {
    return (
      <div className="mp-page">
        <div className="mp-page-loading">
          <div className="loading-spinner" />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const { memberships = [], claimedPlayers = [], games: allGames = [] } = profile;
  const totalGames = aggregateStats?.totalGames || 0;
  const activeGs = activeGroup && activeGroup !== 'all' ? groupStats[activeGroup] : null;
  const activeMembership = memberships.find(m => m.group_id === activeGroup);

  // Filter games by selected group
  const filteredGames = activeGroup === 'all'
    ? allGames
    : allGames.filter(g => g.group_id === activeGroup);

  return (
    <div className="mp-page">
      {/* Dark Hero Banner */}
      <div className="mp-hero">
        <div className="mp-hero-glow" />
        <div className="mp-hero-content">
          <button className="mp-back" onClick={onBack}>← 返回</button>

          <div className="mp-hero-profile">
            {editing ? (
              <div className="mp-edit-zone">
                <div className="mp-avatar-lg mp-avatar-editable" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
                  {editAvatar}
                  <span className="mp-avatar-hint">换</span>
                </div>
                {showAvatarPicker && (
                  <div className="mp-picker">
                    {AVATAR_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        className={`mp-picker-item ${editAvatar === emoji ? 'mp-picker-active' : ''}`}
                        onClick={() => { setEditAvatar(emoji); setShowAvatarPicker(false); }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  className="mp-name-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="显示名称"
                  autoFocus
                />
                <div className="mp-edit-btns">
                  <button className="mp-btn-save" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? '保存中...' : '✓ 保存'}
                  </button>
                  <button className="mp-btn-cancel" onClick={() => { setEditing(false); setShowAvatarPicker(false); }}>
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mp-avatar-lg">{profile.user?.avatar || '👤'}</div>
                <div className="mp-hero-info">
                  <h1 className="mp-hero-name">{profile.user?.display_name || profile.user?.username}</h1>
                  <div className="mp-hero-meta">
                    <span className="mp-role-tag" data-role={profile.user?.role}>
                      {profile.user?.role === 'storyteller' ? '📖 说书人' : '🎮 玩家'}
                    </span>
                    <span className="mp-hero-username">@{profile.user?.username}</span>
                  </div>
                </div>
                <button className="mp-btn-edit" onClick={() => setEditing(true)}>✏️ 编辑资料</button>
              </>
            )}
          </div>

          {/* Quick Stats Bar */}
          {aggregateStats && totalGames > 0 && (
            <div className="mp-quick-stats">
              <div className="mp-qs-item">
                <span className="mp-qs-value">{totalGames}</span>
                <span className="mp-qs-label">总对局</span>
              </div>
              <div className="mp-qs-divider" />
              <div className="mp-qs-item">
                <span className="mp-qs-value mp-qs-accent">{(aggregateStats.winRate * 100).toFixed(1)}%</span>
                <span className="mp-qs-label">综合胜率</span>
              </div>
              <div className="mp-qs-divider" />
              <div className="mp-qs-item">
                <span className="mp-qs-value mp-qs-gold">{aggregateStats.mvpCount || 0}</span>
                <span className="mp-qs-label">🏆 MVP</span>
              </div>
              <div className="mp-qs-divider" />
              <div className="mp-qs-item">
                <span className="mp-qs-value">{(aggregateStats.survivalRate * 100).toFixed(0)}%</span>
                <span className="mp-qs-label">生存率</span>
              </div>
              <div className="mp-qs-divider" />
              <div className="mp-qs-item">
                <span className="mp-qs-value">{memberships.length}</span>
                <span className="mp-qs-label">所属组</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="mp-content">
        <div className="mp-grid">
          {/* Left Column: Groups + Radar */}
          <div className="mp-col-left">
            {/* Groups */}
            <div className="mp-card">
              <h3 className="mp-card-title">所属战队</h3>
              <div className="mp-groups">
                <div
                  className={`mp-group-item ${activeGroup === 'all' ? 'mp-group-active' : ''}`}
                  onClick={() => setActiveGroup('all')}
                >
                  <span className="mp-group-emoji">🌐</span>
                  <div className="mp-group-info">
                    <span className="mp-group-name">全部战队</span>
                    <span className="mp-group-player">跨组综合数据</span>
                  </div>
                  {aggregateStats && <span className="mp-group-score" style={{ color: '#666' }}>{totalGames}局</span>}
                </div>
                {memberships.map(m => {
                  const claimed = claimedPlayers.find(p => p.group_id === m.group_id);
                  const gs = groupStats[m.group_id];
                  return (
                    <div
                      key={m.group_id}
                      className={`mp-group-item ${activeGroup === m.group_id ? 'mp-group-active' : ''}`}
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
                      <div className="mp-group-actions">
                        {gs && <span className="mp-group-score" style={{ color: getPowerTier(gs.powerScore).color }}>{gs.powerScore}</span>}
                        {claimed && (
                          <button className="mp-btn-unlink" onClick={(e) => handleUnclaim(e, claimed.id)} title="解除认领">
                            🔓
                          </button>
                        )}
                        <button className="mp-btn-leave" onClick={(e) => handleLeaveGroup(e, m.group_id)} title="退出战队">
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
                {memberships.length === 0 && (
                  <p className="mp-no-data">还没有加入任何组</p>
                )}
              </div>
            </div>

            {/* Radar Chart */}
            {aggregateStats && totalGames > 0 && (
              <div className="mp-card mp-card-radar">
                <h3 className="mp-card-title">五维能力</h3>
                <div className="mp-radar-wrap">
                  <RadarChart dimensions={getRadarDimensions(aggregateStats)} size={260} />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Group Detail + History */}
          <div className="mp-col-right">
            {/* Per-group detail */}
            {(() => {
              const statsToShow = activeGroup === 'all' ? aggregateStats : activeGs;
              const titleText = activeGroup === 'all' ? '全部战队' : activeMembership?.group_name;
              if (!statsToShow) return (
                <div className="mp-card">
                  <div className="mp-no-data">
                    {memberships.length > 0 ? '← 选择一个组查看详细数据' : '加入一个组后可查看数据'}
                  </div>
                </div>
              );
              return (
                <div className="mp-card">
                  <div className="mp-card-header">
                    <h3 className="mp-card-title">{titleText}</h3>
                    <div className="mp-power-badge" style={{
                      background: `${getPowerTier(statsToShow.powerScore).color}15`,
                      color: getPowerTier(statsToShow.powerScore).color
                    }}>
                      {statsToShow.powerScore} 战力
                    </div>
                  </div>

                  <div className="mp-roles">
                    {Object.entries(ROLE_INFO).map(([key, info]) => {
                      const rs = statsToShow.roleStats?.[key] || { games: 0, wins: 0, winRate: 0 };
                      return (
                        <div key={key} className="mp-role-row">
                          <span className="mp-role-name">{info.label}</span>
                          <span className="mp-role-count">{rs.games}局</span>
                          <div className="mp-role-bar">
                            <div className="mp-role-bar-fill" data-role={key} style={{ width: `${rs.games > 0 ? rs.winRate * 100 : 0}%` }} />
                          </div>
                          <span className="mp-role-rate" data-role={key}>
                            {rs.games > 0 ? `${(rs.winRate * 100).toFixed(0)}%` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {statsToShow.topCharacters?.length > 0 && (
                    <div className="mp-chars">
                      <h4 className="mp-card-subtitle">擅长角色</h4>
                      {statsToShow.topCharacters.slice(0, 5).map((c, i) => (
                        <div key={i} className="mp-char-row">
                          <span className="mp-char-rank">#{i + 1}</span>
                          <span className="mp-char-name">{c.name || c.id}</span>
                          <span className="mp-char-games">{c.games}局</span>
                          <div className="mp-char-bar">
                            <div className="mp-char-fill" style={{ width: `${c.winRate * 100}%` }} />
                          </div>
                          <span className="mp-char-rate">{(c.winRate * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Game History — filtered by selected group */}
            {filteredGames.length > 0 && (
              <div className="mp-card">
                <h3 className="mp-card-title">历史战绩 <span className="mp-count-badge">{filteredGames.length}</span></h3>
                <div className="mp-history">
                  {filteredGames.slice(0, 30).map((game, i) => {
                    const myPlayerIds = claimedPlayers.map(p => p.id);
                    const myP = game.participants?.find(p => myPlayerIds.includes(p.player_id));
                    const won = myP && game.winner === (
                      ['townsfolk', 'outsider'].includes(myP.role_type) ? 'good' : 'evil'
                    );
                    return (
                      <div key={game.id || i} className="mp-history-row">
                        <span className={`mp-h-result ${won ? 'mp-h-win' : 'mp-h-lose'}`}>
                          {won ? 'W' : 'L'}
                        </span>
                        <div className="mp-h-info">
                          <span className="mp-h-script">{game.script || '标准'}</span>
                          <span className="mp-h-date">{new Date(game.date).toLocaleDateString('zh-CN')}</span>
                        </div>
                        {myP && (
                          <span className="mp-h-role" data-role={myP.role_type}>
                            {ROLE_INFO[myP.role_type]?.label}
                          </span>
                        )}
                        {myP?.character_id && (
                          <span className="mp-h-char">{myP.character_id}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
