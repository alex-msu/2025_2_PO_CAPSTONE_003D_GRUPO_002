/**
 * LoadingUtils - Módulo universal para manejo consistente de estados de carga
 * 
 * Funcionalidades:
 * - Estados de carga en botones (guardar/restaurar texto)
 * - Estados de carga en tablas y contenedores
 * - Indicadores de carga de página
 * - Spinners y mensajes de carga consistentes
 * 
 * USO:
 *   <script src="assets/js/loading-utils.js"></script>
 *   <script>
 *     const button = document.getElementById('myButton');
 *     LoadingUtils.showButtonLoading(button, 'Guardando...');
 *     // ... operación async ...
 *     LoadingUtils.hideButtonLoading(button);
 *   </script>
 */

(function() {
    'use strict';

    const LoadingUtils = {
        // Almacenar textos originales de botones
        buttonTexts: new WeakMap(),

        /**
         * Mostrar estado de carga en un botón
         * @param {HTMLElement} button - Elemento botón
         * @param {string} loadingText - Texto a mostrar durante carga (opcional)
         * @returns {void}
         */
        showButtonLoading: function(button, loadingText = 'Cargando...') {
            if (!button) return;

            // Guardar texto original si no está guardado
            if (!this.buttonTexts.has(button)) {
                this.buttonTexts.set(button, button.textContent || button.innerText || '');
            }

            // Deshabilitar botón
            button.disabled = true;
            
            // Cambiar texto
            button.textContent = loadingText;
            
            // Agregar clase de loading si existe
            button.classList.add('loading');
            
            // Agregar atributo para CSS
            button.setAttribute('data-loading', 'true');
        },

        /**
         * Ocultar estado de carga en un botón
         * @param {HTMLElement} button - Elemento botón
         * @param {string} customText - Texto personalizado para restaurar (opcional)
         * @returns {void}
         */
        hideButtonLoading: function(button, customText = null) {
            if (!button) return;

            // Restaurar texto original o usar texto personalizado
            const originalText = this.buttonTexts.get(button);
            button.textContent = customText || originalText || '';
            
            // Habilitar botón
            button.disabled = false;
            
            // Remover clase de loading
            button.classList.remove('loading');
            
            // Remover atributo
            button.removeAttribute('data-loading');
        },

        /**
         * Mostrar estado de carga en una tabla o contenedor
         * @param {HTMLElement} container - Contenedor (tbody, div, etc.)
         * @param {string} message - Mensaje a mostrar (opcional)
         * @param {number} colspan - Número de columnas para tabla (opcional)
         * @returns {void}
         */
        showTableLoading: function(container, message = 'Cargando...', colspan = null) {
            if (!container) return;

            // Determinar si es una tabla (tbody) o un div
            const isTable = container.tagName === 'TBODY' || container.tagName === 'TABLE';
            
            if (isTable && colspan) {
                // Para tablas, usar fila con colspan
                container.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;padding:40px;color:#666;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
                        <div class="spinner" style="width:20px;height:20px;border:3px solid #f3f3f3;border-top:3px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>
                        <span>${this.escapeHtml(message)}</span>
                    </div>
                </td></tr>`;
            } else {
                // Para divs u otros contenedores
                container.innerHTML = `<div class="loading-state" style="text-align:center;padding:40px;color:#666;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
                        <div class="spinner" style="width:20px;height:20px;border:3px solid #f3f3f3;border-top:3px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>
                        <span>${this.escapeHtml(message)}</span>
                    </div>
                </div>`;
            }

            // Agregar atributo para CSS
            container.setAttribute('data-loading', 'true');
        },

        /**
         * Ocultar estado de carga en una tabla o contenedor
         * @param {HTMLElement} container - Contenedor
         * @returns {void}
         */
        hideTableLoading: function(container) {
            if (!container) return;
            
            // Remover atributo
            container.removeAttribute('data-loading');
            
            // El contenido será reemplazado por la función que llama
            // No limpiamos aquí para evitar conflictos
        },

        /**
         * Mostrar estado de carga de página completa
         * @param {string} message - Mensaje a mostrar (opcional)
         * @returns {HTMLElement} - Elemento del overlay creado
         */
        showPageLoading: function(message = 'Cargando...') {
            // Remover overlay existente si hay
            this.hidePageLoading();

            // Crear overlay
            const overlay = document.createElement('div');
            overlay.id = 'pageLoadingOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                backdrop-filter: blur(2px);
            `;

            overlay.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); text-align: center; min-width: 200px;">
                    <div class="spinner" style="width:40px;height:40px;border:4px solid #f3f3f3;border-top:4px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 15px;"></div>
                    <div style="color:#333;font-size:16px;">${this.escapeHtml(message)}</div>
                </div>
            `;

            document.body.appendChild(overlay);
            return overlay;
        },

        /**
         * Ocultar estado de carga de página completa
         * @returns {void}
         */
        hidePageLoading: function() {
            const overlay = document.getElementById('pageLoadingOverlay');
            if (overlay) {
                overlay.remove();
            }
        },

        /**
         * Mostrar spinner inline (para usar en cualquier lugar)
         * @param {HTMLElement} container - Contenedor donde mostrar el spinner
         * @param {string} message - Mensaje opcional
         * @returns {HTMLElement} - Elemento del spinner creado
         */
        showSpinner: function(container, message = '') {
            if (!container) return null;

            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;padding:20px;';
            spinner.innerHTML = `
                <div class="spinner" style="width:20px;height:20px;border:3px solid #f3f3f3;border-top:3px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>
                ${message ? `<span>${this.escapeHtml(message)}</span>` : ''}
            `;

            container.appendChild(spinner);
            return spinner;
        },

        /**
         * Ocultar spinner inline
         * @param {HTMLElement} spinner - Elemento del spinner
         * @returns {void}
         */
        hideSpinner: function(spinner) {
            if (spinner && spinner.parentNode) {
                spinner.remove();
            }
        },

        /**
         * Escapar HTML para prevenir XSS
         * @param {string} text - Texto a escapar
         * @returns {string} - Texto escapado
         */
        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * Agregar animación CSS para spinner si no existe
         * @returns {void}
         */
        ensureSpinnerCSS: function() {
            // Verificar si ya existe el estilo
            if (document.getElementById('loadingUtilsSpinnerCSS')) {
                return;
            }

            const style = document.createElement('style');
            style.id = 'loadingUtilsSpinnerCSS';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .loading-spinner {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                button[data-loading="true"] {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                [data-loading="true"] {
                    position: relative;
                }
            `;
            document.head.appendChild(style);
        }
    };

    // Inicializar CSS al cargar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            LoadingUtils.ensureSpinnerCSS();
        });
    } else {
        LoadingUtils.ensureSpinnerCSS();
    }

    // Exportar al scope global
    window.LoadingUtils = LoadingUtils;
})();

