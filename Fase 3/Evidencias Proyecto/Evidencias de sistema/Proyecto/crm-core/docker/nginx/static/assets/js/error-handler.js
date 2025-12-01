/**
 * ErrorHandler - Módulo universal para manejo robusto y consistente de errores
 * 
 * Funcionalidades:
 * - Manejo de diferentes tipos de errores (red, validación, autorización, servidor, timeout)
 * - Mensajes amigables al usuario en español
 * - Logging detallado para debugging
 * - Integración con sistemas de notificación existentes
 * 
 * USO:
 *   <script src="assets/js/error-handler.js"></script>
 *   <script>
 *     fetch('/api/endpoint')
 *       .then(res => ErrorHandler.handleResponse(res))
 *       .then(data => console.log(data))
 *       .catch(error => ErrorHandler.handleError(error, 'Contexto de la operación'));
 *   </script>
 */

(function() {
    'use strict';

    const ErrorHandler = {
        // Configuración
        config: {
            showConsoleLogs: true, // Mostrar logs en consola para debugging
            defaultTimeout: 30000, // 30 segundos
            retryAttempts: 3, // Intentos de reintento
            retryDelay: 1000 // Delay entre reintentos (ms)
        },

        /**
         * Manejar respuesta de fetch/API
         * @param {Response} response - Respuesta de fetch
         * @param {string} context - Contexto de la operación (opcional)
         * @returns {Promise} - Promise que resuelve con los datos o rechaza con error
         */
        handleResponse: async function(response, context = '') {
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // Si no se puede parsear JSON, crear error genérico
                    errorData = {
                        message: `Error ${response.status}: ${response.statusText}`,
                        status: response.status
                    };
                }

                const error = new Error(errorData.message || 'Error desconocido');
                error.status = response.status;
                error.statusText = response.statusText;
                error.data = errorData;
                error.context = context;
                error.type = this.getErrorType(response.status);

                throw error;
            }

            // Intentar parsear JSON, si falla retornar texto
            try {
                return await response.json();
            } catch (e) {
                return await response.text();
            }
        },

        /**
         * Manejar error completo (catch)
         * @param {Error} error - Error capturado
         * @param {string} context - Contexto de la operación
         * @param {Object} options - Opciones adicionales
         * @returns {void}
         */
        handleError: function(error, context = '', options = {}) {
            const errorInfo = this.parseError(error);
            errorInfo.context = context || errorInfo.context || 'Operación';
            
            // Log para debugging
            if (this.config.showConsoleLogs) {
                console.error(`[ErrorHandler] ${errorInfo.context}:`, {
                    message: errorInfo.userMessage,
                    type: errorInfo.type,
                    status: errorInfo.status,
                    originalError: error
                });
            }

            // Mostrar mensaje al usuario
            this.showUserFriendlyError(errorInfo, options);

            // Retornar error procesado para que el código pueda manejarlo si es necesario
            return errorInfo;
        },

        /**
         * Parsear error y extraer información
         * @param {Error} error - Error a parsear
         * @returns {Object} - Información del error
         */
        parseError: function(error) {
            const errorInfo = {
                type: 'unknown',
                status: null,
                statusText: null,
                message: error.message || 'Error desconocido',
                userMessage: 'Ha ocurrido un error',
                data: null,
                context: null,
                isNetworkError: false,
                isTimeout: false,
                isValidationError: false,
                isAuthError: false,
                isServerError: false
            };

            // Detectar tipo de error
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorInfo.type = 'network';
                errorInfo.isNetworkError = true;
                errorInfo.userMessage = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
            } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
                errorInfo.type = 'timeout';
                errorInfo.isTimeout = true;
                errorInfo.userMessage = 'La operación tardó demasiado. Por favor, intenta nuevamente.';
            } else if (error.status) {
                errorInfo.status = error.status;
                errorInfo.statusText = error.statusText;
                errorInfo.type = this.getErrorType(error.status);
                errorInfo.data = error.data;

                // Mensajes específicos por código de estado
                switch (error.status) {
                    case 400:
                        errorInfo.isValidationError = true;
                        errorInfo.userMessage = this.formatValidationError(error.data);
                        break;
                    case 401:
                        errorInfo.isAuthError = true;
                        errorInfo.userMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
                        // Nota: La redirección se maneja en showUserFriendlyError si es necesario
                        break;
                    case 403:
                        errorInfo.isAuthError = true;
                        errorInfo.userMessage = 'No tienes permisos para realizar esta acción.';
                        break;
                    case 404:
                        errorInfo.userMessage = 'El recurso solicitado no fue encontrado.';
                        break;
                    case 409:
                        errorInfo.isValidationError = true;
                        errorInfo.userMessage = this.formatConflictError(error.data);
                        break;
                    case 422:
                        errorInfo.isValidationError = true;
                        errorInfo.userMessage = this.formatValidationError(error.data);
                        break;
                    case 500:
                    case 502:
                    case 503:
                    case 504:
                        errorInfo.isServerError = true;
                        errorInfo.userMessage = 'Error en el servidor. Por favor, intenta nuevamente más tarde.';
                        break;
                    default:
                        errorInfo.userMessage = error.data?.message || error.message || 'Ha ocurrido un error';
                }
            } else {
                // Error genérico
                errorInfo.userMessage = error.message || 'Ha ocurrido un error inesperado';
            }

            // Agregar contexto si está disponible
            if (error.context) {
                errorInfo.context = error.context;
            }

            return errorInfo;
        },

        /**
         * Obtener tipo de error basado en código de estado
         * @param {number} status - Código de estado HTTP
         * @returns {string} - Tipo de error
         */
        getErrorType: function(status) {
            if (status >= 400 && status < 500) {
                if (status === 401 || status === 403) {
                    return 'auth';
                }
                return 'client';
            } else if (status >= 500) {
                return 'server';
            }
            return 'unknown';
        },

        /**
         * Formatear error de validación
         * @param {Object} data - Datos del error
         * @returns {string} - Mensaje formateado
         */
        formatValidationError: function(data) {
            if (!data) {
                return 'Los datos proporcionados no son válidos.';
            }

            // Si hay mensaje directo
            if (data.message) {
                return data.message;
            }

            // Si hay array de mensajes de validación (class-validator)
            if (Array.isArray(data.message)) {
                return data.message.map(msg => {
                    // Extraer mensaje de validación
                    if (typeof msg === 'string') {
                        return msg;
                    } else if (msg.constraints) {
                        return Object.values(msg.constraints)[0];
                    }
                    return msg;
                }).join('\n');
            }

            // Si hay errores de validación anidados
            if (data.errors && Array.isArray(data.errors)) {
                return data.errors.map(err => {
                    if (typeof err === 'string') {
                        return err;
                    } else if (err.message) {
                        return err.message;
                    } else if (err.constraints) {
                        return Object.values(err.constraints)[0];
                    }
                    return 'Error de validación';
                }).join('\n');
            }

            return 'Los datos proporcionados no son válidos.';
        },

        /**
         * Formatear error de conflicto (409)
         * @param {Object} data - Datos del error
         * @returns {string} - Mensaje formateado
         */
        formatConflictError: function(data) {
            if (!data) {
                return 'El recurso ya existe o hay un conflicto.';
            }

            if (data.message) {
                return data.message;
            }

            // Mensajes comunes de conflicto
            if (data.message && data.message.includes('RUT')) {
                return 'Este RUT ya está registrado.';
            } else if (data.message && data.message.includes('email')) {
                return 'Este email ya está registrado.';
            } else if (data.message && data.message.includes('patente')) {
                return 'Esta patente ya está registrada.';
            }

            return 'El recurso ya existe o hay un conflicto.';
        },

        /**
         * Mostrar mensaje amigable al usuario
         * @param {Object} errorInfo - Información del error
         * @param {Object} options - Opciones adicionales
         * @returns {void}
         */
        showUserFriendlyError: function(errorInfo, options = {}) {
            const {
                targetElement = null, // Elemento donde mostrar el mensaje
                useFlashMessage = true, // Usar flashMessage si está disponible
                useFloatingNotification = false, // Usar notificación flotante
                useAlert = false, // Usar alert como fallback
                customMessage = null // Mensaje personalizado
            } = options;

            const message = customMessage || errorInfo.userMessage;

            // Intentar usar flashMessage si está disponible y se especificó targetElement
            if (targetElement && useFlashMessage && typeof window.flashMessage === 'function') {
                window.flashMessage(targetElement, 'bad', '❌ ' + message);
                return;
            }

            // Intentar usar flashStatus si está disponible
            if (targetElement && useFlashMessage && typeof window.flashStatus === 'function') {
                window.flashStatus(targetElement, 'bad', '❌ ' + message);
                return;
            }

            // Intentar usar showFloatingNotification si está disponible
            if (useFloatingNotification && typeof window.showFloatingNotification === 'function') {
                window.showFloatingNotification('Error', message, 'error');
                return;
            }

            // Usar NotificationsManager si está disponible
            if (useFloatingNotification && typeof window.NotificationsManager !== 'undefined') {
                // Las notificaciones persistentes se manejan por el sistema de notificaciones
                // Aquí solo mostramos un mensaje temporal
                if (typeof window.showFloatingNotification === 'function') {
                    window.showFloatingNotification('Error', message, 'error');
                    return;
                }
            }

            // Fallback: usar alert si está habilitado
            if (useAlert) {
                alert('❌ ' + message);
                return;
            }

            // Último recurso: mostrar en consola
            console.warn('[ErrorHandler] No se pudo mostrar mensaje al usuario:', message);
        },

        /**
         * Wrapper para fetch con manejo de errores automático
         * @param {string} url - URL a llamar
         * @param {Object} options - Opciones de fetch
         * @param {string} context - Contexto de la operación
         * @param {Object} errorOptions - Opciones para manejo de errores
         * @returns {Promise} - Promise que resuelve con los datos
         */
        fetch: async function(url, options = {}, context = '', errorOptions = {}) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.defaultTimeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                return await this.handleResponse(response, context);
            } catch (error) {
                clearTimeout(timeoutId);
                this.handleError(error, context, errorOptions);
                throw error;
            }
        },

        /**
         * Wrapper para bearerFetch con manejo de errores automático
         * @param {string} url - URL a llamar
         * @param {Object} options - Opciones de fetch
         * @param {string} context - Contexto de la operación
         * @param {Object} errorOptions - Opciones para manejo de errores
         * @returns {Promise} - Promise que resuelve con los datos
         */
        bearerFetch: async function(url, options = {}, context = '', errorOptions = {}) {
            const token = localStorage.getItem('crm.token');
            const headers = new Headers(options.headers || {});
            
            if (!headers.has('Content-Type')) {
                headers.set('Content-Type', 'application/json');
            }
            
            if (token) {
                headers.set('Authorization', 'Bearer ' + token);
            }

            return this.fetch(url, {
                ...options,
                headers: headers
            }, context, errorOptions);
        },

        /**
         * Configurar opciones globales
         * @param {Object} newConfig - Nueva configuración
         * @returns {void}
         */
        configure: function(newConfig) {
            this.config = { ...this.config, ...newConfig };
        }
    };

    // Exportar al scope global
    window.ErrorHandler = ErrorHandler;
})();

