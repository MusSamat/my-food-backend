const { Server } = require('socket.io');

let io = null;

const initWebSocket = (server) => {
    io = new Server(server, {
        cors: { origin: true, credentials: true },
        path: '/ws',
    });

    io.on('connection', (socket) => {
        console.log(`🔌 WS connected: ${socket.id}`);

        // Client joins room for their order
        socket.on('join:order', (orderId) => {
            socket.join(`order:${orderId}`);
        });

        // Admin joins room for branch
        socket.on('join:admin', (branchId) => {
            socket.join('admin:all');
            if (branchId) socket.join(`admin:branch:${branchId}`);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 WS disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIO = () => io;

// Emit order status change to client + admin
const emitOrderUpdate = (order) => {
    if (!io) return;
    // To client watching this order
    io.to(`order:${order.id}`).emit('order:status', {
        order_id: order.id,
        status: order.status,
    });
    // To admin dashboards
    io.to('admin:all').emit('order:updated', { order_id: order.id, status: order.status });
    if (order.branch_id) {
        io.to(`admin:branch:${order.branch_id}`).emit('order:updated', { order_id: order.id, status: order.status });
    }
};

// Emit new order to admins
const emitNewOrder = (order) => {
    if (!io) return;
    io.to('admin:all').emit('order:new', { order_id: order.id, name: order.name, total: order.total, branch_id: order.branch_id });
    if (order.branch_id) {
        io.to(`admin:branch:${order.branch_id}`).emit('order:new', { order_id: order.id, name: order.name, total: order.total });
    }
};

module.exports = { initWebSocket, getIO, emitOrderUpdate, emitNewOrder };