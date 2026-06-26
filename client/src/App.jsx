import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { fetchPlayers, fetchGames, fetchGroups, fetchScripts, fetchProfile } from './api';
import { computePlayerStats, computeDashboardStats, computeHallOfFame } from './utils/stats';
import Header from './components/Header';
import GroupSelector from './components/GroupSelector';
import Dashboard from './components/Dashboard';
import HallOfFame from './components/HallOfFame';
import PlayerList from './components/PlayerList';
import PlayerModal from './components/PlayerModal';
import GameHistory from './components/GameHistory';
import RecordGameModal from './components/RecordGameModal';
import AdminPanel from './components/AdminPanel';
import Grimoire from './components/Grimoire';
import MyProfile from './components/MyProfile';
import ClaimPlayerModal from './components/ClaimPlayerModal';
import RoleReveal from './components/RoleReveal';
import { useToast } from './components/Toast';
import './App.css';

export default function App() {
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const isStoryteller = user?.role === 'storyteller';

  // Group state
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Data state (within a group)
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showRecordGame, setShowRecordGame] = useState(false);
  const [showGrimoire, setShowGrimoire] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showClaimPlayer, setShowClaimPlayer] = useState(false);
  const [showRoleReveal, setShowRoleReveal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [prefillData, setPrefillData] = useState(null);
  const [myGroupIds, setMyGroupIds] = useState([]);

  // Reusable function to refresh myGroupIds
  const refreshMyGroups = useCallback(async () => {
    if (!isAuthenticated) {
      setMyGroupIds([]);
      return;
    }
    try {
      const data = await fetchProfile();
      setMyGroupIds((data.memberships || []).map(m => m.group_id));
    } catch (e) {}
  }, [isAuthenticated]);

  // Fetch profile memberships on auth change
  useEffect(() => {
    refreshMyGroups();
  }, [refreshMyGroups]);

  // Load groups on mount
  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const groupsData = await fetchGroups();
      setGroups(groupsData);
    } catch (err) {
      toast.error('分组加载失败: ' + (err.message || '未知错误'));
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // Load group data when a group is selected
  const loadGroupData = useCallback(async (groupId) => {
    setLoading(true);
    try {
      const [playersData, gamesData, scriptsData] = await Promise.all([
        fetchPlayers(groupId),
        fetchGames(groupId),
        fetchScripts(groupId),
      ]);
      setPlayers(playersData);
      setGames(gamesData);
      setScripts(scriptsData);
    } catch (err) {
      toast.error('数据加载失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      loadGroupData(selectedGroup.id);
    }
  }, [selectedGroup, loadGroupData]);

  // Check if user needs to claim a player profile
  useEffect(() => {
    if (selectedGroup && !loading && isAuthenticated && user) {
      // Check if user is member but hasn't claimed a player
      const isGroupOwner = user.role === 'storyteller' && selectedGroup.created_by === user.id;
      if (!isGroupOwner) {
        // Player user - check if they have a claimed player in this group
        const hasClaimed = players.some(p => p.user_id === user.id);
        const isMember = myGroupIds.includes(selectedGroup.id);
        if (isMember && !hasClaimed && players.length > 0) {
          setShowClaimPlayer(true);
        }
      }
    }
  }, [selectedGroup, loading, players, isAuthenticated, user, myGroupIds]);

  // Computed data
  const playersWithStats = useMemo(() => {
    return players.map(p => computePlayerStats(p, games));
  }, [players, games]);

  const dashboardStats = useMemo(() => {
    return computeDashboardStats(games);
  }, [games]);

  const hallOfFameAwards = useMemo(() => {
    return computeHallOfFame(playersWithStats);
  }, [playersWithStats]);

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setPlayers([]);
    setGames([]);
    setScripts([]);
  };

  const handleBack = () => {
    setSelectedGroup(null);
    setPlayers([]);
    setGames([]);
    setScripts([]);
  };

  const handleRefresh = () => {
    if (selectedGroup) {
      loadGroupData(selectedGroup.id);
    }
  };

  // Show groups loading
  if (groupsLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="loading-text">加载中...</p>
        <p className="loading-subtext">LOADING DATA</p>
      </div>
    );
  }

  // Show profile page
  if (showProfile) {
    return <MyProfile onBack={() => setShowProfile(false)} />;
  }

  // Show group selector when no group is selected
  if (!selectedGroup) {
    return (
      <GroupSelector
        groups={groups}
        onSelectGroup={handleSelectGroup}
        onRefresh={() => { loadGroups(); refreshMyGroups(); }}
        isAuthenticated={isAuthenticated}
        myGroupIds={myGroupIds}
        onOpenProfile={() => setShowProfile(true)}
        onRefreshGroups={refreshMyGroups}
      />
    );
  }

  // Show group dashboard
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="loading-text">加载中...</p>
        <p className="loading-subtext">LOADING DATA</p>
      </div>
    );
  }

  const isGroupOwner = isStoryteller && selectedGroup?.created_by === user?.id;

  return (
    <div className="app">
      <Header
        onAddPlayer={() => setActiveTab('admin')}
        onRecordGame={() => setShowRecordGame(true)}
        onOpenGrimoire={() => setShowGrimoire(true)}
        selectedGroup={selectedGroup}
        onBack={handleBack}
        onOpenProfile={() => setShowProfile(true)}
      />

      <main className="app-main">
        {/* Tab Navigation */}
        <div className="app-tabs">
          <button
            className={`app-tab ${activeTab === 'overview' ? 'app-tab-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 数据总览
          </button>
          {isGroupOwner && (
            <button
              className={`app-tab ${activeTab === 'admin' ? 'app-tab-active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              ⚙ 管理
            </button>
          )}
        </div>

        {activeTab === 'overview' && (
          <>
            <Dashboard stats={dashboardStats} games={games} playersWithStats={playersWithStats} />
            <HallOfFame awards={hallOfFameAwards} />
            <PlayerList
              players={playersWithStats}
              onPlayerClick={setSelectedPlayer}
            />
            <GameHistory games={games} players={players} />
          </>
        )}

        {activeTab === 'admin' && isGroupOwner && (
          <AdminPanel
            players={players}
            games={games}
            scripts={scripts}
            groupId={selectedGroup.id}
            onRefresh={handleRefresh}
          />
        )}
      </main>

      {/* ---- Role Reveal Quick Access Card ---- */}
      <div className="reveal-card-section">
        <div className="reveal-card-inner">
          <div className="reveal-card-left">
            <div className="reveal-card-icon">🔮</div>
            <div>
              <h3 className="reveal-card-title">角色抽取</h3>
              <p className="reveal-card-desc">
                说书人生成专属抽签码后，玩家通过输入代码私密查看自己的角色身份
              </p>
            </div>
          </div>
          <div className="reveal-card-steps">
            <div className="reveal-step">
              <span className="step-num">1</span>
              <span>从说书人处获取6位抽签码</span>
            </div>
            <div className="reveal-step">
              <span className="step-num">2</span>
              <span>选择你的玩家名称</span>
            </div>
            <div className="reveal-step">
              <span className="step-num">3</span>
              <span>私密查看你的角色与技能</span>
            </div>
          </div>
          <button
            className="reveal-card-btn"
            onClick={() => setShowRoleReveal(true)}
          >
            🎴 输入抽签码
          </button>
        </div>
      </div>

      <footer className="app-footer">
        <p>血染钟楼 · {selectedGroup.name}</p>
        <p className="footer-sub">Made for Blood on the Clocktower fans</p>
      </footer>

      {/* Modals */}
      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {showRecordGame && isGroupOwner && (
        <RecordGameModal
          players={players}
          scripts={scripts}
          onClose={() => { setShowRecordGame(false); setPrefillData(null); }}
          onSuccess={() => { handleRefresh(); setPrefillData(null); }}
          groupId={selectedGroup.id}
          onRefreshPlayers={handleRefresh}
          prefillData={prefillData}
        />
      )}



      {showGrimoire && isGroupOwner && (
        <Grimoire
          players={players}
          scripts={scripts}
          groupId={selectedGroup.id}
          onExportGame={(gameData) => {
            // Close grimoire, prefill RecordGameModal, open it
            setPrefillData(gameData);
            setShowGrimoire(false);
            setShowRecordGame(true);
            toast.success('魔典数据已导入记录表，请确认后提交');
          }}
          onClose={() => setShowGrimoire(false)}
          onRefreshPlayers={handleRefresh}
        />
      )}



      {showClaimPlayer && (
        <ClaimPlayerModal
          players={players}
          onClose={() => setShowClaimPlayer(false)}
          onClaimed={() => { handleRefresh(); setShowClaimPlayer(false); }}
        />
      )}

      {showRoleReveal && (
        <RoleReveal onClose={() => setShowRoleReveal(false)} />
      )}
    </div>
  );
}
