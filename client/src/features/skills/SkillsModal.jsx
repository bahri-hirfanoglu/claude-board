import { useState, useEffect, useCallback } from 'react';
import { X, Wand2, Download, Trash2, Github, FolderOpen, ArrowLeft, Check, Loader2, ExternalLink, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../i18n/I18nProvider';

const POPULAR_REPOS = [
  { repo: 'sickn33/antigravity-awesome-skills', path: 'skills', label: 'Antigravity Awesome Skills', desc: 'Categorized skill collection with 500+ skills' },
  { repo: 'hesreallyhim/awesome-claude-code', path: '', label: 'Awesome Claude Code', desc: 'Community-curated resources and skills' },
  { repo: 'travisvn/awesome-claude-skills', path: '', label: 'Awesome Claude Skills', desc: 'Curated skill collection' },
];

export default function SkillsModal({ onClose }) {
  const { t } = useTranslation();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('browse'); // 'browse' | 'import'

  const loadSkills = useCallback(() => {
    setLoading(true);
    api.listCustomSkills()
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const handleDelete = async (name) => {
    try {
      await api.deleteCustomSkill(name);
      setSkills(prev => prev.filter(s => s.name !== name));
      if (selected?.name === name) setSelected(null);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface-900 border border-surface-700 rounded-xl w-full max-w-3xl mx-4 shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            {view === 'import' && (
              <button onClick={() => setView('browse')} className="p-1 rounded hover:bg-surface-800 text-surface-400 mr-1">
                <ArrowLeft size={14} />
              </button>
            )}
            <Wand2 size={16} className="text-violet-400" />
            <h2 className="text-sm font-medium">{view === 'import' ? 'Import Skills' : t('skills.title')}</h2>
            {view === 'browse' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-500">~/.claude/skills/</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {view === 'browse' && (
              <button
                onClick={() => setView('import')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg transition-colors"
              >
                <Github size={12} />
                Import
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        {view === 'browse' ? (
          <BrowseView
            skills={skills}
            loading={loading}
            selected={selected}
            onSelect={setSelected}
            onDelete={handleDelete}
            t={t}
          />
        ) : (
          <ImportView
            installedSkills={skills}
            onInstalled={() => { loadSkills(); setView('browse'); }}
          />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-surface-800 flex-shrink-0">
          <span className="text-[10px] text-surface-600">
            {skills.length} {t('skills.skillCount')}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-surface-300 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Browse installed skills ───
function BrowseView({ skills, loading, selected, onSelect, onDelete, t }) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-surface-500 text-sm py-12">
        {t('common.loading')}
      </div>
    );
  }
  if (skills.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6 py-12">
        <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center">
          <Wand2 size={24} className="text-surface-600" />
        </div>
        <div>
          <p className="text-sm text-surface-300 font-medium">{t('skills.empty')}</p>
          <p className="text-xs text-surface-500 mt-1 max-w-sm">{t('skills.emptyDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex min-h-0">
      <div className="w-52 border-r border-surface-800 overflow-y-auto flex-shrink-0">
        {skills.map((skill) => (
          <button
            key={skill.name}
            onClick={() => onSelect(skill)}
            className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-2 group ${
              selected?.name === skill.name
                ? 'bg-violet-500/10 text-violet-300 border-r-2 border-violet-400'
                : 'text-surface-300 hover:bg-surface-800'
            }`}
          >
            <Wand2 size={12} className="flex-shrink-0" />
            <span className="truncate font-medium flex-1">{skill.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(skill.name); }}
              className="p-0.5 rounded hover:bg-red-500/20 text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              title="Delete"
            >
              <Trash2 size={10} />
            </button>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-w-0">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-surface-200">{selected.name}</h3>
              <span className="text-[10px] text-surface-600">{(selected.size / 1024).toFixed(1)}KB</span>
            </div>
            <pre className="text-xs text-surface-400 whitespace-pre-wrap bg-surface-800/50 rounded-lg p-3 border border-surface-700/50 leading-relaxed">
              {selected.content}
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-surface-600 text-xs">
            {t('skills.selectOne')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Import from GitHub ───
function ImportView({ installedSkills, onInstalled }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [installing, setInstalling] = useState(new Set());
  const [installed, setInstalled] = useState(new Set());
  const [previewSkill, setPreviewSkill] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [browsingPath, setBrowsingPath] = useState(null);
  const [pathHistory, setPathHistory] = useState([]);

  const installedNames = new Set(installedSkills.map(s => s.name));

  const fetchRepo = async (url, path) => {
    setFetching(true);
    setError(null);
    setResult(null);
    setPreviewSkill(null);
    try {
      const data = await api.fetchGithubSkills(url || repoUrl, path);
      setResult(data);
      if (path) {
        setBrowsingPath(path);
        setPathHistory(prev => [...prev, browsingPath].filter(Boolean));
      }
    } catch (e) {
      setError(e.message || 'Failed to fetch');
    } finally {
      setFetching(false);
    }
  };

  const handlePreview = async (skill) => {
    if (previewSkill?.name === skill.name) {
      setPreviewSkill(null);
      setPreviewContent(null);
      return;
    }
    setPreviewSkill(skill);
    setPreviewContent(null);
    if (skill.downloadUrl) {
      setPreviewLoading(true);
      try {
        const content = await api.fetchSkillContent(skill.downloadUrl);
        setPreviewContent(content);
      } catch {
        setPreviewContent('(Failed to load content)');
      }
      setPreviewLoading(false);
    }
  };

  const handleInstall = async (skill) => {
    setInstalling(prev => new Set(prev).add(skill.name));
    try {
      // Fetch content if not already loaded
      let content = previewSkill?.name === skill.name ? previewContent : null;
      if (!content && skill.downloadUrl) {
        content = await api.fetchSkillContent(skill.downloadUrl);
      }
      if (content) {
        await api.saveCustomSkill(skill.name, content);
        setInstalled(prev => new Set(prev).add(skill.name));
      }
    } catch {}
    setInstalling(prev => { const n = new Set(prev); n.delete(skill.name); return n; });
  };

  const goBack = () => {
    if (pathHistory.length > 0) {
      const prev = pathHistory[pathHistory.length - 1];
      setPathHistory(h => h.slice(0, -1));
      fetchRepo(repoUrl, prev);
    } else {
      fetchRepo(repoUrl, '');
      setBrowsingPath(null);
    }
  };

  // Filter skills by search and category
  const filteredSkills = (result?.skills || []).filter(s => {
    if (selectedCategory && s.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const anyInstalled = installed.size > 0;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
      {/* Popular repos */}
      {!result && !fetching && (
        <div>
          <label className="block text-xs font-medium text-surface-400 mb-2">Popular Skill Repositories</label>
          <div className="space-y-1.5">
            {POPULAR_REPOS.map((repo) => (
              <button
                key={repo.repo}
                onClick={() => { setRepoUrl(repo.repo); fetchRepo(repo.repo, repo.path); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-800/50 hover:bg-surface-800 border border-surface-700/30 hover:border-surface-700 text-left transition-colors group"
              >
                <Github size={16} className="text-surface-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-surface-200">{repo.label}</div>
                  <div className="text-[10px] text-surface-500">{repo.desc}</div>
                </div>
                <span className="text-[10px] text-surface-600 font-mono group-hover:text-surface-400">{repo.repo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom URL input */}
      {!result && (
        <div>
          <label className="block text-xs font-medium text-surface-400 mb-1.5">
            {fetching ? '' : 'Or enter a GitHub repository URL'}
          </label>
          <div className="flex gap-2">
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="user/repo or https://github.com/user/repo/tree/main/skills"
              className="flex-1 px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-surface-600 font-mono"
              onKeyDown={(e) => e.key === 'Enter' && repoUrl.trim() && fetchRepo()}
              disabled={fetching}
            />
            <button
              onClick={() => fetchRepo()}
              disabled={fetching || !repoUrl.trim()}
              className="px-4 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {fetching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              Fetch
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {fetching && (
        <div className="flex items-center justify-center py-12 gap-2 text-surface-500 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Fetching skills from GitHub...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !fetching && (
        <div className="space-y-3">
          {/* Header: repo + back */}
          <div className="flex items-center gap-2 text-[11px]">
            <button
              onClick={() => { setResult(null); setBrowsingPath(null); setPathHistory([]); setPreviewSkill(null); setSearchQuery(''); setSelectedCategory(null); }}
              className="text-surface-500 hover:text-surface-300"
            >
              <ArrowLeft size={10} className="inline mr-0.5" />Back
            </button>
            <span className="text-violet-400 font-mono">{result.repo}</span>
            <span className="text-surface-600">{result.skills?.length || 0} skills</span>
            <a href={`https://github.com/${result.repo}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-surface-600 hover:text-surface-400">
              <ExternalLink size={11} />
            </a>
          </div>

          {/* Search + category filter (for indexed repos) */}
          {result.skills?.length > 10 && (
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search skills..."
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 placeholder-surface-600"
                />
              </div>
              {result.categories?.length > 0 && (
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="px-2 py-1.5 bg-surface-800 border border-surface-700 rounded-lg text-xs text-surface-300 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="">All categories</option>
                  {result.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Directories (for API-browsed repos) */}
          {result.directories?.length > 0 && (
            <div className="space-y-1">
              {result.directories.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => fetchRepo(repoUrl, dir.path)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-800/30 hover:bg-surface-800 text-left text-xs transition-colors"
                >
                  <FolderOpen size={14} className="text-amber-400 flex-shrink-0" />
                  <span className="text-surface-200 font-medium">{dir.name}/</span>
                </button>
              ))}
            </div>
          )}

          {/* Skills list */}
          {filteredSkills.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-surface-400">
                  {filteredSkills.length}{filteredSkills.length !== (result.skills?.length || 0) ? ` / ${result.skills.length}` : ''} skills
                </span>
              </div>
              <div className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
                {filteredSkills.map((skill) => {
                  const isInstalled = installedNames.has(skill.name) || installed.has(skill.name);
                  const isInstalling = installing.has(skill.name);
                  const isPreview = previewSkill?.name === skill.name;
                  return (
                    <div key={skill.name}>
                      <div
                        className={`flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                          isPreview ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-surface-800/30 hover:bg-surface-800 border border-transparent'
                        }`}
                        onClick={() => handlePreview(skill)}
                      >
                        <Wand2 size={13} className="text-violet-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-surface-200">{skill.name}</span>
                            {skill.category && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700 text-surface-400">{skill.category}</span>
                            )}
                          </div>
                          {skill.description && (
                            <p className="text-[10px] text-surface-500 mt-0.5 line-clamp-1">{skill.description}</p>
                          )}
                        </div>
                        {isInstalled ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 flex-shrink-0">
                            <Check size={10} /> Installed
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleInstall(skill); }}
                            disabled={isInstalling}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            {isInstalling ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                            Install
                          </button>
                        )}
                      </div>
                      {/* Preview content (lazy loaded) */}
                      {isPreview && (
                        <div className="mt-1 mb-2 ml-7">
                          {previewLoading ? (
                            <div className="flex items-center gap-2 py-4 text-surface-500 text-xs">
                              <Loader2 size={12} className="animate-spin" /> Loading...
                            </div>
                          ) : (
                            <pre className="text-[11px] text-surface-400 whitespace-pre-wrap bg-surface-950 rounded-lg p-3 border border-surface-700/50 leading-relaxed max-h-48 overflow-y-auto">
                              {previewContent || '(empty)'}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No results */}
          {filteredSkills.length === 0 && (result.directories?.length || 0) === 0 && (
            <div className="text-center py-8 text-surface-500 text-xs">
              {searchQuery || selectedCategory ? 'No skills match your filter.' : 'No skills found in this repository.'}
            </div>
          )}

          {/* Done button */}
          {anyInstalled && (
            <button
              onClick={onInstalled}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              <Check size={14} />
              Done — {installed.size} skill{installed.size !== 1 ? 's' : ''} installed
            </button>
          )}
        </div>
      )}
    </div>
  );
}
