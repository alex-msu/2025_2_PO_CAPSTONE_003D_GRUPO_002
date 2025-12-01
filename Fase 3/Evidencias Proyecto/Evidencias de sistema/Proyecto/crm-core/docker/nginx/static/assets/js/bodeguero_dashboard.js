const API_BASE = '/api';
let stockCache = [];
let repuestosCache = [];
let movimientosCache = [];
let currentTallerId = 1; // Por defecto, taller principal
let currentStockPage = 1;
const stockPageSize = 50;
let stockFilters = { busqueda: '', estado: '' };
let movimientosFilters = { busqueda: '', fechaDesde: '', fechaHasta: '', tipo: '' };
let solicitudesFilters = { urgencia: '' };

// Utilidades
function qs(selector) {
    return document.querySelector(selector);
}

function qsa(selector) {
    return document.querySelectorAll(selector);
}

function setText(selector, value) {
    const el = qs(selector);
    if (el) el.textContent = value;
}

function bearerFetch(url, options) {
    options = options || {};
    const token = localStorage.getItem('crm.token');
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    if (token) {
        headers.set('Authorization', 'Bearer ' + token);
    }
    return fetch(url, Object.assign({}, options, { headers: headers }));
}

function flashStatus(target, kind, text) {
    if (!target) return;
    const map = { ok: 'ok', bad: 'bad', warn: 'warn' };
    target.textContent = text;
    target.classList.remove('hidden', 'ok', 'bad', 'warn');
    if (map[kind]) {
        target.classList.add(map[kind]);
    }
}

function flashMainStatus(kind, text) {
    const statusEl = qs('#mainStatus');
    if (statusEl) {
        flashStatus(statusEl, kind, text);
        setTimeout(() => {
            statusEl.classList.add('hidden');
        }, 5000);
    }
}

function formatCurrency(value) {
    if (!value) return '$0';
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Modales
function openModal(modalId) {
    const modal = qs(`#${modalId}`);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = qs(`#${modalId}`);
    if (modal) {
        // Resetear formulario si existe dentro del modal
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            // Limpiar mensajes de estado
            const msgEl = modal.querySelector('.status');
            if (msgEl) {
                msgEl.classList.add('hidden');
                msgEl.textContent = '';
            }
        }
        modal.style.display = 'none';
    }
}

// Navegación por tabs
function initTabs() {
    const tabs = qsa('[data-tab]');
    const tabSections = qsa('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = tab.getAttribute('data-tab');

            // Actualizar navegación
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Mostrar sección correspondiente
            tabSections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `tab-${targetTab}`) {
                    section.classList.add('active');
                    // Cargar datos cuando se activa la pestaña
                    if (targetTab === 'solicitudes') {
                        solicitudesRepuestosReload();
                    }
                }
            });

            // Cargar datos según la pestaña
            if (targetTab === 'inventario') {
                stockReload();
            } else if (targetTab === 'movimientos') {
                movimientosReload();
            } else if (targetTab === 'repuestos') {
                repuestosReload();
            }
        });
    });
}

// ========== INVENTARIO ==========
async function stockReload(page) {
    const tbody = qs('#stockTBody');
    const paginationEl = qs('#stockPagination');
    if (!tbody) return;

    if (page !== undefined) {
        currentStockPage = page;
    }

    setText('#total-repuestos', '...');
    setText('#stock-bajo-count', '...');
    setText('#stock-critico-count', '...');
    LoadingUtils.showTableLoading(tbody, 'Cargando inventario...', 8);
    if (paginationEl) {
        paginationEl.innerHTML = '';
    }

    try {
        // Construir query string con filtros
        const queryParams = [`tallerId=${currentTallerId}`, `page=${currentStockPage}`, `limit=${stockPageSize}`];
        if (stockFilters.busqueda) {
            queryParams.push(`busqueda=${encodeURIComponent(stockFilters.busqueda)}`);
        }
        if (stockFilters.estado) {
            queryParams.push(`estado=${encodeURIComponent(stockFilters.estado)}`);
        }

        const [inventariosRes, stockBajoRes] = await Promise.all([
            bearerFetch(`${API_BASE}/stock/inventarios?${queryParams.join('&')}`),
            bearerFetch(`${API_BASE}/stock/inventarios/stock-bajo?tallerId=${currentTallerId}`)
        ]);

        if (!inventariosRes.ok) throw new Error('Error al cargar inventarios');
        if (!stockBajoRes.ok) throw new Error('Error al cargar stock bajo');

        const inventariosResponse = await inventariosRes.json();
        const stockBajo = await stockBajoRes.json();

        // Manejar respuesta con paginación o sin paginación (compatibilidad hacia atrás)
        const inventarios = inventariosResponse.data || inventariosResponse;
        const pagination = inventariosResponse.pagination;

        stockCache = Array.isArray(inventarios) ? inventarios : [];

        // Actualizar estadísticas (usar total de paginación si está disponible)
        const totalInventarios = pagination ? pagination.total : stockCache.length;
        setText('#total-repuestos', totalInventarios);
        const bajo = stockBajo.filter(item => item.cantidad_disponible > 0 && item.cantidad_disponible <= item.nivel_minimo_stock);
        const critico = stockBajo.filter(item => item.cantidad_disponible === 0 || item.cantidad_disponible < item.nivel_minimo_stock * 0.5);
        setText('#stock-bajo-count', bajo.length);
        setText('#stock-critico-count', critico.length);

        // Renderizar tabla
        if (stockCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;">No hay inventarios registrados</td></tr>';
            if (paginationEl) {
                paginationEl.innerHTML = '';
            }
            return;
        }

        tbody.innerHTML = stockCache.map(inv => {
            const rep = inv.repuesto;
            const stockStatus = inv.cantidad_disponible === 0 ? 'critico' :
                inv.cantidad_disponible <= inv.nivel_minimo_stock ? 'bajo' : 'normal';
            const statusBadge = stockStatus === 'critico' ? '<span class="status-badge" style="background:#dc3545;">Crítico</span>' :
                stockStatus === 'bajo' ? '<span class="status-badge" style="background:#ffc107;">Bajo</span>' :
                '<span class="status-badge" style="background:#28a745;">Normal</span>';

            return `
                <tr>
                    <td>${rep.sku}</td>
                    <td>${rep.nombre}</td>
                    <td><strong>${inv.cantidad_disponible}</strong></td>
                    <td>${inv.nivel_minimo_stock}</td>
                    <td>${inv.nivel_maximo_stock}</td>
                    <td>${inv.ubicacion_almacen || '—'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="stockEditInventario(${inv.taller.id}, ${rep.id}, ${inv.cantidad_disponible}, ${inv.nivel_minimo_stock}, ${inv.nivel_maximo_stock}, '${inv.ubicacion_almacen || ''}')">Editar</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Renderizar paginación si está disponible
        if (pagination && typeof window.PaginationUtils !== 'undefined' && window.PaginationUtils.createPagination && paginationEl) {
            window.PaginationUtils.createPagination(paginationEl, pagination, function(newPage) {
                stockReload(newPage);
            });
        }

    } catch (error) {
        console.error('Error cargando inventario:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#dc3545;">Error al cargar inventario</td></tr>';
        if (paginationEl) {
            paginationEl.innerHTML = '';
        }
        flashMainStatus('bad', 'Error al cargar inventario');
    }
}

window.stockEditInventario = function(tallerId, repuestoId, cantidad, minimo, maximo, ubicacion) {
    qs('#edit_inv_taller_id').value = tallerId;
    qs('#edit_inv_repuesto_id').value = repuestoId;
    qs('#edit_inv_cantidad').value = cantidad;
    qs('#edit_inv_minimo').value = minimo;
    qs('#edit_inv_maximo').value = maximo;
    qs('#edit_inv_ubicacion').value = ubicacion || '';
    openModal('modalEditInventario');
};

// ========== MOVIMIENTOS ==========
async function movimientosReload() {
    const tbody = qs('#movimientosTBody');
    if (!tbody) return;

    LoadingUtils.showTableLoading(tbody, 'Cargando movimientos...', 6);

    try {
        // Construir query string con filtros
        const queryParams = [`tallerId=${currentTallerId}`, `limit=100`];
        if (movimientosFilters.busqueda) {
            queryParams.push(`busqueda=${encodeURIComponent(movimientosFilters.busqueda)}`);
        }
        if (movimientosFilters.fechaDesde) {
            queryParams.push(`fechaDesde=${encodeURIComponent(movimientosFilters.fechaDesde)}`);
        }
        if (movimientosFilters.fechaHasta) {
            queryParams.push(`fechaHasta=${encodeURIComponent(movimientosFilters.fechaHasta)}`);
        }
        if (movimientosFilters.tipo) {
            queryParams.push(`tipo=${encodeURIComponent(movimientosFilters.tipo)}`);
        }

        const res = await bearerFetch(`${API_BASE}/stock/movimientos?${queryParams.join('&')}`);
        if (!res.ok) throw new Error('Error al cargar movimientos');

        const movimientos = await res.json();
        movimientosCache = movimientos;

        if (movimientos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">No hay movimientos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = movimientos.map(mov => {
            const tipoBadge = mov.tipo_movimiento === 'ENTRADA' ? 
                '<span class="status-badge" style="background:#28a745;">Entrada</span>' :
                mov.tipo_movimiento === 'SALIDA' ?
                '<span class="status-badge" style="background:#dc3545;">Salida</span>' :
                '<span class="status-badge" style="background:#ffc107;">Ajuste</span>';

            return `
                <tr>
                    <td>${formatDate(mov.fecha_movimiento)}</td>
                    <td>${mov.repuesto.nombre} (${mov.repuesto.sku})</td>
                    <td>${tipoBadge}</td>
                    <td><strong>${mov.cantidad}</strong></td>
                    <td>${mov.motivo || '—'}</td>
                    <td>Usuario #${mov.movido_por}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando movimientos:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#dc3545;">Error al cargar movimientos</td></tr>';
        ErrorHandler.handleError(error, 'Cargar movimientos', {
            useFloatingNotification: true
        });
    }
}

// ========== REPUESTOS ==========
async function repuestosReload() {
    const tbody = qs('#repuestosTBody');
    if (!tbody) return;

    LoadingUtils.showTableLoading(tbody, 'Cargando repuestos...', 7);

    try {
        const res = await bearerFetch(`${API_BASE}/stock/repuestos`);
        if (!res.ok) throw new Error('Error al cargar repuestos');

        const repuestos = await res.json();
        repuestosCache = repuestos;

        // Llenar select de movimientos
        const selectMov = qs('#mov_repuesto');
        if (selectMov) {
            selectMov.innerHTML = '<option value="">Selecciona un repuesto</option>' +
                repuestos.map(rep => `<option value="${rep.id}">${rep.sku} - ${rep.nombre}</option>`).join('');
        }

        if (repuestos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No hay repuestos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = repuestos.map(rep => {
            const estadoBadge = rep.activo ? 
                '<span class="status-badge" style="background:#28a745;">Activo</span>' :
                '<span class="status-badge" style="background:#6c757d;">Inactivo</span>';

            return `
                <tr>
                    <td>${rep.sku}</td>
                    <td>${rep.nombre}</td>
                    <td>${rep.descripcion || '—'}</td>
                    <td>${rep.unidad}</td>
                    <td>${formatCurrency(rep.precio_costo)}</td>
                    <td>${rep.informacion_proveedor || '—'}</td>
                    <td>${estadoBadge}</td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando repuestos:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#dc3545;">Error al cargar repuestos</td></tr>';
        ErrorHandler.handleError(error, 'Cargar repuestos', {
            useFloatingNotification: true
        });
    }
}

// ========== FORMULARIOS ==========
qs('#movimientoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = qs('#movMsg');

    const repuestoId = Number(qs('#mov_repuesto').value);
    const tipo = qs('#mov_tipo').value;
    const cantidad = Number(qs('#mov_cantidad').value);
    const costo = qs('#mov_costo').value ? Number(qs('#mov_costo').value) : undefined;
    const motivo = qs('#mov_motivo').value.trim();

    // Buscar el inventario actual del repuesto en el cache
    let inventarioActual = stockCache.find(inv => inv.repuesto && inv.repuesto.id === repuestoId);

    // Si no está en el cache, intentar obtenerlo del backend usando el endpoint específico
    if (!inventarioActual) {
        try {
            const res = await bearerFetch(`${API_BASE}/stock/inventarios/${currentTallerId}/${repuestoId}`);
            if (res.ok) {
                inventarioActual = await res.json();
            }
        } catch (error) {
            console.warn('No se pudo obtener el inventario para validación:', error);
            // Continuar sin validación de límites si no podemos obtener el inventario
            // (puede ser que el repuesto no tenga inventario en este taller aún)
        }
    }

    // Validar usando módulo de validaciones (con información del inventario actual)
    const movimientoData = {
        repuesto_id: repuestoId,
        tipo_movimiento: tipo,
        cantidad: cantidad
    };

    // Si tenemos información del inventario actual, incluirla para validar límites
    if (inventarioActual) {
        movimientoData.inventario_actual = {
            cantidad_disponible: inventarioActual.cantidad_disponible || 0,
            nivel_maximo_stock: inventarioActual.nivel_maximo_stock
        };
    }

    const validationResult = DomainValidations.validateMovimiento(movimientoData);
    if (!validationResult.valid) {
        flashStatus(msgEl, 'bad', validationResult.message);
        return;
    }

    try {
        const res = await bearerFetch(`${API_BASE}/stock/movimientos`, {
            method: 'POST',
            body: JSON.stringify({
                repuesto_id: repuestoId,
                taller_id: currentTallerId,
                tipo_movimiento: tipo,
                cantidad: cantidad,
                costo_unitario: costo,
                motivo: motivo || undefined
            })
        });

        const data = await ErrorHandler.handleResponse(res, 'Registrar movimiento');

        flashStatus(msgEl, 'ok', 'Movimiento registrado correctamente');
        closeModal('modalMovimiento');
        setTimeout(() => {
            stockReload();
            movimientosReload();
        }, 500);

    } catch (error) {
        ErrorHandler.handleError(error, 'Registrar movimiento', {
            targetElement: msgEl,
            useFlashMessage: true
        });
    }
});

qs('#editInventarioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = qs('#editInvMsg');

    const tallerId = Number(qs('#edit_inv_taller_id').value);
    const repuestoId = Number(qs('#edit_inv_repuesto_id').value);
    const cantidad = Number(qs('#edit_inv_cantidad').value);
    const minimo = Number(qs('#edit_inv_minimo').value);
    const maximo = Number(qs('#edit_inv_maximo').value);
    const ubicacion = qs('#edit_inv_ubicacion').value.trim();

    // Validar usando módulo de validaciones
    const inventarioData = {
        cantidad_disponible: cantidad,
        nivel_minimo_stock: minimo,
        nivel_maximo_stock: maximo
    };

    const validationResult = DomainValidations.validateInventario(inventarioData);
    if (!validationResult.valid) {
        flashStatus(msgEl, 'bad', validationResult.message);
        return;
    }

    try {
        const res = await bearerFetch(`${API_BASE}/stock/inventarios/${tallerId}/${repuestoId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                cantidad_disponible: cantidad,
                nivel_minimo_stock: minimo,
                nivel_maximo_stock: maximo,
                ubicacion_almacen: ubicacion || undefined
            })
        });

        const data = await ErrorHandler.handleResponse(res, 'Actualizar inventario');

        flashStatus(msgEl, 'ok', 'Inventario actualizado correctamente');
        
        // Resetear formulario antes de cerrar el modal
        const form = qs('#editInventarioForm');
        if (form) {
            form.reset();
        }
        
        // Limpiar mensajes de estado
        if (msgEl) {
            msgEl.classList.add('hidden');
            msgEl.textContent = '';
        }
        
        closeModal('modalEditInventario');
        setTimeout(() => {
            stockReload();
        }, 500);

    } catch (error) {
        ErrorHandler.handleError(error, 'Actualizar inventario', {
            targetElement: msgEl,
            useFlashMessage: true
        });
    }
});

qs('#repuestoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = qs('#repMsg');

    const sku = qs('#rep_sku').value.trim();
    const nombre = qs('#rep_nombre').value.trim();
    const descripcion = qs('#rep_descripcion').value.trim();
    const unidad = qs('#rep_unidad').value.trim();
    const precio = qs('#rep_precio').value ? Number(qs('#rep_precio').value) : undefined;
    const proveedor = qs('#rep_proveedor').value.trim();

    if (!sku || !nombre || !unidad) {
        flashStatus(msgEl, 'bad', 'Completa todos los campos requeridos');
        return;
    }

    try {
        const res = await bearerFetch(`${API_BASE}/stock/repuestos`, {
            method: 'POST',
            body: JSON.stringify({
                sku: sku,
                nombre: nombre,
                descripcion: descripcion || undefined,
                unidad: unidad,
                precio_costo: precio,
                informacion_proveedor: proveedor || undefined
            })
        });

        const data = await ErrorHandler.handleResponse(res, 'Crear repuesto');

        flashStatus(msgEl, 'ok', 'Repuesto creado correctamente');
        qs('#repuestoForm').reset();
        setTimeout(() => {
            repuestosReload();
        }, 500);

    } catch (error) {
        ErrorHandler.handleError(error, 'Crear repuesto', {
            targetElement: msgEl,
            useFlashMessage: true
        });
    }
});

// ========== LOGOUT (OBSOLETO - Ahora se usa logout_button.js) ==========
// Estas funciones se mantienen solo por compatibilidad hacia atrás
// El logout ahora se maneja automáticamente con logout_button.js
/*
function openLogoutModal() {
    openModal('modalLogoutConfirm');
}

function confirmLogout() {
    if (typeof window.logout === 'function') {
        window.logout();
    } else {
        localStorage.removeItem('crm.token');
        window.location.href = '/login.html';
    }
}

window.openLogoutModal = openLogoutModal;
window.confirmLogout = confirmLogout;
*/

// Event listener removido - ahora se maneja con logout_button.js
// // Event listener removido - ahora se maneja con logout_button.js
// qs('#btnConfirmLogout')?.addEventListener('click', confirmLogout);

// Cerrar modales al hacer click fuera
qsa('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticación y rol
    if (typeof window.initAuth === 'function') {
        await window.initAuth('bodeguero');
    }

    // Cargar nombre de usuario
    let currentUser = null;
    try {
        const res = await bearerFetch(`${API_BASE}/auth/me`);
        if (res.ok) {
            currentUser = await res.json();
            setText('#currentUserName', currentUser.nombre_completo || 'Usuario');
            
            // Inicializar NotificationsManager
            if (typeof NotificationsManager !== 'undefined' && currentUser) {
                NotificationsManager.init(currentUser.id || currentUser.userId, function(entityId, entityType) {
                    // Callback cuando se hace clic en una notificación
                    // Por ahora no hay acciones específicas para bodeguero
                    console.log('Notificación clickeada:', entityId, entityType);
                });
            }
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
    }

    // Inicializar tabs
    initTabs();

    // NO inicializar time picker aquí porque el campo está oculto
    // Se inicializará cuando se muestre el campo al seleccionar "Aprobar"

    // Cargar datos iniciales
    await Promise.all([
        repuestosReload(),
        stockReload(),
        movimientosReload(),
        updateSolicitudesPendNavLabel() // Actualizar contador de solicitudes pendientes
    ]);

    // Agregar debounce a búsqueda de inventario
    const stockBusquedaInput = qs('#stockBusqueda');
    if (stockBusquedaInput && typeof window.FilterUtils !== 'undefined') {
        const debouncedBusqueda = window.FilterUtils.debounce(function() {
            aplicarFiltrosInventario();
        }, 300);
        stockBusquedaInput.addEventListener('input', debouncedBusqueda);
    }

    // Agregar debounce a búsqueda de movimientos
    const movimientosBusquedaInput = qs('#movimientosBusqueda');
    if (movimientosBusquedaInput && typeof window.FilterUtils !== 'undefined') {
        const debouncedMovimientos = window.FilterUtils.debounce(function() {
            aplicarFiltrosMovimientos();
        }, 300);
        movimientosBusquedaInput.addEventListener('input', debouncedMovimientos);
    }
});

// ========== SOLICITUDES DE REPUESTOS ==========
let solicitudesRepuestosCache = [];

// Función para actualizar solo el contador del nav (sin recargar la tabla)
async function updateSolicitudesPendNavLabel() {
    try {
        const queryParams = ['estado=SOLICITADA'];
        const res = await bearerFetch(`${API_BASE}/stock/solicitudes?${queryParams.join('&')}`);
        if (!res.ok) return;
        
        const solicitudes = await res.json();
        const count = solicitudes.length;
        const label = qs('#solicitudesPendNavLabel');
        if (label) {
            if (count > 0) {
                label.textContent = `(${count})`;
                label.classList.remove('is-hidden');
            } else {
                label.textContent = '';
                label.classList.add('is-hidden');
            }
        }
    } catch (error) {
        console.error('Error actualizando contador de solicitudes:', error);
    }
}

window.solicitudesRepuestosReload = async function() {
    const tbody = qs('#solicitudesRepuestosTBody');
    if (!tbody) return;
    
    LoadingUtils.showTableLoading(tbody, 'Cargando solicitudes...', 9);
    
    try {
        // Construir query string con filtros
        const queryParams = ['estado=SOLICITADA'];
        if (solicitudesFilters.urgencia) {
            queryParams.push('urgencia=' + encodeURIComponent(solicitudesFilters.urgencia));
        }
        
        const res = await bearerFetch(`${API_BASE}/stock/solicitudes?${queryParams.join('&')}`);
        if (!res.ok) throw new Error('Error al cargar solicitudes');
        
        const solicitudes = await res.json();
        solicitudesRepuestosCache = solicitudes;
        
        // Actualizar contador
        const count = solicitudes.length;
        const label = qs('#solicitudesPendNavLabel');
        if (label) {
            if (count > 0) {
                label.textContent = `(${count})`;
                label.classList.remove('is-hidden');
            } else {
                label.textContent = '';
                label.classList.add('is-hidden');
            }
        }
        
        if (solicitudes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">No hay solicitudes pendientes</td></tr>';
            return;
        }
        
        tbody.innerHTML = solicitudes.map(sol => {
            const fecha = new Date(sol.fecha_solicitud).toLocaleDateString('es-CL', { 
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            const urgenciaBadge = sol.urgencia === 'URGENTE' 
                ? '<span class="status-badge" style="background:#dc3545;">Urgente</span>'
                : '<span class="status-badge" style="background:#6c757d;">Normal</span>';
            const estadoBadge = '<span class="status-badge" style="background:#ffc107;">Solicitada</span>';
            
            return `
                <tr>
                    <td>${fecha}</td>
                    <td>${sol.orden_trabajo?.numero_ot || 'N/A'}</td>
                    <td>${sol.orden_trabajo?.vehiculo?.patente || 'N/A'}</td>
                    <td>${sol.orden_trabajo?.mecanico?.nombre_completo || 'N/A'}</td>
                    <td>${sol.repuesto?.nombre || 'N/A'} (${sol.repuesto?.sku || 'N/A'})</td>
                    <td><strong>${sol.cantidad_solicitada}</strong> ${sol.repuesto?.unidad || ''}</td>
                    <td>${urgenciaBadge}</td>
                    <td>${estadoBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="openResponderSolicitudModal(${sol.id})">Responder</button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error cargando solicitudes:', error);
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:#dc3545;">Error: ${error.message || 'Error desconocido'}</td></tr>`;
        ErrorHandler.handleError(error, 'Cargar solicitudes', {
            useFloatingNotification: true
        });
    }
};

window.openResponderSolicitudModal = function(solicitudId) {
    const solicitud = solicitudesRepuestosCache.find(s => s.id === solicitudId);
    if (!solicitud) {
        flashMainStatus('bad', 'Solicitud no encontrada');
        return;
    }
    
    qs('#resp_sol_id').value = solicitud.id;
    qs('#resp_sol_ot').textContent = solicitud.orden_trabajo?.numero_ot || 'N/A';
    qs('#resp_sol_repuesto').textContent = `${solicitud.repuesto?.nombre || 'N/A'} (${solicitud.repuesto?.sku || 'N/A'})`;
    qs('#resp_sol_cantidad').textContent = `${solicitud.cantidad_solicitada} ${solicitud.repuesto?.unidad || ''}`;
    qs('#resp_sol_mecanico').textContent = solicitud.orden_trabajo?.mecanico?.nombre_completo || 'N/A';
    
    // Resetear formulario
    qs('#resp_sol_comentarios').value = '';
    qs('#resp_sol_fecha_entrega').value = '';
    qs('#resp_sol_hora_entrega').value = '';
    qsa('input[name="resp_sol_accion"]').forEach(radio => radio.checked = false);
    qs('#resp_sol_fecha_group').style.display = 'none';
    
    // Limpiar mensaje de estado anterior
    const msgEl = qs('#respSolMsg');
    if (msgEl) {
        msgEl.textContent = '';
        msgEl.className = 'status hidden';
    }
    
    // Función para inicializar el time picker (siempre reinicializa para evitar problemas)
    function initializeTimePicker() {
        if (typeof initTimePicker === 'function') {
            setTimeout(() => {
                var horaInput = document.getElementById('resp_sol_hora_entrega');
                var horaPicker = document.getElementById('resp_sol_hora_entrega_picker');
                if (horaInput && horaPicker) {
                    // Asegurar que el picker esté oculto inicialmente
                    horaPicker.setAttribute('aria-hidden', 'true');
                    // Remover cualquier listener anterior clonando el input para limpiar listeners
                    // Guardar el valor actual antes de clonar
                    var currentValue = horaInput.value;
                    var wrapper = horaInput.parentNode;
                    var newInput = horaInput.cloneNode(true);
                    newInput.value = currentValue; // Restaurar el valor
                    wrapper.replaceChild(newInput, horaInput);
                    // Inicializar el time picker con el nuevo input (buscará el elemento por ID)
                    try {
                        initTimePicker('resp_sol_hora_entrega', 'resp_sol_hora_entrega_picker');
                        console.log('Time picker inicializado correctamente');
                    } catch (error) {
                        console.error('Error inicializando time picker:', error);
                    }
                }
            }, 300);
        }
    }
    
    // Mostrar/ocultar fecha según acción
    qsa('input[name="resp_sol_accion"]').forEach(radio => {
        // Remover listeners anteriores para evitar duplicados
        var newRadio = radio.cloneNode(true);
        radio.parentNode.replaceChild(newRadio, radio);
        
        newRadio.addEventListener('change', function() {
            qs('#resp_sol_fecha_group').style.display = this.value === 'APROBADA' ? 'block' : 'none';
            // Inicializar time picker cuando se muestra el campo (siempre reinicializar)
            if (this.value === 'APROBADA') {
                initializeTimePicker();
            }
        });
    });
    
    openModal('modalResponderSolicitud');
};

qs('#responderSolicitudForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const msgEl = qs('#respSolMsg');
    
    const solicitudId = Number(qs('#resp_sol_id').value);
    const accion = qs('input[name="resp_sol_accion"]:checked')?.value;
    const comentarios = qs('#resp_sol_comentarios').value.trim();
    const fechaEntrega = qs('#resp_sol_fecha_entrega').value;
    const horaEntrega = qs('#resp_sol_hora_entrega').value;
    
    if (!accion) {
        flashStatus(msgEl, 'bad', 'Selecciona una acción');
        return;
    }
    
    // Combinar fecha y hora si ambas están presentes
    // Usar el mismo método que en jefe_taller_dashboard.js para evitar problemas de zona horaria
    let fechaHoraEntrega = undefined;
    if (fechaEntrega && horaEntrega) {
        // Parsear la fecha (formato YYYY-MM-DD)
        const dateParts = fechaEntrega.split('-');
        if (dateParts.length === 3) {
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Los meses en Date son 0-indexados
            const day = parseInt(dateParts[2], 10);
            
            // Parsear la hora (formato HH:MM)
            const timeParts = horaEntrega.split(':');
            const hours = parseInt(timeParts[0], 10) || 0;
            const minutes = parseInt(timeParts[1], 10) || 0;
            
            // Crear un Date en hora local con la fecha y hora especificadas
            const localDate = new Date(year, month, day, hours, minutes, 0, 0);
            
            // Convertir a ISO string (UTC) para enviar al servidor
            fechaHoraEntrega = localDate.toISOString();
        }
    } else if (fechaEntrega) {
        // Si solo hay fecha, usar medianoche local
        const dateParts = fechaEntrega.split('-');
        if (dateParts.length === 3) {
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const day = parseInt(dateParts[2], 10);
            
            // Crear un Date en hora local con medianoche
            const localDate = new Date(year, month, day, 0, 0, 0, 0);
            
            // Convertir a ISO string (UTC) para enviar al servidor
            fechaHoraEntrega = localDate.toISOString();
        }
    }
    
    try {
        const res = await bearerFetch(`${API_BASE}/stock/solicitudes/${solicitudId}/respond`, {
            method: 'PATCH',
            body: JSON.stringify({
                accion: accion,
                comentarios: comentarios || undefined,
                fecha_estimada_entrega: fechaHoraEntrega || undefined
            })
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Error al responder solicitud');
        }
        
        flashStatus(msgEl, 'ok', '✅ Respuesta enviada correctamente');
        closeModal('modalResponderSolicitud');
        setTimeout(() => {
            solicitudesRepuestosReload();
        }, 500);
        
    } catch (error) {
        console.error('Error:', error);
        flashStatus(msgEl, 'bad', '❌ ' + (error.message || 'Error al responder solicitud'));
    }
});

// ========== FUNCIONES DE FILTROS ==========
function aplicarFiltrosInventario() {
    const busquedaInput = qs('#stockBusqueda');
    const estadoSelect = qs('#stockEstado');
    
    stockFilters.busqueda = busquedaInput ? busquedaInput.value.trim() : '';
    stockFilters.estado = estadoSelect ? estadoSelect.value : '';
    
    currentStockPage = 1; // Resetear a primera página
    stockReload();
}

function limpiarFiltrosInventario() {
    stockFilters = { busqueda: '', estado: '' };
    const busquedaInput = qs('#stockBusqueda');
    const estadoSelect = qs('#stockEstado');
    
    if (busquedaInput) busquedaInput.value = '';
    if (estadoSelect) estadoSelect.value = '';
    
    currentStockPage = 1; // Resetear a primera página
    stockReload();
}

function aplicarFiltrosMovimientos() {
    const busquedaInput = qs('#movimientosBusqueda');
    const fechaDesdeInput = qs('#movimientosFechaDesde');
    const fechaHastaInput = qs('#movimientosFechaHasta');
    const tipoSelect = qs('#movimientosTipo');
    
    movimientosFilters.busqueda = busquedaInput ? busquedaInput.value.trim() : '';
    movimientosFilters.fechaDesde = fechaDesdeInput ? fechaDesdeInput.value : '';
    movimientosFilters.fechaHasta = fechaHastaInput ? fechaHastaInput.value : '';
    movimientosFilters.tipo = tipoSelect ? tipoSelect.value : '';
    
    movimientosReload();
}

function limpiarFiltrosMovimientos() {
    movimientosFilters = { busqueda: '', fechaDesde: '', fechaHasta: '', tipo: '' };
    const busquedaInput = qs('#movimientosBusqueda');
    const fechaDesdeInput = qs('#movimientosFechaDesde');
    const fechaHastaInput = qs('#movimientosFechaHasta');
    const tipoSelect = qs('#movimientosTipo');
    
    if (busquedaInput) busquedaInput.value = '';
    if (fechaDesdeInput) fechaDesdeInput.value = '';
    if (fechaHastaInput) fechaHastaInput.value = '';
    if (tipoSelect) tipoSelect.value = '';
    
    movimientosReload();
}

// Exponer funciones globalmente
window.stockReload = stockReload;
window.movimientosReload = movimientosReload;
window.repuestosReload = repuestosReload;
window.aplicarFiltrosInventario = aplicarFiltrosInventario;
window.limpiarFiltrosInventario = limpiarFiltrosInventario;
window.aplicarFiltrosMovimientos = aplicarFiltrosMovimientos;
window.limpiarFiltrosMovimientos = limpiarFiltrosMovimientos;

function aplicarFiltrosSolicitudes() {
    const urgenciaSelect = qs('#solicitudesUrgencia');
    
    solicitudesFilters.urgencia = urgenciaSelect ? urgenciaSelect.value : '';
    
    solicitudesRepuestosReload();
}

function limpiarFiltrosSolicitudes() {
    solicitudesFilters = { urgencia: '' };
    const urgenciaSelect = qs('#solicitudesUrgencia');
    
    if (urgenciaSelect) urgenciaSelect.value = '';
    
    solicitudesRepuestosReload();
}

window.aplicarFiltrosSolicitudes = aplicarFiltrosSolicitudes;
window.limpiarFiltrosSolicitudes = limpiarFiltrosSolicitudes;
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = typeof window.logout !== 'undefined' ? window.logout : () => {
    localStorage.removeItem('crm.token');
    window.location.href = '/login.html';
};

// Socket.IO para actualizaciones en tiempo real
if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('connect', () => {
        console.log('Conectado al servidor de WebSockets (Bodeguero)');
    });
    
    socket.on('solicitudes-repuestos:refresh', () => {
        console.log('[Socket.IO] Evento solicitudes-repuestos:refresh recibido');
        // Actualizar contador del nav inmediatamente (sin importar en qué tab esté)
        updateSolicitudesPendNavLabel().then(() => {
            console.log('[Socket.IO] Contador de solicitudes actualizado');
        }).catch(err => {
            console.error('[Socket.IO] Error actualizando contador:', err);
        });
        // Si estamos en la pestaña de solicitudes, recargar la tabla completa
        const solicitudesTab = qs('#tab-solicitudes');
        if (solicitudesTab && solicitudesTab.classList.contains('active')) {
            console.log('[Socket.IO] Recargando tabla de solicitudes (tab activa)');
            solicitudesRepuestosReload();
        }
    });
    
    socket.on('bodeguero:notification', (data) => {
        if (data.bodegueroId === currentTallerId || !data.bodegueroId) {
            showFloatingNotification(data.titulo, data.mensaje, data.tipo || 'info');
            
            // Actualizar NotificationsManager si está disponible
            if (typeof NotificationsManager !== 'undefined') {
                // Recargar notificaciones desde BD después de un breve delay
                setTimeout(() => {
                    NotificationsManager.loadUnreadNotifications();
                }, 500);
            }
        }
    });
}

function showFloatingNotification(titulo, mensaje, tipo) {
    tipo = tipo || 'info';
    let container = qs('#notificationsContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationsContainer';
        container.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 10000; max-width: 400px;';
        document.body.appendChild(container);
    }
    
    const notification = document.createElement('div');
    notification.className = 'floating-notification floating-notification--' + tipo;
    notification.style.cssText = 'background: white; border-left: 4px solid ' + 
        (tipo === 'success' ? '#28a745' : tipo === 'error' ? '#dc3545' : '#17a2b8') + 
        '; padding: 15px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: flex-start; gap: 10px;';
    
    notification.innerHTML = `
        <div style="flex: 1;">
            <strong>${escapeHtml(titulo)}</strong>
            <p style="margin: 5px 0 0 0; font-size: 0.9em;">${escapeHtml(mensaje)}</p>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; font-size: 1.2em; cursor: pointer; color: #6c757d; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">&times;</button>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

