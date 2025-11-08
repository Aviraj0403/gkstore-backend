import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";

const secret = process.env.JWTSECRET;

// Setup Socket.IO on the provided server instance
export const setupSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
      ],
      methods: ["GET", "POST"],
      credentials: true, 
    },
    transports: ['websocket', 'polling'], 
  });

  io.use((socket, next) => {
    const cookieHeader = socket.request.headers.cookie; 

    if (!cookieHeader) {
      return next(new Error("No cookies found"));
    }
    const cookies = cookie.parse(cookieHeader); 
    const token = cookies.jwt; 

    if (!token) {
      return next(new Error("Authentication error: Token is missing"));
    }
    jwt.verify(token, secret, (err, decoded) => {
      if (err || !decoded) {
        return next(new Error("Authentication error: Invalid token"));
      }
      if (decoded.data.roleType !== "admin") {
        return next(new Error("Authorization error: You must be an admin to connect"));
      }
      socket.user = decoded.data;

      return next(); 
    });
  });
  io.on("connection", (socket) => {
    console.log(`Admin connected: ${socket.id}`);

    socket.on("newOrder", (order) => {
      console.log(`New order received: ${order}`);
      io.emit("newOrder", order); 
    });

    socket.on("disconnect", () => {
      console.log(`Admin disconnected: ${socket.id}`);
    });
  });

  return io;
};
