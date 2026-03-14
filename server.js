import 'dotenv/config';
import { createApp } from './src/app.js';

const PORT = process.env.PORT || 4000;
const { server } = createApp();

server.listen(PORT, () => {
  console.log(`\n  Claude Board v3.0.0 running at http://localhost:${PORT}\n`);
});
