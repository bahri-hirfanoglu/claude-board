import { useCallback } from 'react';
import { api } from '../lib/api';

export function useProjectHandlers({ currentProject, navigateToProject, navigateToDashboard, addToast, t, setConfirm, openModal, closeModal }) {

  const onCreate = useCallback(async (data) => {
    const p = await api.createProject(data);
    closeModal('project');
    navigateToProject(p);
    addToast(t('toast.projectCreated'), 'success');
  }, [navigateToProject, addToast, t, closeModal]);

  const onUpdate = useCallback(async (editingProject, data) => {
    await api.updateProject(editingProject.id, data);
    closeModal('project');
    addToast(t('toast.projectUpdated'), 'success');
    if (data.slug && currentProject && data.slug !== currentProject.slug)
      window.history.replaceState({ slug: data.slug }, '', `/${data.slug}`);
  }, [currentProject, addToast, t, closeModal]);

  const onDelete = useCallback(() => {
    if (!currentProject) return;
    setConfirm({
      title: 'Delete Project',
      message: `Delete "${currentProject.name}"? All tasks will be deleted.`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await api.deleteProject(currentProject.id);
        navigateToDashboard();
        addToast(t('toast.projectDeleted'), 'info');
      },
      onCancel: () => setConfirm(null),
    });
  }, [currentProject, navigateToDashboard, addToast, t, setConfirm]);

  const onEdit = useCallback(() => {
    if (currentProject) openModal('project', currentProject);
  }, [currentProject, openModal]);

  return { onCreate, onUpdate, onDelete, onEdit };
}
