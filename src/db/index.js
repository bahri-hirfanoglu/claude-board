// Database barrel export
// Import order matters: connection first, then schema, then queries
export { default as db, queryAll, queryOne, run, save, saveSync } from './connection.js';
import './schema.js'; // Side-effect: creates tables and runs migrations
export { projectQueries } from './projects.js';
export { queries } from './tasks.js';
export { statsQueries } from './stats.js';
export { activityLog } from './activity.js';
