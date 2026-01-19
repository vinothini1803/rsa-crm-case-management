// import { Server } from "socket.io";
// import http from "http";

// let io: Server | null = null;

// export const initSocket = (server: http.Server): Server => {
//   io = new Server(server, {
//     cors: {
//       origin: "*",
//     },
//   });

//   io.on("connection", (socket) => {
//     console.log("🔗 Socket connected:", socket.id);

//     socket.on("joinRoom", (room: string) => {
//       socket.join(room);
//       console.log(`Socket ${socket.id} joined room: ${room}`);
//     });
// setTimeout(() => {
//   console.log("🔥 Global emit test");
//   io.emit("serviceReminder", {
//     title: "GLOBAL TEST",
//     message: "If you see this, frontend is OK",
//     time: new Date(),
//   });
// }, 3000);
//     socket.on("disconnect", () => {
//       console.log("❌ Socket disconnected:", socket.id);
//     });
//   });

//   return io;
// };

// export const getIO = (): Server => {
//   if (!io) {
//     throw new Error("Socket.IO not initialized");
//   }
//   return io;
// };


import { Server } from "socket.io";
import http from "http";

let io: Server | null = null;

export const initSocket = (server: http.Server): Server => {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
    transports: ["websocket"],
  });

  io.on("connection", (socket) => {
    console.log("🔗 Socket connected:", socket.id);

    socket.on("joinRoom", (room: string) => {
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    // 🔥 DEBUG EMIT (GLOBAL)
    // setTimeout(() => {
    //   console.log("🔥 Global emit test");

    //   getIO().emit("serviceReminder", {
    //     title: "GLOBAL TEST",
    //     message: "If you see this, frontend is OK",
    //     time: new Date(),
    //   });
    // }, 1000);

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};
