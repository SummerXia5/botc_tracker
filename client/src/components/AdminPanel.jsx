import { useState, useMemo } from 'react';
import { createPlayer, updatePlayer, deletePlayer, deleteGame, updateGame } from '../api';
import { CHARACTERS, TYPE_LABELS, TYPE_COLORS } from '../data/characters';
import { useToast } from './Toast';
import ScriptManagement from './ScriptManagement';
import './AdminPanel.css';
import './RecordGameModal.css';

const ROLE_TYPES = [
  { key: 'townsfolk', label: '镇民', color: 'var(--color-townsfolk)' },
  { key: 'outsider', label: '外来者', color: 'var(--color-outsider)' },
  { key: 'minion', label: '爪牙', color: 'var(--color-minion)' },
  { key: 'demon', label: '恶魔', color: 'var(--color-demon)' },
];

const ACHIEVEMENTS = [
  { key: 'logic_chain', label: '盘通逻辑线', icon: '🧠', desc: '完美推理出逻辑链' },
  { key: 'perfect_review', label: '完美复盘', icon: '📖', desc: '完美复盘魔典' },
  { key: 'strong_lead', label: '强势带队', icon: '🏆', desc: '强势带队引领方向' },
  { key: 'wrong_lead', label: '带偏方向', icon: '💀', desc: '强势带队但走偏了' },
  { key: 'clutch_play', label: '关键操作', icon: '⚡', desc: '在关键时刻做出决定性操作' },
  { key: 'great_bluff', label: '完美伪装', icon: '🎭', desc: '邪恶方完美伪装身份' },
];

const EMOJI_OPTIONS = [
  '😎', '🦊', '🐺', '🦁', '🐉', '🧙', '🧛', '👻', '💀', '🎃',
  '🌟', '🔥', '⚡', '🗡️', '🛡️', '👑', '🎯', '🎪', '🌙', '☀️',
  '🦅', '🐍', '🦇', '🐲', '🦄', '🧝', '🧟', '🤖', '👽', '🎭',
  '🏴‍☠️', '🃏', '🎲', '🔮', '💎', '🌹', '🍷', '⚔️', '🏹', '🪄',
];

export default function AdminPanel({ players, games, scripts, groupId, onRefresh }) {
  const toast = useToast();
  const [section, setSection] = useState('players'); // 'players' | 'scripts' | 'games'
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Add form state
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('😎');
  const [newDesc, setNewDesc] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [loading, setLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Game management
  const [gameSearch, setGameSearch] = useState('');
  const [confirmDeleteGameId, setConfirmDeleteGameId] = useState(null);
  const [editingGameId, setEditingGameId] = useState(null);
  const [editGameDate, setEditGameDate] = useState('');
  const [editGameScript, setEditGameScript] = useState('');
  const [editGameWinner, setEditGameWinner] = useState('good');
  const [editGameNotes, setEditGameNotes] = useState('');
  const [editGameMvp, setEditGameMvp] = useState('');
  const [editParticipants, setEditParticipants] = useState([]); // [{player_id, player_name, role_type, survived, survival_days, character_id, final_round}]

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return players;
    const q = search.toLowerCase();
    return players.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.desc || '').toLowerCase().includes(q)
    );
  }, [players, search]);

  const filteredGames = useMemo(() => {
    if (!games) return [];
    if (!gameSearch.trim()) return games;
    const q = gameSearch.toLowerCase();
    return games.filter(g =>
      (g.script || '').toLowerCase().includes(q) ||
      (g.date || '').includes(q)
    );
  }, [games, gameSearch]);

  // ---- Player CRUD ----
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim() || loading) return;
    setLoading(true);
    try {
      await createPlayer({
        name: newName.trim(),
        avatar: newEmoji,
        desc: newDesc.trim(),
        group_id: groupId,
      });
      toast.success(`玩家 "${newName.trim()}" 已添加`);
      setNewName('');
      setNewEmoji('😎');
      setNewDesc('');
      setShowAddForm(false);
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || '添加失败');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (player) => {
    setEditingId(player.id);
    setEditName(player.name);
    setEditEmoji(player.avatar || '😎');
    setEditDesc(player.desc || '');
  };

  const handleUpdate = async (id) => {
    if (!editName.trim() || loading) return;
    setLoading(true);
    try {
      await updatePlayer(id, {
        name: editName.trim(),
        avatar: editEmoji,
        desc: editDesc.trim(),
      });
      toast.success('已更新');
      setEditingId(null);
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlayer = async (id, name) => {
    if (loading) return;
    setLoading(true);
    try {
      await deletePlayer(id);
      toast.success(`已删除 "${name}"`);
      setConfirmDeleteId(null);
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGame = async (id) => {
    if (loading) return;
    setLoading(true);
    try {
      await deleteGame(id);
      toast.success('对局已删除');
      setConfirmDeleteGameId(null);
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const startEditGame = (game) => {
    setEditingGameId(game.id);
    setEditGameDate(game.date || '');
    setEditGameScript(game.script || '');
    setEditGameWinner(game.winner || 'good');
    setEditGameNotes(game.notes || '');
    setEditGameMvp(game.mvp_player_id || '');
    setEditParticipants((game.participants || []).map(p => {
      let achs = [];
      try { achs = typeof p.achievements === 'string' ? JSON.parse(p.achievements) : (p.achievements || []); } catch { achs = []; }
      return {
        player_id: p.player_id,
        player_name: p.player_name || getPlayerName(p.player_id),
        player_avatar: p.player_avatar || '',
        role_type: p.role_type || 'townsfolk',
        survived: p.survived ? true : false,
        survival_days: p.survival_days || null,
        character_id: p.character_id || null,
        final_round: p.final_round ? true : false,
        correct_vote: p.correct_vote ? true : false,
        achievements: achs,
        player_notes: p.player_notes || '',
      };
    }));
  };

  const handleUpdateGame = async (id) => {
    if (loading) return;
    setLoading(true);
    try {
      await updateGame(id, {
        date: editGameDate || undefined,
        script: editGameScript || undefined,
        winner: editGameWinner || undefined,
        notes: editGameNotes,
        mvp_player_id: editGameMvp || undefined,
        participants: editParticipants.map(p => ({
          player_id: p.player_id,
          role_type: p.role_type,
          survived: p.survived,
          survival_days: p.survival_days,
          character_id: p.character_id,
          final_round: p.final_round,
          correct_vote: p.correct_vote,
          achievements: p.achievements,
          player_notes: p.player_notes,
        })),
      });
      toast.success('对局已更新');
      setEditingGameId(null);
      onRefresh?.();
    } catch (err) {
      toast.error(err.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const getPlayerName = (id) => {
    const p = players.find(pl => pl.id === id);
    return p ? p.name : id;
  };

  return (
    <div className="admin-panel">
      {/* Section Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${section === 'players' ? 'admin-tab-active' : ''}`}
          onClick={() => setSection('players')}
        >
          👥 玩家管理
        </button>
        <button
          className={`admin-tab ${section === 'games' ? 'admin-tab-active' : ''}`}
          onClick={() => setSection('games')}
        >
          🎮 对局管理
        </button>
        <button
          className={`admin-tab ${section === 'scripts' ? 'admin-tab-active' : ''}`}
          onClick={() => setSection('scripts')}
        >
          📜 剧本管理
        </button>
      </div>

      {/* ---- Player Management ---- */}
      {section === 'players' && (
        <div className="admin-section">
          <div className="admin-toolbar">
            <input
              type="text"
              className="admin-search"
              placeholder="🔍 搜索玩家..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              className="admin-btn admin-btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? '取消' : '+ 添加玩家'}
            </button>
          </div>

          {/* Add Player Form */}
          {showAddForm && (
            <form className="admin-add-form" onSubmit={handleAdd}>
              <div className="admin-form-row">
                <div className="admin-emoji-picker">
                  <span className="admin-selected-emoji">{newEmoji}</span>
                  <div className="admin-emoji-grid">
                    {EMOJI_OPTIONS.map(e => (
                      <button
                        key={e}
                        type="button"
                        className={`admin-emoji-opt ${newEmoji === e ? 'admin-emoji-active' : ''}`}
                        onClick={() => setNewEmoji(e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="玩家名称"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <input
                type="text"
                className="admin-input admin-input-full"
                placeholder="一句话描述（可选）"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={!newName.trim() || loading}
              >
                {loading ? '添加中...' : '确认添加'}
              </button>
            </form>
          )}

          {/* Player List */}
          <div className="admin-player-list">
            <div className="admin-list-header">
              <span>共 {players.length} 位玩家</span>
              {search && <span className="admin-filter-info">显示 {filteredPlayers.length} 条结果</span>}
            </div>

            {filteredPlayers.map(player => (
              <div key={player.id} className="admin-player-card">
                {editingId === player.id ? (
                  /* Edit Mode */
                  <div className="admin-edit-form">
                    <div className="admin-edit-row">
                      <div className="admin-emoji-picker admin-emoji-picker-sm">
                        <span className="admin-selected-emoji">{editEmoji}</span>
                        <div className="admin-emoji-grid">
                          {EMOJI_OPTIONS.map(e => (
                            <button
                              key={e}
                              type="button"
                              className={`admin-emoji-opt ${editEmoji === e ? 'admin-emoji-active' : ''}`}
                              onClick={() => setEditEmoji(e)}
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        className="admin-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      className="admin-input admin-input-full"
                      placeholder="描述"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                    />
                    <div className="admin-edit-actions">
                      <button
                        className="admin-btn admin-btn-primary admin-btn-sm"
                        onClick={() => handleUpdate(player.id)}
                        disabled={!editName.trim() || loading}
                      >
                        保存
                      </button>
                      <button
                        className="admin-btn admin-btn-sm"
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="admin-player-info">
                    <span className="admin-player-emoji">{player.avatar || '👤'}</span>
                    <div className="admin-player-details">
                      <span className="admin-player-name">{player.name}</span>
                      {player.desc && (
                        <span className="admin-player-desc">{player.desc}</span>
                      )}
                    </div>
                    <div className="admin-player-actions">
                      <button
                        className="admin-action-btn"
                        onClick={() => startEdit(player)}
                        title="编辑"
                      >
                        ✏️
                      </button>
                      {confirmDeleteId === player.id ? (
                        <div className="admin-confirm-delete">
                          <span>确认删除？</span>
                          <button
                            className="admin-action-btn admin-action-danger"
                            onClick={() => handleDeletePlayer(player.id, player.name)}
                          >
                            是
                          </button>
                          <button
                            className="admin-action-btn"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            否
                          </button>
                        </div>
                      ) : (
                        <button
                          className="admin-action-btn admin-action-danger"
                          onClick={() => setConfirmDeleteId(player.id)}
                          title="删除"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredPlayers.length === 0 && (
              <div className="admin-empty">
                {search ? '没有匹配的玩家' : '暂无玩家，点击上方添加'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Game Management ---- */}
      {section === 'games' && (
        <div className="admin-section">
          <div className="admin-toolbar">
            <input
              type="text"
              className="admin-search"
              placeholder="🔍 搜索对局（剧本/日期）..."
              value={gameSearch}
              onChange={e => setGameSearch(e.target.value)}
            />
            <span className="admin-list-count">共 {(games || []).length} 局</span>
          </div>

          <div className="admin-game-list">
            {filteredGames.map(game => (
              <div key={game.id} className="admin-game-card">
                {editingGameId === game.id ? (
                  /* Game Edit Mode */
                  <div className="admin-edit-form">
                    <div className="admin-edit-row">
                      <input
                        type="date"
                        className="admin-input"
                        value={editGameDate}
                        onChange={e => setEditGameDate(e.target.value)}
                      />
                      <select
                        className="admin-input"
                        value={editGameScript}
                        onChange={e => setEditGameScript(e.target.value)}
                      >
                        <option value="">选择剧本</option>
                        {(scripts || []).map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        {editGameScript && !(scripts || []).some(s => s.name === editGameScript) && (
                          <option value={editGameScript}>{editGameScript}</option>
                        )}
                      </select>
                    </div>
                    <div className="admin-edit-row">
                      <div className="admin-winner-toggle">
                        <button
                          type="button"
                          className={`admin-btn admin-btn-sm ${editGameWinner === 'good' ? 'admin-btn-primary' : ''}`}
                          onClick={() => setEditGameWinner('good')}
                        >
                          善良胜
                        </button>
                        <button
                          type="button"
                          className={`admin-btn admin-btn-sm ${editGameWinner === 'evil' ? 'admin-btn-primary' : ''}`}
                          onClick={() => setEditGameWinner('evil')}
                        >
                          邪恶胜
                        </button>
                      </div>
                      <select
                        className="admin-input"
                        value={editGameMvp}
                        onChange={e => setEditGameMvp(e.target.value)}
                      >
                        <option value="">MVP（可选）</option>
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="admin-input admin-input-full"
                      placeholder="备注（可选）"
                      value={editGameNotes}
                      onChange={e => setEditGameNotes(e.target.value)}
                      rows={2}
                    />
                    <div className="admin-edit-actions">
                      <button
                        className="admin-btn admin-btn-primary admin-btn-sm"
                        onClick={() => handleUpdateGame(game.id)}
                        disabled={loading}
                      >
                        保存
                      </button>
                      <button
                        className="admin-btn admin-btn-sm"
                        onClick={() => setEditingGameId(null)}
                      >
                        取消
                      </button>
                    </div>

                    {/* Participant details — match RecordGameModal step 3 style */}
                    {editParticipants.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 10 }}>
                        <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 8 }}>玩家详情</div>
                        <div className="ra-participants-list">
                          {editParticipants.map((p, pi) => {
                            const updateP = (field, value) => {
                              const next = [...editParticipants];
                              next[pi] = { ...next[pi], [field]: value };
                              setEditParticipants(next);
                            };
                            const toggleAch = (key) => {
                              const achs = p.achievements || [];
                              updateP('achievements', achs.includes(key) ? achs.filter(a => a !== key) : [...achs, key]);
                            };
                            const isMvp = editGameMvp === p.player_id;
                            return (
                              <div key={p.player_id} className="ra-participant-card">
                                <div className="ra-player-header">
                                  <span className="ra-player-emoji">{p.player_avatar || '👤'}</span>
                                  <span className="ra-player-name">{p.player_name}</span>
                                  <button
                                    type="button"
                                    className={`ra-mvp-btn ${isMvp ? 'ra-mvp-active' : ''}`}
                                    onClick={() => setEditGameMvp(isMvp ? '' : p.player_id)}
                                    title="设为 MVP"
                                  >
                                    {isMvp ? '⭐ MVP' : '☆ MVP'}
                                  </button>
                                </div>
                                <div className="ra-role-select">
                                  {ROLE_TYPES.map(rt => (
                                    <button
                                      key={rt.key}
                                      type="button"
                                      className={`ra-role-btn ${p.role_type === rt.key ? 'ra-role-active' : ''}`}
                                      style={p.role_type === rt.key ? { color: rt.color, borderColor: rt.color, background: `${rt.color}12` } : {}}
                                      onClick={() => updateP('role_type', rt.key)}
                                    >
                                      {rt.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="ra-toggles">
                                  <label className="ra-toggle">
                                    <input type="checkbox" checked={p.correct_vote ?? false} onChange={e => updateP('correct_vote', e.target.checked)} />
                                    <span>最终投票正确</span>
                                  </label>
                                  <div className="ra-survival-days">
                                    <label>存活天数</label>
                                    <input
                                      type="number" min="0" max="20" placeholder="—"
                                      value={p.survival_days ?? ''}
                                      onChange={e => updateP('survival_days', e.target.value ? parseInt(e.target.value) : null)}
                                      className="ra-days-input"
                                    />
                                  </div>
                                </div>
                                <div className="ra-achievements">
                                  <span className="ra-ach-label">成就标签</span>
                                  <div className="ra-ach-tags">
                                    {ACHIEVEMENTS.map(ach => {
                                      const isActive = (p.achievements || []).includes(ach.key);
                                      return (
                                        <button
                                          key={ach.key} type="button"
                                          className={`ra-ach-tag ${isActive ? 'ra-ach-active' : ''}`}
                                          onClick={() => toggleAch(ach.key)}
                                          title={ach.desc}
                                        >
                                          {ach.icon} {ach.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <input
                                  type="text" className="ra-notes-input"
                                  placeholder="备注 (可选)..."
                                  value={p.player_notes || ''}
                                  onChange={e => updateP('player_notes', e.target.value)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Game Display Mode */
                  <>
                    <div className="admin-game-info">
                      <div className="admin-game-main">
                        <span className="admin-game-date">{game.date}</span>
                        <span className="admin-game-script">{game.script}</span>
                        <span className={`admin-game-winner ${game.winner === 'good' ? 'winner-good' : 'winner-evil'}`}>
                          {game.winner === 'good' ? '善良胜' : '邪恶胜'}
                        </span>
                      </div>
                      <div className="admin-game-players">
                        {game.participants?.slice(0, 6).map((p, i) => (
                          <span key={i} className="admin-game-player-name">
                            {p.player_name || getPlayerName(p.player_id)}
                          </span>
                        ))}
                        {game.participants?.length > 6 && (
                          <span className="admin-game-more">+{game.participants.length - 6}</span>
                        )}
                      </div>
                    </div>
                    <div className="admin-game-actions">
                      <button
                        className="admin-action-btn"
                        onClick={() => startEditGame(game)}
                        title="编辑对局"
                      >
                        ✏️
                      </button>
                      {confirmDeleteGameId === game.id ? (
                        <div className="admin-confirm-delete">
                          <span>确认删除？</span>
                          <button
                            className="admin-action-btn admin-action-danger"
                            onClick={() => handleDeleteGame(game.id)}
                          >
                            是
                          </button>
                          <button
                            className="admin-action-btn"
                            onClick={() => setConfirmDeleteGameId(null)}
                          >
                            否
                          </button>
                        </div>
                      ) : (
                        <button
                          className="admin-action-btn admin-action-danger"
                          onClick={() => setConfirmDeleteGameId(game.id)}
                          title="删除对局"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}

            {filteredGames.length === 0 && (
              <div className="admin-empty">
                {gameSearch ? '没有匹配的对局' : '暂无对局记录'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Script Management ---- */}
      {section === 'scripts' && (
        <ScriptManagement
          scripts={scripts}
          groupId={groupId}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
