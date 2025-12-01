import { Worker, QueueEvents } from 'bullmq';

const connection = { connection: { host: 'redis', port: 6379 } };

const w = new Worker('ot-jobs', async (job) => {
  // Procesa creación/validaciones de OT, notificaciones, etc.
  console.log('[worker] job recibido', job.name, job.id, job.data);
}, connection);

const qe = new QueueEvents('ot-jobs', connection);
qe.on('completed', ({ jobId }) => console.log('[worker] completado', jobId));
qe.on('failed', ({ jobId, failedReason }) => console.error('[worker] falló', jobId, failedReason));

console.log('[worker] listo');
