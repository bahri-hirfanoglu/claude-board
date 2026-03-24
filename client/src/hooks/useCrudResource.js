import { useState, useEffect, useCallback } from 'react';

export function useCrudResource({ projectId, getAll, create, update, remove }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | item object
  const [deleting, setDeleting] = useState(null);

  const reload = useCallback(async () => {
    try {
      const data = await getAll(projectId);
      setItems(data);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [projectId, getAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = useCallback(async (data) => {
    if (editing === 'new') {
      await create(projectId, data);
    } else if (editing?.id) {
      await update(editing.id, data);
    }
    setEditing(null);
    reload();
  }, [editing, projectId, create, update, reload]);

  const handleDelete = useCallback(async (id) => {
    await remove(id);
    setDeleting(null);
    reload();
  }, [remove, reload]);

  return { items, loading, editing, setEditing, deleting, setDeleting, handleSave, handleDelete, reload };
}
