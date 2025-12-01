const API_BASE = '/api';
let recepAgendaCache = [];
let recepOrdersCache = [];
let recepWorkshopCache = []; // Cache para todos los vehículos en taller
let recepCheckinEvidencias = [];
let recepFinalizeRetiroEvidencias = [];
let recepWorkshopMsg = null;
let recepFiltros = { search: '', estado: '' };
const MAX_WORKSHOP_ITEMS_DASHBOARD = 4; // Máximo de items a mostrar en el dashboard

// Variables para paginación y filtros de vehículos
let recepVehiculosPage = 1;
let recepVehiculosLimit = 9;
let recepVehiculosFiltros = {
    fechaDesde: '',
    fechaHasta: '',
    estado: '',
    patente: '',
    mecanico: ''
};

// Variable para el historial de entregas
let entregasHistoryViewer = null;
let currentUserRecep = null;

// La función completa se definirá más adelante en el código
// Por ahora, solo declarar que existirá

function qs(selector) {
    return document.querySelector(selector);
}


function setText(selector, value) {
    var el = qs(selector);
    if (el) el.textContent = value;
}

function storeOrders(list) {
    // Manejar respuesta con paginación o sin paginación
    var ordersList = list;
    if (list && list.data && Array.isArray(list.data)) {
        ordersList = list.data;
    }
    recepOrdersCache = Array.isArray(ordersList) ? ordersList : [];
}

function bearerFetch(url, options) {
    options = options || {};
    var token = localStorage.getItem('crm.token');
    var headers = new Headers(options.headers || {});
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
    const map = {
        ok: 'ok',
        bad: 'bad',
        warn: 'warn'
    };
    target.textContent = text;
    target.classList.remove('hidden', 'ok', 'bad', 'warn');
    if (map[kind]) {
        target.classList.add(map[kind]);
    }
}

function formatDateShort(value) {
    if (!value) return '—';
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CL', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
    });
}

function formatTime(value) {
    if (!value) return '';
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTimeRange(start, end) {
    if (!start || !end) return '—';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '—';
    const sameDay = startDate.toDateString() === endDate.toDateString();
    const startLabel = `${formatDateShort(startDate)} ${formatTime(startDate)}`;
    const endLabel = sameDay ? formatTime(endDate) : `${formatDateShort(endDate)} ${formatTime(endDate)}`;
    return sameDay ? `${formatDateShort(startDate)} · ${formatTime(startDate)} → ${formatTime(endDate)}` : `${startLabel} → ${endLabel}`;
}

function formatLocalDateTimeInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return [
        d.getFullYear(),
        pad(d.getMonth() + 1),
        pad(d.getDate())
    ].join('-') + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function startOfDay(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date) {
    var d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function isWithinPlannedRange(item) {
    if (!item || !item.fecha_inicio_trabajo || !item.fecha_estimada_termino) return false;
    var now = new Date();
    var start = startOfDay(new Date(item.fecha_inicio_trabajo));
    var end = endOfDay(new Date(item.fecha_estimada_termino));
    return now >= start && now <= end;
}

function canCheckInToday(item) {
    if (!item || item.fecha_ingreso_recepcion) return false;
    return isWithinPlannedRange(item);
}

function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-active');
    modal.style.display = 'flex';
}
window.openModal = openModal;

function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-active');
    modal.style.display = 'none';
}
window.closeModal = closeModal;

// ========== FUNCIONES DE FILTROS ==========
function aplicarFiltrosAgenda() {
    var busquedaInput = qs('#agendaBusqueda');
    var estadoSelect = qs('#agendaEstado');
    
    recepFiltros.search = busquedaInput ? busquedaInput.value.trim() : '';
    recepFiltros.estado = estadoSelect ? estadoSelect.value : '';
    
    loadAgenda();
}

function limpiarFiltrosAgenda() {
    recepFiltros = { search: '', estado: '' };
    var busquedaInput = qs('#agendaBusqueda');
    var estadoSelect = qs('#agendaEstado');
    
    if (busquedaInput) busquedaInput.value = '';
    if (estadoSelect) estadoSelect.value = '';
    
    loadAgenda();
}

window.aplicarFiltrosAgenda = aplicarFiltrosAgenda;
window.limpiarFiltrosAgenda = limpiarFiltrosAgenda;

// ========== LOGOUT (OBSOLETO - Ahora se usa logout_button.js) ==========
// Estas funciones se mantienen solo por compatibilidad hacia atrás
// El logout ahora se maneja automáticamente con logout_button.js
/*
function openLogoutModal() {
    openModal('modalLogout');
}
window.openLogoutModal = openLogoutModal;

function confirmLogout() {
    if (typeof window.logout === 'function') {
        window.logout();
    } else {
        // Fallback si window.logout no está disponible
        if (confirm('¿Está seguro de que desea cerrar sesión?')) {
            localStorage.removeItem('crm.token');
            window.location.href = 'index.html';
        }
    }
}
window.confirmLogout = confirmLogout;
*/

function initStatsPlaceholders() {
    setText('#recepcionesPendientes', '—');
    setText('#visitasProgramadas', '—');
    setText('#documentosPendientes', '—');
}

function storeAgenda(list) {
    recepAgendaCache = Array.isArray(list) ? list : [];
}

function getAgendaItem(id) {
    if (!recepAgendaCache.length) return undefined;
    return recepAgendaCache.find(function(item) { return item.id === id; });
}

function getOrderById(id) {
    if (!recepOrdersCache.length) return undefined;
    var parsed = Number(id);
    return recepOrdersCache.find(function(item) { return Number(item.id) === parsed; });
}

// Función mejorada para renderizar la agenda
function renderAgenda(list) {
    var container = qs('#agendaList');
    if (!container) return;

    if (!list.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 15px;">📅</div>
                <h3 style="color: #666; margin-bottom: 10px;">No hay recepciones programadas</h3>
                <p style="color: #888; font-size: 14px;">Cuando haya vehículos programados, aparecerán aquí.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(function(item) {
                var veh = item.vehiculo || {};
                var sol = item.solicitud || {};
                var conductor = sol.conductor || {};
                var mec = item.mecanico || {};
                var fechaPlan = item.fecha_inicio_trabajo ? new Date(item.fecha_inicio_trabajo) : null;
                var fechaFinPlan = item.fecha_estimada_termino ? new Date(item.fecha_estimada_termino) : null;
                var fechaLabel = formatDateShort(fechaPlan);
                var horaLabel = formatTime(fechaPlan);
                var patente = veh.patente || (veh.id ? 'Vehículo #' + veh.id : 'Vehículo');
                var modelo = veh.modelo || '';
                var chofer = conductor.nombre_completo || 'Sin chofer';

                // Estado y etiquetas
                var prioridadTag = item.prioridad === 'URGENTE' ?
                    '<span class="agenda-tag agenda-tag--urgent">🚨 Urgente</span>' : '';

                var lateTag = '';
                if (fechaPlan && fechaPlan < new Date() && ['PENDIENTE', 'APROBADO', 'CITA_MANTENCION'].includes((item.estado || '').toUpperCase()) && !item.fecha_ingreso_recepcion) {
                    lateTag = '<span class="agenda-tag agenda-tag--late">⏰ Retraso</span>';
                }

                var estado = (item.estado || 'Pendiente').replace('_', ' ');
                var actionHtml = '';

                if (item.fecha_ingreso_recepcion) {
                    actionHtml = '<span class="agenda-tag" style="background: #e8f5e9; color: #2e7d32;">✅ Recibido</span>';
                } else if (canCheckInToday(item)) {
                    actionHtml = `
                <button class="btn btn-primary btn-sm" onclick="window.recepOpenCheckIn(${item.id})" style="display: flex; align-items: center; gap: 8px;">
                    <span>📋 Registrar llegada</span>
                </button>
            `;
                } else {
                    actionHtml = '<span class="agenda-tag" style="background: #f5f5f5; color: #666;">⏳ Fuera de rango</span>';
                }

                var solicitudDesc = (item.solicitud && item.solicitud.descripcion) || '';
                var problema = (item.descripcion_problema || item.descripcion || solicitudDesc).trim();

                return `
            <div class="agenda-item">
                <div class="agenda-date">
                    <span class="agenda-date__day">${fechaPlan ? String(fechaPlan.getDate()).padStart(2, '0') : '--'}</span>
                    <span class="agenda-date__month">${fechaPlan ? fechaPlan.toLocaleDateString('es-CL', { month: 'short' }) : ''}</span>
                </div>
                
                <div class="agenda-info">
                    <div class="agenda-title" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <span style="font-weight: 700; color: var(--primary);">${patente}</span>
                        ${modelo ? '<span style="color: #666;">· ' + modelo + '</span>' : ''}
                    </div>
                    
                    <div class="agenda-meta" style="margin-bottom: 8px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 13px;">
                            <span style="display: flex; align-items: center; gap: 5px;">
                                <span style="color: #888;">⏰</span>
                                ${fechaLabel}${horaLabel ? ' · ' + horaLabel : ''}
                                ${fechaFinPlan ? ' → ' + formatDateShort(fechaFinPlan) + ' ' + formatTime(fechaFinPlan) : ''}
                            </span>
                            <span style="display: flex; align-items: center; gap: 5px;">
                                <span style="color: #888;">🔧</span>
                                ${mec.nombre_completo || 'Sin asignar'}
                            </span>
                        </div>
                    </div>
                    
                    <div class="agenda-meta" style="margin-bottom: 8px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 13px;">
                            <span style="display: flex; align-items: center; gap: 5px;">
                                <span style="color: #888;">👤</span>
                                ${chofer}
                            </span>
                            <span style="display: flex; align-items: center; gap: 5px;">
                                <span style="color: #888;">📊</span>
                                ${estado}
                            </span>
                        </div>
                    </div>
                    
                    ${problema ? `
                        <div class="agenda-meta" style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                            <div style="display: flex; align-items: flex-start; gap: 8px;">
                                <span style="color: #888; flex-shrink: 0;">🔍</span>
                                <span style="font-size: 13px; line-height: 1.4;">${problema}</span>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="agenda-tags">
                        ${prioridadTag} ${lateTag}
                    </div>
                </div>
                
                <div class="agenda-actions">
                    ${actionHtml}
                </div>
            </div>
        `;
    }).join('');
}

function loadAgenda() {
    var container = qs('#agendaList');
    if (container) {
        LoadingUtils.showTableLoading(container, 'Cargando agenda...');
    }
    
    // Construir query string con filtros
    var queryParams = [];
    if (recepFiltros.search) {
        queryParams.push('search=' + encodeURIComponent(recepFiltros.search));
    }
    if (recepFiltros.estado) {
        queryParams.push('estado=' + encodeURIComponent(recepFiltros.estado));
    }
    
    var url = API_BASE + '/workorders';
    if (queryParams.length > 0) {
        url += '?' + queryParams.join('&');
    }
    
    return bearerFetch(url)
        .then(function(res) {
            if (!res.ok) throw new Error('No se pudo cargar la agenda');
            return res.json();
        })
        .then(function(data) {
            console.log('Datos recibidos del servidor:', data);
            
            // Manejar respuesta con paginación o sin paginación (compatibilidad hacia atrás)
            var ordersData = data.data || data;
            if (!Array.isArray(ordersData)) {
                console.error('Los datos recibidos no son un array:', ordersData);
                ordersData = [];
            }
            
            storeOrders(ordersData);
            console.log('Total de OTs en cache:', recepOrdersCache.length);
            console.log('OTs en cache con estado de vehículo:', recepOrdersCache.map(function(ot) {
                return {
                    id: ot.id,
                    numero_ot: ot.numero_ot,
                    estado: ot.estado,
                    vehiculoEstado: ot.vehiculo ? ot.vehiculo.estado : 'N/A',
                    vehiculo: ot.vehiculo,
                    tieneMecanico: !!(ot.mecanico && (ot.mecanico.id || typeof ot.mecanico === 'string')) || !!ot.mecanico_asignado_id,
                    mecanico: ot.mecanico ? (typeof ot.mecanico === 'string' ? ot.mecanico : ot.mecanico.nombre_completo) : null,
                    mecanico_asignado_id: ot.mecanico_asignado_id,
                    mecanicoRaw: ot.mecanico,
                    fecha_ingreso_recepcion: ot.fecha_ingreso_recepcion,
                    fecha_inicio_trabajo: ot.fecha_inicio_trabajo
                };
            }));
            var upcoming = recepOrdersCache.filter(function(ot) {
                // Mostrar OTs que tengan mecánico asignado pero sin fecha_ingreso_recepcion
                // Esto incluye OTs con estado APROBADO (nuevo flujo) o PENDIENTE/EN_PROCESO (OTs antiguas)
                var estado = (ot.estado || '').toUpperCase();
                // El backend puede devolver mecanico como objeto {id, nombre_completo} o como string
                var tieneMecanico = false;
                if (ot.mecanico) {
                    if (typeof ot.mecanico === 'object' && ot.mecanico.id) {
                        tieneMecanico = true;
                    } else if (typeof ot.mecanico === 'string' && ot.mecanico.trim() !== '') {
                        tieneMecanico = true;
                    } else if (ot.mecanico_asignado_id) {
                        // Fallback: si hay mecanico_asignado_id, considerar que tiene mecánico
                        tieneMecanico = true;
                    }
                } else if (ot.mecanico_asignado_id) {
                    // Si no hay objeto mecanico pero hay mecanico_asignado_id, considerar que tiene mecánico
                    tieneMecanico = true;
                }
                var sinRecepcion = !ot.fecha_ingreso_recepcion;
                
                // mostrar independientemente de la fecha (aún necesitan ser recibidas)
                // Para otros estados, aplicar filtro de fecha
                var esEstadoPendienteRecepcion = ['APROBADO', 'PENDIENTE'].includes(estado);
                var esFuturaODeHoy = true; // Por defecto true para estados pendientes de recepción
                
                if (!esEstadoPendienteRecepcion) {
                    // Para otros estados, aplicar filtro de fecha
                    var fechaInicio = ot.fecha_inicio_trabajo ? new Date(ot.fecha_inicio_trabajo) : 
                                     (ot.fecha_estimada_termino ? new Date(ot.fecha_estimada_termino) : null);
                    var hoy = new Date();
                    hoy.setHours(0, 0, 0, 0); // Inicio del día de hoy
                    // Si no hay fecha de inicio, considerar que es futura si tiene fecha estimada
                    esFuturaODeHoy = fechaInicio ? (fechaInicio >= hoy) : 
                                   (ot.fecha_estimada_termino ? (new Date(ot.fecha_estimada_termino) >= hoy) : false);
                } else {
                    // Para OTs APROBADO o PENDIENTE, permitir fechas pasadas hasta 7 días atrás
                    // (OTs que se programaron pero aún no han sido recibidas)
                    var fechaInicio = ot.fecha_inicio_trabajo ? new Date(ot.fecha_inicio_trabajo) : 
                                     (ot.fecha_estimada_termino ? new Date(ot.fecha_estimada_termino) : null);
                    if (fechaInicio) {
                        var hoy = new Date();
                        hoy.setHours(0, 0, 0, 0);
                        var hace7Dias = new Date(hoy);
                        hace7Dias.setDate(hace7Dias.getDate() - 7);
                        // Permitir si la fecha es futura, de hoy, o hasta 7 días en el pasado
                        esFuturaODeHoy = fechaInicio >= hace7Dias;
                    } else {
                        // Si no hay fecha, considerar que es válida (puede ser OT sin fecha programada aún)
                        esFuturaODeHoy = true;
                    }
                }
                
                // Incluir si tiene mecánico asignado, no tiene fecha_ingreso_recepcion,
                // la fecha es válida según la lógica anterior, y el estado no es COMPLETADO o CANCELADA
                // IMPORTANTE: Incluir estados APROBADO y PENDIENTE (OTs programadas esperando recepción)
                var resultado = sinRecepcion && tieneMecanico && esFuturaODeHoy && 
                    !['COMPLETADO', 'CANCELADA'].includes(estado) &&
                    ['PENDIENTE', 'APROBADO', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'LISTO'].includes(estado);
                // Debug: log para ver qué OTs se están filtrando
                if (!resultado) {
                    console.log('OT excluida de agenda:', {
                        id: ot.id,
                        numero_ot: ot.numero_ot,
                        estado: ot.estado,
                        tieneMecanico: tieneMecanico,
                        mecanico: ot.mecanico,
                        mecanico_asignado_id: ot.mecanico_asignado_id,
                        sinRecepcion: sinRecepcion,
                        fecha_inicio_trabajo: ot.fecha_inicio_trabajo,
                        fecha_ingreso_recepcion: ot.fecha_ingreso_recepcion,
                        esFuturaODeHoy: esFuturaODeHoy,
                        fechaInicio: fechaInicio,
                        hoy: hoy
                    });
                } else {
                    console.log('OT incluida en agenda:', {
                        id: ot.id,
                        numero_ot: ot.numero_ot,
                        estado: ot.estado,
                        tieneMecanico: tieneMecanico,
                        mecanico: ot.mecanico,
                        fecha_inicio_trabajo: ot.fecha_inicio_trabajo,
                        fecha_ingreso_recepcion: ot.fecha_ingreso_recepcion,
                        esFuturaODeHoy: esFuturaODeHoy
                    });
                }
                return resultado;
            }).sort(function(a, b) {
                var da = a.fecha_inicio_trabajo ? new Date(a.fecha_inicio_trabajo).getTime() : Infinity;
                var db = b.fecha_inicio_trabajo ? new Date(b.fecha_inicio_trabajo).getTime() : Infinity;
                return da - db;
            });
            storeAgenda(upcoming);
            updateAgendaStats(upcoming);
            renderAgenda(upcoming);

            var workshopItems = recepOrdersCache.filter(function(ot) {
                var estado = (ot.estado || '').toUpperCase();
                var vehiculoEstado = (ot.vehiculo?.estado || '').toUpperCase();
                // Incluir OTs con fecha_ingreso_recepcion y estados permitidos
                // O vehículos en estado COMPLETADO (para finalizar retiro)
                // Excluir vehículos en LISTO_PARA_RETIRO (ya finalizados, esperando chofer)
                var allowed = ['APROBADO', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'LISTO', 'COMPLETADO', 'PENDIENTE_VERIFICACION'];
                if (vehiculoEstado === 'LISTO_PARA_RETIRO') {
                    return false; // Ya finalizado, no necesita acción del recepcionista
                }
                var resultado = ot.fecha_ingreso_recepcion && (allowed.includes(estado) || vehiculoEstado === 'COMPLETADO');
                return resultado;
            }).sort(function(a, b) {
                var da = a.fecha_ingreso_recepcion ? new Date(a.fecha_ingreso_recepcion).getTime() : 0;
                var db = b.fecha_ingreso_recepcion ? new Date(b.fecha_ingreso_recepcion).getTime() : 0;
                // Orden descendente: más reciente primero
                return db - da;
            });
            
            console.log('Workshop items filtrados:', workshopItems.length, workshopItems);
            renderWorkshopList(workshopItems);
        })
        .catch(function(err) {
            ErrorHandler.handleError(err, 'Cargar agenda', {
                useFloatingNotification: true
            });
            if (container) {
                container.innerHTML = '<div class="empty-state">No se pudo cargar la agenda.</div>';
            }
            renderWorkshopList([]);
        });
}

function updateAgendaStats(list) {
    var today = new Date();
    var dayStart = startOfDay(today);
    var weekEnd = new Date(dayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    var countToday = list.filter(function(item) {
        if (!item.fecha_inicio_trabajo) return false;
        var d = new Date(item.fecha_inicio_trabajo);
        return d >= dayStart && d < new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    }).length;

    var countWeek = list.filter(function(item) {
        if (!item.fecha_inicio_trabajo) return false;
        var d = new Date(item.fecha_inicio_trabajo);
        return d >= dayStart && d <= weekEnd;
    }).length;

    var countUrgent = list.filter(function(item) {
        return item.prioridad === 'URGENTE';
    }).length;

    setText('#recepcionesPendientes', countToday || '0');
    setText('#visitasProgramadas', countWeek || '0');
    setText('#documentosPendientes', countUrgent || '0');
}

// Definir la función completa directamente en window
// Como el script se carga con defer, esta función estará disponible
// antes de que se rendericen los botones dinámicamente
window.recepOpenCheckIn = function(id) {
    console.log('recepOpenCheckIn llamado con ID:', id);
    var ot = getAgendaItem(Number(id));
    if (!ot) {
        alert('No se encontró la orden.');
        return;
    }
    if (!canCheckInToday(ot)) {
        alert('La llegada solo puede registrarse en el rango planificado.');
        return;
    }
    recepFillCheckinModal(ot);
    openModal('modalCheckin');
};

function recepFillCheckinModal(ot) {
    // Fixed optional chaining syntax
    var vehPatente = (ot.vehiculo && ot.vehiculo.patente) || ('Vehículo #' + ((ot.vehiculo && ot.vehiculo.id) || ''));
    var vehModelo = (ot.vehiculo && ot.vehiculo.modelo) ? ' · ' + ot.vehiculo.modelo : '';
    var vehText = vehPatente + vehModelo;
    var mechText = (ot.mecanico && ot.mecanico.nombre_completo) || 'Sin asignar';
    var conductorObj = (ot.solicitud && ot.solicitud.conductor) || {};
    var driverText = conductorObj.nombre_completo || 'Sin chofer registrado';
    var summaryOt = document.getElementById('recep_checkin_ot_numero');
    if (summaryOt) summaryOt.textContent = ot.numero_ot || ('#' + ot.id);
    var vehEl = document.getElementById('recep_checkin_vehicle');
    if (vehEl) vehEl.textContent = vehText;
    var mecEl = document.getElementById('recep_checkin_mechanic');
    if (mecEl) mecEl.textContent = mechText;
    var driverEl = document.getElementById('recep_checkin_driver');
    if (driverEl) driverEl.textContent = driverText;
    var problemEl = document.getElementById('recep_checkin_problem');
    if (problemEl) {
        var solicitudDesc = (ot.solicitud && ot.solicitud.descripcion) || '';
        problemEl.textContent = (ot.descripcion_problema || ot.descripcion || solicitudDesc || '—');
    }
    var scheduleEl = document.getElementById('recep_checkin_schedule');
    if (scheduleEl) scheduleEl.textContent = formatDateTimeRange(ot.fecha_inicio_trabajo, ot.fecha_estimada_termino);
    var idInput = document.getElementById('recep_checkin_ot_id');
    if (idInput) idInput.value = ot.id;
    var arrivalInput = document.getElementById('recep_checkin_arrival');
    if (arrivalInput) {
        arrivalInput.value = formatLocalDateTimeInput(new Date());
    }
    ['recep_check_permiso', 'recep_check_seguro', 'recep_check_all_ok'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.checked = false;
    });
    recepCheckinEvidencias = [];
    var filesInput = document.getElementById('recep_checkin_evidencias');
    if (filesInput) filesInput.value = '';
    updateCheckinFilesList();
    var notes = document.getElementById('recep_checkin_notes');
    if (notes) notes.value = '';
    var msg = document.getElementById('recepCheckinMsg');
    if (msg) {
        msg.textContent = '';
        msg.classList.add('hidden');
    }
     // Sincronizar estados del checklist / "Todo OK"
    initCheckinChecklistPrecision();
}

function initCheckinChecklistPrecision() {
    var permisoEl = document.getElementById('recep_check_permiso');
    var seguroEl = document.getElementById('recep_check_seguro');
    var allOkEl = document.getElementById('recep_check_all_ok');
    var allOkWrapper = document.getElementById('recep_check_all_ok_wrapper');

    if (!permisoEl || !seguroEl || !allOkEl || !allOkWrapper) return;

    function updateAllOkState() {
        var allChecked = permisoEl.checked && seguroEl.checked;

        // Si no están todos marcados, desactivar y desmarcar "Todo OK"
        allOkEl.disabled = !allChecked;
        if (!allChecked) {
            allOkEl.checked = false;
            allOkWrapper.classList.add('toggle-disabled');
        } else {
            allOkWrapper.classList.remove('toggle-disabled');
        }
    }

    // Escuchar cambios en cada documento (solo permiso y seguro)
    [permisoEl, seguroEl].forEach(function (el) {
        el.addEventListener('change', updateAllOkState);
    });

    // Por seguridad, si intentan tocar el checkbox deshabilitado
    allOkEl.addEventListener('change', function () {
        if (allOkEl.disabled) {
            allOkEl.checked = false;
        }
    });

    // Estado inicial
    updateAllOkState();
}


function handleCheckinSubmit(ev) {
    ev.preventDefault();
    var idInput = document.getElementById('recep_checkin_ot_id');
    if (!idInput || !idInput.value) return;
    var msg = document.getElementById('recepCheckinMsg');
    if (msg) {
        msg.textContent = '';
        msg.classList.add('hidden');
    }
    var ot = getAgendaItem(Number(idInput.value));
    if (!ot) {
        flashStatus(msg, 'bad', '❌ No se encontró la OT a registrar.');
        return;
    }
    var arrivalInput = document.getElementById('recep_checkin_arrival');
    if (!arrivalInput || !arrivalInput.value) {
        flashStatus(msg, 'bad', '❌ Debes indicar la fecha y hora de llegada.');
        return;
    }
    var arrivalDate = new Date(arrivalInput.value);
    if (isNaN(arrivalDate.getTime())) {
        flashStatus(msg, 'bad', '❌ Fecha de llegada inválida.');
        return;
    }
    var start = startOfDay(new Date(ot.fecha_inicio_trabajo));
    var end = endOfDay(new Date(ot.fecha_estimada_termino));
    if (arrivalDate < start || arrivalDate > end) {
        flashStatus(msg, 'bad', '❌ La llegada debe estar dentro del rango planificado (' + formatDateShort(start) + ' - ' + formatDateShort(end) + ').');
        return;
    }
    var notes = document.getElementById('recep_checkin_notes');
    var permisoEl = document.getElementById('recep_check_permiso');
    var seguroEl = document.getElementById('recep_check_seguro');
    var allOkEl = document.getElementById('recep_check_all_ok');

    if (!permisoEl || !permisoEl.checked) {
        flashStatus(msg, 'bad', '❌ Debes marcar el checklist de "Permiso de circulación".');
        return;
    }
    if (!seguroEl || !seguroEl.checked) {
        flashStatus(msg, 'bad', '❌ Debes marcar el checklist de "Seguro / SOAP vigente".');
        return;
    }
    if (!allOkEl || !allOkEl.checked) {
        flashStatus(msg, 'bad', '❌ Debes marcar "Todo OK / Documentación completa".');
        return;
    }

    var payload = {
        observaciones: notes && notes.value ? notes.value.trim() : undefined,
        fechaLlegada: arrivalDate.toISOString(),
        checklist: {
            permisoCirculacion: !!(permisoEl && permisoEl.checked),
            seguroVigente: !!(seguroEl && seguroEl.checked)
        },
        checklistCompleto: !!(allOkEl && allOkEl.checked),
        evidencias: recepCheckinEvidencias.map(function(item) { return item.dataUrl; })
    };
    
    // Mostrar loading en botón de submit
    var submitBtn = ev.target.querySelector('button[type="submit"]') || ev.target.querySelector('input[type="submit"]');
    if (submitBtn) {
        LoadingUtils.showButtonLoading(submitBtn, 'Registrando llegada...');
    }
    
    bearerFetch(API_BASE + '/workorders/' + idInput.value + '/checkin', {
        method: 'POST',
        body: JSON.stringify(payload)
    }).then(function(res) {
        if (!res.ok) {
            return res.json().then(function(err) {
                throw new Error(err.message || 'No se pudo registrar la llegada');
            });
        }
        return res.json();
    }).then(function() {
        // Ocultar loading
        if (submitBtn) {
            LoadingUtils.hideButtonLoading(submitBtn);
        }
        
        closeModal('modalCheckin');
        recepCheckinEvidencias = [];
        updateCheckinFilesList();
        loadAgenda();
    }).catch(function(error) {
        // Ocultar loading en caso de error
        if (submitBtn) {
            LoadingUtils.hideButtonLoading(submitBtn);
        }
        
        if (msg) {
            flashStatus(msg, 'bad', '❌ ' + (error.message || 'Error al registrar la llegada'));
        } else {
            alert(error.message || 'Error al registrar la llegada');
        }
    });
}

// Función mejorada para los badges de estado (agregar iconos)
function formatStatusBadge(status) {
    var map = {
        PENDIENTE: { class: 'status-pendiente', icon: '⏳', text: 'Pendiente' },
        APROBADO: { class: 'status-aprobacion', icon: '✅', text: 'Aprobado' },
        EN_PROCESO: { class: 'status-proceso', icon: '🔧', text: 'En Proceso' },
        ESPERA_REPUESTOS: { class: 'status-aprobacion', icon: '📦', text: 'Espera Repuestos' },
        LISTO: { class: 'status-completado', icon: '🚀', text: 'Listo' },
        COMPLETADO: { class: 'status-completado', icon: '🏁', text: 'Completado' },
        PENDIENTE_VERIFICACION: { class: 'status-pendiente', icon: '🔍', text: 'Pendiente Verificación' }
    };
    
    var key = (status || 'PENDIENTE').toUpperCase();
    var item = map[key] || map.PENDIENTE;
    
    return `
        <span class="status-badge ${item.class}" style="display: flex; align-items: center; gap: 6px; padding: 6px 12px;">
            <span>${item.icon}</span>
            <span>${item.text}</span>
        </span>
    `;
}

// Función helper para renderizar un item de workshop
function renderWorkshopItem(item) {
    console.log('[renderWorkshopItem] Renderizando item:', item.id, item.numero_ot);
    
    var veh = item.vehiculo || {};
    var mec = item.mecanico || {};
    var schedule = formatDateTimeRange(item.fecha_inicio_trabajo, item.fecha_estimada_termino);
    var arrival = item.fecha_ingreso_recepcion ? 
        formatDateShort(item.fecha_ingreso_recepcion) + ' · ' + formatTime(item.fecha_ingreso_recepcion) : '—';
    
    var estado = (item.estado || 'PENDIENTE').toUpperCase();
    var vehiculoEstado = (veh.estado || '').toUpperCase();
    var actionHtml = '';
    
    // Determinar la acción basada en el estado
    if (vehiculoEstado === 'COMPLETADO') {
        actionHtml = `
            <button class="btn btn-success btn-sm" onclick="recepOpenFinalizeRetiro(${item.id})" 
                style="display: flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #28a745, #20c997);">
                <span>✅ Finalizar proceso</span>
            </button>
        `;
    } else if (estado === 'APROBADO') {
        actionHtml = `
            <button class="btn btn-primary btn-sm" onclick="recepHandleWorkshopAction(${item.id}, 'handoff')" 
                style="display: flex; align-items: center; gap: 8px;">
                <span>🔧 Entregar a taller</span>
            </button>
        `;
    } else if (estado === 'EN_PROCESO') {
        actionHtml = `
            <button class="btn btn-secondary btn-sm" onclick="recepHandleWorkshopAction(${item.id}, 'ready')" 
                style="display: flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #6c757d, #5a6268);">
                <span>🚀 Listo para salida</span>
            </button>
        `;
    } else {
        actionHtml = '<span class="agenda-tag" style="background: #f5f5f5; color: #666;">⏳ En espera</span>';
    }

    return `
        <div class="workshop-item">
            <div class="workshop-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <div class="workshop-item__title" style="font-size: 18px; font-weight: 700; color: var(--dark);">
                    ${veh.patente || ('Vehículo #' + (veh.id || ''))} 
                    ${veh.modelo ? '<span style="font-weight: 500; color: #666;">· ' + veh.modelo + '</span>' : ''}
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${formatStatusBadge(estado)}
                    ${vehiculoEstado ? formatStatusBadge(vehiculoEstado) : ''}
                </div>
            </div>
            
            <div class="workshop-item__meta" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8f9fa; border-radius: 6px;">
                    <span style="color: var(--primary); font-weight: 600;">OT:</span>
                    <span>${item.numero_ot || ('#' + item.id)}</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8f9fa; border-radius: 6px;">
                    <span style="color: var(--primary); font-weight: 600;">Ingreso:</span>
                    <span>${arrival}</span>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8f9fa; border-radius: 6px;">
                    <span style="color: var(--primary); font-weight: 600;">Mecánico:</span>
                    <span>${mec.nombre_completo || 'Sin asignar'}</span>
                </div>
            </div>
            
            <div class="workshop-item__status" style="display: flex; align-items: center; gap: 8px; padding: 10px 15px; background: #e7f3ff; border-radius: 6px; margin-bottom: 15px;">
                <span style="color: var(--primary);">📅</span>
                <span style="font-weight: 600; color: var(--primary);">Ventana planificada:</span>
                <span style="color: #666;">${schedule}</span>
            </div>
            
            <div class="workshop-item__actions" style="display: flex; justify-content: flex-end;">
                ${actionHtml}
            </div>
        </div>
    `;
}

// Renderiza la lista de workshop en el dashboard (máximo 4 items)
function renderWorkshopList(list) {
    console.log('[renderWorkshopList] Llamado con lista de', list ? list.length : 0, 'items');
    
    // Guardar la lista completa en el cache
    recepWorkshopCache = Array.isArray(list) ? list : [];
    
    var container = qs('#workshopList');
    if (!container) {
        console.error('[renderWorkshopList] Contenedor #workshopList no encontrado');
        return;
    }
    
    if (!list || !list.length) {
        console.log('[renderWorkshopList] Lista vacía, mostrando estado vacío');
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 15px;">🏭</div>
                <h3 style="color: #666; margin-bottom: 10px;">No hay vehículos en taller</h3>
                <p style="color: #888; font-size: 14px;">Los vehículos recibidos aparecerán aquí para su gestión.</p>
            </div>
        `;
        // Ocultar mensaje de overflow
        var overflowMsg = qs('#workshopOverflowMessage');
        if (overflowMsg) overflowMsg.style.display = 'none';
        return;
    }

    console.log('[renderWorkshopList] Renderizando', list.length, 'items (mostrando máximo', MAX_WORKSHOP_ITEMS_DASHBOARD, ')');
    
    // Mostrar solo los primeros MAX_WORKSHOP_ITEMS_DASHBOARD items
    var itemsToShow = list.slice(0, MAX_WORKSHOP_ITEMS_DASHBOARD);
    try {
        container.innerHTML = itemsToShow.map(renderWorkshopItem).join('');
        console.log('[renderWorkshopList] HTML renderizado correctamente');
    } catch (error) {
        console.error('[renderWorkshopList] Error al renderizar items:', error);
        container.innerHTML = '<div class="empty-state">Error al renderizar vehículos.</div>';
    }
    
    // Mostrar mensaje de overflow si hay más items
    var overflowMsg = qs('#workshopOverflowMessage');
    if (overflowMsg) {
        if (list.length > MAX_WORKSHOP_ITEMS_DASHBOARD) {
            overflowMsg.style.display = 'block';
        } else {
            overflowMsg.style.display = 'none';
        }
    }
}

// Renderiza todos los vehículos en taller en la sección "Vehículos"
function renderWorkshopListAll(list) {
    console.log('[renderWorkshopListAll] Llamado con lista de', list ? list.length : 0, 'items');
    
    var container = qs('#workshopListAll');
    if (!container) {
        console.error('[renderWorkshopListAll] Contenedor #workshopListAll no encontrado');
        return;
    }
    
    console.log('[renderWorkshopListAll] Contenedor encontrado:', container);
    
    if (!list || !list.length) {
        console.log('[renderWorkshopListAll] Lista vacía, mostrando estado vacío');
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 15px;">🏭</div>
                <h3 style="color: #666; margin-bottom: 10px;">No hay vehículos en taller</h3>
                <p style="color: #888; font-size: 14px;">Los vehículos recibidos aparecerán aquí para su gestión.</p>
            </div>
        `;
        return;
    }

    console.log('[renderWorkshopListAll] Renderizando', list.length, 'items');
    try {
        var html = list.map(function(item, index) {
            console.log('[renderWorkshopListAll] Procesando item', index + 1, 'de', list.length, ':', item.id);
            return renderWorkshopItem(item);
        }).join('');
        console.log('[renderWorkshopListAll] HTML generado, longitud:', html.length);
        container.innerHTML = html;
        console.log('[renderWorkshopListAll] HTML insertado en contenedor');
    } catch (error) {
        console.error('[renderWorkshopListAll] Error al renderizar items:', error);
        container.innerHTML = '<div class="empty-state">Error al renderizar vehículos: ' + error.message + '</div>';
    }
}

// Carga todos los vehículos en taller para la sección "Vehículos" con paginación y filtros
function loadAllWorkshopVehicles(page) {
    console.log('[loadAllWorkshopVehicles] Función llamada con página:', page);
    
    var container = qs('#workshopListAll');
    var paginationContainer = qs('#vehiculosPagination');
    
    console.log('[loadAllWorkshopVehicles] Contenedor encontrado:', container ? 'Sí' : 'No');
    console.log('[loadAllWorkshopVehicles] Contenedor de paginación encontrado:', paginationContainer ? 'Sí' : 'No');
    
    if (!container) {
        console.error('[loadAllWorkshopVehicles] Contenedor #workshopListAll no encontrado');
        return;
    }
    
    // Actualizar página si se proporciona
    if (page !== undefined) {
        recepVehiculosPage = page;
    }
    
    // Verificar si hay filtros activos (excluyendo el estado por defecto)
    var hasFilters = recepVehiculosFiltros.fechaDesde || recepVehiculosFiltros.fechaHasta || 
                     recepVehiculosFiltros.estado || recepVehiculosFiltros.patente || recepVehiculosFiltros.mecanico;
    
    console.log('[loadAllWorkshopVehicles] Verificando cache - hasFilters:', hasFilters, 'recepWorkshopCache.length:', recepWorkshopCache.length);
    console.log('[loadAllWorkshopVehicles] Filtros actuales:', recepVehiculosFiltros);
    
    // Si tenemos cache, usarlo y aplicar filtros del lado del cliente
    if (recepWorkshopCache.length > 0) {
        console.log('[loadAllWorkshopVehicles] Usando cache existente con', recepWorkshopCache.length, 'items y aplicando filtros del lado del cliente');
        
        // Aplicar todos los filtros del lado del cliente
        var filteredItems = recepWorkshopCache.filter(function(ot) {
            // Filtro por fecha desde
            if (recepVehiculosFiltros.fechaDesde) {
                var fechaIngreso = ot.fecha_ingreso_recepcion;
                if (!fechaIngreso) return false;
                var fechaIngresoDate = new Date(fechaIngreso);
                var fechaDesdeDate = new Date(recepVehiculosFiltros.fechaDesde);
                fechaDesdeDate.setHours(0, 0, 0, 0);
                if (fechaIngresoDate < fechaDesdeDate) return false;
            }
            
            // Filtro por fecha hasta
            if (recepVehiculosFiltros.fechaHasta) {
                var fechaIngreso = ot.fecha_ingreso_recepcion;
                if (!fechaIngreso) return false;
                var fechaIngresoDate = new Date(fechaIngreso);
                var fechaHastaDate = new Date(recepVehiculosFiltros.fechaHasta);
                fechaHastaDate.setHours(23, 59, 59, 999);
                if (fechaIngresoDate > fechaHastaDate) return false;
            }
            
            // Filtro por estado
            if (recepVehiculosFiltros.estado) {
                var estadoOt = (ot.estado || '').toUpperCase();
                if (estadoOt !== recepVehiculosFiltros.estado.toUpperCase()) return false;
            }
            
            // Filtro por patente
            if (recepVehiculosFiltros.patente) {
                var patenteVeh = (ot.vehiculo && ot.vehiculo.patente) || '';
                var patenteFilter = recepVehiculosFiltros.patente.toUpperCase().trim();
                if (patenteVeh.toUpperCase().indexOf(patenteFilter) === -1) return false;
            }
            
            // Filtro por mecánico (se aplica después)
            // Este filtro se aplica más abajo para tener mejor logging
            
            return true;
        });
        
        // Aplicar filtro de mecánico
        if (recepVehiculosFiltros.mecanico) {
            var mecanicoLower = recepVehiculosFiltros.mecanico.toLowerCase();
            var beforeMecanico = filteredItems.length;
            filteredItems = filteredItems.filter(function(ot) {
                var mec = ot.mecanico || {};
                return (mec.nombre_completo || '').toLowerCase().indexOf(mecanicoLower) !== -1;
            });
            console.log('[loadAllWorkshopVehicles] Después de filtrar por mecánico:', filteredItems.length, 'de', beforeMecanico);
        }
        
        // Ordenar por fecha_ingreso_recepcion (más reciente primero)
        filteredItems.sort(function(a, b) {
            var fechaA = a.fecha_ingreso_recepcion ? new Date(a.fecha_ingreso_recepcion).getTime() : 0;
            var fechaB = b.fecha_ingreso_recepcion ? new Date(b.fecha_ingreso_recepcion).getTime() : 0;
            // Orden descendente: más reciente primero
            return fechaB - fechaA;
        });
        
        console.log('[loadAllWorkshopVehicles] Items después de aplicar filtros y ordenamiento:', filteredItems.length, 'de', recepWorkshopCache.length);
        
        // Aplicar paginación
        var total = filteredItems.length;
        var totalPages = Math.ceil(total / recepVehiculosLimit);
        var startIndex = (recepVehiculosPage - 1) * recepVehiculosLimit;
        var endIndex = startIndex + recepVehiculosLimit;
        var paginatedItems = filteredItems.slice(startIndex, endIndex);
        
        console.log('[loadAllWorkshopVehicles] Items del cache para renderizar (página', recepVehiculosPage, ', índices', startIndex, '-', endIndex, '):', paginatedItems.length);
        renderWorkshopListAll(paginatedItems);
        
        // Renderizar paginación
        if (typeof window.PaginationUtils !== 'undefined' && window.PaginationUtils.createPagination && paginationContainer) {
            var adjustedPagination = {
                page: recepVehiculosPage,
                limit: recepVehiculosLimit,
                total: total,
                totalPages: totalPages
            };
            console.log('[loadAllWorkshopVehicles] Renderizando paginación desde cache:', adjustedPagination);
            window.PaginationUtils.createPagination(paginationContainer, adjustedPagination, function(newPage) {
                console.log('[loadAllWorkshopVehicles] Cambio de página a:', newPage);
                loadAllWorkshopVehicles(newPage);
            });
        }
        return;
    }
    
    console.log('[loadAllWorkshopVehicles] No hay cache disponible, haciendo petición al servidor');
    
    // Mostrar loading
    LoadingUtils.showTableLoading(container, 'Cargando vehículos...');
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }
    
    // Construir query string con filtros y paginación
    var queryParams = [];
    
    // Siempre cargar más datos porque necesitamos filtrar por fecha_ingreso_recepcion del lado del cliente
    // y aplicar paginación del lado del cliente para tener resultados precisos
    // Cargar suficientes datos para cubrir varias páginas
    var loadLimit = Math.max(100, recepVehiculosLimit * 5); // Cargar al menos 5 páginas de datos
    queryParams.push('page=1');
    queryParams.push('limit=' + loadLimit);
    
    // Filtro de estados (solo vehículos con ingreso registrado)
    // Si hay un estado específico, usar ese; si no, usar los estados por defecto
    if (recepVehiculosFiltros.estado) {
        queryParams.push('estado=' + encodeURIComponent(recepVehiculosFiltros.estado));
        console.log('[loadAllWorkshopVehicles] Filtro de estado activo:', recepVehiculosFiltros.estado);
    } else {
        queryParams.push('estado=APROBADO,EN_PROCESO,ESPERA_REPUESTOS,LISTO,COMPLETADO,PENDIENTE_VERIFICACION');
        console.log('[loadAllWorkshopVehicles] Usando estados por defecto');
    }
    
    // Filtros adicionales
    if (recepVehiculosFiltros.fechaDesde) {
        queryParams.push('fechaDesde=' + encodeURIComponent(recepVehiculosFiltros.fechaDesde));
    }
    if (recepVehiculosFiltros.fechaHasta) {
        queryParams.push('fechaHasta=' + encodeURIComponent(recepVehiculosFiltros.fechaHasta));
    }
    if (recepVehiculosFiltros.patente) {
        queryParams.push('vehiculoPatente=' + encodeURIComponent(recepVehiculosFiltros.patente));
    }
    // Nota: El filtro de mecánico por nombre se aplica del lado del cliente
    
    var url = API_BASE + '/workorders?' + queryParams.join('&');
    console.log('[loadAllWorkshopVehicles] URL de petición:', url);
    
    bearerFetch(url)
        .then(function(res) {
            if (!res.ok) {
                throw new Error('Error al cargar vehículos: ' + res.status);
            }
            return res.json();
        })
        .then(function(response) {
            console.log('[loadAllWorkshopVehicles] Respuesta recibida:', response);
            
            // Manejar respuesta con paginación o sin paginación (compatibilidad hacia atrás)
            var data = response.data || response;
            var pagination = response.pagination;
            
            console.log('[loadAllWorkshopVehicles] Datos extraídos:', Array.isArray(data) ? data.length : 'No es array', data);
            
            if (!Array.isArray(data)) {
                console.error('[loadAllWorkshopVehicles] Los datos no son un array:', data);
                data = [];
            }
            
            // Filtrar solo vehículos con ingreso registrado
            var workshopItems = (data || []).filter(function(ot) {
                var hasIngreso = ot.fecha_ingreso_recepcion != null;
                if (!hasIngreso) {
                    console.log('[loadAllWorkshopVehicles] OT sin fecha_ingreso_recepcion:', ot.id, ot.numero_ot);
                }
                return hasIngreso;
            });
            
            console.log('[loadAllWorkshopVehicles] Items con fecha_ingreso_recepcion:', workshopItems.length);
            
            // Ordenar por fecha_ingreso_recepcion (más reciente primero)
            workshopItems.sort(function(a, b) {
                var fechaA = a.fecha_ingreso_recepcion ? new Date(a.fecha_ingreso_recepcion).getTime() : 0;
                var fechaB = b.fecha_ingreso_recepcion ? new Date(b.fecha_ingreso_recepcion).getTime() : 0;
                // Orden descendente: más reciente primero
                return fechaB - fechaA;
            });
            
            // Actualizar el cache con los items filtrados y ordenados
            if (workshopItems.length > 0) {
                recepWorkshopCache = workshopItems;
                console.log('[loadAllWorkshopVehicles] Cache actualizado con', recepWorkshopCache.length, 'items (ordenados por fecha_ingreso_recepcion DESC)');
            }
            
            // Aplicar filtro de mecánico por nombre (del lado del cliente)
            if (recepVehiculosFiltros.mecanico) {
                var mecanicoLower = recepVehiculosFiltros.mecanico.toLowerCase();
                var beforeFilter = workshopItems.length;
                workshopItems = workshopItems.filter(function(ot) {
                    var mec = ot.mecanico || {};
                    return (mec.nombre_completo || '').toLowerCase().indexOf(mecanicoLower) !== -1;
                });
                console.log('[loadAllWorkshopVehicles] Después de filtrar por mecánico:', workshopItems.length, 'de', beforeFilter);
            }
            
            // Siempre aplicar paginación del lado del cliente porque filtramos por fecha_ingreso_recepcion
            // que el backend no puede filtrar directamente
            var total = workshopItems.length;
            var totalPages = Math.ceil(total / recepVehiculosLimit);
            
            console.log('[loadAllWorkshopVehicles] Paginación - Total:', total, 'Páginas:', totalPages, 'Página actual:', recepVehiculosPage);
            
            // Aplicar paginación del lado del cliente
            var startIndex = (recepVehiculosPage - 1) * recepVehiculosLimit;
            var endIndex = startIndex + recepVehiculosLimit;
            var paginatedItems = workshopItems.slice(startIndex, endIndex);
            
            console.log('[loadAllWorkshopVehicles] Items para renderizar (índices', startIndex, '-', endIndex, '):', paginatedItems.length);
            console.log('[loadAllWorkshopVehicles] Llamando renderWorkshopListAll con', paginatedItems.length, 'items');
            
            renderWorkshopListAll(paginatedItems);
            
            // Renderizar paginación
            if (typeof window.PaginationUtils !== 'undefined' && window.PaginationUtils.createPagination && paginationContainer) {
                var adjustedPagination = {
                    page: recepVehiculosPage,
                    limit: recepVehiculosLimit,
                    total: total,
                    totalPages: totalPages
                };
                console.log('[loadAllWorkshopVehicles] Renderizando paginación:', adjustedPagination);
                window.PaginationUtils.createPagination(paginationContainer, adjustedPagination, function(newPage) {
                    console.log('[loadAllWorkshopVehicles] Cambio de página a:', newPage);
                    loadAllWorkshopVehicles(newPage);
                });
            } else {
                console.log('[loadAllWorkshopVehicles] PaginationUtils no disponible o contenedor no encontrado');
                if (paginationContainer) {
                    paginationContainer.innerHTML = '';
                }
            }
        })
        .catch(function(err) {
            ErrorHandler.handleError(err, 'Cargar vehículos', {
                useFloatingNotification: true
            });
            container.innerHTML = '<div class="empty-state">Error al cargar vehículos.</div>';
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
        });
}

// Aplica los filtros de vehículos
function aplicarFiltrosVehiculos() {
    var fechaDesdeEl = qs('#vehiculosFiltroFechaDesde');
    var fechaHastaEl = qs('#vehiculosFiltroFechaHasta');
    var estadoEl = qs('#vehiculosFiltroEstado');
    var patenteEl = qs('#vehiculosFiltroPatente');
    var mecanicoEl = qs('#vehiculosFiltroMecanico');
    
    recepVehiculosFiltros.fechaDesde = fechaDesdeEl ? fechaDesdeEl.value.trim() : '';
    recepVehiculosFiltros.fechaHasta = fechaHastaEl ? fechaHastaEl.value.trim() : '';
    recepVehiculosFiltros.estado = estadoEl ? estadoEl.value.trim() : '';
    recepVehiculosFiltros.patente = patenteEl ? patenteEl.value.trim() : '';
    recepVehiculosFiltros.mecanico = mecanicoEl ? mecanicoEl.value.trim() : '';
    
    // Resetear a página 1 cuando se aplican filtros
    recepVehiculosPage = 1;
    
    // Recargar vehículos con los nuevos filtros
    loadAllWorkshopVehicles();
}

// Limpia los filtros de vehículos
function limpiarFiltrosVehiculos() {
    var fechaDesdeEl = qs('#vehiculosFiltroFechaDesde');
    var fechaHastaEl = qs('#vehiculosFiltroFechaHasta');
    var estadoEl = qs('#vehiculosFiltroEstado');
    var patenteEl = qs('#vehiculosFiltroPatente');
    var mecanicoEl = qs('#vehiculosFiltroMecanico');
    
    if (fechaDesdeEl) fechaDesdeEl.value = '';
    if (fechaHastaEl) fechaHastaEl.value = '';
    if (estadoEl) estadoEl.value = '';
    if (patenteEl) patenteEl.value = '';
    if (mecanicoEl) mecanicoEl.value = '';
    
    recepVehiculosFiltros = {
        fechaDesde: '',
        fechaHasta: '',
        estado: '',
        patente: '',
        mecanico: ''
    };
    
    // Resetear a página 1
    recepVehiculosPage = 1;
    
    // Recargar vehículos sin filtros
    loadAllWorkshopVehicles();
}

// Hacer funciones disponibles globalmente
window.aplicarFiltrosVehiculos = aplicarFiltrosVehiculos;
window.limpiarFiltrosVehiculos = limpiarFiltrosVehiculos;
function recepHandleWorkshopAction(id, action) {
    if (recepWorkshopMsg) {
        recepWorkshopMsg.classList.add('hidden');
    }
    var order = getOrderById(id);
    if (!order) {
        if (recepWorkshopMsg) flashStatus(recepWorkshopMsg, 'bad', '❌ No se encontró la orden seleccionada.');
        return;
    }
    var payloadStatus = null;
    var confirmText = '';
    if (action === 'handoff') {
        payloadStatus = 'EN_PROCESO';
        confirmText = '¿Confirmas que el vehículo fue entregado al taller?';
    } else if (action === 'ready') {
        payloadStatus = 'LISTO';
        confirmText = '¿Confirmas que el vehículo está listo para salida?';
    } else {
        return;
    }
    if (!window.confirm(confirmText)) {
        return;
    }
    bearerFetch(API_BASE + '/workorders/status', {
            method: 'PATCH',
            body: JSON.stringify({ id: order.id, status: payloadStatus })
        })
        .then(function(res) {
            if (!res.ok) {
                return res.json().then(function(err) {
                    throw new Error(err.message || 'No se pudo actualizar el estado');
                });
            }
            return res.json();
        })
        .then(function() {
            if (recepWorkshopMsg) {
                flashStatus(recepWorkshopMsg, 'ok', '✅ Estado actualizado correctamente.');
            }
            loadAgenda();
        })
        .catch(function(err) {
            if (recepWorkshopMsg) {
                flashStatus(recepWorkshopMsg, 'bad', '❌ ' + (err.message || 'Error al actualizar estado.'));
            } else {
                alert(err.message || 'Error al actualizar estado.');
            }
        });
}
window.recepHandleWorkshopAction = recepHandleWorkshopAction;

// Finalizar proceso de retiro
window.recepOpenFinalizeRetiro = function(otId) {
    var ot = getOrderById(Number(otId));
    if (!ot) {
        alert('No se encontró la orden.');
        return;
    }
    recepFillFinalizeRetiroModal(ot);
    openModal('modalFinalizeRetiro');
};

function recepFillFinalizeRetiroModal(ot) {
    var vehPatente = (ot.vehiculo && ot.vehiculo.patente) || ('Vehículo #' + ((ot.vehiculo && ot.vehiculo.id) || ''));
    var vehModelo = (ot.vehiculo && ot.vehiculo.modelo) ? ' · ' + ot.vehiculo.modelo : '';
    var vehText = vehPatente + vehModelo;
    var mechText = (ot.mecanico && ot.mecanico.nombre_completo) || 'Sin asignar';
    
    var otNumeroEl = document.getElementById('recep_finalize_ot_numero');
    if (otNumeroEl) otNumeroEl.textContent = ot.numero_ot || ('#' + ot.id);
    
    var vehEl = document.getElementById('recep_finalize_vehicle');
    if (vehEl) vehEl.textContent = vehText;
    
    var mecEl = document.getElementById('recep_finalize_mechanic');
    if (mecEl) mecEl.textContent = mechText;
    
    var idInput = document.getElementById('recep_finalize_ot_id');
    if (idInput) idInput.value = ot.id;
    
    recepFinalizeRetiroEvidencias = [];
    var filesInput = document.getElementById('recep_finalize_evidencias');
    if (filesInput) filesInput.value = '';
    updateFinalizeRetiroFilesList();
    
    var observaciones = document.getElementById('recep_finalize_observaciones');
    if (observaciones) observaciones.value = '';
    
    var password = document.getElementById('recep_finalize_password');
    if (password) password.value = '';
    
    var msg = document.getElementById('recepFinalizeRetiroMsg');
    if (msg) {
        msg.textContent = '';
        msg.classList.add('hidden');
    }
}

function updateFinalizeRetiroFilesList() {
    var list = document.getElementById('recep_finalize_evidencias_list');
    if (!list) return;
    if (!recepFinalizeRetiroEvidencias.length) {
        list.innerHTML = '';
        return;
    }
    list.innerHTML = recepFinalizeRetiroEvidencias.map(function(item, index) {
        return '<li>' + (item.name || 'Archivo ' + (index + 1)) + ' <button type="button" onclick="recepRemoveFinalizeRetiroFile(' + index + ')" style="margin-left: 10px; color: #dc3545; background: none; border: none; cursor: pointer;">✕</button></li>';
    }).join('');
}

window.recepRemoveFinalizeRetiroFile = function(index) {
    recepFinalizeRetiroEvidencias.splice(index, 1);
    updateFinalizeRetiroFilesList();
};

function handleFinalizeRetiroFilesChange(ev) {
    // Usar función centralizada de validaciones
    var validFiles = ValidationUtils.handleFileInputChange(ev, {
        fieldName: 'Evidencias de retiro',
        maxFiles: 10,
        onEmpty: function() {
            recepFinalizeRetiroEvidencias = [];
            updateFinalizeRetiroFilesList();
        },
        onClear: function() {
            recepFinalizeRetiroEvidencias = [];
            updateFinalizeRetiroFilesList();
        },
        allowEmpty: true
    });

    // Si hay error o no hay archivos válidos, salir
    if (!validFiles || validFiles.length === 0) {
        return;
    }

    // Procesar archivos válidos
    Promise.all(validFiles.map(function(file) {
        return fileToDataUrl(file).then(function(dataUrl) {
            return { dataUrl: dataUrl, name: file.name };
        });
    })).then(function(payload) {
        recepFinalizeRetiroEvidencias = payload;
        updateFinalizeRetiroFilesList();
    }).catch(function(err) {
        console.error(err);
        recepFinalizeRetiroEvidencias = [];
        updateFinalizeRetiroFilesList();
        var msg = document.getElementById('recepFinalizeRetiroMsg');
        flashStatus(msg, 'bad', '❌ No se pudieron procesar los archivos seleccionados.');
    });
}

function handleFinalizeRetiroSubmit(ev) {
    ev.preventDefault();
    console.log('handleFinalizeRetiroSubmit llamado');
    var idInput = document.getElementById('recep_finalize_ot_id');
    if (!idInput || !idInput.value) {
        console.error('No se encontró el ID de la OT');
        return;
    }
    console.log('OT ID:', idInput.value);
    
    var msg = document.getElementById('recepFinalizeRetiroMsg');
    if (msg) {
        msg.textContent = '';
        msg.classList.remove('ok', 'bad', 'warn');
        msg.classList.add('hidden');
    }
    
    var password = document.getElementById('recep_finalize_password');
    if (!password || !password.value) {
        console.error('Contraseña no ingresada');
        if (msg) {
            msg.textContent = '❌ Debes ingresar tu contraseña para confirmar.';
            msg.classList.remove('hidden');
            msg.classList.add('bad');
        }
        return;
    }
    
    var observaciones = document.getElementById('recep_finalize_observaciones');
    
    var payload = {
        password: password.value,
        evidencias: recepFinalizeRetiroEvidencias.map(function(item) { return item.dataUrl; }),
        observaciones: observaciones && observaciones.value ? observaciones.value.trim() : undefined
    };
    
    console.log('Enviando petición a:', API_BASE + '/workorders/' + idInput.value + '/finalize-retiro');
    
    // Mostrar loading en botón de submit
    var submitBtn = ev.target.querySelector('button[type="submit"]') || ev.target.querySelector('input[type="submit"]');
    if (submitBtn) {
        LoadingUtils.showButtonLoading(submitBtn, 'Finalizando retiro...');
    }
    
    bearerFetch(API_BASE + '/workorders/' + idInput.value + '/finalize-retiro', {
        method: 'POST',
        body: JSON.stringify(payload)
    }).then(function(res) {
        console.log('Respuesta recibida, status:', res.status);
        if (!res.ok) {
            return res.json().then(function(err) {
                console.error('Error del servidor:', err);
                throw new Error(err.message || 'No se pudo finalizar el proceso de retiro');
            });
        }
        return res.json();
    }).then(function(data) {
        // Ocultar loading
        if (submitBtn) {
            LoadingUtils.hideButtonLoading(submitBtn);
        }
        
        console.log('Proceso finalizado exitosamente:', data);
        // Mostrar mensaje de éxito antes de cerrar el modal
        if (msg) {
            msg.textContent = '✅ Proceso de retiro finalizado correctamente. El chofer puede retirar el vehículo.';
            msg.classList.remove('hidden', 'bad', 'warn');
            msg.classList.add('ok');
        }
        // Cerrar el modal inmediatamente
        closeModal('modalFinalizeRetiro');
        recepFinalizeRetiroEvidencias = [];
        updateFinalizeRetiroFilesList();
        // Forzar recarga de la agenda después de un pequeño delay para asegurar que el backend haya actualizado
        setTimeout(function() {
            console.log('Recargando agenda después de finalizar retiro...');
            loadAgenda();
        }, 500);
    }).catch(function(error) {
        // Ocultar loading en caso de error
        if (submitBtn) {
            LoadingUtils.hideButtonLoading(submitBtn);
        }
        
        ErrorHandler.handleError(error, 'Finalizar retiro', {
            targetElement: msg,
            useFlashMessage: true,
            useAlert: !msg
        });
    });
}

function fileToDataUrl(file) {
    // Usar FileUtils para comprimir imágenes antes de convertir a base64
    return FileUtils.fileToBase64(file, true);
}

function updateCheckinFilesList() {
    var list = document.getElementById('recep_checkin_evidencias_list');
    if (!list) return;
    if (!recepCheckinEvidencias.length) {
        list.innerHTML = '';
        return;
    }
    list.innerHTML = recepCheckinEvidencias.map(function(item, index) {
        return '<li>Foto ' + (index + 1) + ' · ' + (item.name || 'captura') + '</li>';
    }).join('');
}

function handleCheckinFilesChange(ev) {
    // Usar función centralizada de validaciones
    var validFiles = ValidationUtils.handleFileInputChange(ev, {
        fieldName: 'Evidencias de check-in',
        maxFiles: 3,
        onEmpty: function() {
            recepCheckinEvidencias = [];
            updateCheckinFilesList();
        },
        onClear: function() {
            recepCheckinEvidencias = [];
            updateCheckinFilesList();
        },
        allowEmpty: true
    });

    // Si hay error o no hay archivos válidos, salir
    if (!validFiles || validFiles.length === 0) {
        return;
    }

    // Procesar archivos válidos
    Promise.all(validFiles.map(function(file) {
        return fileToDataUrl(file).then(function(dataUrl) {
            return { dataUrl: dataUrl, name: file.name };
        });
    })).then(function(payload) {
        recepCheckinEvidencias = payload;
        updateCheckinFilesList();
    }).catch(function(err) {
        console.error(err);
        recepCheckinEvidencias = [];
        updateCheckinFilesList();
        var msg = document.getElementById('recepCheckinMsg');
        flashStatus(msg, 'bad', '❌ No se pudieron procesar los archivos seleccionados.');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initStatsPlaceholders();

    if (typeof window.initAuth === 'function') {
        window.initAuth('recepcionista')
            .then(function(user) {
                currentUserRecep = user; // Guardar usuario para usar en el historial
                var userNameEl = document.getElementById('userName');
                if (userNameEl && user.nombre_completo) {
                    userNameEl.textContent = user.nombre_completo;
                }
                
                // Inicializar NotificationsManager si está disponible
                if (typeof NotificationsManager !== 'undefined') {
                    NotificationsManager.init(user.id, function(entityId, entityType) {
                        // Callback cuando se hace clic en una notificación
                        if (entityType === 'ORDEN_TRABAJO' && entityId) {
                            // Recargar agenda para mostrar la OT
                            loadAgenda();
                        }
                    });
                    
                    // Suscribirse a notificaciones de Socket.IO si el socket está disponible
                    if (socket && typeof NotificationsManager.subscribeToSocket === 'function') {
                        NotificationsManager.subscribeToSocket(
                            socket,
                            'recepcionista:notification',
                            function(data) {
                                // Filtrar notificaciones para este usuario específico
                                return data.recepcionistaId === user.id;
                            }
                        );
                    }
                }
                
                return loadAgenda();
            })
            .catch(function(err) {
                console.error('Error de autenticación:', err);
            });
    }

    var btnRefresh = document.getElementById('btnAgendaRefresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
            loadAgenda();
        });
    }

    // Navegación por tabs
    var mainNav = document.getElementById('mainNav');
    if (mainNav) {
        mainNav.addEventListener('click', function(ev) {
            var a = ev.target.closest('a');
            if (!a || !a.hasAttribute('data-tab')) return;
            ev.preventDefault();
            var tabName = a.getAttribute('data-tab');
            switchTab(tabName);
        });
    }

    var form = document.getElementById('recepCheckinForm');
    if (form) {
        form.addEventListener('submit', handleCheckinSubmit);
    }

    recepWorkshopMsg = document.getElementById('recepWorkshopMsg');

    var evidenciasInput = document.getElementById('recep_checkin_evidencias');
    if (evidenciasInput) {
        evidenciasInput.addEventListener('change', handleCheckinFilesChange);
    }

    var finalizeRetiroForm = document.getElementById('recepFinalizeRetiroForm');
    if (finalizeRetiroForm) {
        console.log('Formulario de finalizar retiro encontrado, agregando event listener');
        finalizeRetiroForm.addEventListener('submit', handleFinalizeRetiroSubmit);
    } else {
        console.warn('Formulario recepFinalizeRetiroForm no encontrado');
    }

    var finalizeRetiroEvidenciasInput = document.getElementById('recep_finalize_evidencias');
    if (finalizeRetiroEvidenciasInput) {
        finalizeRetiroEvidenciasInput.addEventListener('change', handleFinalizeRetiroFilesChange);
    }

    // Agregar debounce a búsqueda de agenda
    var agendaBusquedaInput = qs('#agendaBusqueda');
    if (agendaBusquedaInput && typeof window.FilterUtils !== 'undefined') {
        var debouncedBusqueda = window.FilterUtils.debounce(function() {
            aplicarFiltrosAgenda();
        }, 300);
        agendaBusquedaInput.addEventListener('input', debouncedBusqueda);
    }

    var socket = null;
    if (window.io) {
        socket = window.io('/', { path: '/socket.io/' });
        socket.on('connect', function() {
            console.log('Socket.IO conectado para recepcionista');
            socket.emit('subscribeReception');
        });
        socket.on('reception:refresh', function() {
            console.log('Evento reception:refresh recibido, recargando agenda');
            loadAgenda();
        });
        socket.on('vehiculo:refresh', function(payload) {
            console.log('Evento vehiculo:refresh recibido:', payload);
            loadAgenda();
        });
        socket.on('workorders:refresh', function() {
            console.log('Evento workorders:refresh recibido, recargando agenda y vehículos en taller');
            loadAgenda();
            // También recargar vehículos en taller si estamos en esa pestaña
            var vehiculosTab = document.getElementById('tab-vehiculos');
            if (vehiculosTab && vehiculosTab.classList.contains('active')) {
                loadAllWorkshopVehicles();
            } else {
                // Recargar también la lista de workshop en la pestaña inicio
                loadAllWorkshopVehicles(1);
            }
        });
    }
});

// Función para cambiar de tab
function switchTab(name) {
    // Ocultar todas las secciones
    var sections = document.querySelectorAll('.tab');
    for (var i = 0; i < sections.length; i++) {
        sections[i].classList.remove('active');
        sections[i].style.display = 'none';
    }
    
    // Mostrar la sección seleccionada
    var target = document.getElementById('tab-' + name);
    if (target) {
        target.classList.add('active');
        target.style.display = 'block';
    }
    
    // Actualizar navegación activa
    var links = document.querySelectorAll('.nav-menu a');
    for (var j = 0; j < links.length; j++) {
        links[j].classList.remove('active');
    }
    var link = document.querySelector('.nav-menu a[data-tab="' + name + '"]');
    if (link) link.classList.add('active');
    
    // Cargar datos si es necesario
    if (name === 'vehiculos') {
        loadAllWorkshopVehicles(1);
    } else if (name === 'entregas') {
        initEntregasHistory();
    }
}

// Hacer switchTab disponible globalmente
window.switchTab = switchTab;

// Función para inicializar el historial de entregas
function initEntregasHistory() {
    console.log('[Entregas] Inicializando historial de entregas...');
    
    var container = document.getElementById('entregas-container');
    if (!container) {
        console.error('[Entregas] Contenedor no encontrado');
        return;
    }
    
    // Si ya está inicializado, solo recargar
    if (entregasHistoryViewer) {
        console.log('[Entregas] Historial ya inicializado, recargando...');
        entregasHistoryViewer.load();
        return;
    }
    
    // Verificar que initHistoryViewer esté disponible
    if (typeof window.initHistoryViewer === 'undefined') {
        console.error('[Entregas] initHistoryViewer no está disponible');
        container.innerHTML = '<div class="empty-state">Error: Módulo de historial no disponible</div>';
        return;
    }
    
    try {
        var userRoles = currentUserRecep ? (currentUserRecep.roles || [currentUserRecep.rol]) : ['recepcionista'];
        
        entregasHistoryViewer = window.initHistoryViewer({
            container: container,
            bearerFetch: bearerFetch,
            userRoles: userRoles,
            initialEntityType: window.HistoryViewerEntityTypes ? window.HistoryViewerEntityTypes.ENTREGAS_VEHICULOS : 'entregas_vehiculos',
            pageSize: 20
        });
        
        console.log('[Entregas] Historial inicializado correctamente:', entregasHistoryViewer);
    } catch (error) {
        console.error('[Entregas] Error al inicializar historial:', error);
        container.innerHTML = '<div class="empty-state">Error al cargar el historial de entregas</div>';
    }
}

// Función para actualizar el historial de entregas (usada por el botón de actualizar)
function refreshEntregasHistory() {
    if (entregasHistoryViewer && typeof entregasHistoryViewer.load === 'function') {
        entregasHistoryViewer.load();
    } else {
        initEntregasHistory();
    }
}

// Hacer funciones disponibles globalmente
window.refreshEntregasHistory = refreshEntregasHistory;