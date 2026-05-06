"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const config_1 = require("./config");
const error_1 = require("./middlewares/error");
const routes_1 = require("./routes");
const tiles_service_1 = require("./services/tiles.service");
const sockets_1 = require("./sockets");
const h3Geo_1 = require("./utils/h3Geo");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
app.use((0, cors_1.default)({ origin: config_1.config.corsOrigin }));
app.use(express_1.default.json({ limit: '1mb' }));
app.use('/', routes_1.router);
app.use(error_1.notFound);
app.use(error_1.errorHandler);
(0, sockets_1.initSocket)(server, config_1.config.corsOrigin);
setInterval(() => {
    const decayed = (0, tiles_service_1.decayAllTiles)();
    if (decayed.length > 0)
        (0, sockets_1.emitTileUpdates)((0, h3Geo_1.wireTilesFromCells)(decayed));
}, config_1.config.decay.intervalMs);
server.listen(config_1.config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[territory-run] api listening on http://localhost:${config_1.config.port}`);
});
