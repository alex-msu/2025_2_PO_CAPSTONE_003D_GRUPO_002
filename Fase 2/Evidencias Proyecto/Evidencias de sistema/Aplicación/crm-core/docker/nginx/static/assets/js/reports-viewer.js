/**
 * ReportsViewer - Componente universal para visualizar y exportar reportes
 * 
 * Funcionalidades:
 * - Visualizar reportes de diferentes tipos
 * - Filtros específicos por tipo de reporte
 * - Exportación a CSV
 * - Control de acceso por rol de usuario
 * 
 * USO:
 *   <script src="assets/js/reports-viewer.js"></script>
 *   <script>
 *     const viewer = new ReportsViewer({
 *       container: '#reports-container',
 *       reportType: 'breaks',
 *       userRole: 'admin'
 *     });
 *     viewer.load();
 *   </script>
 */

(function() {
    'use strict';

    const API_BASE = '/api';

    // Configuración de reportes disponibles
    const REPORT_TYPES = {
        BREAKS: 'breaks'
        // Agregar más tipos de reportes aquí en el futuro
        // OT_STATS: 'ot_stats',
        // VEHICLE_MAINTENANCE: 'vehicle_maintenance',
    };

    const REPORT_LABELS = {
        'breaks': 'Reporte de Breaks de Mecánicos'
        // Agregar más labels aquí
    };

    // Configuración de acceso por rol
    const REPORT_ACCESS = {
        'breaks': ['admin', 'jefe_taller', 'JEFE_TALLER']
        // Agregar más configuraciones de acceso aquí
    };

    // Configuración de filtros por tipo de reporte
    const REPORT_FILTERS = {
        'breaks': {
            mes: {
                type: 'select',
                label: 'Mes',
                options: [
                    { value: '1', label: 'Enero' },
                    { value: '2', label: 'Febrero' },
                    { value: '3', label: 'Marzo' },
                    { value: '4', label: 'Abril' },
                    { value: '5', label: 'Mayo' },
                    { value: '6', label: 'Junio' },
                    { value: '7', label: 'Julio' },
                    { value: '8', label: 'Agosto' },
                    { value: '9', label: 'Septiembre' },
                    { value: '10', label: 'Octubre' },
                    { value: '11', label: 'Noviembre' },
                    { value: '12', label: 'Diciembre' }
                ],
                defaultValue: () => new Date().getMonth() + 1
            },
            anno: {
                type: 'number',
                label: 'Año',
                min: 2000,
                max: 2100,
                defaultValue: () => new Date().getFullYear()
            }
        }
        // Agregar más configuraciones de filtros aquí
    };

    /**
     * Clase ReportsViewer
     */
    class ReportsViewer {
        constructor(options = {}) {
            console.log('[ReportsViewer] Constructor llamado con options:', options);
            
            this.container = typeof options.container === 'string' 
                ? document.querySelector(options.container) 
                : options.container;
            
            console.log('[ReportsViewer] Container encontrado:', this.container);
            
            if (!this.container) {
                console.error('[ReportsViewer] Contenedor no encontrado. Selector:', options.container);
                throw new Error('ReportsViewer: contenedor no encontrado');
            }

            this.reportType = options.reportType || REPORT_TYPES.BREAKS;
            this.userRole = options.userRole || 'admin';
            
            console.log('[ReportsViewer] ReportType:', this.reportType);
            console.log('[ReportsViewer] UserRole:', this.userRole);
            
            // Verificar acceso
            if (!this.hasAccess(this.reportType, this.userRole)) {
                throw new Error(`El usuario con rol '${this.userRole}' no tiene acceso al reporte '${this.reportType}'`);
            }

            this.filters = this.initializeFilters();
            this.data = null;
            this.loading = false;

            this.onExport = options.onExport || null;
            this.bearerFetch = options.bearerFetch || window.bearerFetch || this.defaultBearerFetch;
            
            console.log('[ReportsViewer] bearerFetch disponible:', typeof this.bearerFetch === 'function');

            console.log('[ReportsViewer] Inicializando...');
            this.init();
            console.log('[ReportsViewer] Inicialización completada');
        }

        /**
         * Verificar si el usuario tiene acceso al reporte
         */
        hasAccess(reportType, userRole) {
            const allowedRoles = REPORT_ACCESS[reportType] || [];
            return allowedRoles.some(role => 
                role.toLowerCase() === userRole.toLowerCase() || 
                role.toUpperCase() === userRole.toUpperCase()
            );
        }

        /**
         * Inicializar filtros según el tipo de reporte
         */
        initializeFilters() {
            const filterConfig = REPORT_FILTERS[this.reportType] || {};
            const filters = {};
            
            for (const key in filterConfig) {
                const config = filterConfig[key];
                filters[key] = config.defaultValue ? config.defaultValue() : '';
            }
            
            return filters;
        }

        /**
         * Inicializar el viewer
         */
        init() {
            console.log('[ReportsViewer] init() llamado');
            try {
                this.render();
                console.log('[ReportsViewer] render() completado');
                this.attachEventListeners();
                console.log('[ReportsViewer] attachEventListeners() completado');
            } catch (error) {
                console.error('[ReportsViewer] Error en init():', error);
                throw error;
            }
        }

        /**
         * Renderizar el componente
         */
        render() {
            console.log('[ReportsViewer] render() llamado');
            const label = REPORT_LABELS[this.reportType] || this.reportType;
            console.log('[ReportsViewer] Label:', label);
            
            const filterConfig = REPORT_FILTERS[this.reportType] || {};
            const filtersHTML = this.renderFilters(filterConfig);
            
            this.container.innerHTML = `
                <div class="reports-viewer" style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div class="reports-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
                        <h3 style="margin: 0; font-size: 20px; font-weight: bold;">${label}</h3>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-export-csv" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                                📥 Exportar CSV
                            </button>
                            <button class="btn-refresh" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                                🔄 Actualizar
                            </button>
                        </div>
                    </div>

                    <div class="reports-filters" style="margin-bottom: 20px; padding: 16px; background: #f8f9fa; border-radius: 4px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-items: end;">
                            ${filtersHTML}
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-apply-filters" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; flex: 1;">
                                    Generar Reporte
                                </button>
                                <button class="btn-clear-filters" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="reports-content">
                        <div class="reports-loading" style="display: none; text-align: center; padding: 40px; color: #666;">
                            Cargando reporte...
                        </div>
                        <div class="reports-result" style="display: none;">
                            <!-- El resultado se renderizará aquí -->
                        </div>
                        <div class="reports-empty" style="text-align: center; padding: 40px; color: #666;">
                            Seleccione los filtros y haga clic en "Generar Reporte"
                        </div>
                    </div>
                </div>
            `;
            
            console.log('[ReportsViewer] HTML insertado. Container innerHTML length:', this.container.innerHTML.length);
        }

        /**
         * Renderizar filtros según configuración
         */
        renderFilters(filterConfig) {
            let html = '';
            
            for (const key in filterConfig) {
                const config = filterConfig[key];
                const value = this.filters[key] || '';
                
                html += '<div>';
                html += `<label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">${config.label}</label>`;
                
                if (config.type === 'select') {
                    html += `<select class="filter-${key}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">`;
                    config.options.forEach(option => {
                        const selected = value == option.value ? 'selected' : '';
                        html += `<option value="${option.value}" ${selected}>${option.label}</option>`;
                    });
                    html += '</select>';
                } else if (config.type === 'number') {
                    html += `<input type="number" class="filter-${key}" value="${value}" min="${config.min || ''}" max="${config.max || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">`;
                } else if (config.type === 'date') {
                    html += `<input type="date" class="filter-${key}" value="${value}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">`;
                } else {
                    html += `<input type="text" class="filter-${key}" value="${value}" placeholder="${config.placeholder || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">`;
                }
                
                html += '</div>';
            }
            
            return html;
        }

        /**
         * Adjuntar event listeners
         */
        attachEventListeners() {
            const btnApply = this.container.querySelector('.btn-apply-filters');
            const btnClear = this.container.querySelector('.btn-clear-filters');
            const btnExport = this.container.querySelector('.btn-export-csv');
            const btnRefresh = this.container.querySelector('.btn-refresh');

            // Aplicar filtros
            if (btnApply) {
                btnApply.addEventListener('click', () => {
                    this.updateFiltersFromDOM();
                    this.load();
                });
            }

            // Limpiar filtros
            if (btnClear) {
                btnClear.addEventListener('click', () => {
                    this.filters = this.initializeFilters();
                    this.updateFiltersInDOM();
                });
            }

            // Exportar CSV
            if (btnExport) {
                btnExport.addEventListener('click', () => {
                    this.exportToCSV();
                });
            }

            // Actualizar
            if (btnRefresh) {
                btnRefresh.addEventListener('click', () => {
                    this.load();
                });
            }
        }

        /**
         * Actualizar filtros desde el DOM
         */
        updateFiltersFromDOM() {
            const filterConfig = REPORT_FILTERS[this.reportType] || {};
            
            for (const key in filterConfig) {
                const input = this.container.querySelector(`.filter-${key}`);
                if (input) {
                    this.filters[key] = input.value;
                }
            }
        }

        /**
         * Actualizar filtros en el DOM
         */
        updateFiltersInDOM() {
            const filterConfig = REPORT_FILTERS[this.reportType] || {};
            
            for (const key in filterConfig) {
                const input = this.container.querySelector(`.filter-${key}`);
                if (input) {
                    input.value = this.filters[key] || '';
                }
            }
        }

        /**
         * Cargar datos del reporte
         */
        async load() {
            console.log('[ReportsViewer] load() llamado');
            
            if (this.loading) {
                console.log('[ReportsViewer] Ya está cargando, ignorando...');
                return;
            }

            this.loading = true;
            const loadingEl = this.container.querySelector('.reports-loading');
            const resultEl = this.container.querySelector('.reports-result');
            const emptyEl = this.container.querySelector('.reports-empty');
            
            if (loadingEl) loadingEl.style.display = 'block';
            if (resultEl) resultEl.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'none';

            try {
                const queryParams = this.buildQueryParams();
                const url = `${API_BASE}/reports/${this.reportType}?${queryParams}`;
                console.log('[ReportsViewer] Cargando desde URL:', url);
                
                const response = await this.bearerFetch(url);
                console.log('[ReportsViewer] Respuesta recibida:', response.status, response.statusText);
                
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log('[ReportsViewer] Datos recibidos:', data);
                
                this.data = data;
                this.renderResult(data);
                
                console.log('[ReportsViewer] Resultado renderizado');

            } catch (error) {
                console.error('[ReportsViewer] Error al cargar reporte:', error);
                this.showError('Error al cargar reporte: ' + error.message);
            } finally {
                this.loading = false;
                if (loadingEl) loadingEl.style.display = 'none';
            }
        }

        /**
         * Renderizar resultado del reporte
         */
        renderResult(data) {
            const resultEl = this.container.querySelector('.reports-result');
            const emptyEl = this.container.querySelector('.reports-empty');
            
            if (!resultEl) return;

            // Delegar al método específico según el tipo de reporte
            let html = '';
            
            switch (this.reportType) {
                case 'breaks':
                    html = this.renderBreaksReport(data);
                    break;
                default:
                    html = '<p>Renderizador no implementado para este tipo de reporte</p>';
            }

            resultEl.innerHTML = html;
            resultEl.style.display = 'block';
            if (emptyEl) emptyEl.style.display = 'none';

            // Agregar event listeners específicos
            this.attachResultEventListeners();
        }

        /**
         * Renderizar reporte de breaks
         */
        renderBreaksReport(data) {
            if (!data || !data.mecanicos || data.mecanicos.length === 0) {
                return '<p style="color: #666; text-align: center; padding: 40px;">No hay datos para el período seleccionado</p>';
            }

            const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const mesNombre = meses[data.mes] || data.mes;

            let html = '<div style="margin-bottom: 20px;">';
            html += `<h3 style="color: #004B93; margin-bottom: 10px;">Reporte de Breaks - ${mesNombre} ${data.anno}</h3>`;
            html += `<p style="color: #666; font-size: 14px;">Total de mecánicos: ${data.total_mecanicos} | Total de breaks (excluyendo colación): ${data.total_breaks}</p>`;
            html += '</div>';

            html += '<div class="table-container" style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">';
            html += '<table style="width: 100%; border-collapse: collapse;">';
            html += '<thead style="background: #004B93; color: white;">';
            html += '<tr>';
            html += '<th style="padding: 15px; text-align: left;">ID</th>';
            html += '<th style="padding: 15px; text-align: left;">RUT</th>';
            html += '<th style="padding: 15px; text-align: left;">Mecánico</th>';
            html += '<th style="padding: 15px; text-align: left;">Email</th>';
            html += '<th style="padding: 15px; text-align: center;">Total Breaks</th>';
            html += '<th style="padding: 15px; text-align: center;">Total Horas</th>';
            html += '</tr>';
            html += '</thead>';
            html += '<tbody>';

            data.mecanicos.forEach((mecanico, index) => {
                const bgColor = index % 2 === 0 ? '#f8f9fa' : 'white';
                html += `<tr style="background: ${bgColor};">`;
                html += `<td style="padding: 15px; text-align: center;">${mecanico.mecanico_id || 'N/A'}</td>`;
                html += `<td style="padding: 15px; text-align: center;">${mecanico.mecanico_rut || 'N/A'}</td>`;
                html += `<td style="padding: 15px;">${this.escapeHtml(mecanico.mecanico_nombre || 'N/A')}</td>`;
                html += `<td style="padding: 15px;">${this.escapeHtml(mecanico.mecanico_email || 'N/A')}</td>`;
                html += `<td style="padding: 15px; text-align: center; font-weight: bold;">${mecanico.total_breaks}</td>`;
                html += `<td style="padding: 15px; text-align: center; font-weight: bold; color: #004B93;">${mecanico.total_horas_formateado || '0 Horas 0 Minutos'}</td>`;
                html += '</tr>';
            });

            html += '</tbody>';
            html += '</table>';
            html += '</div>';

            return html;
        }

        /**
         * Adjuntar event listeners específicos del resultado
         */
        attachResultEventListeners() {
            // Los event listeners específicos se pueden agregar aquí si es necesario
        }

        /**
         * Exportar a CSV
         */
        async exportToCSV() {
            try {
                const queryParams = this.buildQueryParams();
                const url = `${API_BASE}/reports/${this.reportType}/export?${queryParams}`;
                
                const response = await this.bearerFetch(url, { skipContentType: true });
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                
                const mes = this.filters.mes || new Date().getMonth() + 1;
                const anno = this.filters.anno || new Date().getFullYear();
                link.download = `reporte_${this.reportType}_${mes}_${anno}_${new Date().toISOString().split('T')[0]}.csv`;
                
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);

                if (this.onExport) {
                    this.onExport(this.reportType);
                }
            } catch (error) {
                console.error('Error al exportar CSV:', error);
                alert('Error al exportar CSV: ' + error.message);
            }
        }

        /**
         * Construir query params
         */
        buildQueryParams() {
            const params = [];
            for (const key in this.filters) {
                if (this.filters.hasOwnProperty(key)) {
                    const value = this.filters[key];
                    if (value !== null && value !== undefined && value !== '') {
                        params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                    }
                }
            }
            return params.join('&');
        }

        /**
         * Mostrar error
         */
        showError(message) {
            const resultEl = this.container.querySelector('.reports-result');
            if (resultEl) {
                resultEl.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #dc3545;">
                        ❌ ${message}
                    </div>
                `;
                resultEl.style.display = 'block';
            }
        }

        /**
         * Escapar HTML
         */
        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Default bearerFetch
         */
        defaultBearerFetch(url, options = {}) {
            const token = localStorage.getItem('crm.token');
            const headers = new Headers(options.headers || {});
            
            if (!headers.has('Content-Type') && !options.skipContentType) {
                headers.set('Content-Type', 'application/json');
            }
            
            if (token) {
                headers.set('Authorization', 'Bearer ' + token);
            }

            return fetch(url, {
                ...options,
                headers: headers
            });
        }

        /**
         * Cambiar tipo de reporte
         */
        setReportType(reportType) {
            if (!this.hasAccess(reportType, this.userRole)) {
                throw new Error(`El usuario con rol '${this.userRole}' no tiene acceso al reporte '${reportType}'`);
            }
            
            this.reportType = reportType;
            this.filters = this.initializeFilters();
            this.render();
            this.attachEventListeners();
        }

        /**
         * Obtener reportes disponibles para el rol del usuario
         */
        static getAvailableReports(userRole) {
            const available = [];
            for (const reportType in REPORT_ACCESS) {
                const allowedRoles = REPORT_ACCESS[reportType] || [];
                if (allowedRoles.some(role => 
                    role.toLowerCase() === userRole.toLowerCase() || 
                    role.toUpperCase() === userRole.toUpperCase()
                )) {
                    available.push({
                        type: reportType,
                        label: REPORT_LABELS[reportType] || reportType
                    });
                }
            }
            return available;
        }
    }

    // Exportar clase y constantes
    window.ReportsViewer = ReportsViewer;
    window.ReportsViewerTypes = REPORT_TYPES;
    window.ReportsViewerLabels = REPORT_LABELS;
    window.ReportsViewerAccess = REPORT_ACCESS;
})();

