/**
 * VehiclesViewer - Componente universal para gestionar vehículos
 * 
 * Funcionalidades:
 * - Visualizar lista de vehículos
 * - Agregar nuevos vehículos
 * - Editar vehículos existentes
 * - Eliminar vehículos
 * - Generar órdenes de trabajo desde vehículos
 * 
 * USO:
 *   <script src="assets/js/vehicles-viewer.js"></script>
 *   <script>
 *     const viewer = new VehiclesViewer({
 *       container: '#vehicles-container',
 *       bearerFetch: bearerFetch
 *     });
 *     viewer.load();
 *   </script>
 */

(function() {
    'use strict';

    const API_BASE = '/api';

    /**
     * Clase VehiclesViewer
     */
    class VehiclesViewer {
        constructor(options = {}) {
            console.log('[VehiclesViewer] Constructor llamado con options:', options);
            
            this.container = typeof options.container === 'string' 
                ? document.querySelector(options.container) 
                : options.container;
            
            if (!this.container) {
                console.error('[VehiclesViewer] Contenedor no encontrado. Selector:', options.container);
                throw new Error('VehiclesViewer: contenedor no encontrado');
            }

            this.bearerFetch = options.bearerFetch || window.bearerFetch || this.defaultBearerFetch;
            this.onVehicleAdded = options.onVehicleAdded || null;
            this.onVehicleUpdated = options.onVehicleUpdated || null;
            this.onVehicleDeleted = options.onVehicleDeleted || null;
            this.onGenerateOT = options.onGenerateOT || null;
            this.onVehiclesLoaded = options.onVehiclesLoaded || null; // Callback cuando se cargan/actualizan vehículos
            this.showPendingRequests = options.showPendingRequests !== false; // Por defecto true
            this.showGenerateOTButton = options.showGenerateOTButton !== false; // Por defecto true
            
            // Socket.IO para actualizaciones en tiempo real
            this.socket = options.socket || null;
            this.enableSocketIO = options.enableSocketIO !== false; // Por defecto true
            
            this.data = [];
            this.loading = false;

            // Referencias a elementos del DOM (se crearán dinámicamente)
            this.tableBody = null;
            this.modalAdd = null;
            this.modalEdit = null;
            this.formAdd = null;
            this.formEdit = null;

            console.log('[VehiclesViewer] Inicializando...');
            this.init();
            console.log('[VehiclesViewer] Inicialización completada');
        }

        /**
         * Inicializar el viewer
         */
        init() {
            try {
                this.render();
                this.attachEventListeners();
                this.setupSocketIO();
            } catch (error) {
                console.error('[VehiclesViewer] Error en init():', error);
                throw error;
            }
        }

        /**
         * Renderizar el componente
         */
        render() {
            const containerId = this.container.id || 'vehicles-container';
            
            this.container.innerHTML = `
                <div class="vehicles-viewer" style="background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div class="vehicles-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
                        <h3 style="margin: 0; font-size: 20px; font-weight: bold;">Gestión de Vehículos</h3>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-vehicles-add" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                                ➕ Nuevo Vehículo
                            </button>
                            <button class="btn-vehicles-refresh" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                                🔄 Actualizar
                            </button>
                        </div>
                    </div>

                    <div class="vehicles-content">
                        <div class="vehicles-loading" style="display: none; text-align: center; padding: 40px; color: #666;">
                            Cargando vehículos...
                        </div>
                        <div class="vehicles-table-container" style="overflow-x: auto;">
                            <table class="vehicles-table" style="width: 100%; border-collapse: collapse; font-size: 14px;">
                                <thead class="vehicles-thead">
                                    <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">ID</th>
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Patente</th>
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Marca</th>
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Modelo</th>
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Año</th>
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">VIN</th>
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Estado</th>
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Ingreso</th>
                                        <th style="padding: 12px; text-align: left; font-weight: 600; color: #495057;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody class="vehicles-tbody">
                                    <tr>
                                        <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                                            No hay datos para mostrar
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Crear modales
            this.createModals(containerId);
        }

        /**
         * Crear modales para agregar y editar vehículos
         */
        createModals(containerId) {
            // Modal para agregar
            const modalAddId = `modal-vehicles-add-${containerId}`;
            let modalAdd = document.getElementById(modalAddId);
            if (!modalAdd) {
                modalAdd = document.createElement('div');
                modalAdd.id = modalAddId;
                modalAdd.className = 'modal';
                modalAdd.style.display = 'none';
                modalAdd.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Nuevo Vehículo</h3>
                            <button class="close-btn" onclick="this.closest('.modal').style.display='none'">&times;</button>
                        </div>
                        <form class="vehicles-form-add">
                            <div class="form-group">
                                <label for="veh_add_patente">Patente (*)</label>
                                <input id="veh_add_patente" required placeholder="ABCD12" />
                            </div>
                            <div class="form-group">
                                <label for="veh_add_marca">Marca (*)</label>
                                <input id="veh_add_marca" required placeholder="Mercedes-Benz" />
                            </div>
                            <div class="form-group">
                                <label for="veh_add_modelo">Modelo (*)</label>
                                <input id="veh_add_modelo" required placeholder="Actros 2651" />
                            </div>
                            <div class="form-group">
                                <label for="veh_add_anio_modelo">Año</label>
                                <input id="veh_add_anio_modelo" type="number" placeholder="2020" />
                            </div>
                            <div class="form-group">
                                <label for="veh_add_vin">VIN (N° Chasis)</label>
                                <input id="veh_add_vin" placeholder="Opcional..." />
                            </div>
                            <div class="form-actions">
                                <div class="vehicles-add-msg status hidden"></div>
                                <button type="button" class="btn btn-warning" onclick="this.closest('.modal').style.display='none'">Cancelar</button>
                                <button type="submit" class="btn btn-primary">Guardar Vehículo</button>
                            </div>
                        </form>
                    </div>
                `;
                document.body.appendChild(modalAdd);
            }
            this.modalAdd = modalAdd;
            this.formAdd = modalAdd.querySelector('.vehicles-form-add');

            // Modal para editar
            const modalEditId = `modal-vehicles-edit-${containerId}`;
            let modalEdit = document.getElementById(modalEditId);
            if (!modalEdit) {
                modalEdit = document.createElement('div');
                modalEdit.id = modalEditId;
                modalEdit.className = 'modal';
                modalEdit.style.display = 'none';
                modalEdit.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Editar Vehículo</h3>
                            <button class="close-btn" onclick="this.closest('.modal').style.display='none'">&times;</button>
                        </div>
                        <form class="vehicles-form-edit">
                            <input type="hidden" class="veh_edit_id" />
                            <div class="form-group">
                                <label for="veh_edit_patente">Patente (*)</label>
                                <input id="veh_edit_patente" required placeholder="ABCD12" />
                            </div>
                            <div class="form-group">
                                <label for="veh_edit_marca">Marca (*)</label>
                                <input id="veh_edit_marca" required placeholder="Mercedes-Benz" />
                            </div>
                            <div class="form-group">
                                <label for="veh_edit_modelo">Modelo (*)</label>
                                <input id="veh_edit_modelo" required placeholder="Actros 2651" />
                            </div>
                            <div class="form-group">
                                <label for="veh_edit_anio_modelo">Año</label>
                                <input id="veh_edit_anio_modelo" type="number" placeholder="2020" />
                            </div>
                            <div class="form-group">
                                <label for="veh_edit_vin">VIN (N° Chasis)</label>
                                <input id="veh_edit_vin" placeholder="Opcional..." />
                            </div>
                            <div class="form-group">
                                <label for="veh_edit_estado">Estado (*)</label>
                                <select id="veh_edit_estado" required>
                                    <option value="OPERATIVO">Operativo</option>
                                    <option value="EN_REVISION">En Revisión</option>
                                    <option value="STANDBY">Standby</option>
                                    <option value="CITA_MANTENCION">Cita Mantención</option>
                                    <option value="EN_TALLER">En Taller</option>
                                    <option value="MANTENCION">Mantención</option>
                                    <option value="COMPLETADO">Completado</option>
                                    <option value="LISTO_PARA_RETIRO">Listo para Retiro</option>
                                    <option value="INACTIVO">Inactivo</option>
                                </select>
                            </div>
                            <div class="form-actions">
                                <div class="vehicles-edit-msg status hidden"></div>
                                <button type="button" class="btn btn-danger" onclick="this.closest('.vehicles-viewer').__vehiclesViewer.confirmDelete()">Eliminar</button>
                                <div style="flex:1"></div>
                                <button type="button" class="btn btn-warning" onclick="this.closest('.modal').style.display='none'">Cancelar</button>
                                <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                `;
                document.body.appendChild(modalEdit);
            }
            this.modalEdit = modalEdit;
            this.formEdit = modalEdit.querySelector('.vehicles-form-edit');

            // Guardar referencia del viewer en el contenedor para acceso desde callbacks
            const viewerDiv = this.container.querySelector('.vehicles-viewer');
            if (viewerDiv) {
                viewerDiv.__vehiclesViewer = this;
            }
        }

        /**
         * Adjuntar event listeners
         */
        attachEventListeners() {
            const btnAdd = this.container.querySelector('.btn-vehicles-add');
            const btnRefresh = this.container.querySelector('.btn-vehicles-refresh');
            this.tableBody = this.container.querySelector('.vehicles-tbody');

            if (btnAdd) {
                btnAdd.addEventListener('click', () => this.openAddModal());
            }

            if (btnRefresh) {
                btnRefresh.addEventListener('click', () => this.load());
            }

            if (this.formAdd) {
                this.formAdd.addEventListener('submit', (e) => this.handleAddSubmit(e));
            }

            if (this.formEdit) {
                this.formEdit.addEventListener('submit', (e) => this.handleEditSubmit(e));
            }
        }

        /**
         * Configurar Socket.IO para actualizaciones en tiempo real
         */
        setupSocketIO() {
            if (!this.enableSocketIO) {
                console.log('[VehiclesViewer] Socket.IO deshabilitado');
                return;
            }

            // Obtener socket del contexto global si no se pasó como opción
            if (!this.socket && typeof window.io === 'function') {
                // Intentar obtener socket existente del contexto global
                // Si no existe, crear uno nuevo
                this.socket = window.io('/', { path: '/socket.io/' });
                console.log('[VehiclesViewer] Socket.IO creado');
            } else if (this.socket) {
                console.log('[VehiclesViewer] Socket.IO proporcionado como opción. Estado:', this.socket.connected ? 'conectado' : 'desconectado');
            } else {
                console.warn('[VehiclesViewer] Socket.IO no disponible');
                return;
            }

            if (!this.socket) {
                console.warn('[VehiclesViewer] Socket es null, no se pueden configurar listeners');
                return;
            }

            // Escuchar evento de conexión
            this.socket.on('connect', () => {
                console.log('[VehiclesViewer] Socket.IO conectado');
                // Si ya está conectado, configurar listeners inmediatamente
                if (this.socket.connected) {
                    console.log('[VehiclesViewer] Socket ya está conectado, listeners activos');
                }
            });
            
            // Si el socket ya está conectado, los listeners se configurarán inmediatamente
            if (this.socket.connected) {
                console.log('[VehiclesViewer] Socket ya está conectado al configurar listeners');
            }

            // Escuchar evento de desconexión para debugging
            this.socket.on('disconnect', () => {
                console.warn('[VehiclesViewer] Socket.IO desconectado');
            });

            // Escuchar eventos de actualización de vehículos
            this.socket.on('vehiculo:refresh', (payload) => {
                console.log('[VehiclesViewer] Evento vehiculo:refresh recibido:', payload);
                // Recargar lista de vehículos cuando hay cambios (con debounce para evitar múltiples recargas)
                this.scheduleRefresh();
            });

            // Escuchar eventos de recepción (pueden afectar vehículos, especialmente cuando se crean OTs)
            this.socket.on('reception:refresh', () => {
                console.log('[VehiclesViewer] Evento reception:refresh recibido - programando recarga...');
                // Recargar lista de vehículos cuando hay cambios en recepción (incluye creación de OTs)
                this.scheduleRefresh();
            });

            // Escuchar eventos generales de actualización de vehículos
            this.socket.on('vehicles:refresh', () => {
                console.log('[VehiclesViewer] Evento vehicles:refresh recibido - programando recarga...');
                this.scheduleRefresh();
            });

            // Escuchar eventos de solicitudes (cuando se convierten en OTs, afectan vehículos)
            this.socket.on('solicitud:refresh', () => {
                console.log('[VehiclesViewer] Evento solicitud:refresh recibido - programando recarga...');
                this.scheduleRefresh();
            });

            // Escuchar eventos de órdenes de trabajo (cuando se crean OTs, afectan vehículos)
            this.socket.on('workorders:refresh', () => {
                console.log('[VehiclesViewer] ✅ Evento workorders:refresh recibido - programando recarga de vehículos...');
                this.scheduleRefresh();
            });

            // Escuchar notificaciones de jefe de taller (pueden incluir creación de OTs)
            this.socket.on('jefe-taller:notification', (notification) => {
                console.log('[VehiclesViewer] Evento jefe-taller:notification recibido:', notification);
                // Si la notificación está relacionada con una OT, recargar vehículos
                if (notification.otId) {
                    console.log('[VehiclesViewer] Notificación contiene otId, programando recarga...');
                    this.scheduleRefresh();
                }
            });

            console.log('[VehiclesViewer] Socket.IO configurado correctamente. Listeners activos para:', [
                'vehiculo:refresh',
                'reception:refresh',
                'vehicles:refresh',
                'solicitud:refresh',
                'workorders:refresh',
                'jefe-taller:notification'
            ].join(', '));
        }

        /**
         * Programar recarga de vehículos (con debounce)
         */
        scheduleRefresh() {
            // Limpiar timeout anterior si existe
            if (this._refreshTimeout) {
                clearTimeout(this._refreshTimeout);
                console.log('[VehiclesViewer] Timeout anterior cancelado, programando nueva recarga...');
            }
            
            // Programar recarga con un pequeño delay para evitar múltiples recargas si llegan varios eventos seguidos
            this._refreshTimeout = setTimeout(() => {
                if (this.loading) {
                    console.log('[VehiclesViewer] ⏳ Recarga programada cancelada: ya hay una carga en progreso');
                    return;
                }
                console.log('[VehiclesViewer] 🔄 Ejecutando recarga programada de vehículos...');
                this.load();
            }, 300);
        }

        /**
         * Limpiar listeners de Socket.IO al destruir el viewer
         */
        destroy() {
            // Limpiar timeout de refresh si existe
            if (this._refreshTimeout) {
                clearTimeout(this._refreshTimeout);
            }

            if (this.socket) {
                // Remover listeners específicos del viewer
                this.socket.off('vehiculo:refresh');
                this.socket.off('reception:refresh');
                this.socket.off('vehicles:refresh');
                this.socket.off('solicitud:refresh');
                this.socket.off('workorders:refresh');
                this.socket.off('jefe-taller:notification');
                console.log('[VehiclesViewer] Socket.IO listeners removidos');
            }
        }

        /**
         * Cargar lista de vehículos
         */
        async load() {
            if (this.loading) return;

            this.loading = true;
            const loadingEl = this.container.querySelector('.vehicles-loading');
            const tableEl = this.container.querySelector('.vehicles-table-container');

            if (loadingEl) loadingEl.style.display = 'block';
            if (tableEl) tableEl.style.display = 'none';

            try {
                const response = await this.bearerFetch(`${API_BASE}/vehicles`);
                
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                this.data = Array.isArray(data) ? data : [];
                
                this.renderTable();

            } catch (error) {
                console.error('[VehiclesViewer] Error al cargar vehículos:', error);
                this.showError('Error al cargar vehículos: ' + error.message);
            } finally {
                this.loading = false;
                if (loadingEl) loadingEl.style.display = 'none';
                if (tableEl) tableEl.style.display = 'block';
            }
        }

        /**
         * Renderizar tabla de vehículos
         */
        renderTable() {
            if (!this.tableBody) return;

            if (!this.data || this.data.length === 0) {
                this.tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 40px; color: #666;">
                            📭 No hay vehículos registrados
                        </td>
                    </tr>
                `;
                // Notificar que no hay vehículos con solicitudes pendientes
                if (this.onVehiclesLoaded) {
                    this.onVehiclesLoaded(this.data, 0, 0);
                }
                return;
            }

            // Calcular totales de vehículos y solicitudes pendientes
            let totalVehPend = 0;
            let totalSolicPend = 0;

            this.tableBody.innerHTML = this.data.map(vehicle => {
                const pendCount = Number(vehicle.solicitudesPendientes || 0);
                if (pendCount > 0) {
                    totalVehPend++;
                    totalSolicPend += pendCount;
                }
                
                const pendText = pendCount ? `Solicitud pendiente (${pendCount})` : '';
                const pendingTag = pendCount 
                    ? `<div style="font-size: 11px; color: #dc3545; margin-top: 4px;">${pendText}</div>` 
                    : '';
                
                const fecha = this.formatDate(vehicle.fecha_creacion || vehicle.fechaIngreso);
                const estadoBadge = this.getEstadoBadge(vehicle.estado);

                let actions = `
                    <button class="btn-vehicles-edit" data-id="${vehicle.id}" style="padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">
                        ✏️ Editar
                    </button>
                `;

                if (this.showGenerateOTButton) {
                    actions += `
                        <button class="btn-vehicles-generate-ot" data-id="${vehicle.id}" data-patente="${this.escapeHtml(vehicle.patente)}" style="padding: 4px 8px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 4px;">
                            🔧 OT
                        </button>
                    `;
                }

                actions += `
                    <button class="btn-vehicles-delete" data-id="${vehicle.id}" style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        🗑️ Eliminar
                    </button>
                `;

                return `
                    <tr data-id="${vehicle.id}" ${pendCount > 0 ? 'style="background: #fff3cd;"' : ''}>
                        <td style="padding: 12px;">${vehicle.id}</td>
                        <td style="padding: 12px;">
                            <div>
                                <strong>${this.escapeHtml(vehicle.patente)}</strong>
                                ${pendingTag}
                            </div>
                        </td>
                        <td style="padding: 12px;">${this.escapeHtml(vehicle.marca || '-')}</td>
                        <td style="padding: 12px;">${this.escapeHtml(vehicle.modelo || '-')}</td>
                        <td style="padding: 12px;">${vehicle.anio_modelo || '-'}</td>
                        <td style="padding: 12px;">${this.escapeHtml(vehicle.vin || '-')}</td>
                        <td style="padding: 12px;">${estadoBadge}</td>
                        <td style="padding: 12px;">${fecha}</td>
                        <td style="padding: 12px;">
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                ${actions}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Agregar event listeners a los botones
            this.tableBody.querySelectorAll('.btn-vehicles-edit').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.getAttribute('data-id'));
                    this.openEditModal(id);
                });
            });

            this.tableBody.querySelectorAll('.btn-vehicles-delete').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.getAttribute('data-id'));
                    this.deleteVehicle(id);
                });
            });

            if (this.showGenerateOTButton) {
                this.tableBody.querySelectorAll('.btn-vehicles-generate-ot').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = parseInt(btn.getAttribute('data-id'));
                        const patente = btn.getAttribute('data-patente');
                        if (this.onGenerateOT) {
                            this.onGenerateOT(id, patente);
                        }
                    });
                });
            }

            // Notificar que los vehículos se han cargado/actualizado con los totales
            if (this.onVehiclesLoaded) {
                this.onVehiclesLoaded(this.data, totalVehPend, totalSolicPend);
            }
        }

        /**
         * Abrir modal para agregar vehículo
         */
        openAddModal() {
            if (this.modalAdd) {
                this.modalAdd.style.display = 'flex';
                if (this.formAdd) {
                    this.formAdd.reset();
                }
            }
        }

        /**
         * Abrir modal para editar vehículo
         */
        async openEditModal(id) {
            try {
                const response = await this.bearerFetch(`${API_BASE}/vehicles/${id}`);
                
                if (!response.ok) {
                    throw new Error('Vehículo no encontrado');
                }

                const vehicle = await response.json();

                if (this.modalEdit && this.formEdit) {
                    this.modalEdit.querySelector('.veh_edit_id').value = vehicle.id;
                    this.modalEdit.querySelector('#veh_edit_patente').value = vehicle.patente;
                    this.modalEdit.querySelector('#veh_edit_marca').value = vehicle.marca || '';
                    this.modalEdit.querySelector('#veh_edit_modelo').value = vehicle.modelo || '';
                    this.modalEdit.querySelector('#veh_edit_anio_modelo').value = vehicle.anio_modelo || '';
                    this.modalEdit.querySelector('#veh_edit_vin').value = vehicle.vin || '';
                    this.modalEdit.querySelector('#veh_edit_estado').value = vehicle.estado;
                    
                    this.modalEdit.style.display = 'flex';
                }
            } catch (error) {
                console.error('[VehiclesViewer] Error al abrir editor:', error);
                alert('Error al cargar el vehículo: ' + error.message);
            }
        }

        /**
         * Manejar submit del formulario de agregar
         */
        async handleAddSubmit(e) {
            e.preventDefault();
            
            const msgDiv = this.modalAdd.querySelector('.vehicles-add-msg');
            if (msgDiv) msgDiv.classList.add('hidden');

            const patente = this.modalAdd.querySelector('#veh_add_patente').value.trim().toUpperCase();
            const marca = this.modalAdd.querySelector('#veh_add_marca').value.trim();
            const modelo = this.modalAdd.querySelector('#veh_add_modelo').value.trim();
            const anio_modelo = this.modalAdd.querySelector('#veh_add_anio_modelo').value;
            const vin = this.modalAdd.querySelector('#veh_add_vin').value.trim();

            const data = {
                patente: patente,
                marca: marca,
                modelo: modelo,
                ...(anio_modelo && { anio_modelo: parseInt(anio_modelo, 10) }),
                ...(vin && { vin: vin })
            };

            try {
                const response = await this.bearerFetch(`${API_BASE}/vehicles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : (error.message || 'Error al crear'));
                }

                const nuevoVehiculo = await response.json();
                
                if (this.modalAdd) this.modalAdd.style.display = 'none';
                if (this.formAdd) this.formAdd.reset();
                
                if (this.onVehicleAdded) {
                    this.onVehicleAdded(nuevoVehiculo);
                }
                
                this.load();
            } catch (error) {
                console.error('[VehiclesViewer] Error al crear vehículo:', error);
                if (msgDiv) {
                    msgDiv.classList.remove('hidden');
                    msgDiv.textContent = '❌ ' + error.message;
                    msgDiv.style.color = '#dc3545';
                }
            }
        }

        /**
         * Manejar submit del formulario de editar
         */
        async handleEditSubmit(e) {
            e.preventDefault();
            
            const msgDiv = this.modalEdit.querySelector('.vehicles-edit-msg');
            if (msgDiv) msgDiv.classList.add('hidden');

            const id = this.modalEdit.querySelector('.veh_edit_id').value;
            if (!id) {
                if (msgDiv) {
                    msgDiv.classList.remove('hidden');
                    msgDiv.textContent = '❌ No se encontró el ID del vehículo.';
                    msgDiv.style.color = '#dc3545';
                }
                return;
            }

            const patente = this.modalEdit.querySelector('#veh_edit_patente').value.trim().toUpperCase();
            const marca = this.modalEdit.querySelector('#veh_edit_marca').value.trim();
            const modelo = this.modalEdit.querySelector('#veh_edit_modelo').value.trim();
            const anio_modelo = this.modalEdit.querySelector('#veh_edit_anio_modelo').value;
            const vin = this.modalEdit.querySelector('#veh_edit_vin').value.trim();
            const estado = this.modalEdit.querySelector('#veh_edit_estado').value;

            const data = {
                patente: patente,
                marca: marca,
                modelo: modelo,
                estado: estado,
                ...(anio_modelo && { anio_modelo: parseInt(anio_modelo, 10) }),
                ...(vin && { vin: vin })
            };

            try {
                const response = await this.bearerFetch(`${API_BASE}/vehicles/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : (error.message || 'Error al actualizar'));
                }

                const vehiculoActualizado = await response.json();
                
                if (this.modalEdit) this.modalEdit.style.display = 'none';
                if (this.formEdit) this.formEdit.reset();
                
                if (this.onVehicleUpdated) {
                    this.onVehicleUpdated(vehiculoActualizado);
                }
                
                this.load();
            } catch (error) {
                console.error('[VehiclesViewer] Error al actualizar vehículo:', error);
                if (msgDiv) {
                    msgDiv.classList.remove('hidden');
                    msgDiv.textContent = '❌ ' + error.message;
                    msgDiv.style.color = '#dc3545';
                }
            }
        }

        /**
         * Eliminar vehículo
         */
        async deleteVehicle(id) {
            if (!confirm(`¿Eliminar vehículo ID ${id}?`)) return;

            try {
                const response = await this.bearerFetch(`${API_BASE}/vehicles/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ message: `Error ${response.status}: No se pudo eliminar` }));
                    throw new Error(error.message || 'No se pudo eliminar');
                }

                if (this.onVehicleDeleted) {
                    this.onVehicleDeleted(id);
                }
                
                this.load();
            } catch (error) {
                console.error('[VehiclesViewer] Error al eliminar vehículo:', error);
                alert('Error al eliminar: ' + error.message);
            }
        }

        /**
         * Confirmar eliminación desde el modal de edición
         */
        confirmDelete() {
            const id = this.modalEdit.querySelector('.veh_edit_id').value;
            if (id) {
                this.modalEdit.style.display = 'none';
                this.deleteVehicle(parseInt(id));
            }
        }

        /**
         * Obtener badge de estado
         */
        getEstadoBadge(estado) {
            const estadoUpper = (estado || '').toUpperCase();
            const map = {
                'OPERATIVO': { class: 'status-completado', text: 'Operativo' },
                'EN_REVISION': { class: 'status-revision', text: 'En Revisión' },
                'STANDBY': { class: 'status-standby', text: 'Standby' },
                'CITA_MANTENCION': { class: 'status-cita', text: 'Cita Mantención' },
                'EN_TALLER': { class: 'status-taller', text: 'En Taller' },
                'MANTENCION': { class: 'status-mantencion', text: 'Mantención' },
                'COMPLETADO': { class: 'status-completado', text: 'Completado' },
                'LISTO_PARA_RETIRO': { class: 'status-completado', text: 'Listo para Retiro' },
                'INACTIVO': { class: 'status-danger', text: 'Inactivo' }
            };
            const config = map[estadoUpper] || map['OPERATIVO'];
            return `<span class="status-badge ${config.class}">${config.text}</span>`;
        }

        /**
         * Formatear fecha
         */
        formatDate(dateString) {
            if (!dateString) return '-';
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('es-CL', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            } catch (e) {
                return dateString;
            }
        }

        /**
         * Escapar HTML
         */
        escapeHtml(text) {
            if (text === null || text === undefined) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Mostrar error
         */
        showError(message) {
            if (this.tableBody) {
                this.tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 40px; color: #dc3545;">
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

    // Exportar clase
    window.VehiclesViewer = VehiclesViewer;
})();

