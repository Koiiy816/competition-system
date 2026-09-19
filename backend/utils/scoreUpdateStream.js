const clientsBySchedule = new Map();

const streamKey = (competitionId, scheduleId) => `${competitionId}:${scheduleId}`;

const broadcastScoreEvent = (competitionId, scheduleId, event, data) => {
  const clients = clientsBySchedule.get(streamKey(competitionId, scheduleId));
  if (!clients?.size) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (!client.writableEnded && !client.destroyed) client.write(payload);
  }
};

// 一个场次只维护当前打开的评分页连接。没有业务变动时不访问数据库。
const openScoreStream = (req, res) => {
  const scheduleId = String(req.query.scheduleId || '');
  if (!scheduleId) {
    return res.status(400).json({ success: false, message: '缺少赛程ID' });
  }

  const key = streamKey(req.params.competitionId, scheduleId);
  const clients = clientsBySchedule.get(key) || new Set();
  clientsBySchedule.set(key, clients);

  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  res.write(': connected\n\n');
  clients.add(res);

  const heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(': keepalive\n\n');
  }, 25000);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clients.delete(res);
    if (clients.size === 0) clientsBySchedule.delete(key);
  };
  req.on('close', cleanup);
  res.on('error', cleanup);
};

module.exports = { broadcastScoreEvent, openScoreStream };
