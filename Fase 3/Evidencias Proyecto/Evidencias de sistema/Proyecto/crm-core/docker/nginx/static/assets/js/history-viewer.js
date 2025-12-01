/**
 * HistoryViewer - Componente universal para visualizar y exportar historiales
 * 
 * Funcionalidades:
 * - Visualizar historiales de diferentes entidades en el navegador
 * - Filtros y búsqueda
 * - Paginación
 * - Exportación a CSV
 * 
 * USO:
 *   <script src="assets/js/history-viewer.js"></script>
 *   <script>
 *     const viewer = new HistoryViewer({
 *       container: '#history-container',
 *       entityType: 'solicitudes_repuestos'
 *     });
 *     viewer.load();
 *   </script>
 */

(function() {
    'use strict';

    const API_BASE = '/api';
    const ENTITY_TYPES = {
        SOLICITUDES_REPUESTOS: 'solicitudes_repuestos',
        MOVIMIENTOS_REPUESTOS: 'movimientos_repuestos',
        ORDENES_TRABAJO: 'ordenes_trabajo',
        SOLICITUDES_MANTENIMIENTO: 'solicitudes_mantenimiento',
        LOG_ESTADOS_OT: 'log_estados_ot',
        ENTREGAS_VEHICULOS: 'entregas_vehiculos'
    };

    const ENTITY_LABELS = {
        'solicitudes_repuestos': 'Solicitudes de Repuestos',
        'movimientos_repuestos': 'Movimientos de Repuestos',
        'ordenes_trabajo': 'Órdenes de Trabajo',
        'solicitudes_mantenimiento': 'Solicitudes de Mantenimiento',
        'log_estados_ot': 'Cambios de Estado de OTs',
        'entregas_vehiculos': 'Entregas de Vehículos'
    };

    /**
     * Configuración de acceso por rol
     * Define qué roles pueden ver qué tipos de historial
     */
    const ENTITY_ACCESS = {
        'solicitudes_repuestos': ['admin', 'ADMIN', 'jefe_taller', 'JEFE_TALLER'],
        'movimientos_repuestos': ['admin', 'ADMIN', 'jefe_taller', 'JEFE_TALLER'],
        'ordenes_trabajo': ['admin', 'ADMIN', 'jefe_taller', 'JEFE_TALLER'],
        'solicitudes_mantenimiento': ['admin', 'ADMIN', 'jefe_taller', 'JEFE_TALLER'],
        'log_estados_ot': ['admin', 'ADMIN', 'jefe_taller', 'JEFE_TALLER'],
        'entregas_vehiculos': ['admin', 'ADMIN', 'jefe_taller', 'JEFE_TALLER', 'recepcionista', 'RECEPCIONISTA']
    };

    /**
     * Clase HistoryViewer
     */
    class HistoryViewer {
        constructor(options = {}) {
            console.log('[HistoryViewer] Constructor llamado con options:', options);
            
            this.container = typeof options.container === 'string' 
                ? document.querySelector(options.container) 
                : options.container;
            
            console.log('[HistoryViewer] Container encontrado:', this.container);
            
            if (!this.container) {
                console.error('[HistoryViewer] Contenedor no encontrado. Selector:', options.container);
                throw new Error('HistoryViewer: contenedor no encontrado');
            }

            this.entityType = options.entityType || ENTITY_TYPES.SOLICITUDES_REPUESTOS;
            console.log('[HistoryViewer] EntityType:', this.entityType);
            
            // Selector de tipos de historial (opcional)
            this.entityTypeSelect = options.entityTypeSelect 
                ? (typeof options.entityTypeSelect === 'string' 
                    ? document.querySelector(options.entityTypeSelect) 
                    : options.entityTypeSelect)
                : null;
            
            // Filtros de categoría (opcional, para solicitudes_mantenimiento)
            this.categoryFilter = options.categoryFilter || null;
            this.categoryFilterSelect = options.categoryFilterSelect
                ? (typeof options.categoryFilterSelect === 'string'
                    ? document.querySelector(options.categoryFilterSelect)
                    : options.categoryFilterSelect)
                : null;
            
            // Tipos de historial disponibles para este usuario
            this.availableEntityTypes = options.availableEntityTypes || Object.values(ENTITY_TYPES);
            this.userRoles = options.userRoles || [];
            
            this.filters = {
                entityType: this.entityType,
                search: '',
                fechaDesde: '',
                fechaHasta: '',
                usuarioId: options.usuarioId || null,
                tallerId: options.tallerId || null,
                page: 1,
                limit: options.pageSize || 20
            };

            this.currentPage = 1;
            this.pageSize = options.pageSize || 20;
            this.data = [];
            this.allData = []; // Para almacenar todos los datos sin filtrar (para filtros de categoría)
            this.pagination = null;
            this.loading = false;

            this.onExport = options.onExport || null;
            this.onRowClick = options.onRowClick || null; // Callback para clicks en filas
            this.bearerFetch = options.bearerFetch || window.bearerFetch || this.defaultBearerFetch;
            
            console.log('[HistoryViewer] bearerFetch disponible:', typeof this.bearerFetch === 'function');

            console.log('[HistoryViewer] Inicializando...');
            this.init();
            console.log('[HistoryViewer] Inicialización completada');
        }

        /**
         * Inicializar el viewer
         */
        init() {
            console.log('[HistoryViewer] init() llamado');
            try {
                // Si hay un selector de tipos de historial externo, configurarlo
                if (this.entityTypeSelect) {
                    this.renderEntityTypeSelector();
                }
                
                // Si hay un selector de categoría externo, configurarlo
                if (this.categoryFilterSelect) {
                    this.renderCategoryFilter();
                }
                
                this.render();
                console.log('[HistoryViewer] render() completado');
                this.attachEventListeners();
                console.log('[HistoryViewer] attachEventListeners() completado');
            } catch (error) {
                console.error('[HistoryViewer] Error en init():', error);
                throw error;
            }
        }

        /**
         * Renderizar selector de tipos de historial (si está configurado externamente)
         */
        renderEntityTypeSelector() {
            if (!this.entityTypeSelect) return;
            
            // Filtrar tipos disponibles según roles del usuario
            const accessibleTypes = this.availableEntityTypes.filter(type => {
                if (!ENTITY_ACCESS[type]) return true; // Si no hay restricción, permitir
                return ENTITY_ACCESS[type].some(role => 
                    this.userRoles.some(userRole => 
                        String(userRole).toLowerCase() === String(role).toLowerCase()
                    )
                );
            });
            
            // Limpiar y poblar el selector
            this.entityTypeSelect.innerHTML = accessibleTypes.map(type => {
                const label = ENTITY_LABELS[type] || type;
                const selected = type === this.entityType ? 'selected' : '';
                return `<option value="${type}" ${selected}>${label}</option>`;
            }).join('');
            
            // Agregar event listener
            this.entityTypeSelect.addEventListener('change', (e) => {
                this.entityType = e.target.value;
                this.filters.entityType = e.target.value;
                this.filters.page = 1;
                
                // Actualizar el header con el nuevo tipo
                this.updateHeader();
                
                // Actualizar visibilidad del filtro de categoría
                this.renderCategoryFilter();
                
                this.load();
            });
        }

        /**
         * Actualizar el header con el tipo de historial actual
         */
        updateHeader() {
            const headerEl = this.container.querySelector('.history-header h3');
            if (headerEl) {
                const label = ENTITY_LABELS[this.entityType] || this.entityType;
                headerEl.textContent = label;
                console.log('[HistoryViewer] Header actualizado a:', label);
            }
        }

        /**
         * Renderizar selector de categoría (para solicitudes_mantenimiento)
         */
        renderCategoryFilter() {
            if (!this.categoryFilterSelect) return;
            
            // Solo mostrar si el tipo de historial es solicitudes_mantenimiento
            if (this.entityType !== ENTITY_TYPES.SOLICITUDES_MANTENIMIENTO) {
                if (this.categoryFilterSelect.parentElement) {
                    this.categoryFilterSelect.parentElement.style.display = 'none';
                }
                return;
            }
            
            if (this.categoryFilterSelect.parentElement) {
                this.categoryFilterSelect.parentElement.style.display = 'block';
            }
            
            // Agregar event listener si no existe
            if (!this.categoryFilterSelect.hasAttribute('data-listener-attached')) {
                this.categoryFilterSelect.setAttribute('data-listener-attached', 'true');
                this.categoryFilterSelect.addEventListener('change', () => {
                    this.categoryFilter = this.categoryFilterSelect.value;
                    this.applyCategoryFilter();
                });
            }
        }

        /**
         * Renderizar el componente
         */
        render() {
            console.log('[HistoryViewer] render() llamado');
            const label = ENTITY_LABELS[this.entityType] || this.entityType;
            console.log('[HistoryViewer] Label:', label);
            console.log('[HistoryViewer] Container antes de render:', this.container);
            
            this.container.innerHTML = `
                <div class="history-viewer" style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div class="history-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
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

                    <div class="history-filters" style="margin-bottom: 20px; padding: 16px; background: #f8f9fa; border-radius: 4px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Búsqueda</label>
                                <input type="text" class="filter-search" placeholder="Buscar..." 
                                    value="${this.filters.search || ''}"
                                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Fecha Desde</label>
                                <input type="date" class="filter-fecha-desde" 
                                    value="${this.filters.fechaDesde || ''}"
                                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-size: 14px; font-weight: 500;">Fecha Hasta</label>
                                <input type="date" class="filter-fecha-hasta" 
                                    value="${this.filters.fechaHasta || ''}"
                                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                            </div>
                            <div style="display: flex; align-items: flex-end; gap: 8px;">
                                <button class="btn-apply-filters" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; flex: 1;">
                                    Aplicar
                                </button>
                                <button class="btn-clear-filters" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                                    Limpiar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="history-content">
                        <div class="history-loading" style="display: none; text-align: center; padding: 40px; color: #666;">
                            Cargando historial...
                        </div>
                        <div class="history-table-container" style="overflow-x: auto;">
                            <table class="history-table" style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <thead class="history-thead">
                                    <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                        <!-- Headers se generan dinámicamente -->
                                    </tr>
                                </thead>
                                <tbody class="history-tbody">
                                    <tr>
                                        <td colspan="100%" style="text-align: center; padding: 40px; color: #666;">
                                            No hay datos para mostrar
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="history-pagination" style="margin-top: 20px;"></div>
                    </div>
                </div>
            `;
            
            console.log('[HistoryViewer] HTML insertado. Container innerHTML length:', this.container.innerHTML.length);
            console.log('[HistoryViewer] Container después de render:', this.container);
            
            // Verificar que el HTML se insertó correctamente
            const viewerDiv = this.container.querySelector('.history-viewer');
            console.log('[HistoryViewer] .history-viewer encontrado:', viewerDiv);
            if (viewerDiv) {
                console.log('[HistoryViewer] .history-viewer display:', window.getComputedStyle(viewerDiv).display);
                console.log('[HistoryViewer] .history-viewer height:', window.getComputedStyle(viewerDiv).height);
            }
        }

        /**
         * Adjuntar event listeners
         */
        attachEventListeners() {
            const searchInput = this.container.querySelector('.filter-search');
            const fechaDesdeInput = this.container.querySelector('.filter-fecha-desde');
            const fechaHastaInput = this.container.querySelector('.filter-fecha-hasta');
            const btnApply = this.container.querySelector('.btn-apply-filters');
            const btnClear = this.container.querySelector('.btn-clear-filters');
            const btnExport = this.container.querySelector('.btn-export-csv');
            const btnRefresh = this.container.querySelector('.btn-refresh');

            // Debounce para búsqueda
            let searchTimeout;
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.filters.search = e.target.value;
                        this.filters.page = 1;
                        this.load();
                    }, 500);
                });
            }

            // Aplicar filtros
            if (btnApply) {
                btnApply.addEventListener('click', () => {
                    this.filters.fechaDesde = fechaDesdeInput?.value || '';
                    this.filters.fechaHasta = fechaHastaInput?.value || '';
                    this.filters.page = 1;
                    this.load();
                });
            }

            // Limpiar filtros
            if (btnClear) {
                btnClear.addEventListener('click', () => {
                    this.filters.search = '';
                    this.filters.fechaDesde = '';
                    this.filters.fechaHasta = '';
                    this.filters.page = 1;
                    if (searchInput) searchInput.value = '';
                    if (fechaDesdeInput) fechaDesdeInput.value = '';
                    if (fechaHastaInput) fechaHastaInput.value = '';
                    this.load();
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
         * Cargar datos del historial
         */
        async load() {
            console.log('[HistoryViewer] load() llamado');
            
            if (this.loading) {
                console.log('[HistoryViewer] Ya está cargando, ignorando...');
                return;
            }

            this.loading = true;
            const loadingEl = this.container.querySelector('.history-loading');
            const tableEl = this.container.querySelector('.history-table-container');
            
            console.log('[HistoryViewer] loadingEl:', loadingEl, 'tableEl:', tableEl);
            
            if (loadingEl) loadingEl.style.display = 'block';
            if (tableEl) tableEl.style.display = 'none';

            try {
                const queryParams = this.buildQueryParams();
                const url = `${API_BASE}/history?${queryParams}`;
                console.log('[HistoryViewer] Cargando desde URL:', url);
                console.log('[HistoryViewer] Query params:', queryParams);
                
                const response = await this.bearerFetch(url);
                console.log('[HistoryViewer] Respuesta recibida:', response.status, response.statusText);
                
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                console.log('[HistoryViewer] Datos recibidos:', result);
                
                this.allData = result.data || []; // Guardar todos los datos
                this.data = this.allData;
                this.pagination = result.pagination || null;
                
                console.log('[HistoryViewer] Datos procesados. Total items:', this.data.length);
                console.log('[HistoryViewer] Paginación:', this.pagination);

                // Aplicar filtro de categoría si existe
                if (this.categoryFilter && this.entityType === ENTITY_TYPES.SOLICITUDES_MANTENIMIENTO) {
                    this.applyCategoryFilter();
                } else {
                    this.renderTable();
                    this.renderPagination();
                }
                
                console.log('[HistoryViewer] Tabla y paginación renderizadas');

            } catch (error) {
                console.error('[HistoryViewer] Error al cargar historial:', error);
                this.showError('Error al cargar historial: ' + error.message);
            } finally {
                this.loading = false;
                if (loadingEl) loadingEl.style.display = 'none';
                if (tableEl) tableEl.style.display = 'block';
            }
        }

        /**
         * Aplicar filtro de categoría (para solicitudes_mantenimiento)
         */
        applyCategoryFilter() {
            if (!this.categoryFilter || this.entityType !== ENTITY_TYPES.SOLICITUDES_MANTENIMIENTO) {
                this.data = this.allData;
            } else {
                this.data = this.allData.filter(item => {
                    if (this.categoryFilter === 'choferes') {
                        // Solo solicitudes con conductor (choferes)
                        return item.conductor && item.conductor !== null && item.conductor !== '';
                    } else if (this.categoryFilter === 'mecanicos') {
                        // Solo solicitudes sin conductor (mecánicos/internas)
                        return !item.conductor || item.conductor === null || item.conductor === '';
                    }
                    return true; // Todas
                });
            }
            
            this.renderTable();
            this.renderPagination();
        }

        /**
         * Renderizar tabla
         */
        renderTable() {
            console.log('[HistoryViewer] renderTable() llamado. Datos:', this.data);
            console.log('[HistoryViewer] Container:', this.container);
            
            const thead = this.container.querySelector('.history-thead');
            const tbody = this.container.querySelector('.history-tbody');
            
            console.log('[HistoryViewer] thead encontrado:', thead);
            console.log('[HistoryViewer] tbody encontrado:', tbody);

            if (!this.data || this.data.length === 0) {
                console.log('[HistoryViewer] No hay datos, mostrando mensaje vacío');
                
                // Limpiar thead y mostrar mensaje en tbody
                if (thead) {
                    thead.innerHTML = '<tr><th style="padding: 12px;">Estado</th></tr>';
                }
                if (tbody) {
                    tbody.innerHTML = `
                        <tr>
                            <td style="text-align: center; padding: 40px; color: #666; font-size: 16px;">
                                📭 No hay datos para mostrar en este historial
                                <br>
                                <small style="color: #999; margin-top: 10px; display: block;">
                                    Intenta seleccionar otro tipo de historial o ajustar los filtros
                                </small>
                            </td>
                        </tr>
                    `;
                    console.log('[HistoryViewer] Mensaje de "no hay datos" insertado en tbody');
                } else {
                    console.error('[HistoryViewer] tbody no encontrado!');
                }
                return;
            }

            // Obtener headers del primer objeto
            const headers = Object.keys(this.data[0]);
            const headerLabels = this.getHeaderLabels(headers);

            // Renderizar headers
            if (thead) {
                thead.innerHTML = `
                    <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                        ${headers.map(h => `
                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6;">
                                ${headerLabels[h] || h}
                            </th>
                        `).join('')}
                    </tr>
                `;
                console.log('[HistoryViewer] Headers renderizados:', headers.length);
            } else {
                console.error('[HistoryViewer] thead no encontrado!');
            }

            // Renderizar filas
            if (tbody) {
                tbody.innerHTML = this.data.map((row, rowIndex) => {
                    // Agregar columna de origen para solicitudes_mantenimiento si no existe
                    const hasOrigen = headers.includes('origen') || headers.includes('categoria');
                    let origenCell = '';
                    
                    if (this.entityType === ENTITY_TYPES.SOLICITUDES_MANTENIMIENTO && !hasOrigen) {
                        const tieneConductor = row.conductor && row.conductor !== null && row.conductor !== '';
                        origenCell = `
                            <td style="padding: 12px; color: #212529;">
                                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; 
                                    background: ${tieneConductor ? '#e3f2fd' : '#fff3e0'}; 
                                    color: ${tieneConductor ? '#1976d2' : '#f57c00'};">
                                    ${tieneConductor ? '🚗 Chofer' : '🔧 Mecánico'}
                                </span>
                            </td>
                        `;
                    }
                    
                    // Determinar si la fila debe ser clickeable
                    // Solo hacer clickeable si hay onRowClick definido
                    const isClickable = !!this.onRowClick;
                    const rowHtml = `
                        <tr style="border-bottom: 1px solid #dee2e6; ${isClickable ? 'cursor: pointer;' : 'cursor: default;'}" 
                            data-row-index="${rowIndex}" 
                            ${row.id ? `data-row-id="${row.id}"` : ''}>
                            ${headers.map(h => `
                                <td style="padding: 12px; color: #212529;">
                                    ${this.formatCellValue(row[h])}
                                </td>
                            `).join('')}
                            ${origenCell}
                        </tr>
                    `;
                    return rowHtml;
                }).join('');

                // Agregar columna de origen al header si es necesario
                if (this.entityType === ENTITY_TYPES.SOLICITUDES_MANTENIMIENTO && thead) {
                    const headerRow = thead.querySelector('tr');
                    if (headerRow) {
                        const hasOrigenHeader = Array.from(headerRow.querySelectorAll('th')).some(th => {
                            const text = th.textContent.trim().toLowerCase();
                            return text === 'origen' || text === 'categoría';
                        });
                        
                        if (!hasOrigenHeader) {
                            headerRow.innerHTML += `
                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6;">
                                    Origen
                                </th>
                            `;
                        }
                    }
                }

                // Agregar event listeners para clicks en filas
                // Solo hacer filas clickeables si hay onRowClick
                if (this.onRowClick) {
                    const rows = tbody.querySelectorAll('tr[data-row-id]');
                    rows.forEach(row => {
                        // Permitir que el callback decida si manejar el click o no
                        row.addEventListener('click', (e) => {
                            const rowId = row.getAttribute('data-row-id');
                            if (rowId) {
                                // El callback debe verificar el entityType internamente
                                const rowData = this.data[parseInt(row.getAttribute('data-row-index'))];
                                this.onRowClick(rowId, rowData);
                            }
                        });
                        row.style.cursor = 'pointer';
                        row.addEventListener('mouseenter', () => {
                            row.style.background = '#e3f2fd';
                        });
                        row.addEventListener('mouseleave', () => {
                            const index = parseInt(row.getAttribute('data-row-index'));
                            row.style.background = index % 2 === 0 ? '#f8f9fa' : '#fff';
                        });
                    });
                }

                // Alternar colores de filas
                const rows = tbody.querySelectorAll('tr');
                rows.forEach((row, index) => {
                    if (index % 2 === 0 && !this.onRowClick) {
                        row.style.background = '#f8f9fa';
                    }
                });
                console.log('[HistoryViewer] Filas renderizadas:', rows.length);
            } else {
                console.error('[HistoryViewer] tbody no encontrado!');
            }
        }

        /**
         * Renderizar paginación
         */
        renderPagination() {
            const paginationEl = this.container.querySelector('.history-pagination');
            if (!paginationEl || !this.pagination) {
                if (paginationEl) paginationEl.innerHTML = '';
                return;
            }

            const { page, limit, total, totalPages } = this.pagination;

            // Si solo hay una página, no mostrar controles
            if (totalPages <= 1) {
                paginationEl.innerHTML = '';
                return;
            }

            if (typeof window.PaginationUtils !== 'undefined' && window.PaginationUtils.createPagination) {
                window.PaginationUtils.createPagination(paginationEl, this.pagination, (page) => {
                    this.filters.page = page;
                    this.load();
                });
            } else {
                // Fallback funcional con controles básicos
                const startItem = (page - 1) * limit + 1;
                const endItem = Math.min(page * limit, total);
                
                paginationEl.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; flex-wrap: wrap;">
                        <button class="history-pagination-btn" data-action="prev" ${page <= 1 ? 'disabled' : ''} 
                            style="padding: 8px 12px; border: 1px solid #ddd; background: ${page <= 1 ? '#f5f5f5' : '#fff'}; color: ${page <= 1 ? '#999' : '#333'}; cursor: ${page <= 1 ? 'not-allowed' : 'pointer'}; border-radius: 4px; font-size: 14px;">
                            ← Anterior
                        </button>
                        <span style="padding: 8px 12px; color: #666; font-size: 14px;">
                            Página ${page} de ${totalPages}
                        </span>
                        <button class="history-pagination-btn" data-action="next" ${page >= totalPages ? 'disabled' : ''} 
                            style="padding: 8px 12px; border: 1px solid #ddd; background: ${page >= totalPages ? '#f5f5f5' : '#fff'}; color: ${page >= totalPages ? '#999' : '#333'}; cursor: ${page >= totalPages ? 'not-allowed' : 'pointer'}; border-radius: 4px; font-size: 14px;">
                            Siguiente →
                        </button>
                        <span style="margin-left: 16px; color: #666; font-size: 14px;">
                            Mostrando ${startItem}-${endItem} de ${total}
                        </span>
                    </div>
                `;

                // Agregar event listeners a los botones
                const prevBtn = paginationEl.querySelector('[data-action="prev"]');
                const nextBtn = paginationEl.querySelector('[data-action="next"]');
                
                if (prevBtn && !prevBtn.disabled) {
                    prevBtn.addEventListener('click', () => {
                        if (page > 1) {
                            this.filters.page = page - 1;
                            this.load();
                        }
                    });
                }
                
                if (nextBtn && !nextBtn.disabled) {
                    nextBtn.addEventListener('click', () => {
                        if (page < totalPages) {
                            this.filters.page = page + 1;
                            this.load();
                        }
                    });
                }
            }
        }

        /**
         * Exportar a CSV
         */
        async exportToCSV() {
            try {
                const queryParams = this.buildQueryParams();
                const url = `${API_BASE}/history/export?${queryParams}`;
                
                // Crear link temporal para descargar
                const link = document.createElement('a');
                link.href = url;
                link.download = `historial_${this.entityType}_${new Date().toISOString().split('T')[0]}.csv`;
                
                // Agregar token si existe
                const token = localStorage.getItem('crm.token');
                if (token) {
                    // Usar fetch para descargar con token
                    const response = await this.bearerFetch(url);
                    if (!response.ok) {
                        throw new Error(`Error ${response.status}: ${response.statusText}`);
                    }
                    
                    const blob = await response.blob();
                    const blobUrl = window.URL.createObjectURL(blob);
                    link.href = blobUrl;
                    link.click();
                    window.URL.revokeObjectURL(blobUrl);
                } else {
                    link.click();
                }

                if (this.onExport) {
                    this.onExport(this.entityType);
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
         * Obtener labels de headers
         */
        getHeaderLabels(headers) {
            const labels = {
                id: 'ID',
                numero_ot: 'Número OT',
                repuesto: 'Repuesto',
                sku: 'SKU',
                cantidad_solicitada: 'Cantidad Solicitada',
                urgencia: 'Urgencia',
                estado: 'Estado',
                comentarios: 'Comentarios',
                solicitado_por: 'Solicitado Por',
                fecha_solicitud: 'Fecha Solicitud',
                fecha_aprobacion: 'Fecha Aprobación',
                fecha_estimada_entrega: 'Fecha Estimada Entrega',
                tipo_movimiento: 'Tipo Movimiento',
                cantidad: 'Cantidad',
                costo_unitario: 'Costo Unitario',
                motivo: 'Motivo',
                movido_por: 'Movido Por',
                taller: 'Taller',
                vehiculo: 'Vehículo',
                mecanico: 'Mecánico',
                tipo_trabajo: 'Tipo Trabajo',
                descripcion: 'Descripción',
                fecha_creacion: 'Fecha Creación',
                fecha_asignacion: 'Fecha Asignación',
                fecha_inicio_trabajo: 'Fecha Inicio Trabajo',
                fecha_finalizacion: 'Fecha Finalización',
                fecha_cierre: 'Fecha Cierre',
                numero_solicitud: 'Número Solicitud',
                conductor: 'Conductor',
                tipo_solicitud: 'Tipo Solicitud',
                descripcion_problema: 'Descripción Problema',
                estado_anterior: 'Estado Anterior',
                estado_nuevo: 'Estado Nuevo',
                motivo_cambio: 'Motivo Cambio',
                cambiado_por: 'Cambiado Por',
                fecha_cambio: 'Fecha Cambio',
                tipo_entrega: 'Tipo Entrega',
                responsable: 'Responsable',
                condicion_vehiculo: 'Condición Vehículo',
                lectura_odometro: 'Lectura Odómetro',
                nivel_combustible: 'Nivel Combustible',
                observaciones: 'Observaciones',
                fecha_firma: 'Fecha Firma'
            };

            return labels;
        }

        /**
         * Formatear valor de celda
         */
        formatCellValue(value) {
            if (value === null || value === undefined) {
                return '<span style="color: #999;">—</span>';
            }

            if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
                const date = new Date(value);
                return date.toLocaleString('es-CL', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            return String(value);
        }

        /**
         * Mostrar error
         */
        showError(message) {
            const tbody = this.container.querySelector('.history-tbody');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="100%" style="text-align: center; padding: 40px; color: #dc3545;">
                            ❌ ${message}
                        </td>
                    </tr>
                `;
            }
        }

        /**
         * Default bearerFetch
         */
        defaultBearerFetch(url, options = {}) {
            const token = localStorage.getItem('crm.token');
            const headers = new Headers(options.headers || {});
            
            if (!headers.has('Content-Type')) {
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
    }

    /**
     * Función helper para inicializar historiales con selector de tipos
     * Similar a cómo funciona ReportsViewer
     */
    function initHistoryViewer(options) {
        const {
            container,
            entityTypeSelect,
            categoryFilterSelect,
            bearerFetch,
            userRoles = [],
            initialEntityType = ENTITY_TYPES.SOLICITUDES_MANTENIMIENTO,
            onRowClick = null,
            pageSize = 20
        } = options;

        if (!container) {
            console.error('[initHistoryViewer] Container no encontrado');
            return null;
        }

        // Obtener todos los tipos de historial disponibles
        const allEntityTypes = Object.values(ENTITY_TYPES);
        
        // Filtrar según roles del usuario
        const availableEntityTypes = allEntityTypes.filter(type => {
            if (!ENTITY_ACCESS[type]) return true;
            return ENTITY_ACCESS[type].some(role => 
                userRoles.some(userRole => 
                    String(userRole).toLowerCase() === String(role).toLowerCase()
                )
            );
        });

        // Crear el viewer
        const viewer = new HistoryViewer({
            container: container,
            entityType: initialEntityType,
            entityTypeSelect: entityTypeSelect,
            categoryFilterSelect: categoryFilterSelect,
            bearerFetch: bearerFetch,
            userRoles: userRoles,
            availableEntityTypes: availableEntityTypes,
            onRowClick: onRowClick,
            pageSize: pageSize
        });

        // Cargar datos iniciales
        setTimeout(() => {
            viewer.load();
        }, 100);

        return viewer;
    }

    // Exportar clase y función helper
    window.HistoryViewer = HistoryViewer;
    window.HistoryViewerEntityTypes = ENTITY_TYPES;
    window.HistoryViewerEntityLabels = ENTITY_LABELS;
    window.initHistoryViewer = initHistoryViewer;
})();

