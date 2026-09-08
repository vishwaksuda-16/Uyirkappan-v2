"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var app_js_1 = require("./app.js");
var PORT = process.env.PORT || 5000;
app_js_1.default.listen(PORT, function () {
    console.log("UyirKappan backend running on port ".concat(PORT));
});
