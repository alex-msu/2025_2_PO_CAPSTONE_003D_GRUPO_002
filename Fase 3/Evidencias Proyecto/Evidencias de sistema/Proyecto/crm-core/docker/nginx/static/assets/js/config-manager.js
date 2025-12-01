/**
 * ConfigManager - Módulo para gestionar configuración de la aplicación
 * 
 * Funcionalidades:
 * - Gestionar configuración de modo debug
 * - Persistir configuración en localStorage
 * - Sincronizar con backend cuando sea necesario
 * 
 * USO:
 *   <script src="assets/js/config-manager.js"></script>
 *   <script>
 *     ConfigManager.setDebugMode(true);
 *     var isDebug = ConfigManager.isDebugMode();
 *   </script>
 */

(function() {
    'use strict';

    const CONFIG_KEY = 'crm.config';
    const DEBUG_MODE_KEY = 'debugMode';
    const API_BASE = '/api';

    const ConfigManager = {
        /**
         * Obtiene toda la configuración almacenada
         * @returns {Object} Configuración completa
         */
        getConfig() {
            try {
                const stored = localStorage.getItem(CONFIG_KEY);
                return stored ? JSON.parse(stored) : {};
            } catch (e) {
                console.error('Error al leer configuración:', e);
                return {};
            }
        },

        /**
         * Guarda la configuración completa
         * @param {Object} config - Configuración a guardar
         */
        saveConfig(config) {
            try {
                localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
                // Disparar evento para notificar cambios
                window.dispatchEvent(new CustomEvent('configChanged', { detail: config }));
            } catch (e) {
                console.error('Error al guardar configuración:', e);
            }
        },

        /**
         * Obtiene el valor de una configuración específica
         * @param {string} key - Clave de la configuración
         * @param {*} defaultValue - Valor por defecto si no existe
         * @returns {*} Valor de la configuración
         */
        get(key, defaultValue = null) {
            const config = this.getConfig();
            return config[key] !== undefined ? config[key] : defaultValue;
        },

        /**
         * Establece el valor de una configuración específica
         * @param {string} key - Clave de la configuración
         * @param {*} value - Valor a establecer
         */
        set(key, value) {
            const config = this.getConfig();
            config[key] = value;
            this.saveConfig(config);
        },

        /**
         * Verifica si el modo debug está activado
         * @returns {boolean} true si el modo debug está activado
         */
        isDebugMode() {
            return this.get(DEBUG_MODE_KEY, false) === true;
        },

        /**
         * Activa o desactiva el modo debug
         * @param {boolean} enabled - true para activar, false para desactivar
         * @returns {Promise} Promise que se resuelve cuando se guarda la configuración
         */
        async setDebugMode(enabled) {
            console.log('[ConfigManager] setDebugMode llamado con:', enabled);
            
            // Guardar en localStorage primero
            this.set(DEBUG_MODE_KEY, enabled === true);
            
            // Verificar que se guardó correctamente
            var storedConfig = localStorage.getItem(CONFIG_KEY);
            console.log('[ConfigManager] Configuración guardada en localStorage:', storedConfig);
            var verifyEnabled = this.isDebugMode();
            console.log('[ConfigManager] Verificación después de guardar:', verifyEnabled);
            
            // Sincronizar con backend si hay token (opcional, no crítico)
            try {
                const token = localStorage.getItem('crm.token');
                if (token) {
                    await fetch(API_BASE + '/config/debug', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({ enabled: enabled === true })
                    }).catch(err => {
                        // Si falla, no es crítico, la configuración local ya está guardada
                        console.warn('[ConfigManager] No se pudo sincronizar configuración con backend:', err);
                    });
                }
            } catch (e) {
                console.warn('[ConfigManager] Error al sincronizar configuración:', e);
            }
        },

        /**
         * Carga la configuración desde el backend
         * Ahora es público (no requiere autenticación) para que funcione en páginas de login
         * @returns {Promise} Promise que se resuelve con la configuración
         */
        async loadFromBackend() {
            try {
                // Endpoint público, no requiere token
                const response = await fetch(API_BASE + '/config/debug', {
                    method: 'GET',
                    cache: 'no-store'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.enabled !== undefined) {
                        // Sincronizar con localStorage
                        this.set(DEBUG_MODE_KEY, data.enabled);
                        console.log('[ConfigManager] Configuración cargada desde backend:', data.enabled);
                        return data.enabled;
                    }
                } else {
                    console.warn('[ConfigManager] Error al cargar configuración desde backend:', response.status);
                }
            } catch (e) {
                console.warn('[ConfigManager] Error al cargar configuración desde backend:', e);
            }
            return null;
        }
    };

    // Exponer globalmente
    window.ConfigManager = ConfigManager;

    // Cargar configuración desde backend al inicializar (siempre, sin necesidad de token)
    // Esto permite que las páginas de login también carguen la configuración
    function initializeConfig() {
        ConfigManager.loadFromBackend().then(function(enabled) {
            if (enabled !== null) {
                // Disparar evento para notificar que la configuración se cargó
                window.dispatchEvent(new CustomEvent('configLoaded', { detail: { debugMode: enabled } }));
            }
        });
        
        // Sincronizar periódicamente cada 5 segundos para detectar cambios en otros navegadores
        setInterval(function() {
            ConfigManager.loadFromBackend();
        }, 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeConfig);
    } else {
        initializeConfig();
    }
})();

