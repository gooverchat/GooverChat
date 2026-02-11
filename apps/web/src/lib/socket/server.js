const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function setupSocketServer(httpServer) {
  const io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST'],
    },
  });

  const redisUrl = process.env.SOCKET_IO_REDIS_URL || process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
      }).catch((err) => console.warn('Socket.IO Redis adapter failed', err.message));
    } catch (e) {
      console.warn('Socket.IO Redis adapter skipped', e?.message);
    }
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('auth_required'));
    const { verifyAccessToken } = require('./auth-verify');
    verifyAccessToken(token).then((payload) => {
      if (payload) {
        socket.userId = payload.sub;
        socket.userEmail = payload.email;
        return next();
      }
      next(new Error('invalid_token'));
    }).catch(() => next(new Error('invalid_token')));
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.broadcast.emit('presence:update', { userId: socket.userId, status: 'online' });

    // Send current online user IDs to the newly connected client
    io.fetchSockets().then((sockets) => {
      const userIds = [...new Set(sockets.map((s) => s.userId).filter(Boolean))];
      socket.emit('presence:initial', { userIds });
    }).catch(() => {});

    socket.on('conversation:join', async (conversationId) => {
      if (!conversationId) return;
      try {
        const member = await prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: { conversationId, userId: socket.userId },
          },
        });
        if (!member) {
          socket.emit('error', { message: 'forbidden', event: 'conversation:join' });
          return;
        }
        socket.join(`conversation:${conversationId}`);
      } catch (err) {
        socket.emit('error', { message: 'forbidden', event: 'conversation:join' });
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    socket.on('typing:start', (data) => {
      if (data?.conversationId) {
        socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
          userId: socket.userId,
          conversationId: data.conversationId,
        });
      }
    });

    socket.on('typing:stop', (data) => {
      if (data?.conversationId) {
        socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
          userId: socket.userId,
          conversationId: data.conversationId,
        });
      }
    });

    socket.on('disconnect', () => {
      socket.broadcast.emit('presence:update', { userId: socket.userId, status: 'offline' });
    });
  });

  return io;
}

module.exports = { setupSocketServer };
