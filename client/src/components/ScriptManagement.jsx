import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { createScript, deleteScript } from '../api';
import { useToast } from './Toast';
import './ScriptManagement.css';

/**
 * Parse a Blood on the Clocktower script JSON.
 * Accepted formats:
 *  1. Array with _meta: [{"id":"_meta","name":"..."},"washerwoman","librarian",...]
 *  2. Array of strings: ["washerwoman","librarian",...]
 *  3. Object with name: {"name":"...","characters":[...]}
 */
function parseScriptJSON(jsonStr) {
  const data = JSON.parse(jsonStr);
  let name = null;
  let characters = [];
  // charMeta maps id -> { name, team, image, ability } for all characters
  let charMeta = {};

  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'string') {
        characters.push(item);
      } else if (item && typeof item === 'object') {
        if (item.id === '_meta') {
          name = item.name || null;
        } else if (item.id) {
          characters.push(item.id);
          // Extract all available metadata
          const meta = {};
          if (item.name) meta.name = item.name;
          if (item.team) meta.team = item.team;
          if (item.image) meta.image = item.image;
          if (item.ability) meta.ability = item.ability;
          if (item.edition) meta.edition = item.edition;
          if (item.firstNight) meta.firstNight = item.firstNight;
          if (item.otherNight) meta.otherNight = item.otherNight;
          if (item.firstNightReminder) meta.firstNightReminder = item.firstNightReminder;
          if (item.otherNightReminder) meta.otherNightReminder = item.otherNightReminder;
          if (Array.isArray(item.reminders) && item.reminders.length) meta.reminders = item.reminders;
          if (Array.isArray(item.remindersGlobal) && item.remindersGlobal.length) meta.remindersGlobal = item.remindersGlobal;
          if (Object.keys(meta).length > 0) {
            charMeta[item.id] = meta;
          }
        }
      }
    }
  } else if (data && typeof data === 'object') {
    name = data.name || null;
    if (Array.isArray(data.characters)) {
      for (const c of data.characters) {
        if (typeof c === 'string') {
          characters.push(c);
        } else if (c?.id) {
          characters.push(c.id);
          const meta = {};
          if (c.name) meta.name = c.name;
          if (c.team) meta.team = c.team;
          if (c.image) meta.image = c.image;
          if (c.ability) meta.ability = c.ability;
          if (c.firstNight) meta.firstNight = c.firstNight;
          if (c.otherNight) meta.otherNight = c.otherNight;
          if (c.firstNightReminder) meta.firstNightReminder = c.firstNightReminder;
          if (c.otherNightReminder) meta.otherNightReminder = c.otherNightReminder;
          if (Array.isArray(c.reminders) && c.reminders.length) meta.reminders = c.reminders;
          if (Array.isArray(c.remindersGlobal) && c.remindersGlobal.length) meta.remindersGlobal = c.remindersGlobal;
          if (Object.keys(meta).length > 0) {
            charMeta[c.id] = meta;
          }
        }
      }
    }
  }

  return { name, characters, charMeta };
}

export default function ScriptManagement({ scripts, groupId, onRefresh }) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [showImport, setShowImport] = useState(false);
  const [pasteJSON, setPasteJSON] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [scriptName, setScriptName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---- Parse from file ----
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const result = parseScriptJSON(evt.target.result);
        const name = result.name || file.name.replace(/\.json$/i, '');
        setParsedResult(result);
        setScriptName(name);
        setPasteJSON(evt.target.result);
      } catch {
        toast.error('JSON 格式错误，请检查文件内容');
        setParsedResult(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---- Parse from textarea ----
  const handleParseJSON = () => {
    if (!pasteJSON.trim()) return;
    try {
      const result = parseScriptJSON(pasteJSON);
      const name = result.name || '未命名剧本';
      setParsedResult(result);
      setScriptName(name);
    } catch {
      toast.error('JSON 格式错误，请检查内容');
      setParsedResult(null);
    }
  };

  // ---- Submit new script ----
  const handleConfirmImport = async () => {
    if (!parsedResult || !scriptName.trim()) {
      toast.error('请输入剧本名称');
      return;
    }
    setLoading(true);
    try {
      await createScript({
        name: scriptName.trim(),
        group_id: groupId,
        characters: parsedResult.characters,
        char_meta: Object.keys(parsedResult.charMeta).length > 0
          ? JSON.stringify(parsedResult.charMeta)
          : null,
      });
      toast.success(`已导入剧本: ${scriptName.trim()}`);
      resetImportForm();
      onRefresh();
    } catch (err) {
      toast.error(err.message || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const resetImportForm = () => {
    setShowImport(false);
    setPasteJSON('');
    setParsedResult(null);
    setScriptName('');
  };

  // ---- Delete ----
  const handleDelete = async (id, name) => {
    setLoading(true);
    try {
      await deleteScript(id);
      toast.success(`已删除 ${name}`);
      setConfirmDelete(null);
      onRefresh();
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="script-mgmt">
      <div className="script-mgmt-header">
        <div>
          <h2 className="script-mgmt-title">剧本管理</h2>
          <p className="script-mgmt-subtitle">SCRIPT MANAGEMENT</p>
        </div>
        <span className="script-mgmt-count">{scripts.length} 个剧本</span>
      </div>

      {/* Import button */}
      {isAuthenticated && !showImport && (
        <button className="script-mgmt-add-btn" onClick={() => setShowImport(true)}>
          + 导入剧本 JSON
        </button>
      )}

      {/* Import form */}
      {showImport && (
        <div className="script-mgmt-import-form">
          <div className="script-mgmt-import-methods">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="script-mgmt-file-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              选择 JSON 文件
            </button>
            <span className="script-mgmt-or">或粘贴 JSON</span>
          </div>

          <div className="script-mgmt-form-field">
            <textarea
              value={pasteJSON}
              onChange={e => setPasteJSON(e.target.value)}
              placeholder='粘贴剧本 JSON 内容...'
              rows={4}
            />
          </div>

          {!parsedResult && pasteJSON.trim() && (
            <button
              type="button"
              className="script-mgmt-parse-btn"
              onClick={handleParseJSON}
            >
              解析 JSON
            </button>
          )}

          {parsedResult && (
            <div className="script-mgmt-preview">
              <div className="script-mgmt-preview-header">
                <span className="script-mgmt-preview-label">解析结果</span>
              </div>
              <div className="script-mgmt-form-field">
                <label>剧本名称</label>
                <input
                  type="text"
                  value={scriptName}
                  onChange={e => setScriptName(e.target.value)}
                  placeholder="输入剧本名称"
                />
              </div>
              <div className="script-mgmt-preview-info">
                <span className="script-mgmt-preview-chars">
                  {parsedResult.characters.length} 个角色
                </span>
              </div>
            </div>
          )}

          <div className="script-mgmt-import-actions">
            <button className="script-mgmt-btn-ghost" onClick={resetImportForm}>
              取消
            </button>
            {parsedResult && (
              <button
                className="script-mgmt-btn-primary"
                onClick={handleConfirmImport}
                disabled={loading || !scriptName.trim()}
              >
                {loading ? '导入中...' : '确认导入'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Script list */}
      {scripts.length > 0 && (
        <div className="script-mgmt-list">
          {scripts.map(s => (
            <div key={s.id} className="script-mgmt-row">
              <div className="script-mgmt-row-left">
                <div className="script-mgmt-info">
                  <span className="script-mgmt-name">{s.name}</span>
                  <span className="script-mgmt-chars">
                    {s.characters?.length || 0} 角色
                  </span>
                </div>
                {s.is_official === 1 && (
                  <span className="script-mgmt-official-badge">官方</span>
                )}
              </div>
              {isAuthenticated && s.is_official !== 1 && (
                <div className="script-mgmt-row-actions">
                  {confirmDelete === s.id ? (
                    <span className="script-mgmt-confirm-delete">
                      <span className="script-mgmt-confirm-text">确定？</span>
                      <button
                        className="script-mgmt-action-btn script-mgmt-action-danger"
                        onClick={() => handleDelete(s.id, s.name)}
                      >
                        删除
                      </button>
                      <button
                        className="script-mgmt-action-btn"
                        onClick={() => setConfirmDelete(null)}
                      >
                        取消
                      </button>
                    </span>
                  ) : (
                    <button
                      className="script-mgmt-action-btn script-mgmt-action-danger"
                      onClick={() => setConfirmDelete(s.id)}
                    >
                      删除
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {scripts.length === 0 && (
        <p className="script-mgmt-empty">暂无剧本数据</p>
      )}
    </section>
  );
}
