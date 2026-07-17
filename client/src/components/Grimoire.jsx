import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from 'react';

import { CHARACTERS, TYPE_COLORS, TYPE_LABELS, SCRIPTS, TRAVELLERS } from '../data/characters';
import PlayerSelector from './PlayerSelector';
import { createPlayer, createRevealSession, getRevealSession, sitRevealSeat, unseatRevealSeat, syncRevealSession } from '../api';
import './Grimoire.css';

const REMINDER_TOKENS = [
  // ---- 状态类 ----
  { id: 'dead', label: '死亡', icon: '💀', color: '#d44' },
  { id: 'alive_protected', label: '被保护', icon: '🛡️', color: '#4a9' },
  { id: 'drunk', label: '是酒鬼', icon: '🍺', color: '#c7a' },
  { id: 'poisoned', label: '中毒', icon: '☠️', color: '#9a4' },
  { id: 'mad', label: '疯狂', icon: '🤪', color: '#e84' },
  { id: 'noability', label: '失去能力', icon: '🔇', color: '#888' },
  // ---- 身份标记 ----
  { id: 'is_drunk', label: '是真酒鬼', icon: '🍻', color: '#d4a' },
  { id: 'is_redhering', label: '是干扰项', icon: '🐟', color: '#e65' },
  { id: 'is_evil_twin', label: '邪恶双胞胎', icon: '👥', color: '#d44' },
  { id: 'is_good_twin', label: '善良双胞胎', icon: '👥', color: '#4a9' },
  { id: 'is_mastermind', label: '幕后主使', icon: '🎭', color: '#a4d' },
  // ---- 阵营标记 ----
  { id: 'good', label: '善良', icon: '😇', color: '#4a9' },
  { id: 'evil', label: '邪恶', icon: '😈', color: '#d44' },
  { id: 'changed_alignment', label: '阵营转变', icon: '🔄', color: '#da4' },
  // ---- 能力/行动类 ----
  { id: 'chosen', label: '被选择', icon: '👆', color: '#48c' },
  { id: 'attacked', label: '被攻击', icon: '⚔️', color: '#d44' },
  { id: 'nominated', label: '被提名', icon: '📢', color: '#c84' },
  { id: 'executed', label: '被处决', icon: '⚖️', color: '#a44' },
  { id: 'protected', label: '被僧侣保护', icon: '✝️', color: '#4a9' },
  { id: 'poisoner_target', label: '中毒目标', icon: '🧪', color: '#9a4' },
  { id: 'slayer_used', label: '杀手已用', icon: '🔫', color: '#888' },
  { id: 'used', label: '已使用能力', icon: '✓', color: '#888' },
  // ---- 夜间信息类 ----
  { id: 'woke', label: '今晚醒来', icon: '👁️', color: '#48c' },
  { id: 'sees_wrong', label: '得到错误信息', icon: '❌', color: '#d44' },
  { id: 'sees_right', label: '得到正确信息', icon: '✅', color: '#4a9' },
  { id: 'fortune_teller_red', label: '占卜师干扰项', icon: '🔮', color: '#e65' },
  // ---- 投票/死亡类 ----
  { id: 'ghost_vote', label: '已投幽灵票', icon: '👻', color: '#97c' },
  { id: 'about_to_die', label: '即将死亡', icon: '💔', color: '#d44' },
  { id: 'cannot_die', label: '不会死亡', icon: '♾️', color: '#4a9' },
  { id: 'cannot_vote', label: '不能投票', icon: '🚫', color: '#888' },
  // ---- 特殊角色标记 ----
  { id: 'grandchild', label: '孙子', icon: '👶', color: '#48c' },
  { id: 'demon_info', label: '恶魔已知', icon: '🔥', color: '#d44' },
  { id: 'minion_info', label: '爪牙已知', icon: '🦇', color: '#a4d' },
  { id: 'lunatic_target', label: '疯子目标', icon: '🌙', color: '#97c' },
  // ---- 通用 ----
  { id: 'custom', label: '自定义', icon: '📝', color: '#c7a' },
];

// ---- Default info board templates per character ----
// value: null means a placeholder to fill; value: string means preset text
const INFO_BOARD_TEMPLATES = {
  // ---- Trouble Brewing ----
  washerwoman:  [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null}, {type:'text',value:'其中一位是'}, {type:'character',value:null} ],
  librarian:    [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null}, {type:'text',value:'其中一位是'}, {type:'character',value:null} ],
  investigator: [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null}, {type:'text',value:'其中一位是'}, {type:'character',value:null} ],
  chef:         [ {type:'text',value:'你得知'}, {type:'number',value:null}, {type:'text',value:'对'} ],
  empath:       [ {type:'text',value:'你得知'}, {type:'number',value:null} ],
  fortune_teller:[ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null}, {type:'text',value:'得知'} ],
  undertaker:   [ {type:'text',value:'你得知被处决的是'}, {type:'character',value:null} ],
  monk:         [ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  ravenkeeper:  [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'得知'}, {type:'character',value:null} ],
  butler:       [ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  spy:          [ {type:'text',value:'查看魔典'} ],
  godfather:    [ {type:'text',value:'你得知外来者是'}, {type:'character',value:null} ],

  // ---- Bad Moon Rising ----
  grandmother:  [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'是善良的'} ],
  sailor:       [ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  chambermaid:  [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null}, {type:'text',value:'得知'}, {type:'number',value:null} ],
  exorcist:     [ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  innkeeper:    [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null} ],
  gambler:      [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'是'}, {type:'character',value:null} ],
  courtier:     [ {type:'text',value:'你选择'}, {type:'character',value:null} ],
  professor:    [ {type:'text',value:'你选择'}, {type:'player',value:null} ],

  // ---- Sects & Violets ----
  clockmaker:   [ {type:'text',value:'你得知'}, {type:'number',value:null} ],
  dreamer:      [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'得知'}, {type:'character',value:null}, {type:'text',value:'或'}, {type:'character',value:null} ],
  snake_charmer:[ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  mathematician:[ {type:'text',value:'你得知'}, {type:'number',value:null} ],
  flowergirl:   [ {type:'text',value:'你得知'} ],
  town_crier:   [ {type:'text',value:'你得知'} ],
  oracle:       [ {type:'text',value:'你得知'}, {type:'number',value:null} ],
  savant:       [ {type:'text',value:'你得知'} ],
  seamstress:   [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null}, {type:'text',value:'得知'} ],
  philosopher:  [ {type:'text',value:'你选择'}, {type:'character',value:null} ],
  juggler:      [ {type:'text',value:'你得知'}, {type:'number',value:null} ],
  sage:         [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null}, {type:'text',value:'其中一位是恶魔'} ],
  evil_twin:    [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'是你的双胞胎'} ],
  cerenovus:    [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'被疯狂成'}, {type:'character',value:null} ],
  witch:        [ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  pit_hag:      [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'变为'}, {type:'character',value:null} ],

  // ---- Experimental ----
  balloonist:   [ {type:'text',value:'你得知'}, {type:'player',value:null} ],
  bounty_hunter:[ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'是邪恶的'} ],
  choirboy:     [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'是恶魔'} ],
  general:      [ {type:'text',value:'你得知'} ],
  knight:       [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'和'}, {type:'player',value:null}, {type:'text',value:'不是恶魔'} ],
  nightwatchman:[ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  pixie:        [ {type:'text',value:'你得知'}, {type:'character',value:null} ],
  king:         [ {type:'text',value:'你得知'}, {type:'character',value:null} ],
  widow:        [ {type:'text',value:'查看魔典'}, {type:'text',value:'你选择'}, {type:'player',value:null} ],
  alchemist:    [ {type:'text',value:'你是'}, {type:'character',value:null} ],
  cannibal:     [ {type:'text',value:'你获得了'}, {type:'character',value:null}, {type:'text',value:'的能力'} ],
  farmer:       [ {type:'text',value:'你是农夫'} ],
  lycanthrope:  [ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  huntsman:     [ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  preacher:     [ {type:'text',value:'你选择'}, {type:'player',value:null} ],
  fearmonger:   [ {type:'text',value:'你选择'}, {type:'player',value:null} ],

  // ---- Custom: 计划全部泡汤 ----
  qintianjian:  [ {type:'text',value:'你得知'} ],
  village_idiot:[ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'得知'} ],
  joker:        [ {type:'text',value:'你选择'}, {type:'player',value:null}, {type:'text',value:'得知'} ],
  gudiao:       [ {type:'text',value:'你得知'}, {type:'player',value:null}, {type:'text',value:'是'}, {type:'character',value:null} ],
  yaggababble:  [ {type:'text',value:'你的秘密短语是'} ],
  rulianshi:    [ {type:'text',value:'你是'}, {type:'character',value:null} ],
};

// Helper: look up template by ID, with fallback stripping CustomVER/Diy suffixes
function getInfoBoardTemplate(charId) {
  if (!charId) return null;
  if (INFO_BOARD_TEMPLATES[charId]) return INFO_BOARD_TEMPLATES[charId];
  // Strip common custom suffixes
  const normalized = charId.replace(/Custom(?:VER)?(?:Diy)?$/i, '');
  if (normalized !== charId && INFO_BOARD_TEMPLATES[normalized]) return INFO_BOARD_TEMPLATES[normalized];
  return null;
}

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

  // ---- Circle drag-to-swap (desktop) + tap-to-swap (iPad) ----
  const [circleDragIdx, setCircleDragIdx] = useState(null);
  const [circleDropIdx, setCircleDropIdx] = useState(null);
  const [swapSelectIdx, setSwapSelectIdx] = useState(null); // tap-to-swap: first selected seat

  // ---- Traveller insertion ----
  const [showTravellerPanel, setShowTravellerPanel] = useState(false);
  const [travellerStep, setTravellerStep] = useState('player'); // 'player' | 'character' | 'position'
  const [travellerPlayer, setTravellerPlayer] = useState(null);
  const [travellerCharId, setTravellerCharId] = useState(null);
  const [newTravellerName, setNewTravellerName] = useState('');

  // ---- Privacy mask ----
  const [showMask, setShowMask] = useState(false);

  // ---- Perceived identity (deception characters) ----
  const [showPerceivedPicker, setShowPerceivedPicker] = useState(false);
  const [perceivedSeatIndex, setPerceivedSeatIndex] = useState(null);
  // ---- Tap-triggered seat action menu (iPad compatible) ----
  const [activeSeatMenu, setActiveSeatMenu] = useState(null); // seat index or null

  // ---- Role reveal code ----
  const [revealCode, setRevealCode] = useState(null);
  const [showRevealCode, setShowRevealCode] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [perceivedWarning, setPerceivedWarning] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);

  // ---- Info Board (告知版) ----
  const [infoBoardSeat, setInfoBoardSeat] = useState(null); // { seatIdx, character }
  const [infoBoardItems, setInfoBoardItems] = useState([]); // [{type: 'text'|'player'|'character'|'number', value: '...'}]
  const [infoBoardPresenting, setInfoBoardPresenting] = useState(false);
  const [infoBoardTab, setInfoBoardTab] = useState(null); // index of item being edited, or null
  const [showInfoBoardPicker, setShowInfoBoardPicker] = useState(false); // standalone info board player picker

  // ---- Nomination / Voting ----
  const [nomination, setNomination] = useState(null); // { nominator: idx, nominee: idx, votes: Set<idx>, step: 'nominee'|'voting' }
  const [onTheBlock, setOnTheBlock] = useState(null); // { seatIdx, votes, nominator }
  const [nominationsToday, setNominationsToday] = useState([]); // [{nominator, nominee, votes, count}]

  // ---- Top-right dropdown menu ----
  const [showMenu, setShowMenu] = useState(false);
  const [revealSession, setRevealSession] = useState(null);
  const [manualSeatIdx, setManualSeatIdx] = useState(null); // storyteller manual seat assignment
  const revealPollRef = useRef(null);

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
      setNominationsToday([]);
      setOnTheBlock(null);
      setNomination(null);
    } else {
      setTimerRunning(false);
    }
  }, [phase, dayNumber]);

  // ---- Setup: player selection ----
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [playerCount, setPlayerCount] = useState(7);
  // ================================================================
  //  Lock body scroll while Grimoire is open
  // ================================================================
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevBg = document.body.style.background;
    document.body.style.overflow = 'hidden';
    document.body.style.background = '#1a1d23';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.background = prevBg;
    };
  }, []);

  // ================================================================
  //  LocalStorage persistence — survive refresh / disconnect
  // ================================================================
  const STORAGE_KEY = `grimoire_state_${groupId}`;
  const hasRestoredRef = useRef(false);
  const closedRef = useRef(false);  // Prevents auto-save after intentional close

  // Restore state from localStorage on mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      // Try main key first, fall back to backup
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) raw = localStorage.getItem(STORAGE_KEY + '_backup');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.seats && saved.seats.length > 0) {
        // Check staleness — if saved > 6 hours ago, clear and start fresh
        if (saved.savedAt) {
          const savedTime = new Date(saved.savedAt).getTime();
          const hoursAgo = (Date.now() - savedTime) / (1000 * 60 * 60);
          if (hoursAgo > 6) {
            console.log(`[Grimoire] Saved state is ${hoursAgo.toFixed(1)}h old — clearing`);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_KEY + '_backup');
            localStorage.removeItem(STORAGE_KEY + '_log');
            return;
          }
        }
        // Clean up legacy fake reveal_N IDs
        const cleanedSeats = saved.seats.map(s => {
          if (s.player?.id && typeof s.player.id === 'string' && s.player.id.startsWith('reveal_')) {
            return { ...s, player: { ...s.player, id: null } };
          }
          return s;
        });
        setSeats(cleanedSeats);
        setSelectedScript(saved.selectedScript || null);
        setPhase(saved.phase || 'setup');
        setDayNumber(saved.dayNumber || 0);
        setDemonBluffs(saved.demonBluffs || [null, null, null]);
        // Restore log: prefer saved.log, fall back to separate _log key
        let restoredLog = saved.log || [];
        try {
          const logRaw = localStorage.getItem(STORAGE_KEY + '_log');
          if (logRaw) {
            const logParsed = JSON.parse(logRaw);
            // Use whichever has more entries
            if (Array.isArray(logParsed) && logParsed.length > restoredLog.length) {
              restoredLog = logParsed;
            }
          }
        } catch { /* ignore log parse error */ }
        setLog(restoredLog);
        setSeatReminders(saved.seatReminders || {});
        if (saved.selectedPlayerIds) setSelectedPlayerIds(saved.selectedPlayerIds);
        console.log(`[Grimoire] Restored saved game state (${restoredLog.length} log entries)`);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[Grimoire] Failed to restore state:', e);
      // Don't remove — try to recover on next load
    }
  }, []);

  // Auto-save on every state change — save as much as possible
  useEffect(() => {
    if (!hasRestoredRef.current) return;
    if (closedRef.current) return;  // Don't re-save after intentional close
    if (seats.length === 0) return;
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
      const json = JSON.stringify(toSave);
      localStorage.setItem(STORAGE_KEY, json);
      localStorage.setItem(STORAGE_KEY + '_backup', json);
      // Always save log separately — never lose it
      localStorage.setItem(STORAGE_KEY + '_log', JSON.stringify(log));
    } catch (e) {
      console.warn('[Grimoire] Failed to save full state:', e);
      // Even if full save fails, ALWAYS try to save the log
      try {
        localStorage.setItem(STORAGE_KEY + '_log', JSON.stringify(log));
      } catch { /* truly out of space */ }
      try {
        const minimal = {
          selectedScript: selectedScript ? { name: selectedScript.name, id: selectedScript.id } : null,
          seats: seats.map(s => ({
            player: s.player ? { id: s.player.id, name: s.player.name } : null,
            characterId: s.characterId,
            alive: s.alive,
            deathDay: s.deathDay,
          })),
          phase,
          dayNumber,
          demonBluffs,
          log,  // ALL logs — never truncate
          seatReminders,
          savedAt: new Date().toISOString(),
          _minimal: true,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
        localStorage.setItem(STORAGE_KEY + '_backup', JSON.stringify(minimal));
      } catch (e2) {
        console.error('[Grimoire] Even minimal save failed:', e2);
      }
    }
  }, [selectedScript, seats, phase, dayNumber, demonBluffs, log, seatReminders, selectedPlayerIds]);

  // Clear saved state helper — keeps backup
  const clearSavedState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    // Backup is intentionally NOT removed — can be recovered if needed
    console.log('[Grimoire] Cleared saved game state (backup preserved)');
  }, [STORAGE_KEY]);

  // ================================================================
  //  Poll reveal session for real-time seat status
  // ================================================================
  useEffect(() => {
    if (!revealCode || phase !== 'setup') return;
    const poll = async () => {
      try {
        const data = await getRevealSession(revealCode);
        setRevealSession(data);
        // When all seated, update grimoire seats with player info
        if (data.allSeated) {
          // Collect unmatched player names to create
          const unmatchedNames = [];
          for (const seatInfo of data.seats) {
            if (!seatInfo?.playerName) continue;
            const name = seatInfo.playerName.trim();
            const match = localPlayers.find(p =>
              p.name === name || p.name.trim().toLowerCase() === name.toLowerCase()
            );
            if (!match) unmatchedNames.push(name);
          }

          // Auto-create unmatched players in the database
          const newPlayers = [];
          for (const name of [...new Set(unmatchedNames)]) {
            try {
              const result = await createPlayer({ name, group_id: groupId });
              newPlayers.push(result.player);
            } catch (err) {
              console.warn(`[Reveal] Failed to create player "${name}":`, err);
              newPlayers.push({ id: null, name });
            }
          }
          if (newPlayers.length > 0) {
            setLocalPlayers(prev => [...prev, ...newPlayers.filter(p => p.id)]);
          }

          // Now match all seats — both existing and newly created players
          const allPlayers = [...localPlayers, ...newPlayers.filter(p => p.id)];
          setSeats(prev => prev.map((seat, i) => {
            const seatInfo = data.seats[i];
            if (seatInfo?.playerName && (!seat.player || seat.player.name !== seatInfo.playerName)) {
              const name = seatInfo.playerName.trim();
              const matched = allPlayers.find(p =>
                p.name === name || p.name.trim().toLowerCase() === name.toLowerCase()
              );
              return {
                ...seat,
                player: matched || { id: null, name },
              };
            }
            return seat;
          }));
          addLog(`所有玩家已入座 (${data.seatedCount}/${data.totalSeats})`);
          if (newPlayers.length > 0) {
            addLog(`自动创建 ${newPlayers.filter(p => p.id).length} 名新玩家: ${newPlayers.filter(p => p.id).map(p => p.name).join('、')}`);
          }
          clearInterval(revealPollRef.current);
          revealPollRef.current = null;
        }
      } catch (e) {
        // session expired
      }
    };
    poll();
    revealPollRef.current = setInterval(poll, 3000);
    return () => { if (revealPollRef.current) clearInterval(revealPollRef.current); };
  }, [revealCode, phase]);

  // Push live seat names and alive status to the server reveal session (never sending true character ID)
  useEffect(() => {
    if (!revealCode || !seats || seats.length === 0) return;
    const payload = seats.map((s, i) => ({
      seatIndex: i,
      playerName: s.player?.name || `座位${i + 1}`,
      alive: s.alive !== false,
      deathDay: s.deathDay != null ? s.deathDay : null,
      deathCause: s.deathCause || null,
    }));
    syncRevealSession(revealCode, payload).catch(() => {});
  }, [revealCode, seats]);

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
        // Merge: local data + script meta overrides (JSON name takes priority)
        return {
          ...normalized,
          id, // keep original ID for assignment tracking
          name: m.name || normalized.name,
          ability: m.ability || normalized.ability,
          icon: m.image || normalized.icon,
          firstNight: m.firstNight || 0,
          otherNight: m.otherNight || 0,
          firstNightReminder: m.firstNightReminder || '',
          otherNightReminder: m.otherNightReminder || '',
          reminders: m.reminders || [],
          remindersGlobal: m.remindersGlobal || [],
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
        firstNight: m.firstNight || 0,
        otherNight: m.otherNight || 0,
        firstNightReminder: m.firstNightReminder || '',
        otherNightReminder: m.otherNightReminder || '',
        reminders: m.reminders || [],
        remindersGlobal: m.remindersGlobal || [],
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

  // Build dynamic reminder tokens from custom script character reminders
  const scriptReminderTokens = useMemo(() => {
    const tokens = [];
    const seen = new Set();
    for (const ch of scriptCharacters) {
      const allReminders = [
        ...(ch.reminders || []).map(r => ({ text: r, global: false })),
        ...(ch.remindersGlobal || []).map(r => ({ text: r, global: true })),
      ];
      for (const { text, global } of allReminders) {
        const key = `${ch.id}::${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tokens.push({
          id: `script:${ch.id}:${text}`,
          label: text,
          charName: ch.name,
          charIcon: ch.icon,
          charId: ch.id,
          global,
        });
      }
    }
    return tokens;
  }, [scriptCharacters]);

  // Already-assigned character IDs
  const assignedCharIds = useMemo(() => {
    return new Set(seats.map(s => s.characterId).filter(Boolean));
  }, [seats]);

  // Night order badges: ranked positions among in-play characters
  const nightOrderBadges = useMemo(() => {
    // Map charId -> char data from charLookup
    const inPlay = seats
      .filter(s => s.characterId)
      .map(s => ({ charId: s.characterId, ch: charLookup[s.characterId] }))
      .filter(x => x.ch);

    // First night: sort by firstNight value (> 0 only), assign rank
    const firstNighters = inPlay
      .filter(x => x.ch.firstNight > 0)
      .sort((a, b) => a.ch.firstNight - b.ch.firstNight);
    const firstNightMap = {};
    firstNighters.forEach((x, i) => {
      firstNightMap[x.charId] = {
        rank: i + 1,
        reminder: x.ch.firstNightReminder || '',
      };
    });

    // Other night: sort by otherNight value (> 0 only), assign rank
    const otherNighters = inPlay
      .filter(x => x.ch.otherNight > 0)
      .sort((a, b) => a.ch.otherNight - b.ch.otherNight);
    const otherNightMap = {};
    otherNighters.forEach((x, i) => {
      otherNightMap[x.charId] = {
        rank: i + 1,
        reminder: x.ch.otherNightReminder || '',
      };
    });

    return { firstNight: firstNightMap, otherNight: otherNightMap };
  }, [seats, charLookup]);

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
    if (!selectedScript || playerCount < 5) return;
    // Clear any old saved state
    clearSavedState();
    // Create numbered seats without players
    const newSeats = Array.from({ length: playerCount }, (_, i) => ({
      player: null,
      characterId: null,
      alive: true,
    }));
    setSeats(newSeats);
    setPhase('setup');
    setDayNumber(0);
    addLog(`开始配置 · ${selectedScript.name} · ${playerCount} 人`);
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
  // Map<charId, count> — supports duplicate characters
  const [selectedCharPool, setSelectedCharPool] = useState(new Map());
  const [allowDuplicates, setAllowDuplicates] = useState(false);


  // Deselect all
  const deselectAllChars = useCallback(() => {
    setSelectedCharPool(new Map());
  }, []);

  const toggleCharInPool = (charId) => {
    setSelectedCharPool(prev => {
      const next = new Map(prev);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        // Enforce per-type limit (fabled has no limit)
        const ch = charLookup[charId];
        if (ch && ch.type !== 'fabled' && currentDistribution[ch.type] !== undefined) {
          let currentCount = 0;
          for (const [id, cnt] of next) {
            const c = charLookup[id];
            if (c && c.type === ch.type) currentCount += cnt;
          }
          if (currentCount >= currentDistribution[ch.type]) {
            return prev;
          }
        }
        next.set(charId, 1);
      }
      return next;
    });
  };

  const adjustCharCount = (charId, delta) => {
    setSelectedCharPool(prev => {
      const next = new Map(prev);
      const current = next.get(charId) || 0;
      const newCount = current + delta;
      if (newCount <= 0) {
        next.delete(charId);
      } else {
        // Check type limit
        const ch = charLookup[charId];
        if (ch && ch.type !== 'fabled' && currentDistribution[ch.type] !== undefined && delta > 0) {
          let typeTotal = 0;
          for (const [id, cnt] of next) {
            const c = charLookup[id];
            if (c && c.type === ch.type) typeTotal += cnt;
          }
          // typeTotal already includes the old count for this char
          if (typeTotal - current + newCount > currentDistribution[ch.type]) {
            return prev;
          }
        }
        next.set(charId, newCount);
      }
      return next;
    });
  };

  // Helper: expand pool map to array of IDs (with duplicates)
  const expandPool = useCallback((pool) => {
    const result = [];
    for (const [id, count] of pool) {
      for (let i = 0; i < count; i++) result.push(id);
    }
    return result;
  }, []);

  // Count SELECTED characters per type (characters user picked to be "in play")
  const selectedCountByType = useMemo(() => {
    const counts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
    for (const [id, cnt] of selectedCharPool) {
      const ch = charLookup[id];
      if (ch && counts[ch.type] !== undefined) {
        counts[ch.type] += cnt;
      }
    }
    return counts;
  }, [selectedCharPool, charLookup]);

  const baseDistribution = useMemo(() => {
    const count = seats.length;
    return ROLE_DISTRIBUTION[count] || ROLE_DISTRIBUTION[Math.min(count, 15)] || { townsfolk: 3, outsider: 0, minion: 1, demon: 1 };
  }, [seats.length]);

  const [distOverride, setDistOverride] = useState(null);
  const currentDistribution = distOverride || baseDistribution;

  const adjustDist = (type, delta) => {
    setDistOverride(prev => {
      const base = prev || { ...baseDistribution };
      return { ...base, [type]: Math.max(0, (base[type] || 0) + delta) };
    });
  };

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
    const picked = new Map();

    for (const type of ['townsfolk', 'outsider', 'minion', 'demon']) {
      const available = shuffle(charactersByType[type] || []);
      const needed = dist[type] || 0;
      for (let i = 0; i < Math.min(needed, available.length); i++) {
        picked.set(available[i].id, 1);
      }
    }

    setSelectedCharPool(picked);
    let total = 0;
    for (const cnt of picked.values()) total += cnt;
    addLog(`随机配版：已选 ${total} 个角色`);
  };

  // Mode 2: "随机发放" — take the manually selected characters and randomly assign to seats
  const handleDistributeSelected = () => {
    // Only non-fabled characters get assigned to seats
    const allIds = expandPool(selectedCharPool);
    const nonFabled = allIds.filter(id => {
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
  const handleSeatClick = (index, event) => {
    // If no character yet, open role panel
    if (!seats[index].characterId) {
      setAssigningSeatIndex(index);
      setShowRolePanel(true);
      return;
    }

    // During setup: open role panel to reassign
    if (phase === 'setup') {
      setAssigningSeatIndex(index);
      setShowRolePanel(true);
      return;
    }

    // During game: detect top/bottom half click on the seat token
    const rect = event.currentTarget.getBoundingClientRect();
    const clickY = event.clientY - rect.top;
    const isBottomHalf = clickY > rect.height * 0.5;

    if (isBottomHalf) {
      // Bottom half → change character
      setAssigningSeatIndex(index);
      setShowRolePanel(true);
      return;
    }

    // Top half → death/revive
    if (seats[index].alive) {
      setDeathSeatIndex(index);
      setShowDeathPicker(true);
      return;
    }
    // Revive
    setSeats(prev => prev.map((s, i) => {
      if (i !== index) return s;
      addLog(`${s.player?.name || `座位${index+1}`} 复活`);
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
      addLog(`${s.player?.name || `座位${deathSeatIndex+1}`} 死亡（${label}）`);
      return { ...s, alive: false, deathDay: dayNumber, deathCause: reason };
    }));
    setShowDeathPicker(false);
    setDeathSeatIndex(null);
    setCustomDeathReason('');
  };
  const handleAssignRole = (charId) => {
    if (assigningSeatIndex === null) return;
    const oldCharId = seats[assigningSeatIndex]?.characterId;
    const oldCh = oldCharId ? (charLookup[oldCharId] || CHARACTERS[oldCharId]) : null;
    setSeats(prev => prev.map((s, i) => {
      if (i !== assigningSeatIndex) return s;
      return { ...s, characterId: charId };
    }));
    const ch = charLookup[charId] || CHARACTERS[charId];
    const seatPlayer = seats[assigningSeatIndex]?.player;
    if (ch && seatPlayer) {
      if (oldCh && phase !== 'setup') {
        addLog(`${seatPlayer.name} 角色变更: ${oldCh.name} → ${ch.name}`);
      } else {
        addLog(`${seatPlayer.name} → ${ch.name}`);
      }
    }
    setShowRolePanel(false);
    setAssigningSeatIndex(null);
  };

  const handleAssignPerceived = (charId) => {
    if (perceivedSeatIndex === null) return;
    setSeats(prev => prev.map((s, i) => {
      if (i !== perceivedSeatIndex) return s;
      return { ...s, perceivedCharId: charId };
    }));
    const ch = charLookup[charId] || CHARACTERS[charId];
    const seatPlayer = seats[perceivedSeatIndex]?.player;
    if (ch && seatPlayer) {
      addLog(`${seatPlayer.name} 认为自己是: ${ch.name}`);
    }
    setShowPerceivedPicker(false);
    setPerceivedSeatIndex(null);
  };

  const clearPerceived = (seatIdx) => {
    setSeats(prev => prev.map((s, i) => {
      if (i !== seatIdx) return s;
      const { perceivedCharId, ...rest } = s;
      return rest;
    }));
    addLog(`${seats[seatIdx]?.player?.name || `座位${seatIdx+1}`} 认知身份已清除`);
    setShowPerceivedPicker(false);
    setPerceivedSeatIndex(null);
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
    // Log initial setup
    addLog('══ 初始配置 ══');
    seats.forEach((s, i) => {
      const ch = s.characterId ? (charLookup[s.characterId] || CHARACTERS[s.characterId]) : null;
      const perceived = s.perceivedCharId ? (charLookup[s.perceivedCharId] || CHARACTERS[s.perceivedCharId]) : null;
      const name = s.player?.name || `座位${i + 1}`;
      let line = `${i + 1}. ${name} → ${ch?.name || '未分配'}`;
      if (perceived && s.perceivedCharId !== s.characterId) {
        line += ` (认为自己是${perceived.name})`;
      }
      const tokens = seatReminders[i] || [];
      if (tokens.length > 0) {
        const tokenNames = tokens.map(tid => {
          if (tid.startsWith('custom:')) return tid.replace('custom:', '');
          if (tid.startsWith('script:')) return tid.split(':').slice(2).join(':');
          const tk = REMINDER_TOKENS.find(t => t.id === tid);
          return tk?.label || tid;
        });
        line += ` [${tokenNames.join(', ')}]`;
      }
      addLog(line);
    });
    if (demonBluffs.some(b => b)) {
      const bluffNames = demonBluffs.filter(b => b).map(b => { const c = charLookup[b] || CHARACTERS[b]; return c?.name || b; }).join('、');
      addLog(`恶魔伪装: ${bluffNames}`);
    }
    addLog('══════════');
    setPhase('night');
    setDayNumber(1);
    addLog('夜晚 1 开始');
  };

  const toggleReminder = (seatIdx, reminderId) => {
    const playerName = seats[seatIdx]?.player?.name || `座位${seatIdx + 1}`;
    const token = REMINDER_TOKENS.find(t => t.id === reminderId);
    let label;
    if (reminderId.startsWith('custom:')) label = reminderId.replace('custom:', '');
    else if (reminderId.startsWith('script:')) label = reminderId.split(':').slice(2).join(':');
    else label = token?.label || reminderId;
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
    try {
      // Build grimoire log text — include end-game entry manually since addLog is async
      const endMsg = `对局结束 · ${selectedWinner === 'good' ? '善良' : '邪恶'}阵营获胜`;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const allLogs = [...log, { time: timeStr, msg: endMsg }];
      const logText = allLogs.map(l => `[${l.time}] ${l.msg}`).join('\n');
      addLog(endMsg);
      const gameData = {
        script: selectedScript?.name || '未知剧本',
        date: new Date().toISOString().split('T')[0],
        winner: selectedWinner,
        notes: logText,
        participants: seats
          .filter(s => s.player?.id && !(typeof s.player.id === 'string' && s.player.id.startsWith('reveal_')))
          .map(s => {
            const ch = charLookup[s.characterId] || CHARACTERS[s.characterId];
            const survivalDays = s.alive ? dayNumber : (s.deathDay || dayNumber);
            return {
              player_id: s.player.id,
              role_type: ch?.type || 'townsfolk',
              character_id: s.characterId || null,
              survived: s.alive,
              survival_days: survivalDays,
              final_round: s.alive,
            };
          }),
      };
      onExportGame?.(gameData);
      clearSavedState();
    } catch (e) {
      console.error('[Grimoire] handleEndGame error — state preserved:', e);
      // Don't clear saved state on error — data can be recovered
    }
    setShowEndDialog(false);
  };

  // ================================================================
  //  Render: Script + player selection (before seats exist)
  // ================================================================
  if (seats.length === 0) {
    return (
      <div className="grimoire">
        <div className="grimoire-setup-form">
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

          {/* Step 2: Select player count */}
          <div className="grimoire-setup-section">
            <label className="grimoire-label">选择玩家人数</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {[5,6,7,8,9,10,11,12,13,14,15].map(n => (
                <button
                  key={n}
                  type="button"
                  style={{
                    width: 44, height: 44, borderRadius: 10,
                    border: playerCount === n ? '2px solid #d4b878' : '1px solid rgba(100,80,50,0.3)',
                    background: playerCount === n ? 'rgba(212,184,120,0.2)' : 'rgba(255,255,255,0.04)',
                    color: playerCount === n ? '#d4b878' : '#8a7a5a',
                    fontSize: '1rem', fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => setPlayerCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            {/* Role distribution preview */}
            {selectedScript && ROLE_DISTRIBUTION[playerCount] && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                fontSize: '0.75rem', color: '#8a7a5a',
                display: 'flex', gap: 12,
              }}>
                <span>👼 镇民 {ROLE_DISTRIBUTION[playerCount].townsfolk}</span>
                <span>🤷 外来者 {ROLE_DISTRIBUTION[playerCount].outsider}</span>
                <span>🦹 爪牙 {ROLE_DISTRIBUTION[playerCount].minion}</span>
                <span>😈 恶魔 {ROLE_DISTRIBUTION[playerCount].demon}</span>
              </div>
            )}
          </div>

          {/* Start button */}
          <button
            className="grimoire-start-btn"
            disabled={!selectedScript || playerCount < 5}
            onClick={handleStartSetup}
          >
            开始配置 ({playerCount} 人)
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
    <div className={`grimoire grimoire-${phase}${showMask ? ' grimoire-masked' : ''}`}>
      {/* ---- Privacy Mask overlay — click to unlock ---- */}
      {showMask && (
        <div className="grimoire-mask-overlay" onClick={() => setShowMask(false)}>
          <div className="mask-icon">🔒</div>
          <div className="mask-hint">点击解锁</div>
        </div>
      )}
      {/* ---- Floating controls (no topbar) ---- */}
      {/* Close button — top-right corner */}
      <button className="grimoire-float-close" onClick={() => {
        closedRef.current = true;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY + '_backup');
        localStorage.removeItem(STORAGE_KEY + '_log');
        onClose();
      }}>✕</button>

      {/* Gear menu — top-right, next to close */}
      {phase !== 'setup' && (
        <div className="grimoire-float-gear">
          <button className="topbar-menu-btn" onClick={() => setShowMenu(!showMenu)}>⚙</button>
          {showMenu && (
            <div className="topbar-dropdown">
              <button className="dropdown-item" onClick={() => { setShowDistribution(!showDistribution); setShowMenu(false); }}>
                📜 查看配版
              </button>
              <button className="dropdown-item" onClick={() => { setShowNightOrder(!showNightOrder); setShowMenu(false); }}>
                🌃 夜晚顺序
              </button>
              <button className="dropdown-item" onClick={() => { setShowDemonBluffs(true); setShowMenu(false); }}>
                🎭 恶魔伪装
              </button>
              <button className="dropdown-item" onClick={() => {
                setShowTravellerPanel(!showTravellerPanel);
                setTravellerStep('player');
                setTravellerPlayer(null);
                setTravellerCharId(null);
                setNewTravellerName('');
                setShowMenu(false);
              }}>
                🧳 旅行者
              </button>
              <button className="dropdown-item" onClick={() => { setShowMask(true); setShowMenu(false); }}>
                🔒 遮罩
              </button>

              <div className="dropdown-divider" />

              <button className="dropdown-item dropdown-danger" onClick={() => { setShowEndDialog(true); setShowMenu(false); }}>
                ⛔ 结束对局
              </button>
            </div>
          )}
        </div>
      )}

      {/* Day timer — top center floating */}
      {phase === 'day' && (
        <div className={`grimoire-timer grimoire-timer-float ${timerSeconds === 0 ? 'timer-expired' : timerSeconds <= 60 ? 'timer-warning' : ''}`}>
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

      {/* Phase transition — bottom-center prominent pill */}
      {phase === 'day' && (
        <div className="day-action-bar">
          {(onTheBlock || nominationsToday.length > 0) && (
            <div className="nom-history-wrapper">
              <div
                className={`on-the-block-badge ${onTheBlock?.tied ? 'on-the-block-tied' : ''}`}
                onClick={() => {
                  const el = document.querySelector('.nom-history-dropdown');
                  if (el) el.classList.toggle('nom-history-open');
                }}
              >
                {onTheBlock
                  ? onTheBlock.tied
                    ? `⚖️ 平票 (${onTheBlock.votes}票) — 无人处决`
                    : `⚖️ ${seats[onTheBlock.seatIdx]?.player?.name || `座位${onTheBlock.seatIdx + 1}`} (${onTheBlock.votes}票)`
                  : `📋 提名 (${nominationsToday.length})`
                }
              </div>
              <div className="nom-history-dropdown">
                <div className="nom-history-title">今日提名</div>
                {nominationsToday.length === 0 ? (
                  <div className="nom-history-empty">暂无提名</div>
                ) : (
                  nominationsToday.map((n, ni) => {
                    const getName = (idx) => seats[idx]?.player?.name || `座位${idx + 1}`;
                    const threshold = Math.ceil(seats.filter(s => s.alive).length / 2);
                    const passed = n.count >= threshold;
                    return (
                      <div key={ni} className={`nom-history-item ${passed ? 'nom-history-passed' : ''}`}>
                        <span className="nom-history-who">
                          {getName(n.nominator)} → {getName(n.nominee)}
                        </span>
                        <span className={`nom-history-votes ${passed ? 'nom-history-votes-pass' : ''}`}>
                          {n.count}票 {passed ? '✓' : '✗'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          <button className="phase-transition-btn phase-nominate-btn" onClick={() => {
            setNomination({ step: 'nominator', nominator: null, nominee: null, votes: new Set() });
          }}>⚖ 提名</button>
          <button className="phase-transition-btn phase-night-btn" onClick={handleStartNight}>
            🌙 进入夜晚
          </button>
        </div>
      )}
      {phase === 'night' && (
        <button className="phase-transition-btn phase-day-btn" onClick={handleStartDay}>
          ☀ 进入白天
        </button>
      )}

      {/* ---- Nomination Panel ---- */}
      {nomination && (() => {
        const aliveCount = seats.filter(s => s.alive).length;
        const threshold = Math.ceil(aliveCount / 2);
        const getName = (idx) => seats[idx]?.player?.name || `座位${idx + 1}`;

        return (
          <div className="grimoire-panel-overlay" onClick={() => setNomination(null)}>
            <div className="nomination-panel" onClick={e => e.stopPropagation()}>

              {/* Step 1: Select nominator */}
              {nomination.step === 'nominator' && (
                <>
                  <h3 className="nom-title">⚖ 谁发起提名？</h3>
                  <div className="nom-player-grid">
                    {seats.map((s, si) => {
                      const isDead = !s.alive;
                      const alreadyNominated = nominationsToday.some(n => n.nominator === si);
                      const disabled = isDead || alreadyNominated;
                      return (
                        <button
                          key={si}
                          className={`nom-player-btn ${disabled ? 'nom-used' : ''}`}
                          disabled={disabled}
                          onClick={() => setNomination(prev => ({ ...prev, step: 'nominee', nominator: si }))}
                        >
                          <span className="nom-seat-num">{si + 1}</span>
                          {getName(si)}
                          {isDead && <span className="nom-ghost-tag">👻</span>}
                          {alreadyNominated && <span className="nom-used-tag">已提名</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Step 2: Select nominee */}
              {nomination.step === 'nominee' && (
                <>
                  <h3 className="nom-title">
                    {getName(nomination.nominator)} 提名谁？
                  </h3>
                  <div className="nom-player-grid">
                    {seats.map((s, si) => {
                      const alreadyTarget = nominationsToday.some(n => n.nominee === si);
                      const isDead = !s.alive;
                      return (
                        <button
                          key={si}
                          className={`nom-player-btn ${alreadyTarget ? 'nom-used' : ''} ${isDead ? 'nom-dead' : ''}`}
                          disabled={alreadyTarget}
                          onClick={() => setNomination(prev => ({ ...prev, step: 'voting', nominee: si, votes: new Set() }))}
                        >
                          <span className="nom-seat-num">{si + 1}</span>
                          {getName(si)}
                          {isDead && <span className="nom-ghost-tag">👻</span>}
                          {alreadyTarget && <span className="nom-used-tag">已被提名</span>}
                        </button>
                      );
                    })}
                  </div>
                  <button className="nom-btn-cancel" style={{ marginTop: 8 }} onClick={() => setNomination(prev => ({ ...prev, step: 'nominator', nominator: null }))}>← 返回</button>
                </>
              )}

              {/* Step 3: Voting */}
              {nomination.step === 'voting' && (
                <>
                  <h3 className="nom-title">
                    {getName(nomination.nominator)} 提名 <strong>{getName(nomination.nominee)}</strong>
                  </h3>
                  <div className="nom-threshold">
                    票数 <strong className="nom-vote-count">{nomination.votes.size}</strong> / 需要 <strong>{threshold}</strong>
                    {nomination.votes.size >= threshold && <span className="nom-pass"> ✓ 通过</span>}
                  </div>
                  <div className="nom-player-grid">
                    {seats.map((s, si) => {
                      const hasVoted = nomination.votes.has(si);
                      const isDead = !s.alive;
                      const ghostUsed = isDead && s.ghostVoteUsed === true;
                      const disabled = ghostUsed && !hasVoted;
                      return (
                        <button
                          key={si}
                          className={`nom-player-btn nom-vote-btn ${hasVoted ? 'nom-voted' : ''} ${isDead ? 'nom-dead' : ''} ${disabled ? 'nom-used' : ''}`}
                          disabled={disabled}
                          onClick={() => {
                            setNomination(prev => {
                              const newVotes = new Set(prev.votes);
                              if (newVotes.has(si)) newVotes.delete(si);
                              else newVotes.add(si);
                              return { ...prev, votes: newVotes };
                            });
                          }}
                        >
                          <span className="nom-seat-num">{si + 1}</span>
                          {getName(si)}
                          {isDead && <span className="nom-ghost-tag">👻</span>}
                          {ghostUsed && !hasVoted && <span className="nom-used-tag">已用</span>}
                          {hasVoted && <span className="nom-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="nom-actions">
                    <button className="nom-btn-cancel" onClick={() => setNomination(prev => ({ ...prev, step: 'nominee', votes: new Set() }))}>← 返回</button>
                    <button className="nom-btn-confirm" onClick={() => {
                      const voteCount = nomination.votes.size;
                      const nomName = getName(nomination.nominee);
                      const nominatorName = getName(nomination.nominator);
                      addLog(`${nominatorName} 提名 ${nomName}: ${voteCount}票 (需${threshold}) ${voteCount >= threshold ? '→ 通过' : '→ 未通过'}`);
                      
                      // Track nomination
                      setNominationsToday(prev => [...prev, {
                        nominator: nomination.nominator,
                        nominee: nomination.nominee,
                        votes: [...nomination.votes],
                        count: voteCount,
                      }]);

                      // Update on-the-block: tie = no execution
                      if (voteCount >= threshold) {
                        if (!onTheBlock || voteCount > onTheBlock.votes) {
                          setOnTheBlock({ seatIdx: nomination.nominee, votes: voteCount, tied: false });
                        } else if (voteCount === onTheBlock.votes) {
                          setOnTheBlock(prev => ({ ...prev, tied: true }));
                        }
                      }

                      // Mark ghost votes used
                      nomination.votes.forEach(si => {
                        if (!seats[si].alive) {
                          setSeats(prev => prev.map((s, i) => i === si ? { ...s, ghostVoteUsed: true } : s));
                        }
                      });

                      setNomination(null);
                    }}>✓ 记录 ({nomination.votes.size}票)</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ---- Setup phase: Bottom bar with all actions ---- */}
      {phase === 'setup' && (
        <div className="setup-bottombar">
          <button
            className={`bottombar-btn bottombar-close ${confirmExit ? 'confirm-exit-active' : ''}`}
            onClick={() => {
              if (confirmExit) {
                closedRef.current = true;
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(STORAGE_KEY + '_backup');
                localStorage.removeItem(STORAGE_KEY + '_log');
                onClose();
              } else {
                setConfirmExit(true);
                setTimeout(() => setConfirmExit(false), 3000);
              }
            }}
          >{confirmExit ? '⚠ 确认退出？' : '✕ 退出'}</button>
          <button className="bottombar-btn bottombar-primary" onClick={handleOpenDistribution}>🎭 分配角色</button>
          {allAssigned && (
            <button className="bottombar-btn bottombar-shuffle" onClick={() => {
              const n = seats.length;
              const shift = 1 + Math.floor(Math.random() * (n - 1)); // 1 to n-1
              setSeats(prev => {
                const charIds = prev.map(s => s.characterId);
                const perceived = prev.map(s => s.perceivedCharId);
                const reminders = prev.map(s => s.reminders);
                return prev.map((s, i) => ({
                  ...s,
                  characterId: charIds[(i - shift + n) % n],
                  perceivedCharId: perceived[(i - shift + n) % n],
                  reminders: reminders[(i - shift + n) % n],
                }));
              });
              // Also rotate seatReminders (blue/red tokens)
              setSeatReminders(prev => {
                const newReminders = {};
                for (let i = 0; i < n; i++) {
                  const srcIdx = (i - shift + n) % n;
                  if (prev[srcIdx]) newReminders[i] = prev[srcIdx];
                }
                return newReminders;
              });
              addLog(`角色随机旋转 ${shift} 位`);
            }}>🔄 随机旋转</button>
          )}
          {allAssigned && (
            <button
              className="bottombar-btn bottombar-primary"
              disabled={revealLoading}
              onClick={async () => {
                if (revealCode) {
                  setShowRevealCode(!showRevealCode);
                  return;
                }
                const PERCEIVED_IDS = ['drunk', 'marionette', 'lunatic', 'hermit', 'wudaozhe'];
                const PERCEIVED_NAMES = ['酒鬼', '提线木偶', '疯子', '悟道者'];
                const missing = seats
                  .map((s, idx) => {
                    if (!s.characterId) return null;
                    const sch = charLookup[s.characterId] || CHARACTERS[s.characterId];
                    const cid = s.characterId.toLowerCase();
                    const needs = PERCEIVED_IDS.some(pid => cid === pid || cid.startsWith(pid))
                      || (sch && PERCEIVED_NAMES.some(pn => sch.name === pn));
                    return needs && !s.perceivedCharId ? { idx, name: sch?.name || s.characterId, player: s.player?.name || `座位${idx+1}` } : null;
                  })
                  .filter(Boolean);
                if (missing.length > 0) {
                  setPerceivedWarning(missing);
                  return;
                }
                setRevealLoading(true);
                try {
                  const result = await createRevealSession({
                    seats: seats.map(s => {
                      const revealId = s.perceivedCharId || s.characterId;
                      const ch = charLookup[revealId] || CHARACTERS[revealId];
                      return {
                        characterId: revealId,
                        characterName: ch?.name || revealId,
                        characterNameEn: ch?.nameEn || '',
                        characterIcon: ch?.icon || '',
                        characterAbility: ch?.ability || '',
                        characterType: ch?.type || 'townsfolk',
                      };
                    }),
                    scriptName: selectedScript?.name || '自定义剧本',
                    players: localPlayers.map(p => ({ id: p.id, name: p.name })),
                  });
                  setRevealCode(result.code);
                  setShowRevealCode(true);
                  addLog(`生成抽取码: ${result.code}`);
                } catch (e) {
                  console.error('Failed to create reveal session:', e);
                }
                setRevealLoading(false);
              }}
            >
              🎫 {revealCode ? '查看抽取码' : '生成抽取码'}
            </button>
          )}
          {allAssigned && seats.every(s => s.player) && (
            <button className="bottombar-btn bottombar-start" onClick={handleStartFirstNight}>
              🌙 开始游戏
            </button>
          )}
          <button className="bottombar-btn" onClick={() => setShowDemonBluffs(true)}>🎭 恶魔伪装</button>
          <button className="bottombar-btn" onClick={() => setShowNightOrder(!showNightOrder)}>🌃 夜晚顺序</button>
          <button className="bottombar-btn" onClick={() => {
            setShowTravellerPanel(!showTravellerPanel);
            setTravellerStep('player');
            setTravellerPlayer(null);
            setTravellerCharId(null);
            setNewTravellerName('');
          }}>🧳 旅行者</button>
          <button className="bottombar-btn" onClick={() => setShowMask(true)}>🔒 遮罩</button>
        </div>
      )}

      {/* ---- Top-left: Script composition info ---- */}
      <div className="grimoire-comp-info">
        <div className="comp-script-name">{selectedScript?.name}</div>
        <div className="comp-type-row">
          {(() => {
            const counts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
            seats.forEach(s => {
              const ch = s.characterId ? (charLookup[s.characterId] || CHARACTERS[s.characterId]) : null;
              if (ch && counts[ch.type] !== undefined) counts[ch.type]++;
            });
            return (
              <>
                <span className="comp-tag comp-townsfolk">{counts.townsfolk}民</span>
                <span className="comp-tag comp-outsider">{counts.outsider}外</span>
                <span className="comp-tag comp-minion">{counts.minion}爪</span>
                <span className="comp-tag comp-demon">{counts.demon}恶</span>
              </>
            );
          })()}
        </div>
        <div className="comp-stats-row">
          <span>👤{seats.length}</span>
          <span>💚{aliveCount}</span>
          <span>💀{seats.length - aliveCount}</span>
        </div>
      </div>
      {/* ---- Bottom-left: Demon Bluffs floating widget ---- */}
      <div className="bluffs-widget" onClick={() => setShowDemonBluffs(true)}>
        <div className="bluffs-widget-title">恶魔伪装</div>
        <div className="bluffs-widget-slots">
          {demonBluffs.map((bluffId, bi) => {
            const bch = bluffId ? (charLookup[bluffId] || CHARACTERS[bluffId]) : null;
            return (
              <div key={bi} className={`bluffs-widget-slot ${bch ? 'filled' : ''}`}>
                {bch ? (
                  bch.icon ? (
                    <img src={bch.icon} alt={bch.name} className="bluffs-widget-icon" />
                  ) : (
                    <span className="bluffs-widget-letter">{bch.name?.charAt(0)}</span>
                  )
                ) : (
                  <span className="bluffs-widget-empty">?</span>
                )}
              </div>
            );
          })}
        </div>
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
              <Fragment key={seat.player?.id || `seat-${i}`}>
              <div
                className={[
                  'seat-token',
                  !seat.alive && 'dead',
                  ch && `type-${ch.type}`,
                  y < 40 && 'seat-top',
                  circleDragIdx === i && 'seat-dragging',
                  circleDropIdx === i && circleDragIdx !== null && circleDragIdx !== i && 'seat-drop-target',
                  swapSelectIdx === i && 'swap-selected',
                  swapSelectIdx !== null && swapSelectIdx !== i && 'swap-target',
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
                onClick={(e) => handleSeatClick(i, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (seat.characterId) {
                    const PID = ['drunk', 'marionette', 'lunatic', 'hermit', 'wudaozhe'];
                    const PNM = ['酒鬼', '提线木偶', '疯子', '悟道者'];
                    const cid = seat.characterId.toLowerCase();
                    const needs = PID.some(p => cid === p || cid.startsWith(p))
                      || (ch && PNM.some(n => ch.name === n));
                    if (!needs) return;
                    setPerceivedSeatIndex(i);
                    setShowPerceivedPicker(true);
                  }
                }}
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


                {/* 🎭 Perceived identity button — only for qualifying characters */}
                {seat.characterId && (() => {
                  const PID = ['drunk', 'marionette', 'lunatic', 'hermit', 'wudaozhe'];
                  const PNM = ['酒鬼', '提线木偶', '疯子', '悟道者'];
                  const cid = seat.characterId.toLowerCase();
                  const needs = PID.some(p => cid === p || cid.startsWith(p))
                    || (ch && PNM.some(n => ch.name === n));
                  if (!needs) return null;
                  return (
                    <div className="seat-side-btn seat-btn-left" onClick={(e) => {
                      e.stopPropagation();
                      setPerceivedSeatIndex(i);
                      setShowPerceivedPicker(true);
                    }}>🎭</div>
                  );
                })()}

                {/* Character content — flip display when perceived is set */}
                {ch ? (() => {
                  const pch = seat.perceivedCharId ? (charLookup[seat.perceivedCharId] || CHARACTERS[seat.perceivedCharId]) : null;
                  // Display char: show perceived as main when set, otherwise show real
                  const displayCh = pch || ch;
                  // Real char overlay: only show when perceived differs from real
                  const realOverlay = pch ? ch : null;
                  return (
                    <>
                      {displayCh.ability && (
                        <div className="seat-ability-tooltip">
                          <div className="ability-tooltip-name">{displayCh.name}</div>
                          <div className="ability-tooltip-text">{displayCh.ability}</div>
                          {realOverlay && (
                            <div className="ability-tooltip-real">真实身份: {realOverlay.name}</div>
                          )}
                        </div>
                      )}
                      {displayCh.icon ? (
                        <img className="seat-char-img" src={displayCh.icon} alt={displayCh.name} />
                      ) : (
                        <span className="seat-char-icon" style={{ color: TYPE_COLORS[displayCh.type] }}>
                          {displayCh.name?.charAt(0)}
                        </span>
                      )}
                      <span className="seat-char-name">{displayCh.name}</span>
                      {/* Real identity — small overlay token (only when perceived is set) */}
                      {realOverlay && (
                        <div
                          className="perceived-token"
                          title={`真实身份: ${realOverlay.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPerceivedSeatIndex(i);
                            setShowPerceivedPicker(true);
                          }}
                        >
                          {realOverlay.icon ? (
                            <img src={realOverlay.icon} alt={realOverlay.name} className="perceived-token-icon" />
                          ) : (
                            <span className="perceived-token-letter" style={{ color: TYPE_COLORS[realOverlay.type] }}>{realOverlay.name?.charAt(0)}</span>
                          )}
                          <span className="perceived-token-name">{realOverlay.name}</span>
                        </div>
                      )}

                  </>
                  );
                })() : (
                  <span className="seat-empty">?</span>
                )}

                {/* Seat label bar below token */}
                <div className="seat-label">
                  <span className="seat-number">{i + 1}.</span>
                  <span className="seat-player-name">{seat.player?.name || `座位${i+1}`}</span>
                  {phase === 'setup' && seat.characterId && (
                    <span
                      className={`seat-swap-btn ${swapSelectIdx === i ? 'swap-active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (swapSelectIdx === null) {
                          setSwapSelectIdx(i);
                        } else if (swapSelectIdx === i) {
                          setSwapSelectIdx(null); // deselect
                        } else {
                          // Swap seats
                          const fromName = seats[swapSelectIdx]?.player?.name || `座位${swapSelectIdx+1}`;
                          const toName = seats[i]?.player?.name || `座位${i+1}`;
                          addLog(`座位交换: ${fromName} ↔ ${toName}`);
                          setSeats(prev => {
                            const next = [...prev];
                            [next[swapSelectIdx], next[i]] = [next[i], next[swapSelectIdx]];
                            return next;
                          });
                          setSwapSelectIdx(null);
                        }
                      }}
                    >🔀</span>
                  )}
                </div>

                {/* Ghost vote token (dead players only) */}
                {!seat.alive && phase !== 'setup' && (
                  <div
                    className={`ghost-vote-token ${seat.ghostVoteUsed ? 'ghost-vote-used' : ''}`}
                    onClick={e => {
                      e.stopPropagation();
                      const newUsed = !seat.ghostVoteUsed;
                      addLog(`${seat.player?.name || `座位${i+1}`} ${newUsed ? '使用' : '恢复'}遗言票`);
                      setSeats(prev => prev.map((s, si) =>
                        si === i ? { ...s, ghostVoteUsed: newUsed } : s
                      ));
                    }}
                    title={seat.ghostVoteUsed ? '遗言票已使用' : '点击使用遗言票'}
                  >
                    {seat.ghostVoteUsed ? '🚫' : '🗳️'}
                  </div>
                )}


                {/* "+" button to add reminders — positioned toward center (only after game starts) */}
                {(() => {
                  const towardCX = -Math.cos(angle);
                  const towardCY = -Math.sin(angle);
                  const existingCount = seatReminders[i]?.length || 0;
                  const btnDist = 68 + existingCount * 44;
                  return (
                    <button
                      className="seat-reminder-btn"
                      style={{
                        transform: `translate(${towardCX * btnDist - 16}px, ${towardCY * btnDist - 16}px)`,
                      }}
                      onClick={e => { e.stopPropagation(); setReminderSeatIndex(i); setShowReminderPicker(true); }}
                      title="添加标记"
                    >
                      +
                    </button>
                  );
                })()}

                {/* Reminder tokens stacked toward center (only after game starts) */}
                {(seatReminders[i]?.length > 0) && (() => {
                  const towardCenterX = -Math.cos(angle);
                  const towardCenterY = -Math.sin(angle);
                  return (
                    <div className="seat-reminders" onClick={e => e.stopPropagation()}>
                      {seatReminders[i].map((rid, ri) => {
                        const isCustom = rid.startsWith('custom:');
                        const isScript = rid.startsWith('script:');
                        const token = (!isCustom && !isScript) ? REMINDER_TOKENS.find(t => t.id === rid) : null;
                        const scriptToken = isScript ? scriptReminderTokens.find(t => t.id === rid) : null;
                        let icon, label;
                        if (isScript) {
                          label = rid.split(':').slice(2).join(':');
                          icon = null; // will use image
                        } else if (isCustom) {
                          label = rid.replace('custom:', '');
                          icon = '📝';
                        } else {
                          label = token?.label || rid;
                          icon = token?.icon || '?';
                        }
                        const dist = 68 + ri * 44;
                        const tx = towardCenterX * dist;
                        const ty = towardCenterY * dist;
                        return (
                          <div
                            key={ri}
                            className="seat-reminder-token"
                            title={label}
                            style={{
                              transform: `translate(${tx - 26}px, ${ty - 26}px)`,
                              zIndex: 10 - ri,
                            }}
                            onClick={() => {
                              addLog(`${seat.player?.name || `座位${i+1}`} 移除标记: ${label}`);
                              setSeatReminders(prev => ({
                                ...prev,
                                [i]: (prev[i] || []).filter((_, idx) => idx !== ri),
                              }));
                            }}
                          >
                            {isScript && scriptToken?.charIcon ? (
                              <span className="reminder-token-icon" style={{
                                display: 'inline-block',
                                width: 26, height: 26,
                                backgroundImage: `url(${scriptToken.charIcon})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                borderRadius: '50%',
                              }} />
                            ) : (
                              <span className="reminder-token-icon">{icon}</span>
                            )}
                            <span className="reminder-token-text">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}


              </div>
              {/* Night order badges — OUTSIDE token to avoid click conflict */}
              {seat.characterId && (nightOrderBadges.firstNight[seat.characterId] || nightOrderBadges.otherNight[seat.characterId]) && (
                <div
                  className="night-badges-outer"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {nightOrderBadges.firstNight[seat.characterId] ? (
                    <div
                      className="night-order-badge night-order-first"
                      data-tip={`首夜 #${nightOrderBadges.firstNight[seat.characterId].rank}: ${nightOrderBadges.firstNight[seat.characterId].reminder || '无提示'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const ch2 = charLookup[seat.characterId] || CHARACTERS[seat.characterId];
                        setInfoBoardSeat({ seatIdx: i, character: ch2, nightType: 'first' });
                        const tpl = getInfoBoardTemplate(seat.characterId);
                        setInfoBoardItems(tpl ? tpl.map(t => ({...t})) : []);
                        setInfoBoardPresenting(false);
                      }}
                    >
                      {nightOrderBadges.firstNight[seat.characterId].rank}
                    </div>
                  ) : <div className="night-badge-spacer" />}
                  {nightOrderBadges.otherNight[seat.characterId] ? (
                    <div
                      className="night-order-badge night-order-other"
                      data-tip={`其他夜 #${nightOrderBadges.otherNight[seat.characterId].rank}: ${nightOrderBadges.otherNight[seat.characterId].reminder || '无提示'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const ch2 = charLookup[seat.characterId] || CHARACTERS[seat.characterId];
                        setInfoBoardSeat({ seatIdx: i, character: ch2, nightType: 'other' });
                        const tpl2 = getInfoBoardTemplate(seat.characterId);
                        setInfoBoardItems(tpl2 ? tpl2.map(t => ({...t})) : []);
                        setInfoBoardPresenting(false);
                      }}
                    >
                      {nightOrderBadges.otherNight[seat.characterId].rank}
                    </div>
                  ) : <div className="night-badge-spacer" />}
                </div>
              )}
            </Fragment>
            );
          })}
        </div>
      </div>

      {/* Bottom action bar removed — all items moved to topbar dropdown */}

      {/* ---- Role Assignment Panel (slide-up) ---- */}
      {showRolePanel && (
        <div className="grimoire-panel-overlay" onClick={() => { setShowRolePanel(false); setAssigningSeatIndex(null); }}>
          <div className="grimoire-role-panel" onClick={e => e.stopPropagation()}>
            <div className="role-panel-header">
              <h3>
                分配角色
                {assigningSeatIndex !== null && seats[assigningSeatIndex] && (
                  <> — {seats[assigningSeatIndex].player?.name || `座位${assigningSeatIndex+1}`}</>
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

      {/* ---- Perceived Identity Picker ---- */}
      {showPerceivedPicker && perceivedSeatIndex !== null && (
        <div className="grimoire-panel-overlay" onClick={() => { setShowPerceivedPicker(false); setPerceivedSeatIndex(null); }}>
          <div className="grimoire-role-panel" onClick={e => e.stopPropagation()}>
            <div className="role-panel-header">
              <h3>
                🎭 设置认知身份
                {seats[perceivedSeatIndex] && (
                  <> — {seats[perceivedSeatIndex].player?.name || `座位${perceivedSeatIndex+1}`}</>
                )}
              </h3>
              <button className="role-panel-close" onClick={() => { setShowPerceivedPicker(false); setPerceivedSeatIndex(null); }}>✕</button>
            </div>
            <div className="perceived-hint" style={{
              padding: '8px 18px', fontSize: '0.78rem', color: '#8a7a5a', borderBottom: '1px solid rgba(100,80,50,0.15)',
              background: 'rgba(40,35,28,0.5)'
            }}>
              💡 玩家将看到此身份（用于酒鬼/疯子/提线木偶等认知覆盖角色）
              {seats[perceivedSeatIndex]?.perceivedCharId && (
                <button
                  style={{
                    marginLeft: 12, fontSize: '0.72rem', color: '#f36a6a', background: 'none',
                    border: '1px solid rgba(243,106,106,0.3)', borderRadius: 6, padding: '2px 10px',
                    cursor: 'pointer',
                  }}
                  onClick={() => clearPerceived(perceivedSeatIndex)}
                >
                  ✕ 清除认知身份
                </button>
              )}
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
                        const isCurrent = seats[perceivedSeatIndex]?.perceivedCharId === ch.id;
                        const isInPlay = assignedCharIds.has(ch.id);
                        return (
                          <button
                            key={ch.id}
                            className={`role-panel-item ${isCurrent ? 'role-assigned' : ''} ${isInPlay ? 'role-in-play' : ''}`}
                            onClick={() => handleAssignPerceived(ch.id)}
                          >
                            {ch.icon ? (
                              <img className="role-item-icon" src={ch.icon} alt={ch.name} />
                            ) : (
                              <span className="role-item-indicator" style={{ background: TYPE_COLORS[ch.type] }} />
                            )}
                            <span className="role-item-name">{ch.name}</span>
                            {ch.nameEn && <span className="role-item-en">{ch.nameEn}</span>}
                            {isInPlay && <span className="role-in-play-dot" title="已在场">●</span>}
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
                {['townsfolk', 'outsider', 'minion', 'demon'].map(type => (
                  (charactersByType[type] || []).map(ch => {
                    const isSelected = selectedCharPool.has(ch.id);
                    const charCount = selectedCharPool.get(ch.id) || 0;
                    const isAssigned = assignedCharIds.has(ch.id);
                    return (
                      <div
                        key={ch.id}
                        className={`dist-token ${isSelected ? 'selected' : 'deselected'} ${isAssigned ? 'assigned' : ''}`}
                        style={{
                          cursor: phase === 'setup' ? 'pointer' : 'default',
                          borderColor: isSelected ? TYPE_COLORS[ch.type] : 'rgba(100,80,50,0.2)',
                          boxShadow: isSelected ? `0 0 8px ${TYPE_COLORS[ch.type]}50` : 'none',
                        }}
                        title={`${ch.name} (${ch.nameEn}) — ${TYPE_LABELS[ch.type]}\n${ch.ability}`}
                        onClick={() => { if (phase === 'setup') toggleCharInPool(ch.id); }}
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
                        {/* +/- buttons for duplicates */}
                        {phase === 'setup' && isSelected && allowDuplicates && (
                          <div className="dist-token-controls" onClick={e => e.stopPropagation()}>
                            <button className="dist-pm-btn" onClick={() => adjustCharCount(ch.id, -1)}>−</button>
                            {charCount > 1 && <span className="dist-count-badge">{charCount}</span>}
                            <button className="dist-pm-btn" onClick={() => adjustCharCount(ch.id, 1)}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>

            {phase === 'setup' && (
            <div className="distribution-actions">
              {/* Allow duplicates toggle */}
              <label className="dist-dup-toggle" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={allowDuplicates} onChange={e => setAllowDuplicates(e.target.checked)} />
                <span style={{ fontSize: '0.78rem', color: '#d4b878' }}>允许重复角色</span>
              </label>
              <button className="action-bar-btn action-primary" onClick={handleAutoPickAndAssign}>
                🎲 随机配版
              </button>
              {(() => {
                const allIds = expandPool(selectedCharPool);
                const nonFabledCount = allIds.filter(id => {
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
                  const available = localPlayers.filter(p => !seats.some(s => s.player?.id === p.id));
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
                  {localPlayers.filter(p => !seats.some(s => s.player?.id === p.id)).map(p => (
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
                  {localPlayers.filter(p => !seats.some(s => s.player?.id === p.id)).length === 0 && (
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
                    if (player && !seats.some(s => s.player?.id === playerId)) {
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
                      key={seat.player?.id || `seated-${idx}`}
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
                          if (player && !seats.some(s => s.player?.id === playerId)) {
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
                      <span className="pm-seat-name">{seat.player?.name || `玩家${idx+1}`}</span>
                      <button
                        className="pm-remove-btn"
                        title="移除"
                        onClick={e => {
                          e.stopPropagation();
                          setSeats(prev => prev.filter((_, idx) => idx !== si));
                          addLog(`移除玩家 ${seat.player?.name || `座位${idx+1}`}`);
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
                    {localPlayers.filter(p => !seats.some(s => s.player?.id === p.id)).map(p => (
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
                    <div key={seat.player?.id || `night-${ni}`}>
                      <div style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: '0.8rem',
                        background: 'rgba(255,255,255,0.04)', color: '#d4c0a8',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ color: '#888', minWidth: 20 }}>{si + 1}.</span>
                        <span>{seat.player?.name || `座位${ni+1}`}</span>
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

      {/* ---- Info Board (告知版) — Presentation Mode ---- */}
      {infoBoardPresenting && infoBoardSeat && (
        <div className="info-board-present">
          <div className="info-board-present-content">
            <div className="info-board-present-items">
              {infoBoardItems.map((item, idx) => (
                <span key={idx} className={`info-present-item info-present-${item.type}`}>
                  {item.type === 'player' && '👤 '}{item.type === 'character' && '🎭 '}{item.value}
                </span>
              ))}
            </div>
            <button
              className="info-board-btn-done"
              onClick={() => {
                const playerName = seats[infoBoardSeat.seatIdx]?.player?.name || `座位${infoBoardSeat.seatIdx + 1}`;
                const charName = infoBoardSeat.character?.name || '未知';
                const msg = infoBoardItems.map(it => it.value).join(' ');
                addLog(`告知 ${playerName}(${charName}): ${msg}`);
                setInfoBoardPresenting(false);
                setInfoBoardSeat(null);
                setInfoBoardItems([]);
              }}
            >✓ 完成</button>
          </div>
        </div>
      )}

      {/* ---- Info Board (告知版) — Composer Mode ---- */}
      {infoBoardSeat && !infoBoardPresenting && (
        <div className="grimoire-panel-overlay" onClick={() => setInfoBoardSeat(null)}>
          <div className="info-board-modal" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="info-board-header">
              <div className="info-board-char-info">
                {infoBoardSeat.character?.icon && (
                  <img src={infoBoardSeat.character.icon} alt="" className="info-board-char-icon" />
                )}
                <div>
                  <div className="info-board-char-name">{infoBoardSeat.character?.name || '未知'}</div>
                  <div className="info-board-player-name">
                    座位{infoBoardSeat.seatIdx + 1}: {seats[infoBoardSeat.seatIdx]?.player?.name || '空位'}
                  </div>
                </div>
              </div>
              <button className="info-board-close" onClick={() => setInfoBoardSeat(null)}>✕</button>
            </div>

            {/* Ability text */}
            <div className="info-board-ability">
              {infoBoardSeat.character?.ability || '无技能描述'}
            </div>

            {/* Composed template preview - click items to edit/remove */}
            <div className="info-board-preview">
              {infoBoardItems.length === 0 ? (
                <span style={{ color: '#6a5a3a', fontStyle: 'italic' }}>点击下方按钮组合告知模板...</span>
              ) : (
                infoBoardItems.map((item, idx) => (
                  <span
                    key={idx}
                    className={`info-item info-item-${item.type} ${!item.value ? 'info-item-empty' : ''} ${infoBoardTab === idx ? 'info-item-editing' : ''}`}
                    onClick={() => {
                      if (item.type === 'text') {
                        // Text items: click to remove
                        setInfoBoardItems(prev => prev.filter((_, i) => i !== idx));
                      } else {
                        // Placeholder items: click to open picker
                        setInfoBoardTab(infoBoardTab === idx ? null : idx);
                      }
                    }}
                  >
                    {item.type === 'number' && (item.value ? item.value : '[ 数字 ]')}
                    {item.type === 'player' && (item.value ? `👤 ${item.value}` : '[ 玩家 ]')}
                    {item.type === 'character' && (item.value ? `🎭 ${item.value}` : '[ 角色 ]')}
                    {item.type === 'text' && item.value}
                  </span>
                ))
              )}
            </div>

            {/* Inline picker for selected placeholder */}
            {typeof infoBoardTab === 'number' && infoBoardItems[infoBoardTab] && (
              <div className="info-board-inline-picker">
                <div className="info-board-picker-header">
                  <span>选择{infoBoardItems[infoBoardTab].type === 'number' ? '数字' : infoBoardItems[infoBoardTab].type === 'player' ? '玩家' : '角色'}</span>
                  <button className="info-board-picker-delete" onClick={() => {
                    setInfoBoardItems(prev => prev.filter((_, i) => i !== infoBoardTab));
                    setInfoBoardTab(null);
                  }}>🗑 删除</button>
                </div>
                <div className="info-board-quick-btns">
                  {infoBoardItems[infoBoardTab].type === 'number' && (
                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                      <button key={n} className="info-board-chip info-board-chip-number" onClick={() => {
                        const editIdx = infoBoardTab;
                        setInfoBoardItems(prev => prev.map((it, i) => i === editIdx ? { ...it, value: String(n) } : it));
                        setInfoBoardTab(null);
                      }}>{n}</button>
                    ))
                  )}
                  {infoBoardItems[infoBoardTab].type === 'player' && (
                    seats.map((s, si) => (
                      <button key={si} className="info-board-chip info-board-chip-player" onClick={() => {
                        const editIdx = infoBoardTab;
                        setInfoBoardItems(prev => prev.map((it, i) => i === editIdx ? { ...it, value: `${si + 1}. ${s.player?.name || '空位'}` } : it));
                        setInfoBoardTab(null);
                      }}>{si + 1}. {s.player?.name || '空位'}</button>
                    ))
                  )}
                  {infoBoardItems[infoBoardTab].type === 'character' && (
                    scriptCharacters.map(ch => (
                      <button key={ch.id} className="info-board-chip info-board-chip-char" onClick={() => {
                        const editIdx = infoBoardTab;
                        setInfoBoardItems(prev => prev.map((it, i) => i === editIdx ? { ...it, value: ch.name || ch.id } : it));
                        setInfoBoardTab(null);
                      }}>{ch.name || ch.id}</button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Template builder: text buttons + placeholder inserters */}
            <div className="info-board-builder">
              <div className="info-board-quick-btns">
                {['你', '你得知', '其中一位是', '选择', '和', '或', '是', '不是', '有', '没有',
                  '对', '个', '位', '名', '中', '的',
                  '镇民', '外来者', '爪牙', '恶魔', '善良', '邪恶',
                  '相邻', '被选择', '已死亡', '存活', '中毒', '被保护', '得到了',
                  '以上', '以下', '最近', '今晚', '昨晚'].map(txt => (
                  <button key={txt} className="info-board-chip" onClick={() => {
                    setInfoBoardItems(prev => [...prev, { type: 'text', value: txt }]);
                    setInfoBoardTab(null);
                  }}>{txt}</button>
                ))}
              </div>
              <div className="info-board-placeholder-row">
                <button className="info-board-add-ph info-board-add-number" onClick={() => {
                  setInfoBoardItems(prev => [...prev, { type: 'number', value: null }]);
                  setInfoBoardTab(infoBoardItems.length);
                }}>+ 数字</button>
                <button className="info-board-add-ph info-board-add-player" onClick={() => {
                  setInfoBoardItems(prev => [...prev, { type: 'player', value: null }]);
                  setInfoBoardTab(infoBoardItems.length);
                }}>+ 玩家</button>
                <button className="info-board-add-ph info-board-add-char" onClick={() => {
                  setInfoBoardItems(prev => [...prev, { type: 'character', value: null }]);
                  setInfoBoardTab(infoBoardItems.length);
                }}>+ 角色</button>
              </div>
              <form className="info-board-custom-row" onSubmit={(e) => {
                e.preventDefault();
                const input = e.target.elements.customText;
                if (input.value.trim()) {
                  setInfoBoardItems(prev => [...prev, { type: 'text', value: input.value.trim() }]);
                  input.value = '';
                  setInfoBoardTab(null);
                }
              }}>
                <input name="customText" className="info-board-custom-input" placeholder="自定义文本..." autoComplete="off" />
                <button type="submit" className="info-board-chip">添加</button>
              </form>
            </div>

            {/* Actions */}
            <div className="info-board-actions">
              <button className="info-board-btn-clear" onClick={() => setInfoBoardItems([])}>🗑 清空</button>
              <button
                className="info-board-btn-present"
                disabled={infoBoardItems.length === 0}
                onClick={() => {
                  // Build readable text from info board items for logging
                  const parts = infoBoardItems.map(item => {
                    if (item.type === 'text') return item.value || '___';
                    if (item.type === 'number') return item.value != null ? String(item.value) : '?';
                    if (item.type === 'player') {
                      if (item.value != null) {
                        const ps = seats[item.value];
                        return ps?.player?.name || `座位${item.value + 1}`;
                      }
                      return '[玩家]';
                    }
                    if (item.type === 'character') {
                      if (item.value) {
                        const c = charLookup[item.value] || CHARACTERS[item.value];
                        return c?.name || item.value;
                      }
                      return '[角色]';
                    }
                    return '';
                  });
                  const playerName = seats[infoBoardSeat.seatIdx]?.player?.name || `座位${infoBoardSeat.seatIdx + 1}`;
                  const charName = infoBoardSeat.character?.name || '';
                  addLog(`展示给 ${playerName}(${charName}): ${parts.join(' ')}`);
                  setInfoBoardPresenting(true);
                }}
              >📺 展示给玩家</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Perceived Identity Warning Modal ---- */}
      {perceivedWarning && (
        <div className="grimoire-panel-overlay" onClick={() => setPerceivedWarning(null)}>
          <div className="perceived-warning-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', color: '#e8c864' }}>⚠ 请先设置认知覆盖</h3>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.8 }}>
              {perceivedWarning.map((m, i) => (
                <div key={i}>座位{m.idx + 1}: <strong>{m.player}</strong> — {m.name}</div>
              ))}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#9a8a6a', margin: '12px 0 0' }}>点击角色token左下角的 🎭 按钮设置认知覆盖</p>
            <button
              className="bottombar-btn"
              style={{ marginTop: 16, width: '100%' }}
              onClick={() => setPerceivedWarning(null)}
            >知道了</button>
          </div>
        </div>
      )}

      {/* ---- Reveal Code Display ---- */}
      {showRevealCode && revealCode && (
        <div className="grimoire-panel-overlay" onClick={() => setShowRevealCode(false)}>
          <div className="reveal-code-display" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#d4b878', margin: '0 0 8px' }}>🎫 角色抽取码</h3>
            <p style={{ fontSize: '0.8rem', color: '#8a7a5a', margin: '0 0 16px' }}>
              将此代码分享给玩家，玩家访问同一网站后点击"🔮 抽取角色"
            </p>
            <div style={{
              fontSize: '3rem', fontWeight: 700, letterSpacing: '0.3em',
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              color: '#d4b878', padding: '16px 32px', borderRadius: 16,
              background: 'rgba(212,184,120,0.1)', border: '2px solid rgba(212,184,120,0.3)',
              marginBottom: 16, textAlign: 'center',
              textShadow: '0 2px 12px rgba(212,184,120,0.3)',
            }}>
              {revealCode}
            </div>

            {/* Real-time seat status */}
            {revealSession && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: '0.85rem', fontWeight: 600,
                  color: revealSession.allSeated ? '#a0d4a0' : '#d4b878',
                  marginBottom: 10,
                }}>
                  {revealSession.allSeated
                    ? '✅ 所有玩家已入座！'
                    : `⏳ 入座进度: ${revealSession.seatedCount} / ${revealSession.totalSeats}`
                  }
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                  gap: 6, textAlign: 'left',
                }}>
                  {revealSession.seats.map(seat => (
                    <div
                      key={seat.seatIndex}
                      style={{
                        padding: '6px 10px', borderRadius: 8,
                        fontSize: '0.7rem',
                        background: seat.occupied ? 'rgba(100,180,100,0.1)'
                          : manualSeatIdx === seat.seatIndex ? 'rgba(212,184,120,0.15)'
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${seat.occupied ? 'rgba(100,180,100,0.3)'
                          : manualSeatIdx === seat.seatIndex ? 'rgba(212,184,120,0.4)'
                          : 'rgba(100,80,50,0.15)'}`,
                        color: seat.occupied ? '#a0d4a0' : '#6a5a3a',
                        cursor: 'pointer',
                      }}
                      onClick={async () => {
                        if (seat.occupied) {
                          // Unseat (confirm)
                          if (window.confirm(`移除 ${seat.playerName} 的座位？`)) {
                            try {
                              await unseatRevealSeat(revealCode, seat.seatIndex);
                              addLog(`说书人移除 ${seat.playerName} (座位${seat.seatNumber})`);
                              const data = await getRevealSession(revealCode);
                              setRevealSession(data);
                            } catch (e) { console.error('Unseat failed:', e); }
                          }
                        } else {
                          setManualSeatIdx(manualSeatIdx === seat.seatIndex ? null : seat.seatIndex);
                        }
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{seat.seatNumber}.</span>{' '}
                      {seat.occupied ? (
                        <>{seat.playerName} <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>✕</span></>
                      ) : '点击入座'}
                    </div>
                  ))}
                </div>

                {/* Manual player picker */}
                {manualSeatIdx !== null && (
                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(30,28,35,0.95)',
                    border: '1px solid rgba(212,184,120,0.3)',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#d4b878', marginBottom: 8, fontWeight: 600 }}>
                      为座位 {manualSeatIdx + 1} 选择玩家:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {revealSession.availablePlayers.map(p => (
                        <button
                          key={p.id}
                          style={{
                            padding: '4px 10px', borderRadius: 6,
                            border: '1px solid rgba(100,80,50,0.2)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#d4c0a8', fontSize: '0.7rem',
                            cursor: 'pointer',
                          }}
                          onClick={async () => {
                            try {
                              await sitRevealSeat(revealCode, {
                                seatIndex: manualSeatIdx,
                                playerName: p.name,
                                playerId: p.id,
                              });
                              setManualSeatIdx(null);
                              addLog(`说书人帮 ${p.name} 入座 ${manualSeatIdx + 1} 号`);
                              const data = await getRevealSession(revealCode);
                              setRevealSession(data);
                            } catch (e) {
                              console.error('Manual seat failed:', e);
                            }
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    {/* Add new player inline */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="输入新玩家名..."
                        id="manual-new-player"
                        style={{
                          flex: 1, padding: '5px 8px', borderRadius: 6,
                          border: '1px solid rgba(100,80,50,0.3)',
                          background: 'rgba(255,255,255,0.06)',
                          color: '#d4c0a8', fontSize: '0.7rem',
                          outline: 'none',
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            const name = e.target.value.trim();
                            try {
                              await sitRevealSeat(revealCode, {
                                seatIndex: manualSeatIdx,
                                playerName: name,
                                playerId: null,
                              });
                              setManualSeatIdx(null);
                              addLog(`说书人帮 ${name} 入座 ${manualSeatIdx + 1} 号`);
                              const data = await getRevealSession(revealCode);
                              setRevealSession(data);
                            } catch (err) { console.error(err); }
                          }
                        }}
                      />
                      <button
                        style={{
                          padding: '4px 10px', borderRadius: 6,
                          border: '1px solid rgba(100,180,100,0.3)',
                          background: 'rgba(100,180,100,0.1)',
                          color: '#a0d4a0', fontSize: '0.7rem',
                          cursor: 'pointer',
                        }}
                        onClick={async () => {
                          const input = document.getElementById('manual-new-player');
                          const name = input?.value?.trim();
                          if (!name) return;
                          try {
                            await sitRevealSeat(revealCode, {
                              seatIndex: manualSeatIdx,
                              playerName: name,
                              playerId: null,
                            });
                            setManualSeatIdx(null);
                            addLog(`说书人帮 ${name} 入座 ${manualSeatIdx + 1} 号`);
                            const data = await getRevealSession(revealCode);
                            setRevealSession(data);
                          } catch (err) { console.error(err); }
                        }}
                      >
                        + 添加
                      </button>
                    </div>
                    <button
                      style={{
                        marginTop: 6, padding: '3px 10px', borderRadius: 6,
                        border: '1px solid rgba(100,80,50,0.2)',
                        background: 'transparent', color: '#8a7a5a',
                        fontSize: '0.65rem', cursor: 'pointer',
                      }}
                      onClick={() => setManualSeatIdx(null)}
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                className="action-bar-btn"
                onClick={() => { navigator.clipboard?.writeText(revealCode); }}
              >
                📋 复制代码
              </button>
              <button
                className="action-bar-btn"
                style={{ fontSize: '0.75rem' }}
                onClick={() => setShowRevealCode(false)}
              >
                关闭
              </button>
            </div>
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
              {/* Filter: global tokens always show, per-character only when character is in play */}
              {scriptReminderTokens
                .filter(token => {
                  if (token.global) return true;
                  // Check if this character is assigned to any seat
                  return seats.some(s => s.characterId === token.charId);
                })
                .map(token => {
                  const isActive = (seatReminders[reminderSeatIndex] || []).includes(token.id);
                  return (
                    <button
                      key={token.id}
                      className={`reminder-token ${isActive ? 'reminder-active' : ''}`}
                      style={{
                        '--token-color': '#c7a',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onClick={() => toggleReminder(reminderSeatIndex, token.id)}
                      title={`${token.charName}: ${token.label}${token.global ? ' (全局)' : ''}`}
                    >
                      {token.charIcon ? (
                        <span className="reminder-token-icon" style={{
                          display: 'inline-block',
                          width: 24, height: 24,
                          backgroundImage: `url(${token.charIcon})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: '50%',
                          opacity: 0.85,
                        }} />
                      ) : (
                        <span className="reminder-token-icon">📌</span>
                      )}
                      <span className="reminder-token-label" style={{ fontSize: '0.62rem' }}>
                        {token.label}
                      </span>
                    </button>
                  );
                })
              }
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
                  const isScript = rid.startsWith('script:');
                  const token = (!isCustom && !isScript) ? REMINDER_TOKENS.find(t => t.id === rid) : null;
                  let label, icon;
                  if (isScript) {
                    label = rid.split(':').slice(2).join(':');
                    icon = '📌';
                  } else if (isCustom) {
                    label = rid.replace('custom:', '');
                    icon = '📝';
                  } else {
                    label = token?.label || rid;
                    icon = token?.icon || '?';
                  }
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
        <div className="grimoire-side-panel night-order-panel-wide">
          <div className="side-panel-header">
            <h3>🌙 夜晚顺序表</h3>
            <button className="side-panel-close" onClick={() => setShowNightOrder(false)}>✕</button>
          </div>
          <div className="night-order-columns">
            {/* First Night Column */}
            <div className="night-order-col">
              <div className="night-col-header night-col-first">首个夜晚</div>
              {scriptCharacters
                .filter(ch => ch.firstNight > 0)
                .sort((a, b) => a.firstNight - b.firstNight)
                .map(ch => {
                  const inPlaySeats = seats
                    .map((s, si) => ({ ...s, seatIdx: si }))
                    .filter(s => s.characterId === ch.id);
                  const isInPlay = inPlaySeats.length > 0;
                  return (
                    <div key={ch.id} className={`night-row ${isInPlay ? 'night-row-active' : 'night-row-dim'}`}>
                      <div className={`night-row-bar ${isInPlay ? 'night-bar-first' : ''}`} />
                      <span className="night-row-name">{ch.name}</span>
                      {ch.icon && (
                        <img className="night-row-icon" src={ch.icon} alt="" />
                      )}
                      {isInPlay && (
                        <span className="night-row-seat">
                          {inPlaySeats.map(s => `${s.seatIdx + 1}. ${s.player?.name || '空座位'}`).join(', ')}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
            {/* Other Night Column */}
            <div className="night-order-col">
              <div className="night-col-header night-col-other">其他夜晚</div>
              {scriptCharacters
                .filter(ch => (ch.otherNight || ch.otherNights) > 0)
                .sort((a, b) => (a.otherNight || a.otherNights) - (b.otherNight || b.otherNights))
                .map(ch => {
                  const inPlaySeats = seats
                    .map((s, si) => ({ ...s, seatIdx: si }))
                    .filter(s => s.characterId === ch.id);
                  const isInPlay = inPlaySeats.length > 0;
                  return (
                    <div key={ch.id} className={`night-row ${isInPlay ? 'night-row-active' : 'night-row-dim'}`}>
                      <div className={`night-row-bar ${isInPlay ? 'night-bar-other' : ''}`} />
                      <span className="night-row-name">{ch.name}</span>
                      {ch.icon && (
                        <img className="night-row-icon" src={ch.icon} alt="" />
                      )}
                      {isInPlay && (
                        <span className="night-row-seat">
                          {inPlaySeats.map(s => `${s.seatIdx + 1}. ${s.player?.name || '空座位'}`).join(', ')}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ---- Demon Bluffs — fullscreen panel ---- */}
      {showDemonBluffs && (
        <div className="grimoire-panel-overlay" onClick={() => { setShowDemonBluffs(false); setAssigningBluffIndex(null); }}>
          <div className="demon-bluffs-panel" onClick={e => e.stopPropagation()}>
            <div className="dbf-panel-header">
              <h3>🎭 恶魔伪装</h3>
              <p className="dbf-panel-hint">选择3个不在场的好人角色作为伪装选项</p>
              <button className="side-panel-close" onClick={() => { setShowDemonBluffs(false); setAssigningBluffIndex(null); }}>✕</button>
            </div>

            {/* 3 bluff slots */}
            <div className="dbf-slots-row">
              {demonBluffs.map((bluffId, bi) => {
                const ch = bluffId ? (charLookup[bluffId] || CHARACTERS[bluffId]) : null;
                return (
                  <button
                    key={bi}
                    className={`dbf-slot ${assigningBluffIndex === bi ? 'dbf-slot-active' : ''}`}
                    onClick={() => setAssigningBluffIndex(assigningBluffIndex === bi ? null : bi)}
                  >
                    {ch ? (
                      <>
                        {ch.icon ? (
                          <img className="dbf-slot-icon" src={ch.icon} alt={ch.name} />
                        ) : (
                          <span className="dbf-slot-letter" style={{ color: TYPE_COLORS[ch.type] }}>{ch.name?.charAt(0)}</span>
                        )}
                        <span className="dbf-slot-name">{ch.name}</span>
                      </>
                    ) : (
                      <span className="dbf-slot-empty">伪装 {bi + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Character picker grid */}
            {assigningBluffIndex !== null && (
              <div className="dbf-picker-grid">
                {scriptCharacters
                  .filter(ch => ch.type === 'townsfolk' || ch.type === 'outsider')
                  .filter(ch => !assignedCharIds.has(ch.id))
                  .map(ch => (
                    <button
                      key={ch.id}
                      className="dbf-picker-item"
                      onClick={() => handleAssignBluff(ch.id)}
                    >
                      {ch.icon ? (
                        <img className="dbf-picker-icon" src={ch.icon} alt={ch.name} />
                      ) : (
                        <span className="dbf-picker-letter" style={{ color: TYPE_COLORS[ch.type] }}>{ch.name?.charAt(0)}</span>
                      )}
                      <span className="dbf-picker-name">{ch.name}</span>
                    </button>
                  ))}
              </div>
            )}

            {/* Fullscreen show button */}
            {demonBluffs.some(b => b) && (
              <button
                className="dbf-show-btn"
                onClick={() => {
                  const bluffNames = demonBluffs.filter(b => b).map(b => { const c = charLookup[b] || CHARACTERS[b]; return c?.name || b; }).join('、');
                  addLog(`展示恶魔伪装: ${bluffNames}`);
                  setShowDemonBluffsFullscreen(true); setShowDemonBluffs(false);
                }}
              >
                📺 全屏展示给恶魔
              </button>
            )}
          </div>
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
                  // Block auto-save from re-writing state
                  closedRef.current = true;
                  // Clear ALL saved state so a new game can start fresh
                  localStorage.removeItem(STORAGE_KEY);
                  localStorage.removeItem(STORAGE_KEY + '_backup');
                  localStorage.removeItem(STORAGE_KEY + '_log');
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
      <div className="grimoire-log-area">
        {phase !== 'setup' && (
          <button className="info-board-standalone-btn" onClick={() => setShowInfoBoardPicker(true)}>
            📋 展示版
          </button>
        )}
        {log.length > 0 && (
          <details className="grimoire-log">
            <summary className="grimoire-log-toggle">日志 ({log.length})</summary>
            <div className="grimoire-log-content">
              <button
                className="log-export-btn"
                onClick={() => {
                  const lines = [];
                  lines.push(`════ 魔典日志导出 ════`);
                  lines.push(`剧本: ${selectedScript?.name || '未知'}`);
                  lines.push(`日期: ${new Date().toISOString().split('T')[0]}`);
                  lines.push(`阶段: ${phase === 'day' ? `白天 ${dayNumber}` : phase === 'night' ? `夜晚 ${dayNumber}` : '准备'}`);
                  lines.push('');
                  lines.push('── 玩家配置 ──');
                  seats.forEach((s, i) => {
                    const ch = s.characterId ? (charLookup[s.characterId] || CHARACTERS[s.characterId]) : null;
                    const perceived = s.perceivedCharId ? (charLookup[s.perceivedCharId] || CHARACTERS[s.perceivedCharId]) : null;
                    const name = s.player?.name || `座位${i + 1}`;
                    let line = `${i + 1}. ${name} → ${ch?.name || '未分配'} (${ch?.type || '?'})`;
                    if (perceived && s.perceivedCharId !== s.characterId) line += ` [认为: ${perceived.name}]`;
                    if (!s.alive) line += ` 💀已死亡${s.deathDay ? ` (第${s.deathDay}天)` : ''}`;
                    const tokens = seatReminders[i] || [];
                    if (tokens.length > 0) {
                      const names = tokens.map(tid => {
                        if (tid.startsWith('custom:')) return tid.replace('custom:', '');
                        if (tid.startsWith('script:')) return tid.split(':').slice(2).join(':');
                        const tk = REMINDER_TOKENS.find(t => t.id === tid);
                        return tk?.label || tid;
                      });
                      line += ` [标记: ${names.join(', ')}]`;
                    }
                    lines.push(line);
                  });
                  if (demonBluffs.some(b => b)) {
                    lines.push('');
                    lines.push('── 恶魔伪装 ──');
                    demonBluffs.filter(b => b).forEach((b, i) => {
                      const c = charLookup[b] || CHARACTERS[b];
                      lines.push(`${i + 1}. ${c?.name || b}`);
                    });
                  }
                  lines.push('');
                  lines.push('── 完整日志 ──');
                  log.forEach(l => lines.push(`[${l.time}] ${l.msg}`));
                  lines.push('');
                  lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
                  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `魔典日志_${selectedScript?.name || '游戏'}_${new Date().toISOString().split('T')[0]}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >📥 导出日志</button>
              {log.slice().reverse().map((entry, i) => {
                const realIdx = log.length - 1 - i;
                return (
                  <div key={i} className="log-entry">
                    <span className="log-time">{entry.time}</span>
                    <span className="log-msg">{entry.msg}</span>
                    <button className="log-delete" onClick={() => setLog(prev => prev.filter((_, j) => j !== realIdx))}>✕</button>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {/* ---- Standalone Info Board Player Picker ---- */}
      {showInfoBoardPicker && (
        <div className="grimoire-panel-overlay" onClick={() => setShowInfoBoardPicker(false)}>
          <div className="nomination-panel" onClick={e => e.stopPropagation()}>
            <h3 className="nom-title">向哪位玩家展示？</h3>
            <div className="nom-player-grid">
              {seats.map((s, si) => {
                const ch = s.characterId ? (charLookup[s.characterId] || CHARACTERS[s.characterId]) : null;
                return (
                  <button
                    key={si}
                    className="nom-player-btn"
                    onClick={() => {
                      setShowInfoBoardPicker(false);
                      setInfoBoardSeat({ seatIdx: si, character: ch });
                      const tplS = ch ? getInfoBoardTemplate(ch.id) : null;
                      setInfoBoardItems(tplS ? tplS.map(t => ({...t})) : []);
                      setInfoBoardTab(null);
                    }}
                  >
                    <span className="nom-seat-num">{si + 1}</span>
                    {s.player?.name || `座位${si + 1}`}
                    {ch && <span style={{ opacity: 0.5, marginLeft: 4, fontSize: '0.7rem' }}>({ch.name})</span>}
                  </button>
                );
              })}
            </div>
            <button className="nom-cancel-btn" onClick={() => setShowInfoBoardPicker(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
