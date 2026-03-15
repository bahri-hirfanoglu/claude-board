import { queryAll, queryOne, run } from './connection.js';

export const attachmentQueries = {
  getByTask: (taskId) => queryAll('SELECT * FROM task_attachments WHERE task_id=? ORDER BY id', [taskId]),
  getById: (id) => queryOne('SELECT * FROM task_attachments WHERE id=?', [id]),
  create: (taskId, filename, originalName, mimeType, size) =>
    run('INSERT INTO task_attachments (task_id,filename,original_name,mime_type,size) VALUES (?,?,?,?,?)', [
      taskId,
      filename,
      originalName,
      mimeType,
      size,
    ]),
  remove: (id) => run('DELETE FROM task_attachments WHERE id=?', [id]),
  removeByTask: (taskId) => run('DELETE FROM task_attachments WHERE task_id=?', [taskId]),
};
