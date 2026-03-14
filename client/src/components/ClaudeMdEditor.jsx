import { useState, useEffect, useCallback } from 'react';
import { X, Save, FileText, AlertCircle, Check } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { api } from '../api';

const DEFAULT_TEMPLATE = `# CLAUDE.md

## Project Overview
<!-- Describe what this project does -->

## Tech Stack
<!-- List the key technologies used -->

## Development Guidelines
<!-- Add coding standards, patterns, or conventions Claude should follow -->

## Important Notes
<!-- Any critical context Claude needs to know -->
`;

export default function ClaudeMdEditor({ projectId, projectName, onClose }) {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [fileExists, setFileExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadFile();
  }, [projectId]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getClaudeMd(projectId);
      if (data.exists) {
        setContent(data.content);
        setOriginalContent(data.content);
        setFileExists(true);
      } else {
        setContent(DEFAULT_TEMPLATE);
        setOriginalContent('');
        setFileExists(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await api.saveClaudeMd(projectId, content);
      setOriginalContent(content);
      setFileExists(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [projectId, content]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const hasChanges = content !== originalContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-4xl mx-4 shadow-2xl flex flex-col"
        style={{ height: 'min(85vh, 800px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-claude" />
            <h2 className="text-sm font-medium">CLAUDE.md</h2>
            <span className="text-[10px] text-surface-500">
              {projectName}
            </span>
            {!fileExists && !loading && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">
                New file
              </span>
            )}
            {hasChanges && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle size={12} />
                {error}
              </div>
            )}
            {saved && (
              <div className="flex items-center gap-1 text-xs text-emerald-400">
                <Check size={12} />
                Saved
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-claude hover:bg-claude-light disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-colors"
            >
              <Save size={12} />
              {saving ? 'Saving...' : fileExists ? 'Save' : 'Create File'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden" data-color-mode="dark">
          {loading ? (
            <div className="flex items-center justify-center h-full text-surface-500 text-sm">Loading...</div>
          ) : (
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || '')}
              height="100%"
              visibleDragbar={false}
              preview="live"
              style={{
                backgroundColor: 'transparent',
                height: '100%',
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-surface-800 flex-shrink-0">
          <span className="text-[10px] text-surface-600">
            Ctrl+S to save
          </span>
          <span className="text-[10px] text-surface-600">
            {content.length} characters
          </span>
        </div>
      </div>
    </div>
  );
}
