// backend/config/socket.js
const { Server } = require("socket.io");

let io;

const initSocket = (server, allowedOrigins) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("New client connected", socket.id);

    // Join room based on user ID (assuming client sends userId)
    socket.on("join", (userId) => {
        if(userId) {
            socket.join(userId);
            console.log(`Socket ${socket.id} joined room ${userId}`);
        } else {
            console.log(`Socket ${socket.id} tried to join with invalid userId`);
        }
    });

    // Also support joining with just the token if not explicitly sent? 
    // Usually the 'join' event is explicit.

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIo };
