import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { CHARACTERS, TYPE_COLORS, TYPE_LABELS, SCRIPTS, TRAVELLERS } from '../data/characters';
import PlayerSelector from './PlayerSelector';
import { createPlayer, createRevealSession } from '../api';
import './Grimoire.css';

const REMINDER_TOKENS = [
  { id: 'dead', label: '死亡', icon: '💀', color: '#d44' },
  { id: 'nodeath', label: '不会死亡', icon: '🛡️', color: '#4a9' },
  { id: 'drunk', label: '醉酒', icon: '🍺', color: '#c7a' },
  { id: 'poisoned', label: '中毒', icon: '☠️', color: '#9a4' },
  { id: 'noability', label: '失去能力', icon: '🔇', color: '#888' },
  { id: 'chosen', label: '被选择', icon: '👆', color: '#48c' },
  { id: 'mad', label: '疯狂', icon: '🤪', color: '#e84' },
  { id: 'good', label: '善良', icon: '😇', color: '#4a9' },
  { id: 'evil', label: '邪恶', icon: '😈', color: '#d44' },
  { id: 'used', label: '已使用', icon: '✓', color: '#888' },
  { id: 'ghost_vote', label: '投过票', icon: '👻', color: '#97c' },
  { id: 'grandchild', label: '孙子', icon: '👶', color: '#48c' },
  { id: 'custom', label: '自定义', icon: '📝', color: '#c7a' },
];

/**
 * Storyteller Grimoire — the core game-running tool.
 *
 * Props:
 *   players  — array of player objects from the group ({ id, name, emoji })
 *   scripts  — array of script objects from the group ({ id, name, characters })
 *   groupId  — current group ID
 *   onExportGame — callback receiving the finished game record
 *   onClose  — callback to close the grimoire view
 */
export default function Grimoire({ players, scripts, groupId, onExportGame, onClose, onRefreshPlayers }) {
  // Local players (can grow via quick-add)
  const [localPlayers, setLocalPlayers] = useState(players);
  // ---- Core state ----
  const [selectedScript, setSelectedScript] = useState(null);
  const [seats, setSeats] = useState([]);
  const [phase, setPhase] = useState('setup'); // 'setup' | 'day' | 'night'
  const [dayNumber, setDayNumber] = useState(0);

  // ---- UI panels ----
  const [showRolePanel, setShowRolePanel] = useState(false);
  const [assigningSeatIndex, setAssigningSeatIndex] = useState(null);
  const [showNightOrder, setShowNightOrder] = useState(false);
  const [showDemonBluffs, setShowDemonBluffs] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState(null);

  // ---- Demon bluffs ----
  const [demonBluffs, setDemonBluffs] = useState([null, null, null]);
  const [assigningBluffIndex, setAssigningBluffIndex] = useState(null);
  const [showDemonBluffsFullscreen, setShowDemonBluffsFullscreen] = useState(false);

  // ---- Game log ----
  const [log, setLog] = useState([]);

  // ---- Death reason picker ----
  const [showDeathPicker, setShowDeathPicker] = useState(false);
  const [deathSeatIndex, setDeathSeatIndex] = useState(null);
  const [customDeathReason, setCustomDeathReason] = useState('');

  // ---- Reminder tokens ----
  const [seatReminders, setSeatReminders] = useState({}); // { seatIndex: ['dead', 'drunk', 'custom:xxx', ...] }
  const [reminderSeatIndex, setReminderSeatIndex] = useState(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [customReminderText, setCustomReminderText] = useState('');

  // ---- Player management ----
  const [showPlayerManager, setShowPlayerManager] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  // ---- Circle drag-to-swap ----
  const [circleDragIdx, setCircleDragIdx] = useState(null);
  const [circleDropIdx, setCircleDropIdx] = useState(null);

  // ---- Traveller insertion ----
  const [showTravellerPanel, setShowTravellerPanel] = useState(false);
  const [travellerStep, setTravellerStep] = useState('player'); // 'player' | 'character' | 'position'
  const [travellerPlayer, setTravellerPlayer] = useState(null);
  const [travellerCharId, setTravellerCharId] = useState(null);
  const [newTravellerName, setNewTravellerName] = useState('');

  // ---- Privacy mask ----
  const [showMask, setShowMask] = useState(false);

  // ---- Role reveal code ----
  const [revealCode, setRevealCode] = useState(null);
  const [showRevealCode, setShowRevealCode] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);

  // ---- Day timer (供料计时) ----
  const [timerDuration, setTimerDuration] = useState(8 * 60); // seconds, default 8 min
  const [timerSeconds, setTimerSeconds] = useState(8 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  // Play beep sound via Web Audio API
  const playAlarm = useCallback((count = 3, freq = 880) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.4 + 0.35);
        osc.start(ctx.currentTime + i * 0.4);
        osc.stop(ctx.currentTime + i * 0.4 + 0.35);
      }
    } catch (e) { /* ignore audio errors */ }
  }, []);

  // Timer tick effect
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            clearInterval(timerRef.current);
            // Play alarm when time's up
            playAlarm(4, 880);
            return 0;
          }
          // Warning beep at 30s
          if (prev === 31) {
            playAlarm(1, 660);
          }
          // Warning beep at 10s
          if (prev === 11) {
            playAlarm(2, 770);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning, playAlarm]);

  // Auto-start timer when switching to day
  useEffect(() => {
    if (phase === 'day') {
      setTimerSeconds(timerDuration);
      setTimerRunning(true); // Auto-start
    } else {
      setTimerRunning(false);
    }
  }, [phase, dayNumber]);

  // ---- Setup: player selection ----
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);

  // ================================================================
  //  LocalStorage persistence — survive refresh / disconnect
  // ================================================================
  const STORAGE_KEY = `grimoire_state_${groupId}`;
  const hasRestoredRef = useRef(false);

  // Restore state from localStorage on mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.seats && saved.seats.length > 0) {
        setSeats(saved.seats);
        setSelectedScript(saved.selectedScript || null);
        setPhase(saved.phase || 'setup');
        setDayNumber(saved.dayNumber || 0);
        setDemonBluffs(saved.demonBluffs || [null, null, null]);
        setLog(saved.log || []);
        setSeatReminders(saved.seatReminders || {});
        if (saved.selectedPlayerIds) setSelectedPlayerIds(saved.selectedPlayerIds);
        console.log('[Grimoire] Restored saved game state');
      }
    } catch (e) {
      console.warn('[Grimoire] Failed to restore state:', e);
    }
  }, []);

  // Auto-save on every state change (debounced via layout)
  useEffect(() => {
    if (!hasRestoredRef.current) return; // Don't save during initial mount
    if (seats.length === 0 && phase === 'setup') return; // Nothing to save
    try {
      const toSave = {
        selectedScript,
        seats,
        phase,
        dayNumber,
        demonBluffs,
        log,
        seatReminders,
        selectedPlayerIds,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[Grimoire] Failed to save state:', e);
    }
  }, [selectedScript, seats, phase, dayNumber, demonBluffs, log, seatReminders]);

  // Clear saved state helper
  const clearSavedState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Grimoire] Cleared saved game state');
  }, [STORAGE_KEY]);

  // ----------------------------------------------------------------
  //  Available scripts: merge group scripts + built-in SCRIPTS
  // ----------------------------------------------------------------
  const allScripts = useMemo(() => {
    const builtInList = Object.values(SCRIPTS || {});
    const merged = [];
    const usedBuiltIn = new Set();

    // First, process API scripts — enrich with built-in characters if empty
    for (const s of (scripts || [])) {
      const match = builtInList.find(b =>
        s.name.includes(b.name) || s.name.includes(b.nameEn) ||
        b.name.includes(s.name) ||
        s.id === b.id
      );
      if (match && (!s.characters || s.characters.length === 0)) {
        merged.push({ ...s, characters: match.characters, _builtIn: true });
        usedBuiltIn.add(match.id);
      } else {
        merged.push({ ...s, _builtIn: false });
      }
    }

    // Add any built-in scripts not yet covered
    for (const b of builtInList) {
      if (!usedBuiltIn.has(b.id)) {
        merged.push({ ...b, _builtIn: true });
      }
    }

    return merged;
  }, [scripts]);

  // ----------------------------------------------------------------
  //  Characters available in the selected script
  // ----------------------------------------------------------------
  const scriptCharacters = useMemo(() => {
    if (!selectedScript) return [];
    const charIds = selectedScript.characters || [];
    // Parse char_meta from script (stored as JSON string in DB)
    let meta = {};
    try {
      meta = selectedScript.char_meta
        ? (typeof selectedScript.char_meta === 'string'
          ? JSON.parse(selectedScript.char_meta)
          : selectedScript.char_meta)
        : {};
    } catch { /* ignore parse errors */ }

    // Normalize an ID to try matching our CHARACTERS database
    const normalizeId = (rawId) => {
      // Strip common suffixes: CustomVER, _custom, etc.
      let id = rawId.replace(/Custom(?:VER)?$/i, '');
      // Check exact match
      if (CHARACTERS[id]) return CHARACTERS[id];
      // Try lowercase
      id = id.toLowerCase();
      if (CHARACTERS[id]) return CHARACTERS[id];
      // Try with underscores for multi-word (e.g. fortune_teller)
      id = id.replace(/\s+/g, '_');
      if (CHARACTERS[id]) return CHARACTERS[id];
      return null;
    };

    return charIds.map(id => {
      // 1. Direct match in local CHARACTERS database
      if (CHARACTERS[id]) return { ...CHARACTERS[id] };

      // 2. Try normalized match (strip CustomVER etc.)
      const normalized = normalizeId(id);

      // 3. Get metadata from imported script JSON
      const m = meta[id] || {};
      const teamMap = { townsfolk: 'townsfolk', outsider: 'outsider', minion: 'minion', demon: 'demon', fabled: 'fabled', traveler: 'traveller', traveller: 'traveller' };

      if (normalized) {
        // Merge: local data + script meta image as override
        return {
          ...normalized,
          id, // keep original ID for assignment tracking
          icon: m.image || normalized.icon, // prefer script image if available
        };
      }

      // 4. Fully custom character — use script metadata
      return {
        id,
        name: m.name || id.replace(/Custom(?:VER)?$/i, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        nameEn: '',
        type: teamMap[m.team] || 'townsfolk',
        ability: m.ability || '',
        icon: m.image || null,
        _unknown: true,
      };
    });
  }, [selectedScript]);

  const charLookup = useMemo(() => {
    const map = {};
    for (const ch of scriptCharacters) {
      map[ch.id] = ch;
    }
    // Also include travellers
    for (const ch of Object.values(TRAVELLERS)) {
      map[ch.id] = ch;
    }
    return map;
  }, [scriptCharacters]);

  const charactersByType = useMemo(() => {
    const groups = { townsfolk: [], outsider: [], minion: [], demon: [], traveller: [], fabled: [] };
    for (const ch of scriptCharacters) {
      if (groups[ch.type]) {
        groups[ch.type].push(ch);
      }
    }
    // Always include all travellers regardless of script
    groups.traveller = Object.values(TRAVELLERS);
    return groups;
  }, [scriptCharacters]);

  // Already-assigned character IDs
  const assignedCharIds = useMemo(() => {
    return new Set(seats.map(s => s.characterId).filter(Boolean));
  }, [seats]);

  // ----------------------------------------------------------------
  //  Night order (for the night-order panel)
  // ----------------------------------------------------------------
  const nightOrder = useMemo(() => {
    const isFirstNight = dayNumber === 0;
    const activeChars = seats
      .filter(s => s.characterId && s.alive)
      .map(s => charLookup[s.characterId] || CHARACTERS[s.characterId])
      .filter(Boolean);

    return activeChars
      .filter(ch => (isFirstNight ? ch.firstNight : ch.otherNights) > 0)
      .sort((a, b) => {
        const orderA = isFirstNight ? a.firstNight : a.otherNights;
        const orderB = isFirstNight ? b.firstNight : b.otherNights;
        return orderA - orderB;
      });
  }, [seats, dayNumber]);

  // ----------------------------------------------------------------
  //  Helpers
  // ----------------------------------------------------------------
  const addLog = useCallback((msg) => {
    setLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
  }, []);

  const togglePlayer = (id) => {
    setSelectedPlayerIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  // ----------------------------------------------------------------
  //  Setup: start game (populate seats)
  // ----------------------------------------------------------------
  const handleStartSetup = () => {
    if (!selectedScript || selectedPlayerIds.length < 5) return;
    // Start with empty seats — players will be on the left side of the manager
    setSeats([]);
    setPhase('setup');
    setDayNumber(0);
    addLog(`开始配置 · ${selectedScript.name} · ${selectedPlayerIds.length} 名可选玩家`);
    // Auto-open player manager so user can arrange seats
    setShowPlayerManager(true);
  };

  // ----------------------------------------------------------------
  //  BotC role distribution by player count
  // ----------------------------------------------------------------
  const ROLE_DISTRIBUTION = {
    5:  { townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
    6:  { townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
    7:  { townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
    8:  { townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
    9:  { townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
    10: { townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
    11: { townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
    12: { townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
    13: { townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
    14: { townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
    15: { townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
  };

  const [showDistribution, setShowDistribution] = useState(false);
  const [selectedCharPool, setSelectedCharPool] = useState(new Set());



  // Deselect all
  const deselectAllChars = useCallback(() => {
    setSelectedCharPool(new Set());
  }, []);

  const toggleCharInPool = (charId) => {
    setSelectedCharPool(prev => {
      const next = new Set(prev);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        // Enforce per-type limit (fabled has no limit)
        const ch = charLookup[charId];
        if (ch && ch.type !== 'fabled' && currentDistribution[ch.type] !== undefined) {
          const currentCount = [...next].filter(id => {
            const c = charLookup[id];
            return c && c.type === ch.type;
          }).length;
          if (currentCount >= currentDistribution[ch.type]) {
            return prev; // Already at limit for this type
          }
        }
        next.add(charId);
      }
      return next;
    });
  };

  // Count SELECTED characters per type (characters user picked to be "in play")
  const selectedCountByType = useMemo(() => {
    const counts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
    for (const id of selectedCharPool) {
      const ch = charLookup[id];
      if (ch && counts[ch.type] !== undefined) {
        counts[ch.type]++;
      }
    }
    return counts;
  }, [selectedCharPool, charLookup]);

  const baseDistribution = useMemo(() => {
    const count = seats.length;
    return ROLE_DISTRIBUTION[count] || ROLE_DISTRIBUTION[Math.min(count, 15)] || { townsfolk: 3, outsider: 0, minion: 1, demon: 1 };
  }, [seats.length]);

  // Custom overrides (user can +/- each type)
  const [distOverride, setDistOverride] = useState(null);

  // Effective distribution = base + overrides
  const currentDistribution = useMemo(() => {
    if (!distOverride) return baseDistribution;
    return { ...baseDistribution, ...distOverride };
  }, [baseDistribution, distOverride]);

  // Reset overrides when seat count changes
  const adjustDist = (type, delta) => {
    setDistOverride(prev => {
      const current = { ...baseDistribution, ...prev };
      const newVal = Math.max(0, (current[type] || 0) + delta);
      // Auto-adjust townsfolk to keep total = seats.length
      const nonTownsfolk = (type === 'outsider' ? newVal : current.outsider) +
                           (type === 'minion' ? newVal : current.minion) +
                           (type === 'demon' ? newVal : current.demon);
      const autoTownsfolk = type === 'townsfolk' ? newVal : Math.max(0, seats.length - nonTownsfolk);
      return {
        townsfolk: autoTownsfolk,
        outsider: type === 'outsider' ? newVal : current.outsider,
        minion: type === 'minion' ? newVal : current.minion,
        demon: type === 'demon' ? newVal : current.demon,
      };
    });
  };

  // Shuffle helper
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Mode 1: "随机配版" — auto-pick the right number of each type, SELECT only (don't assign)
  const handleAutoPickAndAssign = () => {
    if (!selectedScript || seats.length < 5) return;
    const dist = currentDistribution;
    const picked = new Set();

    for (const type of ['townsfolk', 'outsider', 'minion', 'demon']) {
      const available = shuffle(charactersByType[type] || []);
      const needed = dist[type] || 0;
      for (let i = 0; i < Math.min(needed, available.length); i++) {
        picked.add(available[i].id);
      }
    }

    setSelectedCharPool(picked);
    addLog(`随机配版：已选 ${picked.size} 个角色`);
  };

  // Mode 2: "随机发放" — take the manually selected characters and randomly assign to seats
  const handleDistributeSelected = () => {
    // Only non-fabled characters get assigned to seats
    const nonFabled = [...selectedCharPool].filter(id => {
      const ch = charLookup[id];
      return ch && ch.type !== 'fabled';
    });
    if (nonFabled.length !== seats.length || seats.length < 5) return;
    const selectedIds = shuffle(nonFabled);
    setSeats(prev => prev.map((s, i) => ({
      ...s,
      characterId: selectedIds[i] || null,
    })));
    addLog(`随机发放 ${selectedIds.length} 个已选角色`);
    setShowDistribution(false);
  };

  const handleOpenDistribution = () => {
    setShowDistribution(true);
  };

  // ----------------------------------------------------------------
  //  Role assignment
  // ----------------------------------------------------------------
  const handleSeatClick = (index) => {
    // If in setup phase and no character yet, open role panel
    if (phase === 'setup' || !seats[index].characterId) {
      setAssigningSeatIndex(index);
      setShowRolePanel(true);
      return;
    }
    // If alive → show death reason picker; if dead → revive directly
    if (seats[index].alive) {
      setDeathSeatIndex(index);
      setShowDeathPicker(true);
      return;
    }
    // Revive
    setSeats(prev => prev.map((s, i) => {
      if (i !== index) return s;
      addLog(`${s.player.name} 复活`);
      return { ...s, alive: true, deathDay: null, deathCause: null };
    }));
  };

  const DEATH_REASONS = [
    { id: 'executed', label: '被处决', icon: '⚖️' },
    { id: 'killed_night', label: '夜晚死亡', icon: '🌙' },
    { id: 'ability', label: '技能致死', icon: '✨' },
    { id: 'exiled', label: '被放逐', icon: '🚪' },
    { id: 'poisoned', label: '中毒死亡', icon: '☠️' },
    { id: 'suicide', label: '自杀', icon: '💀' },
  ];

  const confirmDeath = (reason) => {
    if (deathSeatIndex === null) return;
    const label = reason.startsWith('custom:')
      ? reason.replace('custom:', '')
      : DEATH_REASONS.find(r => r.id === reason)?.label || reason;
    setSeats(prev => prev.map((s, i) => {
      if (i !== deathSeatIndex) return s;
      addLog(`${s.player.name} 死亡（${label}）`);
      return { ...s, alive: false, deathDay: dayNumber, deathCause: reason };
    }));
    setShowDeathPicker(false);
    setDeathSeatIndex(null);
    setCustomDeathReason('');
  };
  const handleAssignRole = (charId) => {
    if (assigningSeatIndex === null) return;
    setSeats(prev => prev.map((s, i) => {
      if (i !== assigningSeatIndex) return s;
      return { ...s, characterId: charId };
    }));
    const ch = charLookup[charId] || CHARACTERS[charId];
    const seatPlayer = seats[assigningSeatIndex]?.player;
    if (ch && seatPlayer) {
      addLog(`${seatPlayer.name} → ${ch.name}`);
    }
    setShowRolePanel(false);
    setAssigningSeatIndex(null);
  };

  // ----------------------------------------------------------------
  //  Phase transitions
  // ----------------------------------------------------------------
  const handleStartDay = () => {
    const newDay = dayNumber + 1;
    setPhase('day');
    setDayNumber(newDay);
    addLog(`白天 ${newDay} 开始`);
  };

  const handleStartNight = () => {
    setPhase('night');
    addLog(`夜晚 ${dayNumber} 开始`);
  };

  const handleStartFirstNight = () => {
    setPhase('night');
    setDayNumber(1);
    addLog('夜晚 1 开始（游戏开始）');
  };

  const toggleReminder = (seatIdx, reminderId) => {
    const playerName = seats[seatIdx]?.player?.name || `座位${seatIdx + 1}`;
    const token = REMINDER_TOKENS.find(t => t.id === reminderId);
    const label = reminderId.startsWith('custom:') ? reminderId.replace('custom:', '') : (token?.label || reminderId);
    setSeatReminders(prev => {
      const current = prev[seatIdx] || [];
      const has = current.includes(reminderId);
      addLog(`${playerName} ${has ? '移除' : '添加'}标记: ${label}`);
      return {
        ...prev,
        [seatIdx]: has
          ? current.filter(r => r !== reminderId)
          : [...current, reminderId],
      };
    });
    setShowReminderPicker(false);
  };

  const aliveCount = useMemo(() => {
    return seats.filter(s => s.alive).length;
  }, [seats]);

  // ----------------------------------------------------------------
  //  Demon bluffs
  // ----------------------------------------------------------------
  const handleAssignBluff = (charId) => {
    if (assigningBluffIndex === null) return;
    const ch = charLookup[charId] || CHARACTERS[charId];
    addLog(`恶魔伪装 ${assigningBluffIndex + 1}: ${ch?.name || charId}`);
    setDemonBluffs(prev => {
      const next = [...prev];
      next[assigningBluffIndex] = charId;
      return next;
    });
    setAssigningBluffIndex(null);
  };

  // ----------------------------------------------------------------
  //  End game / export
  // ----------------------------------------------------------------
  const handleEndGame = () => {
    if (!selectedWinner) return;
    // Build grimoire log text
    const logText = log.map(l => `[${l.time}] ${l.msg}`).join('\n');
    const gameData = {
      script: selectedScript.name,
      date: new Date().toISOString().split('T')[0],
      winner: selectedWinner,
      notes: logText,
      participants: seats.map(s => {
        const ch = charLookup[s.characterId] || CHARACTERS[s.characterId];
        // survival_days: if alive at end, survived all days; if dead, died on deathDay
        const survivalDays = s.alive ? dayNumber : (s.deathDay || dayNumber);
        return {
          player_id: s.player.id,
          role_type: ch?.type || 'townsfolk',
          character_id: s.characterId || null,
          survived: s.alive,
          survival_days: survivalDays,
          final_round: s.alive, // alive on last day = in final round
        };
      }),
    };
    onExportGame?.(gameData);
    clearSavedState(); // Clear persisted state on game end
    addLog(`对局结束 · ${selectedWinner === 'good' ? '善良' : '邪恶'}阵营获胜`);
    setShowEndDialog(false);
  };

  // ================================================================
  //  Render: Script + player selection (before seats exist)
  // ================================================================
  if (seats.length === 0 && !phase) {
    return (
      <div className="grimoire">
        <div className="grimoire-setup">
          <div className="grimoire-setup-header">
            <h2 className="grimoire-title">说书人魔典 <span className="grimoire-beta-tag">Beta</span></h2>
            <p className="grimoire-subtitle">STORYTELLER GRIMOIRE</p>
            <button className="grimoire-close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="grimoire-beta-banner">
            <strong>⚠ Beta 测试中</strong> — 此功能仍在开发中，部分功能可能不完善。不会影响已有的玩家数据和对局记录。
          </div>

          {/* Step 1: Select script */}
          <div className="grimoire-setup-section">
            <label className="grimoire-label">选择剧本</label>
            <div className="grimoire-script-list">
              {allScripts.map(s => (
                <button
                  key={s.name}
                  type="button"
                  className={`grimoire-script-item ${selectedScript?.name === s.name ? 'active' : ''}`}
                  onClick={() => setSelectedScript(s)}
                >
                  <span className="grimoire-script-name">{s.name}</span>
                  <span className="grimoire-script-count">
                    {s.characters?.length || 0} 角色
                  </span>
                  {s._builtIn && <span className="grimoire-script-badge">内置</span>}
                </button>
              ))}
              {allScripts.length === 0 && (
                <p className="grimoire-empty">暂无可用剧本</p>
              )}
            </div>
          </div>

          {/* Step 2: Select players */}
          <div className="grimoire-setup-section">
            <PlayerSelector
              players={localPlayers}
              selectedIds={selectedPlayerIds}
              onToggle={togglePlayer}
              groupId={groupId}
              label="选择玩家"
              minCount={5}
              variant="dark"
              onPlayerCreated={(newPlayer) => {
                setLocalPlayers(prev => [...prev, newPlayer]);
                onRefreshPlayers?.();
              }}
            />
          </div>

          {/* Start button */}
          <button
            className="grimoire-start-btn"
            disabled={!selectedScript || selectedPlayerIds.length < 5}
            onClick={handleStartSetup}
          >
            开始配置 ({selectedPlayerIds.length} 人)
          </button>
        </div>
      </div>
    );
  }

  // ================================================================
  //  Render: Active Grimoire
  // ================================================================
  const allAssigned = seats.every(s => s.characterId);

  return (
    <div className={`grimoire grimoire-${phase}`}>
      {/* ---- Privacy Mask ---- */}
      {showMask && (
        <div className="grimoire-mask" onClick={() => setShowMask(false)}>
          <div className="mask-icon">🔒</div>
          <div className="mask-text">魔典已隐藏</div>
          <div className="mask-hint">点击任意位置解锁</div>
        </div>
      )}
      {/* ---- Phase indicator (top bar) ---- */}
      <div className="grimoire-phase-bar">
        <div className={`grimoire-phase-pill phase-${phase}`}>
          {phase === 'setup' && '⚙ 配置中'}
          {phase === 'day' && `☀ 白天 ${dayNumber}`}
          {phase === 'night' && `☽ 夜晚 ${dayNumber}`}
        </div>

        {/* Day timer */}
        {phase === 'day' && (
          <div className={`grimoire-timer ${timerSeconds === 0 ? 'timer-expired' : timerSeconds <= 60 ? 'timer-warning' : ''}`}>
            <span className="timer-display">
              {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
            </span>
            <div className="timer-controls">
              <button
                className="timer-btn"
                onClick={() => {
                  if (timerSeconds === 0) {
                    setTimerSeconds(timerDuration);
                  }
                  setTimerRunning(!timerRunning);
                }}
                title={timerRunning ? '暂停' : '开始'}
              >
                {timerRunning ? '⏸' : '▶'}
              </button>
              <button
                className="timer-btn"
                onClick={() => { setTimerRunning(false); setTimerSeconds(timerDuration); }}
                title="重置"
              >
                ↺
              </button>
              <button
                className="timer-btn timer-adjust"
                onClick={() => {
                  const newMin = Math.max(1, Math.floor(timerDuration / 60) - 1);
                  setTimerDuration(newMin * 60);
                  if (!timerRunning) setTimerSeconds(newMin * 60);
                }}
                title="减少1分钟"
              >−</button>
              <span className="timer-duration-label">{Math.floor(timerDuration / 60)}分</span>
              <button
                className="timer-btn timer-adjust"
                onClick={() => {
                  const newMin = Math.floor(timerDuration / 60) + 1;
                  setTimerDuration(newMin * 60);
                  if (!timerRunning) setTimerSeconds(newMin * 60);
                }}
                title="增加1分钟"
              >+</button>
            </div>
          </div>
        )}

        <button className="grimoire-close-btn grimoire-close-ingame" onClick={onClose} style={{ position: 'absolute', right: 12, top: 8 }}>✕</button>
      </div>

      {/* ---- Circular seating chart ---- */}
      <div className="grimoire-circle-container">
        <div className="grimoire-circle" style={{
          '--seat-size': seats.length <= 10 ? '100px' : seats.length <= 13 ? '90px' : seats.length <= 15 ? '78px' : '66px'
        }}>
          {/* Center decorative area */}
          <div className="grimoire-center">
            <div className="grimoire-center-name">{selectedScript?.name}</div>
            <div className="grimoire-center-sub">{selectedScript?.nameEn || 'CUSTOM SCRIPT'}</div>
            <div className="grimoire-center-count">{aliveCount} / {seats.length}</div>
          </div>

          {seats.map((seat, i) => {
            const seatCount = seats.length;
            const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2;
            // Dynamic radius: expand for more players
            const radius = seatCount <= 10 ? 36 : seatCount <= 13 ? 40 : seatCount <= 15 ? 43 : 45;
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);
            const ch = seat.characterId ? (charLookup[seat.characterId] || CHARACTERS[seat.characterId]) : null;

            return (
              <div
                key={seat.player.id}
                className={[
                  'seat-token',
                  !seat.alive && 'dead',
                  ch && `type-${ch.type}`,
                  circleDragIdx === i && 'seat-dragging',
                  circleDropIdx === i && circleDragIdx !== null && circleDragIdx !== i && 'seat-drop-target',
                ].filter(Boolean).join(' ')}
                style={{ left: `${x}%`, top: `${y}%` }}
                draggable
                onDragStart={(e) => {
                  setCircleDragIdx(i);
                  e.dataTransfer.effectAllowed = 'move';
                  // Set a small transparent image as drag ghost
                  const ghost = document.createElement('div');
                  ghost.style.opacity = '0';
                  document.body.appendChild(ghost);
                  e.dataTransfer.setDragImage(ghost, 0, 0);
                  setTimeout(() => document.body.removeChild(ghost), 0);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (circleDropIdx !== i) setCircleDropIdx(i);
                }}
                onDragLeave={() => {
                  if (circleDropIdx === i) setCircleDropIdx(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (circleDragIdx !== null && circleDragIdx !== i) {
                    const fromName = seats[circleDragIdx]?.player?.name;
                    const toName = seats[i]?.player?.name;
                    addLog(`座位交换: ${fromName} ↔ ${toName}`);
                    setSeats(prev => {
                      const next = [...prev];
                      [next[circleDragIdx], next[i]] = [next[i], next[circleDragIdx]];
                      return next;
                    });
                  }
                  setCircleDragIdx(null);
                  setCircleDropIdx(null);
                }}
                onDragEnd={() => {
                  setCircleDragIdx(null);
                  setCircleDropIdx(null);
                }}
                onClick={() => handleSeatClick(i)}
              >
                {/* Dead shroud overlay */}
                {!seat.alive && (
                  <div className="seat-shroud">
                    {seat.deathCause && (
                      <span className="death-cause-badge">
                        {seat.deathCause.startsWith('custom:')
                          ? '📝'
                          : (DEATH_REASONS.find(r => r.id === seat.deathCause)?.icon || '💀')
                        }
                      </span>
                    )}
                  </div>
                )}

                {/* Alive indicator dot */}
                {seat.alive && <div className="seat-alive-dot" />}

                {/* Character content */}
                {ch ? (
                  <>
                    {ch.icon ? (
                      <img className="seat-char-img" src={ch.icon} alt={ch.name} />
                    ) : (
                      <span className="seat-char-icon" style={{ color: TYPE_COLORS[ch.type] }}>
                        {ch.name?.charAt(0)}
                      </span>
                    )}
                    <span className="seat-char-name">{ch.name}</span>
                  </>
                ) : (
                  <span className="seat-empty">?</span>
                )}

                {/* Seat label bar below token */}
                <div className="seat-label">
                  <span className="seat-number">{i + 1}.</span>
                  <span className="seat-player-name">{seat.player.name}</span>
                </div>

                {/* Ghost vote token (dead players only) */}
                {!seat.alive && phase !== 'setup' && (
                  <div
                    className={`ghost-vote-token ${seat.ghostVoteUsed ? 'ghost-vote-used' : ''}`}
                    onClick={e => {
                      e.stopPropagation();
                      const newUsed = !seat.ghostVoteUsed;
                      addLog(`${seat.player.name} ${newUsed ? '使用' : '恢复'}遗言票`);
                      setSeats(prev => prev.map((s, si) =>
                        si === i ? { ...s, ghostVoteUsed: newUsed } : s
                      ));
                    }}
                    title={seat.ghostVoteUsed ? '遗言票已使用' : '点击使用遗言票'}
                  >
                    {seat.ghostVoteUsed ? '🚫' : '🗳️'}
                  </div>
                )}


                {/* Hover "+" button to add reminders (only after game starts) */}
                {phase !== 'setup' && (
                  <button
                    className="seat-reminder-btn"
                    onClick={e => { e.stopPropagation(); setReminderSeatIndex(i); setShowReminderPicker(true); }}
                    title="添加标记"
                  >
                    +
                  </button>
                )}

                {/* Reminder tokens stacked toward center (only after game starts) */}
                {phase !== 'setup' && (seatReminders[i]?.length > 0) && (() => {
                  const towardCenterX = -Math.cos(angle);
                  const towardCenterY = -Math.sin(angle);
                  return (
                    <div className="seat-reminders" onClick={e => e.stopPropagation()}>
                      {seatReminders[i].map((rid, ri) => {
                        const isCustom = rid.startsWith('custom:');
                        const token = isCustom ? null : REMINDER_TOKENS.find(t => t.id === rid);
                        const icon = isCustom ? '📝' : (token?.icon || '?');
                        const label = isCustom ? rid.replace('custom:', '') : (token?.label || rid);
                        const dist = 60 + ri * 32;
                        const tx = towardCenterX * dist;
                        const ty = towardCenterY * dist;
                        return (
                          <div
                            key={ri}
                            className="seat-reminder-token"
                            title={label}
                            style={{
                              transform: `translate(${tx - 18}px, ${ty - 18}px)`,
                              zIndex: 10 - ri,
                            }}
                            onClick={() => {
                              addLog(`${seat.player.name} 移除标记: ${label}`);
                              setSeatReminders(prev => ({
                                ...prev,
                                [i]: (prev[i] || []).filter((_, idx) => idx !== ri),
                              }));
                            }}
                          >
                            <span className="reminder-token-icon">{icon}</span>
                            <span className="reminder-token-text">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}


              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Bottom Action Bar ---- */}
      <div className="grimoire-action-bar">
        {/* Phase transition button */}
        {phase === 'setup' && allAssigned && (
          <button className="action-bar-btn action-primary" onClick={handleStartFirstNight}>
            开始游戏（夜晚）
          </button>
        )}
        {phase === 'setup' && allAssigned && (
          <button
            className={`action-bar-btn ${showRevealCode ? 'action-active' : ''}`}
            disabled={revealLoading}
            onClick={async () => {
              if (revealCode) {
                setShowRevealCode(!showRevealCode);
                return;
              }
              setRevealLoading(true);
              try {
                const result = await createRevealSession({
                  seats: seats.map(s => ({
                    player: { id: s.player.id, name: s.player.name },
                    characterId: s.characterId,
                  })),
                  scriptName: selectedScript?.name || '自定义剧本',
                });
                setRevealCode(result.code);
                setShowRevealCode(true);
                addLog(`生成抽签码: ${result.code}`);
              } catch (e) {
                console.error('Failed to create reveal session:', e);
              }
              setRevealLoading(false);
            }}
          >
            🎫 {revealCode ? '查看抽签码' : '生成抽签码'}
          </button>
        )}
        {phase === 'setup' && (
          <>
            <button
              className={`action-bar-btn ${showDistribution ? 'action-active' : ''}`}
              onClick={handleOpenDistribution}
            >
              分配角色
            </button>
          </>
        )}
        {phase !== 'setup' && (
          <button
            className={`action-bar-btn ${showDistribution ? 'action-active' : ''}`}
            onClick={() => setShowDistribution(!showDistribution)}
          >
            📜 查看配版
          </button>
        )}
        {phase === 'setup' && !allAssigned && (
          <span className="action-bar-hint">
            还需分配 {seats.filter(s => !s.characterId).length} 个角色
          </span>
        )}
        {phase === 'day' && (
          <button className="action-bar-btn action-primary" onClick={handleStartNight}>
            开始夜晚
          </button>
        )}
        {phase === 'night' && (
          <button className="action-bar-btn action-primary" onClick={handleStartDay}>
            开始白天
          </button>
        )}

        <div className="action-bar-divider" />

        {/* Secondary actions */}
        <button
          className={`action-bar-btn ${showNightOrder ? 'action-active' : ''}`}
          onClick={() => { setShowNightOrder(!showNightOrder); setShowDemonBluffs(false); }}
        >
          夜晚顺序
        </button>
        <button
          className={`action-bar-btn ${showDemonBluffs ? 'action-active' : ''}`}
          onClick={() => { setShowDemonBluffs(!showDemonBluffs); setShowNightOrder(false); }}
        >
          恶魔伪装
        </button>
        {phase === 'setup' && (
          <button
            className={`action-bar-btn ${showPlayerManager ? 'action-active' : ''}`}
            onClick={() => setShowPlayerManager(!showPlayerManager)}
          >
            管理玩家
          </button>
        )}
        <button
          className={`action-bar-btn ${showTravellerPanel ? 'action-active' : ''}`}
          onClick={() => {
            setShowTravellerPanel(!showTravellerPanel);
            setTravellerStep('player');
            setTravellerPlayer(null);
            setTravellerCharId(null);
            setNewTravellerName('');
          }}
        >
          🧳 旅行者
        </button>
        <button
          className="action-bar-btn"
          onClick={() => setShowMask(true)}
          title="隐藏魔典信息"
        >
          🔒 遮罩
        </button>
        <button
          className="action-bar-btn action-end"
          onClick={() => setShowEndDialog(true)}
        >
          结束对局
        </button>
      </div>

      {/* ---- Role Assignment Panel (slide-up) ---- */}
      {showRolePanel && (
        <div className="grimoire-panel-overlay" onClick={() => { setShowRolePanel(false); setAssigningSeatIndex(null); }}>
          <div className="grimoire-role-panel" onClick={e => e.stopPropagation()}>
            <div className="role-panel-header">
              <h3>
                分配角色
                {assigningSeatIndex !== null && seats[assigningSeatIndex] && (
                  <> — {seats[assigningSeatIndex].player.name}</>
                )}
              </h3>
              <button className="role-panel-close" onClick={() => { setShowRolePanel(false); setAssigningSeatIndex(null); }}>✕</button>
            </div>
            <div className="role-panel-content">
              {['townsfolk', 'outsider', 'minion', 'demon', 'traveller'].map(type => {
                const chars = charactersByType[type];
                if (!chars || chars.length === 0) return null;
                return (
                  <div key={type} className="role-panel-group">
                    <div className="role-panel-group-label" style={{ color: TYPE_COLORS[type] }}>
                      {TYPE_LABELS[type]}
                    </div>
                    <div className="role-panel-grid">
                      {chars.map(ch => {
                        const isAssigned = assignedCharIds.has(ch.id);
                        return (
                          <button
                            key={ch.id}
                            className={`role-panel-item ${isAssigned ? 'role-assigned' : ''}`}
                            disabled={isAssigned}
                            onClick={() => handleAssignRole(ch.id)}
                          >
                            {ch.icon ? (
                              <img className="role-item-icon" src={ch.icon} alt={ch.name} />
                            ) : (
                              <span className="role-item-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                            )}
                            <span className="role-item-name">{ch.name}</span>
                            {ch.nameEn && <span className="role-item-en">{ch.nameEn}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---- Distribution Panel (character grid) ---- */}
      {showDistribution && (
        <div className="grimoire-panel-overlay" onClick={() => setShowDistribution(false)}>
          <div className="grimoire-distribution-panel" onClick={e => e.stopPropagation()}>
            <div className="role-panel-header">
              <h3>{phase === 'setup' ? `为当前 ${seats.length} 个玩家选择角色:` : `配版查看（只读）`}</h3>
              <button className="role-panel-close" onClick={() => setShowDistribution(false)}>✕</button>
            </div>

            <div className="distribution-body">
              {/* Left: type count indicators */}
              <div className="distribution-counts">
              {phase === 'setup' && ['townsfolk', 'outsider', 'minion', 'demon'].map(type => {
                  const needed = currentDistribution[type] || 0;
                  const selected = selectedCountByType[type] || 0;
                  const enough = selected >= needed;
                  return (
                    <div key={type} className="dist-count-row" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <button
                        className="dist-adjust-btn"
                        onClick={() => adjustDist(type, -1)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', border: `1px solid ${TYPE_COLORS[type]}40`,
                          background: 'rgba(255,255,255,0.05)', color: TYPE_COLORS[type], cursor: 'pointer',
                          fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >−</button>
                      <div
                        className={`dist-count-pill ${enough ? 'enough' : 'not-enough'}`}
                        style={{ borderColor: TYPE_COLORS[type], color: TYPE_COLORS[type], minWidth: 52, textAlign: 'center' }}
                        title={`${TYPE_LABELS[type]}: 已选 ${selected} / 需要 ${needed}`}
                      >
                        {selected}/{needed}
                      </div>
                      <button
                        className="dist-adjust-btn"
                        onClick={() => adjustDist(type, 1)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', border: `1px solid ${TYPE_COLORS[type]}40`,
                          background: 'rgba(255,255,255,0.05)', color: TYPE_COLORS[type], cursor: 'pointer',
                          fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >+</button>
                    </div>
                  );
                })}
                {distOverride && (
                  <button
                    style={{
                      marginTop: 6, fontSize: '0.65rem', color: '#888', background: 'none',
                      border: '1px solid #555', borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                    }}
                    onClick={() => setDistOverride(null)}
                  >重置</button>
                )}
              </div>

              {/* Right: character grid */}
              <div className="distribution-grid">
                {['townsfolk', 'outsider', 'minion', 'demon', 'traveller', ...(charactersByType.fabled?.length ? ['fabled'] : [])].map(type => (
                  (charactersByType[type] || []).map(ch => {
                    const isSelected = selectedCharPool.has(ch.id);
                    const isAssigned = assignedCharIds.has(ch.id);
                    return (
                      <div
                        key={ch.id}
                        className={`dist-token ${isSelected ? 'selected' : 'deselected'} ${isAssigned ? 'assigned' : ''}`}
                        style={{
                          borderColor: isSelected ? TYPE_COLORS[ch.type] : 'rgba(100,80,50,0.2)',
                          boxShadow: isSelected ? `0 0 8px ${TYPE_COLORS[ch.type]}50` : 'none',
                        }}
                        title={`${ch.name} (${ch.nameEn}) — ${TYPE_LABELS[ch.type]}\n${ch.ability}`}
                        onClick={() => { if (phase === 'setup') toggleCharInPool(ch.id); }}
                        style={{ cursor: phase === 'setup' ? 'pointer' : 'default' }}
                      >
                        {ch.icon ? (
                          <img className="dist-token-img" src={ch.icon} alt={ch.name} style={{ opacity: isSelected ? 1 : 0.3 }} />
                        ) : (
                          <span className="dist-token-icon" style={{ color: isSelected ? TYPE_COLORS[ch.type] : '#666' }}>
                            {ch.name?.charAt(0)}
                          </span>
                        )}
                        <span className="dist-token-name" style={{ opacity: isSelected ? 1 : 0.4 }}>{ch.name}</span>
                        {isAssigned && <div className="dist-token-check">✓</div>}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            {phase === 'setup' && (
            <div className="distribution-actions">
              <button className="action-bar-btn action-primary" onClick={handleAutoPickAndAssign}>
                🎲 随机配版
              </button>
              {(() => {
                const nonFabledCount = [...selectedCharPool].filter(id => {
                  const ch = charLookup[id];
                  return ch && ch.type !== 'fabled';
                }).length;
                return (
                  <button className="action-bar-btn action-primary" onClick={handleDistributeSelected}
                    disabled={nonFabledCount !== seats.length}
                    style={{ opacity: nonFabledCount !== seats.length ? 0.4 : 1 }}
                  >
                    🎯 随机发放 ({nonFabledCount}/{seats.length})
                  </button>
                );
              })()}
              <button className="action-bar-btn" onClick={() => {
                setSeats(prev => prev.map(s => ({ ...s, characterId: null })));
                addLog('已重置所有角色分配');
              }}>
                重置角色
              </button>
              <button className="action-bar-btn" onClick={deselectAllChars}>
                清空选择
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Player Manager Panel (Two-Column) ---- */}
      {showPlayerManager && (
        <div className="grimoire-panel-overlay" onClick={() => setShowPlayerManager(false)}>
          <div className="player-manager-panel" onClick={e => e.stopPropagation()}>
            <div className="pm-header">
              <h3>管理玩家 ({seats.length} 人)</h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {(() => {
                  const available = localPlayers.filter(p => !seats.some(s => s.player.id === p.id));
                  return available.length > 0 && (
                    <button
                      className="pm-addall-btn"
                      onClick={() => {
                        const newSeats = available.map(p => ({ player: p, characterId: null, alive: true }));
                        setSeats(prev => [...prev, ...newSeats]);
                        addLog(`全部添加 ${available.length} 名玩家`);
                      }}
                    >
                      全部添加
                    </button>
                  );
                })()}
                {seats.length > 0 && (
                  <button
                    className="pm-reset-btn"
                    onClick={() => {
                      setSeats([]);
                      addLog('重置所有座位');
                    }}
                  >
                    全部移出
                  </button>
                )}
                <button className="modal-close" onClick={() => setShowPlayerManager(false)}>✕</button>
              </div>
            </div>

            <div className="pm-columns">
              {/* Left: Available players */}
              <div className="pm-col pm-col-left">
                <div className="pm-col-title">可选玩家</div>
                <div className="pm-available-list">
                  {localPlayers.filter(p => !seats.some(s => s.player.id === p.id)).map(p => (
                    <div
                      key={p.id}
                      className="pm-available-item"
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData('playerId', p.id);
                        e.dataTransfer.setData('source', 'available');
                      }}
                      onClick={() => {
                        setSeats(prev => [...prev, { player: p, characterId: null, alive: true }]);
                        addLog(`添加玩家 ${p.name}`);
                      }}
                    >
                      <span className="pm-add-icon">+</span>
                      <span>{p.name}</span>
                    </div>
                  ))}
                  {localPlayers.filter(p => !seats.some(s => s.player.id === p.id)).length === 0 && (
                    <div className="pm-empty">所有玩家已添加</div>
                  )}
                </div>
                <form
                  className="pm-create-form"
                  onSubmit={async e => {
                    e.preventDefault();
                    const input = e.target.elements.newPlayerName;
                    const name = input.value.trim();
                    if (!name) return;
                    try {
                      const result = await createPlayer({ name, group_id: groupId });
                      const newPlayer = result.player;
                      setLocalPlayers(prev => [...prev, newPlayer]);
                      setSeats(prev => [...prev, { player: newPlayer, characterId: null, alive: true }]);
                      addLog(`创建并添加玩家 ${name}`);
                      input.value = '';
                    } catch (err) {
                      console.error('Failed to create player:', err);
                    }
                  }}
                >
                  <input name="newPlayerName" type="text" placeholder="新玩家..." className="pm-create-input" />
                  <button type="submit" className="pm-create-btn">+</button>
                </form>
              </div>

              {/* Right: Current seat order */}
              <div
                className="pm-col pm-col-right"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  const playerId = e.dataTransfer.getData('playerId');
                  const source = e.dataTransfer.getData('source');
                  if (source === 'available' && playerId) {
                    const player = localPlayers.find(p => p.id === playerId);
                    if (player && !seats.some(s => s.player.id === playerId)) {
                      setSeats(prev => [...prev, { player, characterId: null, alive: true }]);
                      addLog(`添加玩家 ${player.name}`);
                    }
                  }
                }}
              >
                <div className="pm-col-title">座位顺序 <span className="pm-hint">（拖拽排序）</span></div>
                <div className="pm-seat-list">
                  {seats.map((seat, si) => (
                    <div
                      key={seat.player.id}
                      draggable
                      onDragStart={() => setDragIndex(si)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.stopPropagation();
                        // Handle drop from available list at specific position
                        const playerId = e.dataTransfer.getData('playerId');
                        const source = e.dataTransfer.getData('source');
                        if (source === 'available' && playerId) {
                          const player = localPlayers.find(p => p.id === playerId);
                          if (player && !seats.some(s => s.player.id === playerId)) {
                            setSeats(prev => {
                              const next = [...prev];
                              next.splice(si, 0, { player, characterId: null, alive: true });
                              return next;
                            });
                            addLog(`添加玩家 ${player.name} (位置 ${si + 1})`);
                          }
                          return;
                        }
                        // Handle reorder within seats
                        if (dragIndex === null || dragIndex === si) return;
                        setSeats(prev => {
                          const next = [...prev];
                          const [moved] = next.splice(dragIndex, 1);
                          next.splice(si, 0, moved);
                          return next;
                        });
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={`pm-seat-item ${dragIndex === si ? 'pm-seat-dragging' : ''}`}
                    >
                      <span className="pm-drag-handle">☰</span>
                      <span className="pm-seat-num">{si + 1}</span>
                      <span className="pm-seat-name">{seat.player.name}</span>
                      <button
                        className="pm-remove-btn"
                        title="移除"
                        onClick={e => {
                          e.stopPropagation();
                          setSeats(prev => prev.filter((_, idx) => idx !== si));
                          addLog(`移除玩家 ${seat.player.name}`);
                        }}
                      >✕</button>
                    </div>
                  ))}
                  {seats.length === 0 && (
                    <div className="pm-empty">← 从左侧拖拽或点击添加玩家</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Traveller Insertion Panel ---- */}
      {showTravellerPanel && (
        <div className="grimoire-panel-overlay" onClick={() => setShowTravellerPanel(false)}>
          <div className="reminder-picker" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="reminder-picker-header">
              <h3>🧳 添加旅行者</h3>
              <button className="modal-close" onClick={() => setShowTravellerPanel(false)}>✕</button>
            </div>

            {/* Step 1: Select or create player */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.75rem', color: '#a09080', marginBottom: 8 }}>
                第一步：选择玩家 {travellerPlayer && `✓ ${travellerPlayer.name}`}
              </div>
              {!travellerPlayer && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {localPlayers.filter(p => !seats.some(s => s.player.id === p.id)).map(p => (
                      <button
                        key={p.id}
                        style={{
                          padding: '5px 14px', borderRadius: 8, fontSize: '0.8rem',
                          background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                          color: '#c4a0ff', cursor: 'pointer',
                        }}
                        onClick={() => { setTravellerPlayer(p); setTravellerStep('character'); }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <form style={{ display: 'flex', gap: 6 }} onSubmit={async e => {
                    e.preventDefault();
                    const name = newTravellerName.trim();
                    if (!name) return;
                    try {
                      const result = await createPlayer({ name, group_id: groupId });
                      const np = result.player;
                      setLocalPlayers(prev => [...prev, np]);
                      setTravellerPlayer(np);
                      setTravellerStep('character');
                      setNewTravellerName('');
                    } catch (err) { console.error(err); }
                  }}>
                    <input
                      type="text" value={newTravellerName}
                      onChange={e => setNewTravellerName(e.target.value)}
                      placeholder="或输入新玩家名..."
                      className="reminder-custom-field" style={{ flex: 1 }}
                    />
                    <button type="submit" className="reminder-custom-add">创建</button>
                  </form>
                </>
              )}
            </div>

            {/* Step 2: Select traveller character */}
            {travellerPlayer && !travellerCharId && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', color: '#a09080', marginBottom: 8 }}>
                  第二步：选择旅行者角色
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
                  {Object.values(TRAVELLERS).map(ch => (
                    <button
                      key={ch.id}
                      style={{
                        padding: '8px', borderRadius: 8, fontSize: '0.78rem', textAlign: 'left',
                        background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
                        color: '#d4c0a8', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                      title={ch.ability}
                      onClick={() => { setTravellerCharId(ch.id); setTravellerStep('position'); }}
                    >
                      <span style={{ color: '#c4a0ff', fontWeight: 600 }}>{ch.name}</span>
                      <span style={{ fontSize: '0.65rem', color: '#888' }}>{ch.nameEn}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Pick insertion position */}
            {travellerPlayer && travellerCharId && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#a09080', marginBottom: 8 }}>
                  第三步：选择插入位置（点击两个玩家之间的位置）
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Insert at beginning */}
                  <button
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem',
                      background: 'rgba(124,58,237,0.15)', border: '1px dashed rgba(124,58,237,0.4)',
                      color: '#c4a0ff', cursor: 'pointer', textAlign: 'center',
                    }}
                    onClick={() => {
                      setSeats(prev => {
                        const newSeat = { player: travellerPlayer, characterId: travellerCharId, alive: true };
                        return [newSeat, ...prev];
                      });
                      addLog(`旅行者 ${travellerPlayer.name} 加入（${TRAVELLERS[travellerCharId]?.name}）· 位置 1`);
                      setShowTravellerPanel(false);
                    }}
                  >
                    ↑ 插入到最前面
                  </button>
                  {seats.map((seat, si) => (
                    <div key={seat.player.id}>
                      <div style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: '0.8rem',
                        background: 'rgba(255,255,255,0.04)', color: '#d4c0a8',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ color: '#888', minWidth: 20 }}>{si + 1}.</span>
                        <span>{seat.player.name}</span>
                        {seat.characterId && (
                          <span style={{ fontSize: '0.65rem', color: '#888', marginLeft: 'auto' }}>
                            {charLookup[seat.characterId]?.name || seat.characterId}
                          </span>
                        )}
                      </div>
                      <button
                        style={{
                          width: '100%', padding: '4px 12px', borderRadius: 6, fontSize: '0.7rem',
                          background: 'rgba(124,58,237,0.08)', border: '1px dashed rgba(124,58,237,0.3)',
                          color: '#a080d0', cursor: 'pointer', textAlign: 'center', marginTop: 2,
                        }}
                        onClick={() => {
                          setSeats(prev => {
                            const newSeat = { player: travellerPlayer, characterId: travellerCharId, alive: true };
                            const next = [...prev];
                            next.splice(si + 1, 0, newSeat);
                            return next;
                          });
                          addLog(`旅行者 ${travellerPlayer.name} 加入（${TRAVELLERS[travellerCharId]?.name}）· 位置 ${si + 2}`);
                          setShowTravellerPanel(false);
                        }}
                      >
                        ↓ 插入此处
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reset / back button */}
            {travellerPlayer && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button
                  className="action-bar-btn"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => {
                    if (travellerCharId) { setTravellerCharId(null); setTravellerStep('character'); }
                    else { setTravellerPlayer(null); setTravellerStep('player'); }
                  }}
                >
                  ← 返回上一步
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Reveal Code Display ---- */}
      {showRevealCode && revealCode && (
        <div className="grimoire-panel-overlay" onClick={() => setShowRevealCode(false)}>
          <div className="reveal-code-display" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#d4b878', margin: '0 0 8px' }}>🎫 角色抽签码</h3>
            <p style={{ fontSize: '0.8rem', color: '#8a7a5a', margin: '0 0 20px' }}>
              将此代码分享给玩家，玩家访问同一网站后点击"🔮 抽取角色"
            </p>
            <div style={{
              fontSize: '3rem', fontWeight: 700, letterSpacing: '0.3em',
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              color: '#d4b878', padding: '16px 32px', borderRadius: 16,
              background: 'rgba(212,184,120,0.1)', border: '2px solid rgba(212,184,120,0.3)',
              marginBottom: 20, textAlign: 'center',
              textShadow: '0 2px 12px rgba(212,184,120,0.3)',
            }}>
              {revealCode}
            </div>
            <button
              className="action-bar-btn"
              style={{ margin: '0 auto', display: 'block' }}
              onClick={() => {
                navigator.clipboard?.writeText(revealCode);
              }}
            >
              📋 复制代码
            </button>
            <button
              className="action-bar-btn"
              style={{ margin: '8px auto 0', display: 'block', fontSize: '0.75rem' }}
              onClick={() => setShowRevealCode(false)}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ---- Reminder Token Picker ---- */}
      {showReminderPicker && reminderSeatIndex !== null && (
        <div className="grimoire-panel-overlay" onClick={() => setShowReminderPicker(false)}>
          <div className="reminder-picker" onClick={e => e.stopPropagation()}>
            <div className="reminder-picker-header">
              <h3>选择备忘标记 — {seats[reminderSeatIndex]?.player?.name}</h3>
              <button className="modal-close" onClick={() => setShowReminderPicker(false)}>✕</button>
            </div>
            <div className="reminder-grid">
              {REMINDER_TOKENS.filter(t => t.id !== 'custom').map(token => {
                const isActive = (seatReminders[reminderSeatIndex] || []).includes(token.id);
                return (
                  <button
                    key={token.id}
                    className={`reminder-token ${isActive ? 'reminder-active' : ''}`}
                    style={{ '--token-color': token.color }}
                    onClick={() => toggleReminder(reminderSeatIndex, token.id)}
                  >
                    <span className="reminder-token-icon">{token.icon}</span>
                    <span className="reminder-token-label">{token.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Custom reminder input */}
            <div className="reminder-custom-input">
              <input
                type="text"
                placeholder="输入自定义标记..."
                value={customReminderText}
                onChange={e => setCustomReminderText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customReminderText.trim()) {
                    const customId = `custom:${customReminderText.trim()}`;
                    setSeatReminders(prev => ({
                      ...prev,
                      [reminderSeatIndex]: [...(prev[reminderSeatIndex] || []), customId],
                    }));
                    setCustomReminderText('');
                  }
                }}
                className="reminder-custom-field"
              />
              <button
                className="reminder-custom-add"
                disabled={!customReminderText.trim()}
                onClick={() => {
                  if (!customReminderText.trim()) return;
                  const customId = `custom:${customReminderText.trim()}`;
                  setSeatReminders(prev => ({
                    ...prev,
                    [reminderSeatIndex]: [...(prev[reminderSeatIndex] || []), customId],
                  }));
                  setCustomReminderText('');
                }}
              >
                添加
              </button>
            </div>
            {/* Show current reminders with remove option */}
            {seatReminders[reminderSeatIndex]?.length > 0 && (
              <div className="reminder-current">
                <span>当前标记：</span>
                {seatReminders[reminderSeatIndex].map((rid, ri) => {
                  const isCustom = rid.startsWith('custom:');
                  const token = isCustom ? null : REMINDER_TOKENS.find(t => t.id === rid);
                  const label = isCustom ? rid.replace('custom:', '') : (token?.label || rid);
                  const icon = isCustom ? '📝' : (token?.icon || '?');
                  return (
                    <span key={ri} className="reminder-current-tag" onClick={() => toggleReminder(reminderSeatIndex, rid)}>
                      {icon} {label} ✕
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Night Order Panel (slide-in right) ---- */}
      {showNightOrder && (
        <div className="grimoire-side-panel">
          <div className="side-panel-header">
            <h3>{dayNumber === 0 ? '首夜顺序' : '其他夜晚顺序'}</h3>
            <button className="side-panel-close" onClick={() => setShowNightOrder(false)}>✕</button>
          </div>
          <div className="side-panel-content">
            {nightOrder.length === 0 ? (
              <p className="side-panel-empty">暂无需要唤醒的角色</p>
            ) : (
              nightOrder.map((ch, i) => {
                const order = dayNumber === 0 ? ch.firstNight : ch.otherNights;
                return (
                  <div key={ch.id} className="night-order-item">
                    <span className="night-order-num">{i + 1}</span>
                    <span className="night-order-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                    <div className="night-order-info">
                      <span className="night-order-name" style={{ color: TYPE_COLORS[ch.type] }}>{ch.name}</span>
                      {ch.ability && (
                        <span className="night-order-ability">{ch.ability}</span>
                      )}
                    </div>
                    <span className="night-order-original">({order})</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ---- Demon Bluffs Panel ---- */}
      {showDemonBluffs && (
        <div className="grimoire-side-panel">
          <div className="side-panel-header">
            <h3>恶魔伪装</h3>
            <button className="side-panel-close" onClick={() => { setShowDemonBluffs(false); setAssigningBluffIndex(null); }}>✕</button>
          </div>
          <div className="side-panel-content">
            <p className="side-panel-hint">选择3个不在场的好人角色作为伪装选项</p>
            <div className="bluff-slots">
              {demonBluffs.map((bluffId, bi) => {
                const ch = bluffId ? (charLookup[bluffId] || CHARACTERS[bluffId]) : null;
                return (
                  <button
                    key={bi}
                    className={`bluff-slot ${assigningBluffIndex === bi ? 'bluff-selecting' : ''}`}
                    onClick={() => setAssigningBluffIndex(assigningBluffIndex === bi ? null : bi)}
                  >
                    {ch ? (
                      <>
                        {ch.icon ? (
                          <img className="bluff-icon" src={ch.icon} alt={ch.name} />
                        ) : (
                          <span className="bluff-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                        )}
                        <span className="bluff-name">{ch.name}</span>
                      </>
                    ) : (
                      <span className="bluff-empty">选择伪装 {bi + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {assigningBluffIndex !== null && (
              <div className="bluff-picker">
                {scriptCharacters
                  .filter(ch => ch.type === 'townsfolk' || ch.type === 'outsider')
                  .filter(ch => !assignedCharIds.has(ch.id))
                  .map(ch => (
                    <button
                      key={ch.id}
                      className="bluff-picker-item"
                      onClick={() => handleAssignBluff(ch.id)}
                    >
                      {ch.icon ? (
                        <img className="role-item-icon" src={ch.icon} alt={ch.name} />
                      ) : (
                        <span className="role-item-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                      )}
                      <span>{ch.name}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
          {demonBluffs.some(b => b) && (
            <button
              className="bluff-fullscreen-btn"
              onClick={() => { setShowDemonBluffsFullscreen(true); setShowDemonBluffs(false); }}
            >
              📺 全屏展示给恶魔
            </button>
          )}
        </div>
      )}

      {/* ---- Death Reason Picker ---- */}
      {showDeathPicker && deathSeatIndex !== null && (
        <div className="grimoire-panel-overlay" onClick={() => { setShowDeathPicker(false); setDeathSeatIndex(null); }}>
          <div className="death-picker-panel" onClick={e => e.stopPropagation()}>
            <h3 className="death-picker-title">
              💀 {seats[deathSeatIndex]?.player?.name} — 死亡原因
            </h3>
            <div className="death-picker-options">
              {DEATH_REASONS.map(r => (
                <button
                  key={r.id}
                  className="death-option-btn"
                  onClick={() => confirmDeath(r.id)}
                >
                  <span className="death-option-icon">{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
            <div className="death-custom-row">
              <input
                type="text"
                className="death-custom-input"
                placeholder="自定义原因..."
                value={customDeathReason}
                onChange={e => setCustomDeathReason(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customDeathReason.trim()) {
                    confirmDeath(`custom:${customDeathReason.trim()}`);
                  }
                }}
              />
              <button
                className="death-custom-confirm"
                disabled={!customDeathReason.trim()}
                onClick={() => confirmDeath(`custom:${customDeathReason.trim()}`)}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Demon Bluffs Fullscreen Display ---- */}
      {showDemonBluffsFullscreen && (
        <div className="demon-bluffs-fullscreen" onClick={() => setShowDemonBluffsFullscreen(false)}>
          <div className="dbf-header">恶魔伪装</div>
          <div className="dbf-subtitle">以下角色不在场，你可以声称自己是其中之一</div>
          <div className="dbf-cards">
            {demonBluffs.map((bluffId, bi) => {
              const ch = bluffId ? (charLookup[bluffId] || CHARACTERS[bluffId]) : null;
              if (!ch) return null;
              return (
                <div key={bi} className="dbf-card">
                  <div className="dbf-card-icon" style={{
                    borderColor: TYPE_COLORS[ch.type] || '#d4b878',
                    boxShadow: `0 0 24px ${TYPE_COLORS[ch.type]}40`,
                  }}>
                    {ch.icon ? (
                      <img src={ch.icon} alt={ch.name} className="dbf-card-img" />
                    ) : (
                      <span className="dbf-card-letter" style={{ color: TYPE_COLORS[ch.type] }}>
                        {ch.name?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="dbf-card-name">{ch.name}</div>
                  <div className="dbf-card-en">{ch.nameEn}</div>
                  <div className="dbf-card-type" style={{ color: TYPE_COLORS[ch.type] }}>
                    {TYPE_LABELS[ch.type]}
                  </div>
                  <div className="dbf-card-ability">{ch.ability}</div>
                </div>
              );
            })}
          </div>
          <div className="dbf-hint">点击任意位置关闭</div>
        </div>
      )}
      {showEndDialog && (
        <div className="grimoire-panel-overlay" onClick={() => setShowEndDialog(false)}>
          <div className="grimoire-end-dialog" onClick={e => e.stopPropagation()}>
            <h3>结束对局</h3>
            <p className="end-dialog-hint">选择获胜阵营</p>
            <div className="end-dialog-options">
              <button
                className={`end-option ${selectedWinner === 'good' ? 'end-option-active end-good' : ''}`}
                onClick={() => setSelectedWinner('good')}
              >
                善良阵营
              </button>
              <button
                className={`end-option ${selectedWinner === 'evil' ? 'end-option-active end-evil' : ''}`}
                onClick={() => setSelectedWinner('evil')}
              >
                邪恶阵营
              </button>
            </div>
            <div className="end-dialog-actions">
              <button className="btn-ghost" onClick={() => setShowEndDialog(false)}>取消</button>
              <button
                className="btn-close-grimoire"
                onClick={() => {
                  clearSavedState();
                  addLog('对局取消 — 关闭魔典');
                  setShowEndDialog(false);
                  onClose();
                }}
              >
                关闭魔典
              </button>
              <button
                className="btn-primary"
                disabled={!selectedWinner}
                onClick={handleEndGame}
              >
                确认结束
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Game Log (collapsible at bottom-right) ---- */}
      {log.length > 0 && (
        <details className="grimoire-log">
          <summary className="grimoire-log-toggle">日志 ({log.length})</summary>
          <div className="grimoire-log-content">
            {log.slice().reverse().map((entry, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{entry.time}</span>
                <span className="log-msg">{entry.msg}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
