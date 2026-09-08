"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/health", function (_req, res) {
    res.json({
        success: true,
        service: "UyirKappan Backend",
        status: "UP"
    });
});
exports.default = app;
