function timestamp() {
  return new Date().toISOString();
}

function format(level, message, meta) {
  const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp()}] [${level}] ${message}${suffix}`;
}

function info(message, meta = {}) {
  console.log(format('INFO', message, meta));
}

function warn(message, meta = {}) {
  console.warn(format('WARN', message, meta));
}

function error(message, meta = {}) {
  console.error(format('ERROR', message, meta));
}

module.exports = {
  info,
  warn,
  error
};