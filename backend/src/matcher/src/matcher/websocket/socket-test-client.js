"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const socket = (0, socket_io_client_1.io)("http://localhost:5000");
socket.on("connect", () => {
    console.log("Connected to Socket.IO:", socket.id);
    socket.emit("join-emergency", "REQ-TRACK-ETA-001");
});
socket.on("joined-emergency", (data) => {
    console.log("Joined emergency room:", data);
});
socket.on("AMBULANCE_LOCATION_UPDATED", (data) => {
    console.log("LOCATION UPDATE:", data);
});
socket.on("ETA_UPDATED", (data) => {
    console.log("ETA UPDATE:", data);
});
socket.on("STATUS_UPDATED", (data) => {
    console.log("STATUS UPDATE:", data);
});
socket.on("ROUTE_UPDATED", (data) => {
    console.log("ROUTE UPDATE:", data);
});
socket.on("disconnect", () => {
    console.log("Disconnected from Socket.IO");
});
