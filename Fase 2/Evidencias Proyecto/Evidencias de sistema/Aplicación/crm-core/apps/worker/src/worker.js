const { Worker, QueueEvents } = require('bullmq');

console.log('🚀 Worker starting...');

// Configuración Redis
const connection = {
    host: 'redis',
    port: 6379,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
};

console.log('📡 Connecting to Redis:', connection);

try {
    // Worker para procesar jobs
    const worker = new Worker('ot-jobs', async(job) => {
        console.log('✅ [WORKER] Job procesado:', {
            id: job.id,
            name: job.name,
            data: job.data,
            timestamp: new Date().toISOString()
        });

        // Simular procesamiento
        await new Promise(function(resolve) {
            setTimeout(resolve, 1000);
        });

        return { status: 'completed', processedAt: new Date().toISOString() };
    }, {
        connection,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
        concurrency: 5
    });

    // Eventos del queue
    const queueEvents = new QueueEvents('ot-jobs', { connection });

    queueEvents.on('completed', function(data) {
        console.log('🎉 Job completado:', data.jobId);
    });

    queueEvents.on('failed', function(data) {
        console.error('❌ Job falló:', data.jobId, data.failedReason);
    });

    queueEvents.on('waiting', function(data) {
        console.log('⏳ Job en espera:', data.jobId);
    });

    // Manejar errores del worker
    worker.on('failed', function(job, err) {
        var jobId = job ? job.id : 'unknown';
        console.error('❌ Worker error en job:', job?.id, err.message);
    });

    // Manejar conexión
    worker.on('ready', function() {
        console.log('✅ Worker listo y conectado a Redis');
    });

    worker.on('error', function(err) {
        console.error('💥 Worker error:', err);
    });

    console.log('📊 Worker iniciado - Escuchando cola: ot-jobs');

} catch (error) {
    console.error('💥 ERROR: Worker failed to start:', error.message);
    process.exit(1);
}