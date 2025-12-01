/**
 * ========================================================
 * FILTERS & SEARCH UTILITIES - Componente Universal de Filtros
 * ========================================================
 * 
 * Componente reutilizable para construir query strings de filtros
 * y manejar debounce en búsquedas.
 */

(function() {
    'use strict';

    /**
     * Construye query string a partir de un objeto de filtros
     * @param {Object} filters - Objeto con filtros { key: value }
     * @returns {string} Query string (sin el ? inicial)
     */
    function buildQueryParams(filters) {
        if (!filters || typeof filters !== 'object') {
            return '';
        }

        const params = [];
        for (const key in filters) {
            if (filters.hasOwnProperty(key)) {
                const value = filters[key];
                // Solo agregar si el valor no está vacío
                if (value !== null && value !== undefined && value !== '') {
                    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                }
            }
        }
        return params.join('&');
    }

    /**
     * Crea una función con debounce para búsquedas
     * @param {Function} callback - Función a ejecutar después del debounce
     * @param {number} delay - Tiempo de espera en ms (default: 300)
     * @returns {Function} Función con debounce
     */
    function debounce(callback, delay) {
        delay = delay || 300;
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                callback.apply(this, args);
            }, delay);
        };
    }

    /**
     * Limpia todos los filtros de un objeto
     * @param {Object} filters - Objeto de filtros a limpiar
     * @returns {Object} Objeto con todos los valores en vacío/null
     */
    function clearFilters(filters) {
        if (!filters || typeof filters !== 'object') {
            return {};
        }
        const cleared = {};
        for (const key in filters) {
            if (filters.hasOwnProperty(key)) {
                cleared[key] = '';
            }
        }
        return cleared;
    }

    /**
     * Obtiene valores de filtros desde inputs en un contenedor
     * @param {HTMLElement|string} container - Contenedor o selector CSS
     * @param {Object} config - Configuración { inputId: filterKey }
     * @returns {Object} Objeto con filtros
     */
    function getFiltersFromInputs(container, config) {
        const containerEl = typeof container === 'string' ? document.querySelector(container) : container;
        if (!containerEl) {
            console.warn('getFiltersFromInputs: contenedor no encontrado');
            return {};
        }

        const filters = {};
        for (const inputId in config) {
            if (config.hasOwnProperty(inputId)) {
                const filterKey = config[inputId];
                const input = containerEl.querySelector('#' + inputId);
                if (input) {
                    const value = input.value ? input.value.trim() : '';
                    if (value) {
                        filters[filterKey] = value;
                    }
                }
            }
        }
        return filters;
    }

    /**
     * Establece valores de filtros en inputs
     * @param {HTMLElement|string} container - Contenedor o selector CSS
     * @param {Object} config - Configuración { inputId: filterKey }
     * @param {Object} filters - Objeto con valores de filtros
     */
    function setFiltersToInputs(container, config, filters) {
        const containerEl = typeof container === 'string' ? document.querySelector(container) : container;
        if (!containerEl || !filters) {
            return;
        }

        for (const inputId in config) {
            if (config.hasOwnProperty(inputId)) {
                const filterKey = config[inputId];
                const input = containerEl.querySelector('#' + inputId);
                if (input && filters[filterKey]) {
                    input.value = filters[filterKey];
                }
            }
        }
    }

    // Exportar funciones
    window.FilterUtils = {
        buildQueryParams: buildQueryParams,
        debounce: debounce,
        clearFilters: clearFilters,
        getFiltersFromInputs: getFiltersFromInputs,
        setFiltersToInputs: setFiltersToInputs
    };

})();

