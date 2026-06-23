import { useState, useMemo } from 'react';
import { createGame } from '../api';
import { useToast } from './Toast';
import PlayerSelector from './PlayerSelector';
import { CHARACTERS, TYPE_COLORS } from '../data/characters';
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

export default function RecordGameModal({ players, scripts, onClose, onSuccess, groupId, onRefreshPlayers, prefillData }) {
  // Local copy of players that can grow when quick-adding
  const [localPlayers, setLocalPlayers] = useState(players);
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Prefill from Grimoire data if available
  const hasPrefill = !!prefillData;
  const [step, setStep] = useState(hasPrefill ? 3 : 1);

  // Step 1
  const [date, setDate] = useState(prefillData?.date || new Date().toISOString().split('T')[0]);
  const [script, setScript] = useState(prefillData?.script || scripts[0]?.name || '');
  const [winner, setWinner] = useState(prefillData?.winner || 'good');

  // Step 2 — prefill selected player IDs from grimoire participants
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(
    hasPrefill ? prefillData.participants.map(p => p.player_id) : []
  );

  // Step 3 — prefill role_type and survived from grimoire
  const [participantDetails, setParticipantDetails] = useState(() => {
    if (!hasPrefill) return {};
    const details = {};
    for (const p of prefillData.participants) {
      details[p.player_id] = {
        role_type: p.role_type || 'townsfolk',
        survived: p.survived !== undefined ? p.survived : true,
        final_round: false,
        correct_vote: false,
        achievements: [],
        survival_days: null,
        player_notes: '',
      };
    }
    return details;
  });
  const [mvpPlayerId, setMvpPlayerId] = useState(null);

  const togglePlayer = (id) => {
    setSelectedPlayerIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const updateDetail = (playerId, field, value) => {
    setParticipantDetails(prev => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), [field]: value },
    }));
  };

  const toggleAchievement = (playerId, achKey) => {
    setParticipantDetails(prev => {
      const current = prev[playerId] || {};
      const achs = current.achievements || [];
      const next = achs.includes(achKey)
        ? achs.filter(a => a !== achKey)
        : [...achs, achKey];
      return { ...prev, [playerId]: { ...current, achievements: next } };
    });
  };

  const getDetail = (playerId) => {
    return participantDetails[playerId] || {
      role_type: 'townsfolk',
      survived: true,
      final_round: false,
      correct_vote: false,
      achievements: [],
      survival_days: null,
      player_notes: '',
    };
  };

  const canProceedStep1 = date && script && winner;
  const canProceedStep2 = selectedPlayerIds.length >= 5;
  const canProceedStep3 = selectedPlayerIds.every(id => {
    const d = getDetail(id);
    return d.role_type;
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const participants = selectedPlayerIds.map(id => {
        const d = getDetail(id);
        return {
          player_id: id,
          role_type: d.role_type || 'townsfolk',
          survived: d.survived ?? true,
          final_round: d.final_round ?? false,
          correct_vote: d.correct_vote ?? false,
          achievements: d.achievements || [],
          survival_days: d.survival_days ?? null,
          player_notes: d.player_notes || null,
        };
      });

      await createGame({
        date,
        script,
        winner,
        participants,
        mvp_player_id: mvpPlayerId || null,
        ...(groupId ? { group_id: groupId } : {}),
      });
      toast.success('对局记录成功！');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || '记录失败');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlayers = localPlayers.filter(p => selectedPlayerIds.includes(p.id));

  // Build character list from the selected script
  const scriptChars = useMemo(() => {
    const sel = scripts.find(s => s.name === script);
    if (!sel || !sel.characters) return [];
    let meta = {};
    try {
      meta = sel.char_meta
        ? (typeof sel.char_meta === 'string' ? JSON.parse(sel.char_meta) : sel.char_meta)
        : {};
    } catch { /* ignore */ }

    return sel.characters.map(id => {
      // Try exact match
      if (CHARACTERS[id]) return CHARACTERS[id];
      // Try stripped CustomVER
      const stripped = id.replace(/Custom(?:VER)?$/i, '').toLowerCase();
      if (CHARACTERS[stripped]) return { ...CHARACTERS[stripped], id };
      // Use script metadata
      const m = meta[id] || {};
      return {
        id,
        name: m.name || id.replace(/Custom(?:VER)?$/i, '').replace(/_/g, ' '),
        type: m.team || 'townsfolk',
        icon: m.image || null,
      };
    });
  }, [script, scripts]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container record-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="record-header">
          <h2>记录赛果</h2>
          <p className="record-subtitle">RECORD GAME</p>
        </div>

        {hasPrefill && (
          <div className="record-prefill-notice">
            📋 已从魔典自动导入：{script} · {selectedPlayerIds.length}人 · {winner === 'good' ? '善良' : '邪恶'}胜
          </div>
        )}

        {/* Step Progress */}
        <div className="step-progress">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`step-item ${step > s ? 'step-active' : ''} ${step === s ? 'step-current' : ''}`}>
              <div className="step-circle">{step > s ? '✓' : s}</div>
              <span className="step-label">
                {s === 1 && '基本信息'}
                {s === 2 && '选择玩家'}
                {s === 3 && '分配角色'}
                {s === 4 && '确认提交'}
              </span>
            </div>
          ))}
          <div className="step-line">
            <div className="step-line-fill" style={{ width: `${((step - 1) / 3) * 100}%` }} />
          </div>
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="step-content">
            <div className="form-field">
              <label>日期</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-field">
              <label>剧本</label>
              <select value={script} onChange={e => setScript(e.target.value)}>
                {scripts.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>获胜方</label>
              <div className="winner-toggle">
                <button
                  className={`winner-btn winner-good ${winner === 'good' ? 'winner-active' : ''}`}
                  onClick={() => setWinner('good')}
                  type="button"
                >
                  善良阵营
                </button>
                <button
                  className={`winner-btn winner-evil ${winner === 'evil' ? 'winner-active' : ''}`}
                  onClick={() => setWinner('evil')}
                  type="button"
                >
                  邪恶阵营
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Players */}
        {step === 2 && (
          <div className="step-content">
            <PlayerSelector
              players={localPlayers}
              selectedIds={selectedPlayerIds}
              onToggle={togglePlayer}
              groupId={groupId}
              label="选择参与玩家"
              minCount={5}
              variant="light"
              onPlayerCreated={(newPlayer) => {
                setLocalPlayers(prev => [...prev, newPlayer]);
                onRefreshPlayers?.();
              }}
            />
          </div>
        )}

        {/* Step 3: Assign Roles & Details */}
        {step === 3 && (
          <div className="step-content">
            <p className="step-hint">为每位玩家分配角色、成就和详细状态</p>
            <div className="role-assignments">
              {selectedPlayers.map(p => {
                const detail = getDetail(p.id);
                const isMvp = mvpPlayerId === p.id;
                return (
                  <div key={p.id} className={`role-assignment-card ${isMvp ? 'ra-mvp' : ''}`}>
                    <div className="ra-header">
                      <span className="ra-emoji">{p.avatar || '👤'}</span>
                      <span className="ra-name">{p.name}</span>
                      <button
                        type="button"
                        className={`ra-mvp-btn ${isMvp ? 'ra-mvp-active' : ''}`}
                        onClick={() => setMvpPlayerId(isMvp ? null : p.id)}
                        title="设为 MVP"
                      >
                        {isMvp ? '⭐ MVP' : '☆ MVP'}
                      </button>
                    </div>

                    {/* Role type buttons */}
                    <div className="ra-role-select">
                      {ROLE_TYPES.map(rt => (
                        <button
                          key={rt.key}
                          type="button"
                          className={`ra-role-btn ${detail.role_type === rt.key ? 'ra-role-active' : ''}`}
                          style={detail.role_type === rt.key ? { color: rt.color, borderColor: rt.color, background: `${rt.color}12` } : {}}
                          onClick={() => updateDetail(p.id, 'role_type', rt.key)}
                        >
                          {rt.label}
                        </button>
                      ))}
                    </div>

                    {/* Optional: specific character */}
                    {scriptChars.length > 0 && (
                      <div className="ra-character-select">
                        <select
                          value={detail.character_id || ''}
                          onChange={e => {
                            const charId = e.target.value;
                            updateDetail(p.id, 'character_id', charId || null);
                            // Auto-set role_type from character
                            if (charId) {
                              const ch = scriptChars.find(c => c.id === charId);
                              if (ch) updateDetail(p.id, 'role_type', ch.type);
                            }
                          }}
                          className="ra-char-dropdown"
                        >
                          <option value="">选择具体角色（可选）</option>
                          {scriptChars
                            .filter(ch => !detail.role_type || ch.type === detail.role_type || !detail.character_id)
                            .map(ch => (
                              <option key={ch.id} value={ch.id}>
                                {ch.name}{ch.nameEn ? ` (${ch.nameEn})` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Toggles row */}
                    <div className="ra-toggles">
                      <label className="ra-toggle">
                        <input
                          type="checkbox"
                          checked={detail.survived ?? true}
                          onChange={e => updateDetail(p.id, 'survived', e.target.checked)}
                        />
                        <span>存活</span>
                      </label>
                      <label className="ra-toggle">
                        <input
                          type="checkbox"
                          checked={detail.final_round ?? false}
                          onChange={e => updateDetail(p.id, 'final_round', e.target.checked)}
                        />
                        <span>决赛轮</span>
                      </label>
                      <label className="ra-toggle">
                        <input
                          type="checkbox"
                          checked={detail.correct_vote ?? false}
                          onChange={e => updateDetail(p.id, 'correct_vote', e.target.checked)}
                        />
                        <span>正确投票</span>
                      </label>
                      <div className="ra-survival-days">
                        <label>存活天数</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          placeholder="—"
                          value={detail.survival_days ?? ''}
                          onChange={e => updateDetail(p.id, 'survival_days', e.target.value ? parseInt(e.target.value) : null)}
                          className="ra-days-input"
                        />
                      </div>
                    </div>

                    {/* Achievement tags */}
                    <div className="ra-achievements">
                      <span className="ra-ach-label">成就标签</span>
                      <div className="ra-ach-tags">
                        {ACHIEVEMENTS.map(ach => {
                          const isActive = (detail.achievements || []).includes(ach.key);
                          return (
                            <button
                              key={ach.key}
                              type="button"
                              className={`ra-ach-tag ${isActive ? 'ra-ach-active' : ''}`}
                              onClick={() => toggleAchievement(p.id, ach.key)}
                              title={ach.desc}
                            >
                              {ach.icon} {ach.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    <input
                      type="text"
                      className="ra-notes-input"
                      placeholder="备注 (可选)..."
                      value={detail.player_notes || ''}
                      onChange={e => updateDetail(p.id, 'player_notes', e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="step-content">
            <div className="review-summary">
              <div className="review-row">
                <span className="review-label">日期</span>
                <span className="review-value">{date}</span>
              </div>
              <div className="review-row">
                <span className="review-label">剧本</span>
                <span className="review-value">{script}</span>
              </div>
              <div className="review-row">
                <span className="review-label">获胜方</span>
                <span className={`review-value review-winner-${winner}`}>
                  {winner === 'good' ? '善良阵营' : '邪恶阵营'}
                </span>
              </div>
              <div className="review-row">
                <span className="review-label">参与者</span>
                <span className="review-value">{selectedPlayerIds.length} 人</span>
              </div>
            </div>

            <div className="review-players">
              {selectedPlayers.map(p => {
                const d = getDetail(p.id);
                const rt = ROLE_TYPES.find(r => r.key === d.role_type);
                return (
                  <div key={p.id} className="review-player-row">
                    <span>{p.emoji || '👤'}</span>
                    <span className="review-player-name">{p.name}</span>
                    <span style={{ color: rt?.color, fontSize: '0.78rem', fontWeight: 500 }}>{rt?.label}</span>
                    <span style={{ fontSize: '0.75rem' }}>{d.survived ? '✓' : '✗'}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{d.final_round ? '决赛轮' : ''}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{d.correct_vote ? '正确投票' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="step-nav">
          {step > 1 && (
            <button className="btn-ghost" onClick={() => setStep(step - 1)}>
              ← 上一步
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 4 && (
            <button
              className="btn-primary"
              disabled={
                (step === 1 && !canProceedStep1) ||
                (step === 2 && !canProceedStep2) ||
                (step === 3 && !canProceedStep3)
              }
              onClick={() => {
                if (step === 2) {
                  // Initialize details for newly selected players
                  selectedPlayerIds.forEach(id => {
                    if (!participantDetails[id]) {
                      updateDetail(id, 'role_type', 'townsfolk');
                      updateDetail(id, 'survived', true);
                    }
                  });
                }
                setStep(step + 1);
              }}
            >
              下一步 →
            </button>
          )}
          {step === 4 && (
            <button
              className="btn-primary"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? '提交中...' : '确认提交'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
