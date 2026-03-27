import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { socket } from '../lib/socket';
import { tauriListen, IS_TAURI } from '../lib/tauriEvents';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
      return data;
    } catch (err) {
      console.error('Failed to load projects:', err);
      return [];
    }
  }, []);

  // Initial load + URL slug resolution
  useEffect(() => {
    loadProjects().then((data) => {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (path && data.length > 0) {
        const match = data.find((p) => p.slug === path);
        if (match) {
          setCurrentProject(match);
          window.history.replaceState({ slug: match.slug }, '', `/${match.slug}`);
        }
      }
      setInitialLoad(false);
    });
  }, [loadProjects]);

  // Browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const slug = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (slug) {
        const match = projects.find((p) => p.slug === slug);
        setCurrentProject(match || null);
      } else {
        setCurrentProject(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [projects]);

  // Socket events — empty deps is intentional: `socket` is a module-level singleton
  // (never changes) and all handlers use only state setter functions (stable by React guarantee)
  useEffect(() => {
    const onCreate = (project) => setProjects((prev) => [...prev, project]);
    const onUpdate = (project) => {
      setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)));
      setCurrentProject((prev) => (prev?.id === project.id ? project : prev));
    };
    const onDelete = ({ id }) => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setCurrentProject((prev) => {
        if (prev?.id === id) {
          window.history.pushState({}, '', '/');
          return null;
        }
        return prev;
      });
    };

    if (IS_TAURI) {
      const unsubs = [
        tauriListen('project:created', onCreate),
        tauriListen('project:updated', onUpdate),
        tauriListen('project:deleted', onDelete),
      ];
      return () => unsubs.forEach((fn) => fn());
    } else {
      socket.on('project:created', onCreate);
      socket.on('project:updated', onUpdate);
      socket.on('project:deleted', onDelete);
      return () => {
        socket.off('project:created', onCreate);
        socket.off('project:updated', onUpdate);
        socket.off('project:deleted', onDelete);
      };
    }
  }, []);

  const navigateToProject = useCallback((project) => {
    setCurrentProject(project);
    if (project) window.history.pushState({ slug: project.slug }, '', `/${project.slug}`);
  }, []);

  const navigateToDashboard = useCallback(() => {
    setCurrentProject(null);
    window.history.pushState({}, '', '/');
  }, []);

  return {
    projects,
    currentProject,
    initialLoad,
    navigateToProject,
    navigateToDashboard,
    setCurrentProject,
  };
}
