import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { fetchPlayers, fetchGames, fetchGroups, fetchScripts, createGame } from './api';
import { computePlayerStats, computeDashboardStats, computeHallOfFame } from './utils/stats';
import Header from './components/Header';
import GroupSelector from './components/GroupSelector';
import Dashboard from './components/Dashboard';
import HallOfFame from './components/HallOfFame';
import PlayerList from './components/PlayerList';
import ScriptManagement from './components/ScriptManagement';
import PlayerModal from './components/PlayerModal';
import GameHistory from './components/GameHistory';
import RecordGameModal from './components/RecordGameModal';
import AddPlayerModal from './components/AddPlayerModal';
import Grimoire from './components/Grimoire';
import { useToast } from './components/Toast';
import './App.css';

export default function App() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();

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
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showGrimoire, setShowGrimoire] = useState(false);

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

  // Show group selector when no group is selected
  if (!selectedGroup) {
    return (
      <GroupSelector
        groups={groups}
        onSelectGroup={handleSelectGroup}
        onRefresh={loadGroups}
        isAuthenticated={isAuthenticated}
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

  return (
    <div className="app">
      <Header
        onAddPlayer={() => setShowAddPlayer(true)}
        onRecordGame={() => setShowRecordGame(true)}
        onOpenGrimoire={() => setShowGrimoire(true)}
        selectedGroup={selectedGroup}
        onBack={handleBack}
      />

      <main className="app-main">
        <Dashboard stats={dashboardStats} />
        <HallOfFame awards={hallOfFameAwards} />
        <PlayerList
          players={playersWithStats}
          onPlayerClick={setSelectedPlayer}
        />
        <ScriptManagement
          scripts={scripts}
          groupId={selectedGroup.id}
          onRefresh={handleRefresh}
        />
        <GameHistory games={games} players={players} />
      </main>

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

      {showRecordGame && isAuthenticated && (
        <RecordGameModal
          players={players}
          scripts={scripts}
          onClose={() => setShowRecordGame(false)}
          onSuccess={handleRefresh}
          groupId={selectedGroup.id}
          onRefreshPlayers={handleRefresh}
        />
      )}

      {showAddPlayer && isAuthenticated && (
        <AddPlayerModal
          onClose={() => setShowAddPlayer(false)}
          onSuccess={handleRefresh}
          groupId={selectedGroup.id}
        />
      )}

      {showGrimoire && isAuthenticated && (
        <Grimoire
          players={players}
          scripts={scripts}
          groupId={selectedGroup.id}
          onExportGame={async (gameData) => {
            try {
              await createGame({ ...gameData, group_id: selectedGroup.id });
              toast.success('对局已记录！');
              handleRefresh();
              setShowGrimoire(false);
            } catch (err) {
              toast.error(err.message || '记录失败');
            }
          }}
          onClose={() => setShowGrimoire(false)}
          onRefreshPlayers={handleRefresh}
        />
      )}
    </div>
  );
}
