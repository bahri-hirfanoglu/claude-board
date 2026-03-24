export default function InlineDeleteConfirm({ message = 'Delete this item?', onConfirm, onCancel }) {
  return (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
      <div className="bg-surface-800 rounded-lg p-4 border border-surface-700 shadow-xl mx-4">
        <p className="text-sm text-surface-200 mb-3">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
