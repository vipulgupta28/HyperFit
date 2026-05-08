import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import http from 'http';

import { config } from './config';
import { errorHandler, notFound } from './middlewares/error';
import { router } from './routes';
import { decayAllTiles } from './services/tiles.service';
import { emitTileUpdates, initSocket } from './sockets';
import { wireTilesFromCells } from './utils/h3Geo';

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '15mb' }));
app.use('/', router);
app.use(notFound);
app.use(errorHandler);

initSocket(server, config.corsOrigin);

setInterval(() => {
  decayAllTiles()
    .then((decayed) => {
      if (decayed.length > 0) emitTileUpdates(wireTilesFromCells(decayed));
    })
    .catch((err) => {
      console.error('[decay] error:', err);
    });
}, config.decay.intervalMs);

server.listen(config.port, () => {
  console.log(`[territory-run] api listening on http://localhost:${config.port}`);
});
