/**
 * OfflineHandler - Módulo universal para manejo de conexión/desconexión
 * 
 * Funcionalidades:
 * - Detección de pérdida de conexión (navigator.onLine + fetch fallback)
 * - Banner "Sin conexión" visible
 * - Cola de operaciones pendientes (localStorage)
 * - Reintentos automáticos cuando se recupera conexión
 * - Intercepta bearerFetch para encolar operaciones cuando está offline
 * 
 * USO:
 *   <script src="assets/js/offline-handler.js"></script>
 *   <script>
 *     OfflineHandler.init();
 *     // bearerFetch ahora se encola automáticamente cuando está offline
 *   </script>
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'crm.offline.queue';
    const CONNECTION_CHECK_INTERVAL = 5000; // 5 segundos
    const RETRY_INTERVAL = 3000; // 3 segundos entre reintentos
    const MAX_RETRIES = 3; // Máximo de reintentos por operación
    const CONNECTION_CHECK_URL = '/api/auth/health'; // Endpoint para verificar conexión

    const OfflineHandler = {
        // Estado
        isOnline: navigator.onLine,
        isCheckingConnection: false,
        queue: [], // Operaciones en memoria (con promises)
        persistedQueue: [], // Operaciones guardadas en localStorage (sin promises)
        retryTimer: null,
        connectionCheckTimer: null,
        banner: null,
        initialized: false,
        socket: null, // Instancia de Socket.IO
        socketConnected: false, // Estado de conexión de Socket.IO

        /**
         * Inicializar el handler
         * @returns {void}
         */
        init: function() {
            if (this.initialized) return;
            
            // Cargar cola persistida desde localStorage
            this.loadPersistedQueue();
            
            // Crear banner
            this.createBanner();
            
            // Inicializar Socket.IO si está disponible
            this.initSocket();
            
            // Escuchar eventos de conexión del navegador
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());
            
            // Verificar conexión periódicamente (fallback si Socket.IO no está disponible)
            this.startConnectionCheck();
            
            // Iniciar procesamiento de cola
            this.startQueueProcessor();
            
            // Interceptar fetch/bearerFetch
            this.interceptFetch();
            
            // Verificar estado inicial
            this.checkConnection();
            
            this.initialized = true;
            console.log('[OfflineHandler] Inicializado');
        },

        /**
         * Inicializar Socket.IO para detección reactiva de conexión
         * @returns {void}
         */
        initSocket: function() {
            // Verificar si Socket.IO está disponible
            if (typeof window.io !== 'function') {
                console.log('[OfflineHandler] Socket.IO no disponible, usando polling como fallback');
                return;
            }

            // Solo inicializar Socket.IO si hay un token (usuario autenticado)
            // Esto evita problemas en la página de login
            const token = localStorage.getItem('crm.token') || localStorage.getItem('token');
            if (!token) {
                console.log('[OfflineHandler] No hay token de autenticación, Socket.IO se inicializará después del login');
                return;
            }

            try {
                // Crear conexión Socket.IO
                this.socket = window.io('/', { 
                    path: '/socket.io/',
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    reconnectionAttempts: Infinity,
                    timeout: 20000,
                    transports: ['websocket', 'polling'],
                    // No forzar desconexión si hay un error de autenticación
                    autoConnect: true
                });

                // Escuchar evento de conexión
                this.socket.on('connect', () => {
                    console.log('[OfflineHandler] Socket.IO conectado - servidor online');
                    this.socketConnected = true;
                    
                    // Si estaba offline, ahora está online
                    if (!this.isOnline) {
                        this.handleOnline();
                    }
                });

                // Escuchar evento de desconexión
                this.socket.on('disconnect', (reason) => {
                    console.log('[OfflineHandler] Socket.IO desconectado:', reason);
                    this.socketConnected = false;
                    
                    // Solo marcar como offline si no es una desconexión voluntaria o de autenticación
                    if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
                        if (this.isOnline) {
                            this.handleOffline();
                        }
                    }
                });

                // Escuchar errores de conexión
                this.socket.on('connect_error', (error) => {
                    console.log('[OfflineHandler] Error de conexión Socket.IO:', error.message);
                    this.socketConnected = false;
                    
                    // Solo marcar como offline si no es un error de autenticación
                    if (!error.message || !error.message.includes('auth')) {
                        if (this.isOnline) {
                            this.handleOffline();
                        }
                    }
                });

                // Escuchar reconexión
                this.socket.on('reconnect', (attemptNumber) => {
                    console.log('[OfflineHandler] Socket.IO reconectado después de', attemptNumber, 'intentos');
                    this.socketConnected = true;
                    
                    // Si estaba offline, ahora está online
                    if (!this.isOnline) {
                        this.handleOnline();
                    }
                });

                // Escuchar intento de reconexión
                this.socket.on('reconnect_attempt', (attemptNumber) => {
                    console.log('[OfflineHandler] Intentando reconectar Socket.IO (intento', attemptNumber, ')');
                });

                console.log('[OfflineHandler] Socket.IO inicializado');
            } catch (error) {
                console.error('[OfflineHandler] Error al inicializar Socket.IO:', error);
                this.socket = null;
            }
        },

        /**
         * Crear banner de estado de conexión
         * @returns {void}
         */
        createBanner: function() {
            // Remover banner existente si hay
            const existing = document.getElementById('offline-banner');
            if (existing) existing.remove();
            
            const banner = document.createElement('div');
            banner.id = 'offline-banner';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #dc3545;
                color: white;
                padding: 12px 20px;
                text-align: center;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                display: none;
            `;
            banner.innerHTML = `
                <span>⚠️ Sin conexión a internet. Las operaciones se guardarán y se enviarán cuando se recupere la conexión.</span>
                <span id="offline-queue-count" style="margin-left: 10px; font-weight: normal;"></span>
            `;
            document.body.appendChild(banner);
            this.banner = banner;
        },

        /**
         * Mostrar banner
         * @returns {void}
         */
        showBanner: function() {
            if (this.banner) {
                this.banner.style.display = 'block';
                // Ajustar padding del body para que no oculte contenido
                document.body.style.paddingTop = document.body.style.paddingTop || '0px';
                const bannerHeight = this.banner.offsetHeight;
                if (!document.body.style.paddingTop || parseInt(document.body.style.paddingTop) < bannerHeight) {
                    document.body.style.paddingTop = bannerHeight + 'px';
                }
                this.updateBannerCount();
            }
        },

        /**
         * Ocultar banner
         * @returns {void}
         */
        hideBanner: function() {
            if (this.banner) {
                this.banner.style.display = 'none';
                // Restaurar padding del body
                document.body.style.paddingTop = '0px';
            }
        },

        /**
         * Actualizar contador en banner
         * @returns {void}
         */
        updateBannerCount: function() {
            const countEl = document.getElementById('offline-queue-count');
            const totalPending = this.queue.length + this.persistedQueue.length;
            if (countEl && totalPending > 0) {
                countEl.textContent = `(${totalPending} operación${totalPending > 1 ? 'es' : ''} pendiente${totalPending > 1 ? 's' : ''})`;
            } else if (countEl) {
                countEl.textContent = '';
            }
        },

        /**
         * Verificar conexión real con fetch
         * @returns {Promise<boolean>}
         */
        checkConnection: async function() {
            // Si Socket.IO está conectado, confiar en él (más rápido y reactivo)
            if (this.socket && this.socketConnected) {
                this.isOnline = true;
                return true;
            }

            // Si Socket.IO está disponible pero no conectado, asumir offline
            if (this.socket && !this.socketConnected) {
                this.isOnline = false;
                return false;
            }

            // Fallback: usar polling si Socket.IO no está disponible
            if (this.isCheckingConnection) return this.isOnline;
            
            this.isCheckingConnection = true;
            
            try {
                // Intentar fetch a un endpoint simple
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const response = await fetch(CONNECTION_CHECK_URL, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                const wasOnline = this.isOnline;
                this.isOnline = response.ok || response.status === 304;
                
                if (!wasOnline && this.isOnline) {
                    // Se recuperó la conexión
                    this.handleOnline();
                } else if (wasOnline && !this.isOnline) {
                    // Se perdió la conexión
                    this.handleOffline();
                }
                
                return this.isOnline;
            } catch (error) {
                const wasOnline = this.isOnline;
                this.isOnline = false;
                
                if (wasOnline && !this.isOnline) {
                    // Se perdió la conexión
                    this.handleOffline();
                }
                
                return false;
            } finally {
                this.isCheckingConnection = false;
            }
        },

        /**
         * Iniciar verificación periódica de conexión (solo como fallback si Socket.IO no está disponible)
         * @returns {void}
         */
        startConnectionCheck: function() {
            if (this.connectionCheckTimer) {
                clearInterval(this.connectionCheckTimer);
            }
            
            // Solo usar polling si Socket.IO no está disponible
            this.connectionCheckTimer = setInterval(() => {
                // Si Socket.IO está disponible, no necesitamos polling
                if (this.socket) {
                    // Actualizar estado basado en Socket.IO
                    if (this.socketConnected !== this.isOnline) {
                        this.isOnline = this.socketConnected;
                        if (this.isOnline) {
                            this.handleOnline();
                        } else {
                            this.handleOffline();
                        }
                    }
                } else {
                    // Fallback: usar polling
                    this.checkConnection();
                }
            }, CONNECTION_CHECK_INTERVAL);
        },

        /**
         * Manejar cuando se recupera la conexión
         * @returns {void}
         */
        handleOnline: function() {
            console.log('[OfflineHandler] Conexión recuperada');
            this.isOnline = true;
            
            // Procesar cola en memoria primero (con promises)
            this.processQueue().then(() => {
                // Luego procesar cola persistida (sin promises, solo ejecutar)
                return this.processPersistedQueue();
            }).then(() => {
                // Ocultar banner si no hay más operaciones pendientes
                if (this.queue.length === 0 && this.persistedQueue.length === 0) {
                    this.hideBanner();
                } else {
                    // Actualizar contador si aún hay operaciones
                    this.updateBannerCount();
                }
            }).catch((error) => {
                console.error('[OfflineHandler] Error al procesar cola:', error);
            });
        },

        /**
         * Manejar cuando se pierde la conexión
         * @returns {void}
         */
        handleOffline: function() {
            console.log('[OfflineHandler] Conexión perdida');
            this.isOnline = false;
            this.showBanner();
        },

        /**
         * Agregar operación a la cola
         * @param {string} url - URL de la operación
         * @param {Object} options - Opciones de fetch
         * @param {Function} resolve - Resolver de la promise (opcional, solo para operaciones en memoria)
         * @param {Function} reject - Rechazar de la promise (opcional, solo para operaciones en memoria)
         * @returns {void}
         */
        enqueue: function(url, options, resolve, reject) {
            const operation = {
                id: Date.now() + Math.random(),
                url: url,
                options: options,
                resolve: resolve,
                reject: reject,
                retries: 0,
                timestamp: Date.now()
            };
            
            // Agregar a cola en memoria (con promises)
            this.queue.push(operation);
            
            // También guardar en cola persistida (sin promises, solo datos)
            this.enqueuePersisted(url, options);
            
            this.updateBannerCount();
            
            console.log('[OfflineHandler] Operación encolada:', url);
        },

        /**
         * Agregar operación a la cola persistida (solo datos, sin promises)
         * @param {string} url - URL de la operación
         * @param {Object} options - Opciones de fetch
         * @returns {void}
         */
        enqueuePersisted: function(url, options) {
            const operation = {
                id: Date.now() + Math.random(),
                url: url,
                options: {
                    method: options.method || 'GET',
                    headers: options.headers ? Object.fromEntries(new Headers(options.headers)) : {},
                    body: options.body
                },
                retries: 0,
                timestamp: Date.now()
            };
            
            this.persistedQueue.push(operation);
            this.savePersistedQueue();
        },

        /**
         * Procesar cola de operaciones en memoria (con promises)
         * @returns {Promise<void>}
         */
        processQueue: async function() {
            if (!this.isOnline || this.queue.length === 0) {
                return;
            }
            
            console.log(`[OfflineHandler] Procesando ${this.queue.length} operación(es) en cola (memoria)`);
            
            // Usar fetch original guardado (no el interceptado)
            const originalFetch = this._originalFetch || window.fetch;
            
            // Procesar operaciones una por una
            const operations = [...this.queue];
            this.queue = [];
            
            for (const operation of operations) {
                try {
                    // Usar fetch original directamente para evitar interceptar nuestra propia llamada
                    const response = await originalFetch.call(window, operation.url, operation.options);
                    
                    // Si la respuesta es exitosa, resolver la promise con el objeto Response completo
                    if (response.ok) {
                        // Clonar la respuesta para poder leerla múltiples veces si es necesario
                        const clonedResponse = response.clone();
                        if (operation.resolve) {
                            // Resolver con el objeto Response completo, no solo los datos
                            operation.resolve(clonedResponse);
                        }
                        console.log('[OfflineHandler] Operación exitosa:', operation.url);
                    } else {
                        // Si falla, reintentar si no excedió el máximo
                        if (operation.retries < MAX_RETRIES) {
                            operation.retries++;
                            this.queue.push(operation);
                            console.log('[OfflineHandler] Reintentando operación:', operation.url);
                        } else {
                            // Rechazar después de máximo de reintentos
                            if (operation.reject) {
                                operation.reject(new Error(`Error ${response.status}: ${response.statusText}`));
                            }
                            console.error('[OfflineHandler] Operación fallida después de reintentos:', operation.url);
                        }
                    }
                } catch (error) {
                    // Si hay error de red, volver a encolar si no excedió el máximo
                    if (operation.retries < MAX_RETRIES) {
                        operation.retries++;
                        this.queue.push(operation);
                        console.log('[OfflineHandler] Error de red, reintentando:', operation.url);
                    } else {
                        // Rechazar después de máximo de reintentos
                        if (operation.reject) {
                            operation.reject(error);
                        }
                        console.error('[OfflineHandler] Operación fallida después de reintentos:', operation.url);
                    }
                }
            }
            
            this.updateBannerCount();
            
            // Si aún hay operaciones pendientes, programar siguiente intento
            if (this.queue.length > 0 && this.isOnline) {
                this.scheduleNextRetry();
            }
        },

        /**
         * Procesar cola persistida (sin promises, solo ejecutar)
         * @returns {Promise<void>}
         */
        processPersistedQueue: async function() {
            if (!this.isOnline || this.persistedQueue.length === 0) {
                return;
            }
            
            console.log(`[OfflineHandler] Procesando ${this.persistedQueue.length} operación(es) en cola persistida`);
            
            // Procesar operaciones una por una
            const operations = [...this.persistedQueue];
            this.persistedQueue = [];
            this.savePersistedQueue();
            
            for (const operation of operations) {
                try {
                    // Reconstruir headers
                    const headers = new Headers(operation.options.headers || {});
                    const options = {
                        method: operation.options.method || 'GET',
                        headers: headers,
                        body: operation.options.body
                    };
                    
                    const response = await fetch(operation.url, options);
                    
                    // Si la respuesta es exitosa, continuar
                    if (response.ok) {
                        console.log('[OfflineHandler] Operación persistida exitosa:', operation.url);
                    } else {
                        // Si falla, reintentar si no excedió el máximo
                        if (operation.retries < MAX_RETRIES) {
                            operation.retries++;
                            this.persistedQueue.push(operation);
                            console.log('[OfflineHandler] Reintentando operación persistida:', operation.url);
                        } else {
                            console.error('[OfflineHandler] Operación persistida fallida después de reintentos:', operation.url);
                        }
                    }
                } catch (error) {
                    // Si hay error de red, volver a encolar si no excedió el máximo
                    if (operation.retries < MAX_RETRIES) {
                        operation.retries++;
                        this.persistedQueue.push(operation);
                        console.log('[OfflineHandler] Error de red en operación persistida, reintentando:', operation.url);
                    } else {
                        console.error('[OfflineHandler] Operación persistida fallida después de reintentos:', operation.url);
                    }
                }
            }
            
            // Guardar cola actualizada
            this.savePersistedQueue();
            this.updateBannerCount();
            
            // Si aún hay operaciones pendientes, programar siguiente intento
            if (this.persistedQueue.length > 0 && this.isOnline) {
                this.scheduleNextRetry();
            }
        },

        /**
         * Programar siguiente reintento
         * @returns {void}
         */
        scheduleNextRetry: function() {
            if (this.retryTimer) {
                clearTimeout(this.retryTimer);
            }
            
            this.retryTimer = setTimeout(() => {
                this.processQueue();
            }, RETRY_INTERVAL);
        },

        /**
         * Iniciar procesador de cola
         * @returns {void}
         */
        startQueueProcessor: function() {
            // Procesar cola periódicamente cuando hay conexión
            setInterval(() => {
                if (this.isOnline) {
                    if (this.queue.length > 0) {
                        this.processQueue();
                    }
                    if (this.persistedQueue.length > 0) {
                        this.processPersistedQueue();
                    }
                }
            }, RETRY_INTERVAL * 2);
        },

        /**
         * Guardar cola persistida en localStorage
         * @returns {void}
         */
        savePersistedQueue: function() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.persistedQueue));
            } catch (error) {
                console.error('[OfflineHandler] Error al guardar cola persistida:', error);
            }
        },

        /**
         * Cargar cola persistida desde localStorage
         * @returns {void}
         */
        loadPersistedQueue: function() {
            try {
                const queueData = localStorage.getItem(STORAGE_KEY);
                if (queueData) {
                    const parsed = JSON.parse(queueData);
                    // Solo cargar operaciones de las últimas 24 horas
                    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                    this.persistedQueue = parsed.filter(op => op.timestamp > oneDayAgo);
                    
                    if (this.persistedQueue.length > 0) {
                        console.log(`[OfflineHandler] Cargadas ${this.persistedQueue.length} operación(es) desde localStorage`);
                    }
                }
            } catch (error) {
                console.error('[OfflineHandler] Error al cargar cola persistida:', error);
                this.persistedQueue = [];
            }
        },

        /**
         * Limpiar cola
         * @returns {void}
         */
        clearQueue: function() {
            this.queue = [];
            this.persistedQueue = [];
            this.savePersistedQueue();
            this.updateBannerCount();
            console.log('[OfflineHandler] Cola limpiada');
        },

        /**
         * Interceptar fetch/bearerFetch para encolar cuando está offline
         * @returns {void}
         */
        interceptFetch: function() {
            const self = this;
            const originalFetch = window.fetch;
            
            // Interceptar fetch
            window.fetch = function(url, options) {
                options = options || {};
                
                // Si está online, usar fetch normal
                if (self.isOnline) {
                    return originalFetch.call(window, url, options).catch(async (error) => {
                        // Detectar errores de red (TypeError con 'fetch' o 'Failed to fetch')
                        const isNetworkError = error.name === 'TypeError' && 
                            (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError'));
                        
                        if (isNetworkError) {
                            // Verificar conexión real
                            const isStillOnline = await self.checkConnection();
                            if (!isStillOnline) {
                                // Si realmente está offline, encolar
                                return new Promise((resolve, reject) => {
                                    self.enqueue(url, options, resolve, reject);
                                });
                            }
                        }
                        
                        // Si sigue online o no es error de red, lanzar error
                        throw error;
                    });
                }
                
                // Si está offline, encolar directamente
                return new Promise((resolve, reject) => {
                    self.enqueue(url, options, resolve, reject);
                });
            };
            
            // Nota: bearerFetch en los dashboards llama a fetch internamente,
            // por lo que será interceptado automáticamente. No necesitamos interceptar bearerFetch directamente.
        },

        /**
         * Obtener estado actual
         * @returns {Object}
         */
        getStatus: function() {
            return {
                isOnline: this.isOnline,
                queueLength: this.queue.length,
                persistedQueueLength: this.persistedQueue.length,
                totalPending: this.queue.length + this.persistedQueue.length,
                isCheckingConnection: this.isCheckingConnection,
                socketConnected: this.socketConnected,
                usingSocketIO: !!this.socket
            };
        },

        /**
         * Limpiar recursos (útil para testing o reinicio)
         * @returns {void}
         */
        destroy: function() {
            if (this.connectionCheckTimer) {
                clearInterval(this.connectionCheckTimer);
                this.connectionCheckTimer = null;
            }
            
            if (this.retryTimer) {
                clearTimeout(this.retryTimer);
                this.retryTimer = null;
            }
            
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
            }
            
            this.initialized = false;
        }
    };

    // Exportar al scope global
    window.OfflineHandler = OfflineHandler;
    
    // Auto-inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => OfflineHandler.init());
    } else {
        OfflineHandler.init();
    }
})();

