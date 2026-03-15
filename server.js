import 'dotenv/config';
import { createApp } from './src/app.js';

const PORT = process.env.PORT || 4000;
const { server } = createApp();

server.listen(PORT, () => {
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    gray: '\x1b[90m',
    magenta: '\x1b[35m',
  };
  console.log('');
  console.log(`  ${c.magenta}${c.bold}╔══════════════════════════════════════╗${c.reset}`);
  console.log(
    `  ${c.magenta}${c.bold}║${c.reset}   ${c.cyan}${c.bold}Claude Board${c.reset} ${c.gray}v3.4.0${c.reset}               ${c.magenta}${c.bold}║${c.reset}`,
  );
  console.log(`  ${c.magenta}${c.bold}╚══════════════════════════════════════╝${c.reset}`);
  console.log('');
  console.log(`  ${c.green}→${c.reset} Local:   ${c.bold}http://localhost:${PORT}${c.reset}`);
  console.log(`  ${c.gray}→ Press Ctrl+C to stop${c.reset}`);
  console.log('');
});

// Graceful shutdown
function shutdown(signal) {
  const c = { reset: '\x1b[0m', yellow: '\x1b[33m', gray: '\x1b[90m' };
  console.log(`\n  ${c.yellow}[SHUTDOWN]${c.reset} ${signal} received, closing server...`);
  server.close(() => {
    console.log(`  ${c.gray}Server stopped. Goodbye.${c.reset}\n`);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
