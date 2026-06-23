import { useState, useMemo } from 'react';
import { createPlayer } from '../api';
import './PlayerSelector.css';

/**
 * Reusable player selector with search + quick add.
 *
 * Props:
 *   players         — full player list
 *   selectedIds     — array of selected player IDs
 *   onToggle        — (id) => void
 *   groupId         — group ID for creating new players
 *   onPlayerCreated — (newPlayer) => void, called after quick-add
 *   label           — optional header label
 *   minCount        — optional minimum selection count to display
 *   variant         — 'light' | 'dark' (default 'light')
 */
export default function PlayerSelector({
  players,
  selectedIds,
  onToggle,
  groupId,
  onPlayerCreated,
  label,
  minCount,
  variant = 'light',
}) {
  const [search, setSearch] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return players;
    const q = search.trim().toLowerCase();
    return players.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.avatar && p.avatar.includes(q))
    );
  }, [players, search]);

  const handleQuickAdd = async () => {
    const name = quickAddName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const result = await createPlayer({
        name,
        group_id: groupId,
        avatar: '👤',
      });
      const newPlayer = result.player || { id: name.toLowerCase().replace(/\s+/g, '-'), name, avatar: '👤', group_id: groupId };
      onPlayerCreated?.(newPlayer);
      onToggle?.(newPlayer.id);
      setQuickAddName('');
      setShowQuickAdd(false);
    } catch (err) {
      alert('添加失败: ' + (err.message || '未知错误'));
    } finally {
      setAdding(false);
    }
  };

  const isDark = variant === 'dark';

  return (
    <div className={`player-selector ${isDark ? 'ps-dark' : 'ps-light'}`}>
      {/* Header */}
      <div className="ps-header">
        {label && <label className="ps-label">{label}</label>}
        <span className="ps-count">
          已选 <strong>{selectedIds.length}</strong> 人
          {minCount != null && <span className="ps-min"> (至少{minCount}人)</span>}
        </span>
      </div>

      {/* Search + Quick Add */}
      <div className="ps-toolbar">
        <div className="ps-search-wrap">
          <span className="ps-search-icon">🔍</span>
          <input
            type="text"
            className="ps-search"
            placeholder="搜索玩家..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="ps-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>
        <button
          className="ps-quick-add-btn"
          onClick={() => setShowQuickAdd(!showQuickAdd)}
          title="快速添加新玩家"
        >
          + 添加
        </button>
      </div>

      {/* Quick Add Form */}
      {showQuickAdd && (
        <div className="ps-quick-add-form">
          <input
            type="text"
            className="ps-quick-add-input"
            placeholder="输入新玩家名称..."
            value={quickAddName}
            onChange={e => setQuickAddName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            autoFocus
          />
          <button
            className="ps-quick-add-confirm"
            onClick={handleQuickAdd}
            disabled={!quickAddName.trim() || adding}
          >
            {adding ? '...' : '确认添加'}
          </button>
        </div>
      )}

      {/* Player Grid */}
      <div className="ps-grid">
        {filtered.length === 0 && (
          <p className="ps-empty">
            {search ? `未找到 "${search}"` : '暂无玩家'}
          </p>
        )}
        {filtered.map(p => (
          <label
            key={p.id}
            className={`ps-player ${selectedIds.includes(p.id) ? 'ps-checked' : ''}`}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(p.id)}
              onChange={() => onToggle(p.id)}
            />
            <span className="ps-avatar">{p.avatar || '👤'}</span>
            <span className="ps-name">{p.name}</span>
          </label>
        ))}
      </div>

      {/* Select all / deselect all */}
      <div className="ps-actions">
        <button className="ps-action-btn" onClick={() => players.forEach(p => { if (!selectedIds.includes(p.id)) onToggle(p.id); })}>
          全选
        </button>
        <button className="ps-action-btn" onClick={() => selectedIds.forEach(id => onToggle(id))}>
          全不选
        </button>
      </div>
    </div>
  );
}
