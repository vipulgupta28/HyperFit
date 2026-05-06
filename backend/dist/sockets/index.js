"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.emitTileUpdates = emitTileUpdates;
exports.emitTerritoryChanged = emitTerritoryChanged;
const socket_io_1 = require("socket.io");
let io = null;
function initSocket(server, corsOrigin) {
    io = new socket_io_1.Server(server, {
        cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    });
    io.on('connection', (socket) => {
        // eslint-disable-next-line no-console
        console.log(`[socket] connected ${socket.id}`);
        socket.on('subscribe_region', (region) => {
            if (region?.regionId)
                socket.join(region.regionId);
        });
        socket.on('disconnect', () => {
            // eslint-disable-next-line no-console
            console.log(`[socket] disconnected ${socket.id}`);
        });
    });
    return io;
}
function emitTileUpdates(tiles) {
    if (!io || tiles.length === 0)
        return;
    io.emit('tile_updated', tiles);
}
function emitTerritoryChanged(userId, territoryCount) {
    if (!io)
        return;
    io.emit('territory_changed', { userId, territoryCount });
}
