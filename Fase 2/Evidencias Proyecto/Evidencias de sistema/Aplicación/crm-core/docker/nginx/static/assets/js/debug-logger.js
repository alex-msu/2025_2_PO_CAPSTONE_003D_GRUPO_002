/**
 * DebugLogger - Módulo para logging condicional basado en modo debug
 * 
 * Funcionalidades:
 * - Logging condicional que solo funciona si el modo debug está activado
 * - Métodos compatibles con console.log, console.warn, console.error
 * - Soporte para grupos de logs
 * 
 * USO:
 *   <script src="assets/js/debug-logger.js"></script>
 *   <script>
 *     DebugLogger.log('Mensaje de debug');
 *     DebugLogger.warn('Advertencia');
 *     DebugLogger.error('Error');
 *     DebugLogger.group('Grupo de logs');
 *     DebugLogger.groupEnd();
 *   </script>
 */

(function() {
    'use strict';

    const DebugLogger = {
        /**
         * Verifica si el modo debug está activado
         * @returns {boolean} true si el modo debug está activado
         */
        isEnabled() {
            if (typeof window.ConfigManager !== 'undefined') {
                return window.ConfigManager.isDebugMode();
            }
            // Si ConfigManager no está disponible, verificar localStorage directamente
            try {
                const config = localStorage.getItem('crm.config');
                if (config) {
                    const parsed = JSON.parse(config);
                    return parsed.debugMode === true;
                }
            } catch (e) {
                // Ignorar errores
            }
            return false;
        },

        /**
         * Log normal (equivalente a console.log)
         * @param {...*} args - Argumentos a loguear
         */
        log(...args) {
            if (this.isEnabled()) {
                console.log(...args);
            }
        },

        /**
         * Log de advertencia (equivalente a console.warn)
         * @param {...*} args - Argumentos a loguear
         */
        warn(...args) {
            if (this.isEnabled()) {
                console.warn(...args);
            }
        },

        /**
         * Log de error (equivalente a console.error)
         * @param {...*} args - Argumentos a loguear
         */
        error(...args) {
            if (this.isEnabled()) {
                console.error(...args);
            }
        },

        /**
         * Log de información (equivalente a console.info)
         * @param {...*} args - Argumentos a loguear
         */
        info(...args) {
            if (this.isEnabled()) {
                console.info(...args);
            }
        },

        /**
         * Inicia un grupo de logs (equivalente a console.group)
         * @param {string} label - Etiqueta del grupo
         */
        group(label) {
            if (this.isEnabled()) {
                console.group(label);
            }
        },

        /**
         * Inicia un grupo de logs colapsado (equivalente a console.groupCollapsed)
         * @param {string} label - Etiqueta del grupo
         */
        groupCollapsed(label) {
            if (this.isEnabled()) {
                console.groupCollapsed(label);
            }
        },

        /**
         * Termina un grupo de logs (equivalente a console.groupEnd)
         */
        groupEnd() {
            if (this.isEnabled()) {
                console.groupEnd();
            }
        },

        /**
         * Log con formato de tabla (equivalente a console.table)
         * @param {*} data - Datos a mostrar en tabla
         * @param {Array} columns - Columnas opcionales
         */
        table(data, columns) {
            if (this.isEnabled()) {
                if (columns) {
                    console.table(data, columns);
                } else {
                    console.table(data);
                }
            }
        },

        /**
         * Log con formato de tiempo (equivalente a console.time)
         * @param {string} label - Etiqueta del temporizador
         */
        time(label) {
            if (this.isEnabled()) {
                console.time(label);
            }
        },

        /**
         * Log con formato de tiempo finalizado (equivalente a console.timeEnd)
         * @param {string} label - Etiqueta del temporizador
         */
        timeEnd(label) {
            if (this.isEnabled()) {
                console.timeEnd(label);
            }
        },

        /**
         * Log con formato de trace (equivalente a console.trace)
         * @param {...*} args - Argumentos a loguear
         */
        trace(...args) {
            if (this.isEnabled()) {
                console.trace(...args);
            }
        },

        /**
         * Log con formato de debug (equivalente a console.debug)
         * @param {...*} args - Argumentos a loguear
         */
        debug(...args) {
            if (this.isEnabled()) {
                console.debug(...args);
            }
        }
    };

    // Exponer globalmente
    window.DebugLogger = DebugLogger;
})();

