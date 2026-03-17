import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, Trash2, Shield, Globe } from 'lucide-react';
import { api } from '../../lib/api';

const ROLE_COLORS = [
  '#6B7280',
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
];

function RoleForm({ role, onSave, onCancel }) {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [prompt, setPrompt] = useState(role?.prompt || '');
  const [color, setColor] = useState(role?.color || '#6B7280');
  const [isGlobal, setIsGlobal] = useState(role?.project_id === null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), prompt: prompt.trim(), color, global: isGlobal });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs text-surface-400 mb-1 block">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Senior Backend Developer"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude"
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1 block">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Experienced in Node.js, databases, and API design"
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude"
        />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1 block">
          Prompt Instructions
          <span className="text-surface-600 font-normal ml-1">- injected into Claude's prompt</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            'You are a senior backend developer with deep expertise in Node.js and PostgreSQL.\n\nKey principles:\n- Write clean, testable code\n- Follow SOLID principles\n- Add proper error handling'
          }
          rows={5}
          className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-claude resize-y"
        />
      </div>
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">Color</label>
        <div className="flex gap-1.5">
          {ROLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-1 ring-offset-surface-900 ring-white/60 scale-110' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 cursor-pointer group">
          <button
            type="button"
            onClick={() => setIsGlobal(!isGlobal)}
            className={`relative w-8 h-4.5 rounded-full transition-colors ${isGlobal ? 'bg-claude' : 'bg-surface-700'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${isGlobal ? 'translate-x-3.5' : ''}`}
            />
          </button>
          <span className="text-xs text-surface-400 group-hover:text-surface-200 flex items-center gap-1">
            <Globe size={11} />
            Shared across all projects
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-3 py-1.5 text-xs bg-claude hover:bg-claude-light text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {role?.id ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function RolesModal({ projectId, projectName, onClose }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const loadRoles = useCallback(async () => {
    try {
      const data = await api.getRoles(projectId);
      setRoles(data);
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleSave = async (data) => {
    if (editing === 'new') {
      await api.createRole(projectId, data);
    } else if (editing?.id) {
      await api.updateRole(editing.id, data);
    }
    setEditing(null);
    loadRoles();
  };

  const handleDelete = async (id) => {
    await api.deleteRole(id);
    setDeleting(null);
    loadRoles();
  };

  const projectRoles = roles.filter((r) => r.project_id !== null);
  const globalRoles = roles.filter((r) => r.project_id === null);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-lg shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div>
            <h2 className="text-base font-semibold text-surface-100 flex items-center gap-2">
              <Shield size={16} className="text-claude" />
              Roles
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">{projectName} — assign personas to tasks</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-800 text-surface-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-claude/20 border-t-claude animate-spin" />
            </div>
          ) : (
            <>
              {/* Role list */}
              {roles.length > 0 && !editing && (
                <div className="space-y-2 mb-4">
                  {/* Project Roles */}
                  {projectRoles.length > 0 && (
                    <>
                      <div className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-1">
                        Project Roles
                      </div>
                      {projectRoles.map((r) => (
                        <RoleItem key={r.id} role={r} onEdit={setEditing} onDelete={setDeleting} />
                      ))}
                    </>
                  )}

                  {/* Global Roles */}
                  {globalRoles.length > 0 && (
                    <>
                      <div
                        className={`text-[10px] font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1 ${projectRoles.length > 0 ? 'mt-4 mb-1' : 'mb-1'}`}
                      >
                        <Globe size={10} />
                        Shared Roles
                      </div>
                      {globalRoles.map((r) => (
                        <RoleItem key={r.id} role={r} onEdit={setEditing} onDelete={setDeleting} isGlobal />
                      ))}
                    </>
                  )}
                </div>
              )}

              {roles.length === 0 && !editing && (
                <div className="text-center py-8 text-surface-500">
                  <Shield size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No roles yet</p>
                  <p className="text-xs mt-1">Create roles to define Claude's persona for tasks</p>
                </div>
              )}

              {/* Edit/Create form */}
              {editing && (
                <div className="bg-surface-800/30 rounded-lg p-4 border border-surface-700/50">
                  <h3 className="text-xs font-medium text-surface-400 mb-3">
                    {editing === 'new' ? 'New Role' : `Edit: ${editing.name}`}
                  </h3>
                  <RoleForm
                    role={editing === 'new' ? null : editing}
                    onSave={handleSave}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              )}

              {/* Add button */}
              {!editing && (
                <button
                  onClick={() => setEditing('new')}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-surface-700 text-xs text-surface-400 hover:text-claude hover:border-claude/50 transition-colors"
                >
                  <Plus size={14} />
                  Add Role
                </button>
              )}
            </>
          )}
        </div>

        {/* Delete confirmation */}
        {deleting && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
            <div className="bg-surface-800 rounded-lg p-4 border border-surface-700 shadow-xl mx-4">
              <p className="text-sm text-surface-200 mb-3">Delete this role?</p>
              <p className="text-xs text-surface-500 mb-3">
                Tasks using this role will keep working but without role instructions.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleting(null)}
                  className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleting)}
                  className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleItem({ role, onEdit, onDelete, isGlobal }) {
  return (
    <div className="bg-surface-800/50 rounded-lg px-4 py-3 border border-surface-700/50">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
          <h3 className="text-sm font-medium text-surface-200">{role.name}</h3>
          {isGlobal && <Globe size={10} className="text-surface-500" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(role)}
            className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(role.id)}
            className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {role.description && <p className="text-xs text-surface-400 mb-1">{role.description}</p>}
      {role.prompt && <p className="text-xs text-surface-500 whitespace-pre-wrap line-clamp-2">{role.prompt}</p>}
    </div>
  );
}
