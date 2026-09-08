module.exports = {
  log(level, message, data = undefined) {
    const ts = new Date().toTimeString().slice(0, 8);
    const extra = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[${ts}] [${level.toUpperCase()}] ${message}${extra}`);
  },
  info: (m, d) => module.exports.log('info', m, d),
  warn: (m, d) => module.exports.log('warn', m, d),
  error: (m, d) => module.exports.log('error', m, d),
};