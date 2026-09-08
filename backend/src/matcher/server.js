"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.services = exports.io = void 0;
const http_1 = __importDefault(require("http"));
const app_js_1 = __importDefault(require("./app.js"));
const socket_io_1 = require("socket.io");
const service_container_js_1 = require("./config/service-container.js");
const PORT = process.env.PORT || 5000;
const httpServer = http_1.default.createServer(app_js_1.default);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
exports.io = io;
/*
 * ============================
 * SERVICE CONTAINER
 * ============================
 */
const services = (0, service_container_js_1.createServiceContainer)(io);
exports.services = services;
/*
 * ============================
 * SIMULATION API
 * ============================
 */
app_js_1.default.post("/api/simulation/start", async (req, res) => {
    try {
        const requestId = req.body?.requestId ||
            "REQ-E2E-FALLBACK-M5-M6-001";
        if (services
            .simulationDemoService
            .isRunning()) {
            return res.status(409).json({
                success: false,
                message: "Simulation already running"
            });
        }
        /*
         * Start asynchronously.
         */
        services
            .simulationDemoService
            .start(requestId)
            .catch(error => {
            console.error("Simulation failed:", error);
        });
        return res.json({
            success: true,
            message: "Simulation started",
            requestId
        });
    }
    catch (error) {
        console.error("Failed to start simulation:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to start simulation"
        });
    }
});
app_js_1.default.post("/api/simulation/stop", (_req, res) => {
    services
        .simulationDemoService
        .stop();
    return res.json({
        success: true,
        message: "Simulation stop requested"
    });
});
/*
 * ============================
 * SOCKET CONNECTION
 * ============================
 */
io.on("connection", socket => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on("join-emergency", (requestId) => {
        const room = `emergency:${requestId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined ${room}`);
        socket.emit("joined-emergency", {
            requestId,
            room
        });
    });
    socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});
/*
 * ============================
 * SERVER START
 * ============================
 */
httpServer.listen(PORT, () => {
    console.log(`UyirKappan backend running on port ${PORT}`);
    console.log("Socket.IO real-time server ready");
    console.log("Module 5/6 services initialized");
});
