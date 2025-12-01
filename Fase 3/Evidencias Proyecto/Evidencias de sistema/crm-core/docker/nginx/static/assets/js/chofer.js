/**
 * ========================================================
 * DASHBOARD CHOFER - Script Principal
 * ========================================================
 * 
 * REQUIERE: assets/js/auth.js (debe cargarse antes)
 */

// === API endpoints ===
var API = {
    mecanicosDisponibles: '/api/workorders/support/mechanics',
    vehiculosIngresados: '/api/workorders/support/vehicles',
    crearWorkOrder: '/api/workorders', // POST (chofer)
    vehiculoAsignado: '/api/vehicles/my/assigned',
    vehiculoHistorial: '/api/vehicles/my/history',
    crearSolicitud: '/api/solicitudes'
};

const API_BASE = '/api';

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
    var map = {
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

function flashMainStatus(kind, text) {
    var el = document.getElementById('mainStatus');
    if (!el) return;

    // limpia todas las clases y re-aplica base + variante
    el.className = '';                 // borra todo
    el.classList.add('status');        // base
    if (kind === 'ok' || kind === 'bad' || kind === 'warn') {
        el.classList.add(kind);        // color según estado
    }

    // texto del mensaje
    el.textContent = text;

    // mostrar con animación (CSS usa .show)
    el.classList.add('show');

    // limpiar timeout anterior si existía
    if (el._hideTimeout) {
        clearTimeout(el._hideTimeout);
    }

    // ocultar automáticamente
    el._hideTimeout = setTimeout(function () {
        el.classList.remove('show');
    }, 4000);
}

var estadoVehiculoActual = null;
var imagenesSolicitud = [];
var socket = typeof window.io === 'function' ? window.io('/', { path: '/socket.io/' }) : null;
if (socket) {
    socket.on('vehiculo:refresh', function (payload) {
        var currentId = estadoVehiculoActual && estadoVehiculoActual.vehiculo ? estadoVehiculoActual.vehiculo.id : null;
        if (!payload || !payload.vehiculoId || !currentId || payload.vehiculoId === currentId) {
            cargarEstadoVehiculo().then(function(resp) {
                if (resp && resp.vehiculo) {
                    actualizarBotonNuevaSolicitud(resp.vehiculo.estado, resp.pendingSolicitud);
                }
            });
        }
    });
    socket.on('solicitud:refresh', function () {
        cargarEstadoVehiculo().then(function(resp) {
            if (resp && resp.vehiculo) {
                actualizarBotonNuevaSolicitud(resp.vehiculo.estado, resp.pendingSolicitud);
            }
        });
    });
    socket.on('workorders:refresh', function () {
        cargarEstadoVehiculo().then(function(resp) {
            if (resp && resp.vehiculo) {
                actualizarBotonNuevaSolicitud(resp.vehiculo.estado, resp.pendingSolicitud);
            }
        });
    });
}

// Header auth si usas JWT en localStorage
function apiHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var tok;

    // Intentar usar auth.js si está disponible
    if (typeof window.authUtils !== 'undefined' && window.authUtils.getToken) {
        tok = window.authUtils.getToken();
    } else {
        // Fallback: usar localStorage directamente
        tok = localStorage.getItem('crm.token') || localStorage.getItem('token');
    }

    if (tok) h['Authorization'] = 'Bearer ' + tok;
    return h;
}

// Helpers
function qs(s, r) { return (r || document).querySelector(s); }

function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

function setText(target, value, fallback) {
    var el = typeof target === 'string' ? qs(target) : target;
    if (!el) return;
    var text = value;
    if (text === undefined || text === null || text === '') {
        text = fallback !== undefined ? fallback : '—';
    }
    el.textContent = text;
}

function sanitizePhone(value) {
    if (!value && value !== 0) return '';
    var raw = String(value).trim();
    var keepPlus = raw.startsWith('+') ? '+' : '';
    var digits = raw.replace(/[^\d]/g, '');
    return digits ? keepPlus + digits : '';
}

function setContactLink(target, value) {
    var el = typeof target === 'string' ? qs(target) : target;
    if (!el) return '';
    var label = value && String(value).trim() ? String(value).trim() : 'Sin contacto';
    el.textContent = label;
    el.classList.remove('is-disabled');
    el.removeAttribute('aria-disabled');
    var sanitized = sanitizePhone(value);
    if (sanitized) {
        el.setAttribute('href', 'tel:' + sanitized);
    } else {
        el.removeAttribute('href');
        el.classList.add('is-disabled');
        el.setAttribute('aria-disabled', 'true');
    }
    return sanitized;
}

var STATUS_CLASS_MAP = {
    'PENDIENTE': 'status-pendiente',
    'EN_PROCESO': 'status-proceso',
    'EN_TALLER': 'status-taller',
    'ESPERA_REPUESTOS': 'status-espera',
    'LISTO': 'status-completado',
    'APROBADO': 'status-completado',
    'COMPLETADO': 'status-completado',
    'OPERATIVO': 'status-operativo',
    'MANTENCION': 'status-mantencion',
    'INACTIVO': 'status-inactivo',
    'EN_REVISION': 'status-revision',
    'STANDBY': 'status-standby',
    'CITA_MANTENCION': 'status-cita'
};
var STATUS_DETAIL_STATES = ['CITA_MANTENCION', 'EN_TALLER', 'MANTENCION'];
var STATUS_STATE_ONLY = ['OPERATIVO', 'COMPLETADO', 'EN_REVISION', 'STANDBY'];

function formatEstadoLabel(value) {
    if (!value && value !== 0) return 'Sin estado';
    var normalized = String(value).trim().toUpperCase();
    var map = {
        'EN_REVISION': 'En Revisión',
        'CITA_MANTENCION': 'Cita Mantención',
        'STANDBY': 'Standby'
    };
    if (map[normalized]) return map[normalized];
    return String(value)
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, function (chr) { return chr.toUpperCase(); });
}

function badgeClassForStatus(value) {
    var key = (value && String(value).trim().toUpperCase()) || '';
    return STATUS_CLASS_MAP[key] || 'status-pendiente';
}

function updateStatusBadge(target, status) {
    var el = typeof target === 'string' ? qs(target) : target;
    if (!el) return;
    var cls = 'status-badge ' + badgeClassForStatus(status);
    el.className = cls;
    el.textContent = formatEstadoLabel(status);
}

function toggleVehicleDetails(status) {
    var normalized = (status || '').toUpperCase();
    var showDetails = STATUS_DETAIL_STATES.includes(normalized) || !STATUS_STATE_ONLY.includes(normalized);
    qsa('[data-vehicle-section="details"]').forEach(function (el) {
        if (!el) return;
        el.hidden = !showDetails;
        if (el.classList) {
            el.classList.toggle('is-hidden', !showDetails);
        }
    });
}

/**
 * Actualizar el estado del botón "Nueva Solicitud" basado en el estado del vehículo y solicitudes pendientes
 * Esta función se puede llamar desde múltiples lugares (mostrarVehiculo, socket.io, etc.)
 */
function actualizarBotonNuevaSolicitud(estadoVehiculo, solicitudPendiente) {
    var btnNuevaSolicitud = qs('#btnNuevaSolicitud');
    if (!btnNuevaSolicitud) {
        console.warn('[actualizarBotonNuevaSolicitud] Botón #btnNuevaSolicitud no encontrado');
        return;
    }
    
    var estadoVehUpper = (estadoVehiculo || '').toUpperCase();
    var tieneSolicitudPendiente = !!(solicitudPendiente && solicitudPendiente.id);
    var vehiculoOperativo = estadoVehUpper === 'OPERATIVO';
    
    // Deshabilitar si hay solicitud pendiente o vehículo no está operativo
    var debeDeshabilitar = tieneSolicitudPendiente || !vehiculoOperativo;
    btnNuevaSolicitud.disabled = debeDeshabilitar;
    
    if (debeDeshabilitar) {
        if (tieneSolicitudPendiente) {
            btnNuevaSolicitud.title = 'Ya tienes una solicitud pendiente. Espera a que sea procesada.';
        } else {
            btnNuevaSolicitud.title = 'El vehículo debe estar operativo para crear una nueva solicitud.';
        }
    } else {
        btnNuevaSolicitud.title = '';
    }
    
    console.log('[actualizarBotonNuevaSolicitud] Estado del botón actualizado:', {
        disabled: debeDeshabilitar,
        tieneSolicitudPendiente: tieneSolicitudPendiente,
        vehiculoOperativo: vehiculoOperativo,
        estadoVehiculo: estadoVehiculo
    });
}

function toggleSection(target, visible) {
    var el = typeof target === 'string' ? qs(target) : target;
    if (!el) return;
    el.hidden = !visible;
    if (el.classList) {
        el.classList.toggle('is-hidden', !visible);
    }
}

function formatFechaSegura(value) {
    return value ? formatFecha(value) : '—';
}

function openModal(id) {
    console.log('[openModal] Llamado con id:', id);

    if (typeof id === 'string') {
        var m = qs('#' + id);
        console.log('[openModal] Modal encontrado por ID:', m);
        if (m) {
            m.setAttribute('aria-hidden', 'false');
            m.style.display = 'flex';
            console.log('[openModal] Modal abierto:', id, 'Display:', m.style.display);
        } else {
            console.error('[openModal] Modal no encontrado con ID:', id);
        }
    } else {
        var m = qs('#modalSolicitud');
        console.log('[openModal] Modal de solicitud encontrado:', m);
        if (m) {
            m.setAttribute('aria-hidden', 'false');
            m.style.display = 'flex';
            console.log('[openModal] Modal de solicitud abierto, Display:', m.style.display);
        } else {
            console.error('[openModal] Modal de solicitud no encontrado en el DOM');
        }
    }
}

function closeModal(id) {
    var m;
    if (typeof id === 'string') {
        m = qs('#' + id);
    } else if (id && id.target) {
        // Si se llama desde un evento click, buscar el modal padre
        var clickedEl = id.target;
        m = clickedEl.closest('.modal');
        if (!m) {
            // Si no se encuentra, buscar por el elemento con data-close
            var closeEl = clickedEl.closest('[data-close]') || clickedEl;
            m = closeEl.closest('.modal');
        }
    } else {
        m = qs('#modalSolicitud');
    }

    if (m) {
        m.setAttribute('aria-hidden', 'true');
        m.style.display = 'none';
        // Si es el modal de solicitud, resetear el formulario
        if (m.id === 'modalSolicitud') {
            resetNuevaSolicitudForm();
        }
    }
}

function fetchJson(url) {
    return fetch(url, { headers: apiHeaders(), credentials: 'include' })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); });
}

function resetNuevaSolicitudForm() {
    imagenesSolicitud = [];
    var form = qs('#formSolicitud');
    if (form) form.reset();
    actualizarResumenEvidencia();
}

function abrirNuevaSolicitud(ev) {
    console.log('[abrirNuevaSolicitud] Iniciando función', { ev, estadoVehiculoActual });

    if (ev && typeof ev.preventDefault === 'function') {
        ev.preventDefault();
    }

    console.log('[abrirNuevaSolicitud] Verificando vehículo asignado...');
    if (!estadoVehiculoActual || !estadoVehiculoActual.vehiculo) {
        console.warn('[abrirNuevaSolicitud] No hay vehículo asignado', { estadoVehiculoActual });
        alert('Necesitas un vehículo asignado para generar una solicitud.');
        return;
    }

    console.log('[abrirNuevaSolicitud] Vehículo encontrado:', estadoVehiculoActual.vehiculo);
    var vehiculo = estadoVehiculoActual.vehiculo;
    var resumen = qs('#vehiculoSolicitudResumen');
    console.log('[abrirNuevaSolicitud] Elemento resumen encontrado:', resumen);

    if (resumen) {
        var etiqueta = vehiculo.patente
            ? vehiculo.patente + ' — ' + [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ')
            : 'Vehículo asignado #' + vehiculo.id;
        resumen.textContent = etiqueta.trim();
        console.log('[abrirNuevaSolicitud] Resumen actualizado:', etiqueta);
    }

    console.log('[abrirNuevaSolicitud] Reseteando formulario...');
    resetNuevaSolicitudForm();

    console.log('[abrirNuevaSolicitud] Abriendo modal...');
    openModal();

    var modal = qs('#modalSolicitud');
    console.log('[abrirNuevaSolicitud] Modal encontrado:', modal, 'Display:', modal ? modal.style.display : 'N/A');
}

function leerArchivoComoBase64(file) {
    // Usar FileUtils para comprimir imágenes antes de convertir a base64
    return FileUtils.fileToBase64(file, true);
}

function actualizarResumenEvidencia(files) {
    var resumen = qs('#evidenciaResumen');
    if (!resumen) return;
    if (!imagenesSolicitud.length) {
        resumen.textContent = 'Debes adjuntar al menos una imagen.';
        return;
    }
    var nombres = (files || []).map(function (f) { return f.name; }).filter(Boolean);
    if (!nombres.length) {
        resumen.textContent = imagenesSolicitud.length + ' imagen(es) listas para enviar.';
    } else {
        resumen.textContent = nombres.join(', ');
    }
}

function handleEvidenciaChange(ev) {
    // Usar función centralizada de validaciones
    var validFiles = ValidationUtils.handleFileInputChange(ev, {
        fieldName: 'Evidencias',
        maxFiles: 5,
        onEmpty: function() {
            imagenesSolicitud = [];
            actualizarResumenEvidencia();
        },
        onClear: function() {
            imagenesSolicitud = [];
            actualizarResumenEvidencia();
        },
        allowEmpty: true
    });

    // Si hay error o no hay archivos válidos, salir
    if (!validFiles || validFiles.length === 0) {
        return;
    }

    // Procesar archivos válidos
    Promise.all(validFiles.map(leerArchivoComoBase64))
        .then(function (resultados) {
            imagenesSolicitud = resultados.filter(Boolean);
            actualizarResumenEvidencia(validFiles);
        })
        .catch(function (err) {
            console.error('Error al leer evidencias', err);
            imagenesSolicitud = [];
            actualizarResumenEvidencia();
            ErrorHandler.handleError(err, 'Procesar evidencias', {
                useAlert: true
            });
        });
}

function crearSolicitud(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!estadoVehiculoActual || !estadoVehiculoActual.vehiculo) {
        flashMainStatus('bad', '❌ No se detectó un vehículo asignado para generar la solicitud.');
        return;
    }

    // LOGGING: Verificar datos del vehículo antes de enviar
    var vehiculo = estadoVehiculoActual.vehiculo;
    console.log('[CHOFER - crearSolicitud] ===== INICIO CREACIÓN SOLICITUD =====');
    console.log('[CHOFER - crearSolicitud] Vehículo detectado:', {
        id: vehiculo.id,
        patente: vehiculo.patente,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        estado: vehiculo.estado,
        vehiculoCompleto: vehiculo
    });

    var descEl = qs('#descripcion');
    var descripcion = descEl && typeof descEl.value === 'string' ? descEl.value.trim() : '';
    var emergencia = !!(qs('#chkEmergencia') && qs('#chkEmergencia').checked);

    if (!descripcion) {
        flashMainStatus('bad', '❌ Debes ingresar una descripción del problema.');
        return;
    }
    if (!imagenesSolicitud.length) {
        flashMainStatus('bad', '❌ Adjunta al menos una imagen como evidencia.');
        return;
    }

    var payload = {
        descripcion: descripcion,
        emergencia: emergencia,
        imagenes: imagenesSolicitud.slice(0, 5)
    };

    console.log('[CHOFER - crearSolicitud] Payload a enviar:', {
        descripcion: descripcion.substring(0, 50) + '...',
        emergencia: emergencia,
        numImagenes: payload.imagenes.length,
        vehiculoId: vehiculo.id,
        vehiculoPatente: vehiculo.patente
    });

    var btn = qs('#btnEnviarSolicitud');
    if (btn) {
        LoadingUtils.showButtonLoading(btn, 'Enviando...');
    }

    console.log('[CHOFER - crearSolicitud] Enviando solicitud a:', API.crearSolicitud);

    bearerFetch(API.crearSolicitud, {
        method: 'POST',
        body: JSON.stringify(payload)
    })
        .then(function (res) {
            console.log('[CHOFER - crearSolicitud] Respuesta HTTP recibida:', {
                status: res.status,
                statusText: res.statusText,
                ok: res.ok
            });
            if (!res.ok) {
                // Intentar obtener el mensaje de error del backend
                return res.json().then(function (errorData) {
                    throw new Error(errorData.message || 'Error al crear solicitud');
                }).catch(function () {
                    throw new Error('HTTP ' + res.status);
                });
            }
            return res.json();
        })
        .then(function (resp) {
            console.log('[CHOFER - crearSolicitud] Solicitud creada exitosamente:', {
                id: resp.id,
                numero_solicitud: resp.numero_solicitud,
                estado: resp.estado,
                tipo_solicitud: resp.tipo_solicitud,
                respuestaCompleta: resp
            });
            console.log('[CHOFER - crearSolicitud] ===== FIN CREACIÓN SOLICITUD =====');
            closeModal();
            resetNuevaSolicitudForm();

            var numero = resp.numero_solicitud || ('#' + resp.id);
            var estado = resp.estado || 'PENDIENTE';
            flashMainStatus('ok', '✅ Solicitud enviada: ' + numero + ' (estado ' + estado + ')');
            
            setTimeout(function() {
                cargarEstadoVehiculo();
            }, 500);
        })
        .catch(function (err) {
            console.error('[CHOFER - crearSolicitud] ERROR al crear solicitud:', err);
            console.error('[CHOFER - crearSolicitud] Vehículo que se intentó usar:', {
                id: vehiculo.id,
                patente: vehiculo.patente
            });
            console.log('[CHOFER - crearSolicitud] ===== FIN CREACIÓN SOLICITUD (ERROR) =====');

            // Mostrar el mensaje de error del backend si está disponible
            var mensajeError = err && err.message ? err.message : 'No se pudo crear la solicitud. Intenta nuevamente en unos momentos.';
            flashMainStatus('bad', '❌ ' + mensajeError);
            
            // Recargar estado del vehículo para actualizar el botón
            setTimeout(function() {
                cargarEstadoVehiculo();
            }, 500);
        })
        .finally(function () {
            if (btn) {
                LoadingUtils.hideButtonLoading(btn);
            }
        });
}

// Timeline
function appendTimeline(item) {
    var tl = qs('#timeline');
    if (!tl) return;
    var div = document.createElement('div');
    div.className = 'timeline-item';
    div.innerHTML =
        '<div class="timeline-content">' +
        '<strong>' + (item.titulo || 'Evento') + '</strong>' +
        '<p>' + (item.detalle || '') + '</p>' +
        '<div class="timeline-date">' + formatFecha(item.fecha || new Date()) + '</div>' +
        '</div>';
    if (tl.firstChild) tl.insertBefore(div, tl.firstChild);
    else tl.appendChild(div);
}

function renderTimeline(items, emptyMessage) {
    var tl = qs('#timeline');
    if (!tl) return;
    tl.innerHTML = '';
    if (!items || !items.length) {
        var empty = document.createElement('div');
        empty.className = 'timeline-empty';
        empty.textContent = emptyMessage || 'Sin eventos registrados';
        tl.appendChild(empty);
        return;
    }
    items
        .slice()
        .sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); })
        .forEach(appendTimeline);
}

function buildVehiculoEvento(vehiculo, ot, solicitudPendiente) {
    if (!vehiculo || !vehiculo.ultima_novedad) return null;
    
    var fechaNovedad = vehiculo.ultima_novedad_fecha ? new Date(vehiculo.ultima_novedad_fecha) : null;
    
    // Esto evita mostrar eventos de OTs anteriores cuando hay una OT nueva
    if (ot && ot.fechas && ot.fechas.apertura) {
        var fechaOtApertura = new Date(ot.fechas.apertura);
        
        // Si la novedad es más antigua que la apertura de la OT, no mostrarla
        if (fechaNovedad && fechaNovedad < fechaOtApertura) {
            console.log('[buildVehiculoEvento] Omitiendo ultima_novedad porque hay una OT más reciente', {
                ultima_novedad: vehiculo.ultima_novedad,
                fecha_novedad: fechaNovedad,
                fecha_ot_apertura: fechaOtApertura,
                ot_numero: ot.numero || ot.numero_ot
            });
            return null;
        }
    }
    
    // Esto evita mostrar eventos de OTs anteriores cuando hay una solicitud nueva
    if (solicitudPendiente && solicitudPendiente.fecha_creacion) {
        var fechaSolicitud = new Date(solicitudPendiente.fecha_creacion);
        
        // Si la novedad es más antigua que la creación de la solicitud, no mostrarla
        if (fechaNovedad && fechaNovedad < fechaSolicitud) {
            console.log('[buildVehiculoEvento] Omitiendo ultima_novedad porque hay una solicitud más reciente', {
                ultima_novedad: vehiculo.ultima_novedad,
                fecha_novedad: fechaNovedad,
                fecha_solicitud: fechaSolicitud,
                solicitud_numero: solicitudPendiente.numero_solicitud || solicitudPendiente.id
            });
            return null;
        }
    }
    
    var fecha = fechaNovedad || new Date();
    return {
        titulo: vehiculo.ultima_novedad,
        detalle: vehiculo.ultima_novedad_detalle || '',
        fecha: fecha
    };
}

function renderTimelineFromOrder(ot, estadoActual, extraEvent) {
    if (!ot) {
        if (extraEvent) {
            renderTimeline([extraEvent], extraEvent.titulo);
        } else {
            renderTimeline([], 'Aún no hay órdenes registradas para tu vehículo.');
        }
        return;
    }

    // Logging para debugging
    console.log('[renderTimelineFromOrder] OT recibida:', {
        id: ot.id,
        numero: ot.numero || ot.numero_ot,
        estado: ot.estado,
        fechas: ot.fechas,
        mecanico: ot.mecanico ? { id: ot.mecanico.id, nombre: ot.mecanico.nombre } : null
    });

    var events = [];
    var numero = ot.numero || ot.numero_ot || ('#' + ot.id);
    var estadoOt = (ot.estado || '').toUpperCase();

    console.log('[renderTimelineFromOrder] OT recibida:', {
        id: ot.id,
        numero: numero,
        estado: estadoOt,
        fechas: ot.fechas,
        mecanico: ot.mecanico ? { id: ot.mecanico.id, nombre: ot.mecanico.nombre } : null
    });

    // Helper para verificar si una fecha es válida (no null, no undefined, no string vacío)
    function esFechaValida(fecha) {
        return fecha !== null && fecha !== undefined && fecha !== '' && fecha !== 'null' && fecha !== 'undefined';
    }

    // OT creada - siempre se muestra si existe la fecha de apertura
    if (ot.fechas && esFechaValida(ot.fechas.apertura)) {
        events.push({ titulo: 'OT creada', detalle: 'Ingreso al taller ' + numero, fecha: ot.fechas.apertura });
        console.log('[renderTimelineFromOrder] ✅ Agregado evento: OT creada');
    }

    // Asignación - solo si la OT ha sido asignada (estado >= EN_PROCESO o tiene mecánico asignado)
    // IMPORTANTE: Si la OT está en PENDIENTE, NO mostrar asignación aunque tenga fecha
    if (ot.fechas && esFechaValida(ot.fechas.asignacion) && estadoOt !== 'PENDIENTE') {
        var debeMostrarAsignacion = (
            estadoOt === 'EN_PROCESO' ||
            estadoOt === 'ESPERA_REPUESTOS' ||
            estadoOt === 'LISTO' ||
            estadoOt === 'APROBADO' ||
            estadoOt === 'COMPLETADO' ||
            (ot.mecanico && ot.mecanico.id)
        );

        if (debeMostrarAsignacion) {
            var detalleAsignacion = ot.mecanico && ot.mecanico.nombre
                ? 'Asignado a ' + ot.mecanico.nombre
                : 'Pendiente de mecánico';
            events.push({ titulo: 'Asignación', detalle: detalleAsignacion, fecha: ot.fechas.asignacion });
            console.log('[renderTimelineFromOrder] ✅ Agregado evento: Asignación');
        } else {
            console.log('[renderTimelineFromOrder] ❌ Omitido evento: Asignación (estado:', estadoOt, ', tiene mecánico:', !!(ot.mecanico && ot.mecanico.id), ')');
        }
    } else if (ot.fechas && esFechaValida(ot.fechas.asignacion) && estadoOt === 'PENDIENTE') {
        console.log('[renderTimelineFromOrder] ❌ Omitido evento: Asignación (OT en estado PENDIENTE, no debe mostrarse)');
    }

    // Inicio de reparación - solo si la OT está en proceso o más avanzada
    // IMPORTANTE: Si la OT está en PENDIENTE, NO mostrar inicio aunque tenga fecha
    if (ot.fechas && esFechaValida(ot.fechas.inicio) && estadoOt !== 'PENDIENTE') {
        var debeMostrarInicio = (
            estadoOt === 'EN_PROCESO' ||
            estadoOt === 'ESPERA_REPUESTOS' ||
            estadoOt === 'LISTO' ||
            estadoOt === 'APROBADO' ||
            estadoOt === 'COMPLETADO'
        );

        if (debeMostrarInicio) {
            events.push({ titulo: 'Inicio de reparación', detalle: 'Trabajo en progreso', fecha: ot.fechas.inicio });
            console.log('[renderTimelineFromOrder] ✅ Agregado evento: Inicio de reparación');
        } else {
            console.log('[renderTimelineFromOrder] ❌ Omitido evento: Inicio de reparación (estado:', estadoOt, ')');
        }
    } else if (ot.fechas && esFechaValida(ot.fechas.inicio) && estadoOt === 'PENDIENTE') {
        console.log('[renderTimelineFromOrder] ❌ Omitido evento: Inicio de reparación (OT en estado PENDIENTE, no debe mostrarse)');
    }

    // Entrega estimada - NO se muestra en el timeline (es una fecha futura, no un evento ocurrido)
    // Las fechas estimadas no son eventos que hayan ocurrido, son proyecciones
    if (ot.fechas && esFechaValida(ot.fechas.estimada)) {
        console.log('[renderTimelineFromOrder] ❌ Omitido evento: Entrega estimada (es una fecha futura, no un evento ocurrido)');
    }

    // Trabajo finalizado - solo si la OT está LISTO, APROBADO o COMPLETADO
    // IMPORTANTE: Si la OT está en PENDIENTE o EN_PROCESO, NO mostrar finalización aunque tenga fecha
    if (ot.fechas && esFechaValida(ot.fechas.finalizacion)) {
        var debeMostrarFinalizacion = (
            estadoOt === 'LISTO' ||
            estadoOt === 'APROBADO' ||
            estadoOt === 'COMPLETADO'
        );

        if (debeMostrarFinalizacion) {
            events.push({ titulo: 'Trabajo finalizado', detalle: 'Listo para entrega', fecha: ot.fechas.finalizacion });
            console.log('[renderTimelineFromOrder] ✅ Agregado evento: Trabajo finalizado');
        } else {
            console.log('[renderTimelineFromOrder] ❌ Omitido evento: Trabajo finalizado (estado:', estadoOt, ', debe estar en LISTO/APROBADO/COMPLETADO)');
        }
    }

    // Cierre de OT - solo si está COMPLETADO
    if (ot.fechas && esFechaValida(ot.fechas.cierre)) {
        if (estadoOt === 'COMPLETADO') {
            events.push({ titulo: 'Cierre de OT', detalle: 'Entregado al chofer', fecha: ot.fechas.cierre });
            console.log('[renderTimelineFromOrder] ✅ Agregado evento: Cierre de OT');
        } else {
            console.log('[renderTimelineFromOrder] ❌ Omitido evento: Cierre de OT (estado:', estadoOt, ', debe estar COMPLETADO)');
        }
    }

    // Si no hay eventos pero hay OT, mostrar al menos el estado actual
    if (!events.length && ot.fechas && ot.fechas.apertura) {
        events.push({
            titulo: 'Estado actual',
            detalle: formatEstadoLabel(ot.estado),
            fecha: ot.fechas.apertura
        });
        console.log('[renderTimelineFromOrder] Agregado evento: Estado actual (fallback)');
    }

    // Agregar evento extra si existe (ej: última novedad del vehículo)
    if (extraEvent) {
        events.push(extraEvent);
        console.log('[renderTimelineFromOrder] Agregado evento extra:', extraEvent.titulo);
    }

    console.log('[renderTimelineFromOrder] Total eventos a mostrar:', events.length);
    var msg = 'Último estado: ' + formatEstadoLabel(estadoActual || ot.estado);
    renderTimeline(events, msg);
}

function formatFecha(d) {
    var date = d instanceof Date ? d : new Date(d);
    var pad = function (n) { n = String(n); return n.length < 2 ? '0' + n : n; };
    return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear() +
        ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function abrirHistorial() {
    var modal = qs('#modalHistorial');
    if (!modal) {
        console.error('Modal de historial no encontrado');
        return;
    }

    // Mostrar loading
    var loading = qs('#historialLoading');
    var content = qs('#historialContent');
    var empty = qs('#historialEmpty');
    if (loading) {
        loading.style.display = 'block';
        LoadingUtils.showTableLoading(loading, 'Cargando historial...');
    }
    if (content) content.style.display = 'none';
    if (empty) empty.style.display = 'none';

    // Abrir modal
    openModal('modalHistorial');

    // Cargar historial
    fetchJson(API.vehiculoHistorial)
        .then(function (historial) {
            // porque showTableLoading reemplaza el contenido HTML del elemento
            if (loading) {
                loading.style.display = 'none';
            }

            if (!historial || !Array.isArray(historial) || historial.length === 0) {
                if (empty) empty.style.display = 'block';
                return;
            }

            if (content) content.style.display = 'block';
            if (empty) empty.style.display = 'none';

            var listContainer = qs('#historialList');
            if (!listContainer) return;

            listContainer.innerHTML = historial.map(function (item) {
                var vehiculoInfo = [item.vehiculo.marca, item.vehiculo.modelo, item.vehiculo.patente]
                    .filter(Boolean).join(' · ') || 'Vehículo';
                var fechaCierre = formatFechaSegura(item.fechas && item.fechas.cierre);
                var tallerInfo = item.taller && item.taller.nombre ? item.taller.nombre : 'Sin taller';
                var mecanicoInfo = item.mecanico && item.mecanico.nombre ? item.mecanico.nombre : 'No asignado';

                return '<div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #f9f9f9;">' +
                    '<div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">' +
                    '<div><strong>' + (item.numero_ot || 'OT #' + item.id) + '</strong></div>' +
                    '<div style="color: #666; font-size: 0.9em;">' + fechaCierre + '</div>' +
                    '</div>' +
                    '<div style="margin-bottom: 10px;"><strong>Vehículo:</strong> ' + vehiculoInfo + '</div>' +
                    '<div style="margin-bottom: 10px;"><strong>Taller:</strong> ' + tallerInfo + '</div>' +
                    '<div style="margin-bottom: 10px;"><strong>Mecánico:</strong> ' + mecanicoInfo + '</div>' +
                    (item.descripcion ? '<div style="margin-bottom: 10px;"><strong>Problema:</strong> ' + escapeHtml(item.descripcion) + '</div>' : '') +
                    (item.descripcion_proceso_realizado ? '<div style="margin-bottom: 10px;"><strong>Trabajo realizado:</strong> ' + escapeHtml(item.descripcion_proceso_realizado) + '</div>' : '') +
                    '</div>';
            }).join('');
        })
        .catch(function (err) {
            console.error('Error al cargar historial:', err);
            if (loading) {
                loading.style.display = 'none';
            }
            if (empty) {
                empty.style.display = 'block';
                empty.innerHTML = '<p style="color: #d32f2f;">Error al cargar el historial. Intenta nuevamente más tarde.</p>';
            }
        });
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function mostrarVehiculo(payload) {
    var vehiculo = payload.vehiculo || {};
    var ot = payload.workOrder || null;
    var solicitudPendiente = payload.pendingSolicitud || null;

    toggleSection('#vehiculoPanel', true);
    toggleSection('#vehiculoSinAsignacion', false);

    var titulo = [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ').trim();
    if (!titulo) titulo = 'Vehículo asignado';
    setText('#vehiculoTitulo', titulo);

    var subtitleParts = [];
    if (vehiculo.patente) subtitleParts.push('Patente: ' + vehiculo.patente);
    if (vehiculo.anio_modelo) subtitleParts.push('Año ' + vehiculo.anio_modelo);
    setText('#vehiculoSubtitulo', subtitleParts.join(' • ') || vehiculo.patente || '—');

    // Priorizar el estado del vehículo sobre el estado de la OT
    // El estado del vehículo es la fuente de verdad para determinar qué botones mostrar
    var estadoVehiculo = vehiculo.estado || (ot && ot.estado) || 'PENDIENTE';
    var estadoActual = estadoVehiculo; // Usar el estado del vehículo como estado actual
    updateStatusBadge('#vehiculoEstadoBadge', estadoActual);
    updateStatusBadge('#vehiculoEstadoDetalle', estadoActual);
    toggleVehicleDetails(estadoActual);

    setText('#vehiculoTaller', ot && ot.taller && ot.taller.nombre ? ot.taller.nombre : 'Sin taller asignado');
    setText('#mecanicoAsignado', ot && ot.mecanico && ot.mecanico.nombre ? ot.mecanico.nombre : 'No asignado');
    var fechaCreacion = ot && ot.fechas ? (ot.fechas.apertura || ot.fechas.inicio) : null;
    setText('#vehiculoFechaIngreso', formatFechaSegura(fechaCreacion));
    var fechaEstimada = ot && ot.fechas ? (ot.fechas.estimada || ot.fechas.finalizacion) : null;
    setText('#vehiculoFechaEstimada', fechaEstimada ? formatFechaSegura(fechaEstimada) : 'Pendiente');

    var telefono = ot && ot.taller ? (ot.taller.telefono || '') : '';
    var telefonoSanitizado = setContactLink('#vehiculoContacto', telefono);
    var btnContactar = qs('#btnContactarTaller');
    if (btnContactar) {
        btnContactar.dataset.phone = telefonoSanitizado || '';
        // El chofer siempre debe tener acceso para intentar contactar al taller
        // Si no hay teléfono, el handler mostrará un mensaje apropiado
        btnContactar.disabled = false;
        
        console.log('[mostrarVehiculo] Estado del botón Contactar Taller:', {
            telefono: telefono,
            telefonoSanitizado: telefonoSanitizado,
            disabled: false,
            tieneTelefono: !!telefonoSanitizado,
            mensaje: 'Botón siempre habilitado para permitir contacto con taller'
        });
    }

    // Mostrar el problema de la OT activa, o de la solicitud pendiente si no hay OT activa
    var problemaTexto = 'Sin problemas reportados.';
    if (ot && ot.descripcion) {
        problemaTexto = ot.descripcion;
    } else if (solicitudPendiente && solicitudPendiente.descripcion) {
        problemaTexto = solicitudPendiente.descripcion;
    }
    setText('#vehiculoProblema', problemaTexto);
    
    actualizarBotonNuevaSolicitud(estadoVehiculo, solicitudPendiente);

    // Mostrar botón de retiro si el vehículo está listo para retiro
    var vehicleActions = qs('.vehicle-actions');
    if (vehicleActions) {
        var estadoVehUpper = (estadoVehiculo || '').toUpperCase();
        if (estadoVehUpper === 'LISTO_PARA_RETIRO') {
            vehicleActions.innerHTML = '<button class="btn btn-success" id="btnRetiroVehiculo" type="button">Retiro de Vehículo</button>';
            var btnRetiro = qs('#btnRetiroVehiculo');
            if (btnRetiro) {
                btnRetiro.addEventListener('click', function () {
                    openRetiroModal(vehiculo, ot);
                });
            }
        } else {
            // Botones normales
            vehicleActions.innerHTML = '<button class="btn btn-primary" id="btnVerDetalles" type="button">Ver Detalles Completo</button><button class="btn btn-warning" id="btnSolicitarActualizacion" type="button">Solicitar Actualización</button>';
            // Re-attach event listeners
            var btnDetalles = qs('#btnVerDetalles');
            if (btnDetalles) btnDetalles.addEventListener('click', mostrarDetallesOt);
            var btnActualizar = qs('#btnSolicitarActualizacion');
            if (btnActualizar) btnActualizar.addEventListener('click', function (ev) {
                ev.preventDefault();
                LoadingUtils.showButtonLoading(btnActualizar, 'Actualizando...');
                cargarEstadoVehiculo()
                    .finally(function () {
                        LoadingUtils.hideButtonLoading(btnActualizar);
                    });
            });
        }
    }

    // Mostrar timeline solo si hay una OT activa (no completada)
    // Si no hay OT activa, mostrar mensaje indicando que el historial está en el modal
    var estadoVehUpper = (estadoVehiculo || '').toUpperCase();
    if (ot && estadoVehUpper !== 'OPERATIVO') {
        // Hay una OT activa, mostrar su timeline
        var extraEvent = buildVehiculoEvento(vehiculo, ot, solicitudPendiente);
        renderTimelineFromOrder(ot, estadoActual, extraEvent);
    } else if (!ot && estadoVehUpper === 'OPERATIVO') {
        // No hay OT activa y el vehículo está operativo
        renderTimeline([], 'El vehículo está operativo. Consulta el historial completo en el menú "Historial".');
    } else if (!ot) {
        // No hay OT activa pero el vehículo no está operativo (puede tener una solicitud pendiente)
        var extraEvent = buildVehiculoEvento(vehiculo, null, solicitudPendiente);
        renderTimelineFromOrder(null, estadoActual, extraEvent);
    } else {
        // Hay OT pero el vehículo está operativo (caso raro, pero manejarlo)
        renderTimeline([], 'El vehículo está operativo. Consulta el historial completo en el menú "Historial".');
    }
}

function mostrarEstadoSinVehiculo(options) {
    toggleSection('#vehiculoPanel', false);
    toggleSection('#vehiculoSinAsignacion', true);
    var cardText = qs('#vehiculoSinAsignacion p');
    if (cardText) {
        if (!cardText.dataset.defaultContent) {
            cardText.dataset.defaultContent = cardText.textContent;
        }
        if (options && options.error) {
            cardText.textContent = 'No pudimos cargar tu vehículo. Intenta nuevamente más tarde o contacta al administrador.';
        } else {
            cardText.textContent = cardText.dataset.defaultContent;
        }
    }
    var emptyMsg = options && options.error ? 'No se pudo cargar la línea de tiempo.' : 'Sin eventos registrados para mostrar.';
    renderTimeline([], emptyMsg);
}

function cargarEstadoVehiculo() {
    console.log('[cargarEstadoVehiculo] ===== INICIO CARGA ESTADO VEHÍCULO =====');
    console.log('[cargarEstadoVehiculo] Estado actual ANTES de cargar:', {
        vehiculo_id: estadoVehiculoActual?.vehiculo?.id || null,
        vehiculo_patente: estadoVehiculoActual?.vehiculo?.patente || null,
        vehiculo_marca: estadoVehiculoActual?.vehiculo?.marca || null,
        vehiculo_modelo: estadoVehiculoActual?.vehiculo?.modelo || null
    });
    console.log('[cargarEstadoVehiculo] Iniciando carga del estado del vehículo...');
    var panel = qs('#vehiculoPanel');
    if (panel) panel.setAttribute('data-loading', 'true');
    return fetchJson(API.vehiculoAsignado)
        .then(function (resp) {
            console.log('[cargarEstadoVehiculo] Respuesta recibida del servidor:', resp);
            if (!resp || !resp.vehiculo) {
                console.warn('[cargarEstadoVehiculo] ⚠️ No hay vehículo en la respuesta');
                estadoVehiculoActual = null;
                mostrarEstadoSinVehiculo();
                console.log('[cargarEstadoVehiculo] ===== FIN (sin vehículo) =====');
                return resp;
            }
            console.log('[cargarEstadoVehiculo] Vehículo recibido del servidor:', {
                id: resp.vehiculo.id,
                patente: resp.vehiculo.patente,
                marca: resp.vehiculo.marca,
                modelo: resp.vehiculo.modelo,
                estado: resp.vehiculo.estado,
                vehiculoCompleto: resp.vehiculo
            });

            // Comparar con el vehículo anterior
            if (estadoVehiculoActual && estadoVehiculoActual.vehiculo) {
                var vehiculoAnterior = estadoVehiculoActual.vehiculo;
                if (vehiculoAnterior.id !== resp.vehiculo.id) {
                    console.error('[cargarEstadoVehiculo] ⚠️⚠️⚠️ ERROR CRÍTICO: El vehículo cambió!', {
                        vehiculo_anterior_id: vehiculoAnterior.id,
                        vehiculo_anterior_patente: vehiculoAnterior.patente,
                        vehiculo_nuevo_id: resp.vehiculo.id,
                        vehiculo_nuevo_patente: resp.vehiculo.patente
                    });
                } else {
                    console.log('[cargarEstadoVehiculo] ✅ Vehículo coincide con el anterior');
                }
            }

            estadoVehiculoActual = resp;
            mostrarVehiculo(resp);
            console.log('[cargarEstadoVehiculo] Estado del vehículo actualizado:', {
                vehiculo_id: estadoVehiculoActual.vehiculo.id,
                vehiculo_patente: estadoVehiculoActual.vehiculo.patente,
                estadoVehiculoActualCompleto: estadoVehiculoActual
            });
            console.log('[cargarEstadoVehiculo] ===== FIN CARGA ESTADO VEHÍCULO =====');
            return resp;
        })
        .catch(function (err) {
            console.error('[cargarEstadoVehiculo] ERROR al cargar vehículo asignado:', err);
            estadoVehiculoActual = null;
            mostrarEstadoSinVehiculo({ error: true });
            console.log('[cargarEstadoVehiculo] ===== FIN (error) =====');
        })
        .finally(function () {
            if (panel) panel.removeAttribute('data-loading');
        });
}

function handleContactarTaller(ev) {
    ev.preventDefault();
    var btn = ev.currentTarget;
    var phone = btn && btn.dataset ? (btn.dataset.phone || '') : '';
    
    if (!phone || !phone.trim()) {
        var mensaje = 'No hay teléfono disponible del taller en este momento. ';
        if (estadoVehiculoActual && estadoVehiculoActual.workOrder && estadoVehiculoActual.workOrder.taller) {
            var tallerNombre = estadoVehiculoActual.workOrder.taller.nombre || 'el taller asignado';
            mensaje += 'Puedes contactar a ' + tallerNombre + ' a través de otros medios o consultar con tu supervisor.';
        } else {
            mensaje += 'Puedes consultar con tu supervisor para obtener información de contacto.';
        }
        alert(mensaje);
        return;
    }
    
    // Si hay teléfono, intentar llamar
    window.location.href = 'tel:' + phone;
}

function openRetiroModal(vehiculo, ot) {
    var modal = qs('#modalRetiroVehiculo');
    if (!modal) {
        console.error('Modal de retiro no encontrado');
        return;
    }

    // Llenar información del modal
    // Intentar obtener OT desde estadoVehiculoActual si no se proporciona
    if (!ot && estadoVehiculoActual && estadoVehiculoActual.workOrder) {
        ot = estadoVehiculoActual.workOrder;
    }
    var otNumero = ot && ot.numero_ot ? ot.numero_ot : (ot && ot.numero ? ot.numero : (ot && ot.id ? '#' + ot.id : 'N/A'));
    var otDescripcion = ot && ot.descripcion_proceso_realizado ? ot.descripcion_proceso_realizado : (ot && ot.descripcion ? ot.descripcion : 'Sin descripción');
    var vehiculoInfo = [vehiculo.marca, vehiculo.modelo, vehiculo.patente].filter(Boolean).join(' · ') || 'Vehículo';

    setText('#retiro_ot_numero', otNumero);
    setText('#retiro_vehiculo_info', vehiculoInfo);
    setText('#retiro_descripcion', otDescripcion);

    // Resetear formulario
    var vehiculoOperativoCheck = qs('#retiro_vehiculo_operativo');
    if (vehiculoOperativoCheck) vehiculoOperativoCheck.checked = false;

    var observaciones = qs('#retiro_observaciones');
    if (observaciones) observaciones.value = '';

    var msg = qs('#retiroMsg');
    if (msg) {
        msg.textContent = '';
        msg.classList.add('hidden');
    }

    // Guardar ID del vehículo en un campo hidden
    var vehiculoIdInput = qs('#retiro_vehiculo_id');
    if (vehiculoIdInput) vehiculoIdInput.value = vehiculo.id;

    openModal('modalRetiroVehiculo');
}

function handleConfirmRetiroSubmit(ev) {
    ev.preventDefault();
    var vehiculoIdInput = qs('#retiro_vehiculo_id');
    if (!vehiculoIdInput || !vehiculoIdInput.value) return;

    var msg = qs('#retiroMsg');
    if (msg) {
        msg.textContent = '';
        msg.classList.add('hidden');
    }

    var vehiculoOperativoCheck = qs('#retiro_vehiculo_operativo');
    if (!vehiculoOperativoCheck || !vehiculoOperativoCheck.checked) {
        flashStatus(msg, 'bad', '❌ Debes confirmar que el vehículo está operativo para proceder con el retiro.');
        return;
    }

    var observaciones = qs('#retiro_observaciones');

    var payload = {
        vehiculoOperativo: true,
        observaciones: observaciones && observaciones.value ? observaciones.value.trim() : undefined
    };

    bearerFetch(API_BASE + '/workorders/vehicles/' + vehiculoIdInput.value + '/confirm-retiro', {
        method: 'POST',
        body: JSON.stringify(payload)
    }).then(function (res) {
        if (!res.ok) {
            return res.json().then(function (err) {
                throw new Error(err.message || 'No se pudo confirmar el retiro');
            });
        }
        return res.json();
    }).then(function () {
        closeModal('modalRetiroVehiculo');
        // Recargar estado del vehículo
        cargarEstadoVehiculo();
        if (msg) {
            flashStatus(msg, 'ok', '✅ Retiro confirmado correctamente. Vehículo operativo.');
        }
    }).catch(function (error) {
        if (msg) {
            flashStatus(msg, 'bad', '❌ ' + (error.message || 'Error al confirmar el retiro'));
        } else {
            alert(error.message || 'Error al confirmar el retiro');
        }
    });
}

function mostrarDetallesOt(ev) {
    if (ev && typeof ev.preventDefault === 'function') {
        ev.preventDefault();
    }

    if (!estadoVehiculoActual || !estadoVehiculoActual.workOrder) {
        // Reusa la notificación pro de arriba
        if (typeof flashMainStatus === 'function') {
            flashMainStatus('bad', '❌ Tu vehículo no tiene una orden de trabajo activa en este momento.');
        } else {
            alert('Tu vehículo no tiene una orden de trabajo activa en este momento.');
        }
        return;
    }

    var ot = estadoVehiculoActual.workOrder;
    var vehiculo = estadoVehiculoActual.vehiculo || {};
    var content = qs('#detalleOtContent');

    if (content) {
        var numero = ot.numero || ('#' + ot.id);
        var estado = ot.estado || 'PENDIENTE';
        var estadoLabel = formatEstadoLabel(estado);
        var prioridad = ot.prioridad || 'NORMAL';
        var tallerNombre = (ot.taller && ot.taller.nombre) ? ot.taller.nombre : 'Sin taller asignado';
        var mecanicoNombre = (ot.mecanico && ot.mecanico.nombre) ? ot.mecanico.nombre : 'No asignado';
        var fechaCreacion = ot.fecha_creacion || ot.createdAt || ot.created_at || '—';
        var fechaEstimada = ot.fecha_estimada_termino || ot.fecha_estimada || '—';
        var descripcion = ot.descripcion || 'Sin descripción registrada.';
        var observaciones = ot.observaciones || ot.notas || 'Sin observaciones adicionales.';

        // Si hay descripción de solicitud pendiente úsala como "problema"
        var problema = (estadoVehiculoActual.pendingSolicitud && estadoVehiculoActual.pendingSolicitud.descripcion)
            ? estadoVehiculoActual.pendingSolicitud.descripcion
            : descripcion;

        var modelo = [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ');
        var patente = vehiculo.patente || '—';
        var subtitleParts = [];
        if (patente && patente !== '—') subtitleParts.push('Patente ' + patente);
        if (vehiculo.anio_modelo) subtitleParts.push('Año ' + vehiculo.anio_modelo);
        var subtitle = (modelo || 'Vehículo asignado') + (subtitleParts.length ? ' • ' + subtitleParts.join(' • ') : '');

        content.innerHTML =
            '<div class="vehicle-card">' +
                '<div class="vehicle-header">' +
                    '<div>' +
                        '<h3>OT ' + escapeHtml(String(numero)) + '</h3>' +
                        '<p class="vehicle-subtitle">' + escapeHtml(subtitle) + '</p>' +
                    '</div>' +
                    '<span id="detalleOtEstadoBadge" class="status-badge">' + escapeHtml(estadoLabel) + '</span>' +
                '</div>' +
                '<div class="vehicle-info">' +
                    '<div class="info-item">' +
                        '<h4>Estado</h4>' +
                        '<p>' + escapeHtml(estadoLabel) + '</p>' +
                    '</div>' +
                    '<div class="info-item">' +
                        '<h4>Prioridad</h4>' +
                        '<p>' + escapeHtml(prioridad) + '</p>' +
                    '</div>' +
                    '<div class="info-item">' +
                        '<h4>Taller</h4>' +
                        '<p>' + escapeHtml(tallerNombre) + '</p>' +
                    '</div>' +
                    '<div class="info-item">' +
                        '<h4>Mecánico</h4>' +
                        '<p>' + escapeHtml(mecanicoNombre) + '</p>' +
                    '</div>' +
                    '<div class="info-item">' +
                        '<h4>Fecha creación</h4>' +
                        '<p>' + escapeHtml(fechaCreacion) + '</p>' +
                    '</div>' +
                    '<div class="info-item">' +
                        '<h4>Fecha estimada término</h4>' +
                        '<p>' + escapeHtml(fechaEstimada) + '</p>' +
                    '</div>' +
                '</div>' +
                '<div class="ot-detail-section">' +
                    '<h4>Problema reportado</h4>' +
                    '<p>' + escapeHtml(problema) + '</p>' +
                '</div>' +
                '<div class="ot-detail-section">' +
                    '<h4>Descripción del trabajo</h4>' +
                    '<p>' + escapeHtml(descripcion) + '</p>' +
                '</div>' +
                '<div class="ot-detail-section">' +
                    '<h4>Observaciones</h4>' +
                    '<p>' + escapeHtml(observaciones) + '</p>' +
                '</div>' +
            '</div>';

        // Aplicar color de badge según estado
        updateStatusBadge('#detalleOtEstadoBadge', estado);
    } else {
        console.warn('[mostrarDetallesOt] No se encontró #detalleOtContent en el DOM');
    }

    // Abrir el modal centrado
    openModal('modalDetalleOt');
}


// ========== LOGOUT (OBSOLETO - Ahora se usa logout_button.js) ==========
// Esta función se mantiene solo por compatibilidad hacia atrás
// El logout ahora se maneja automáticamente con logout_button.js
/*
var authLogoutHandler = typeof window.logout === 'function' ? window.logout : null;
function logout() {
    if (authLogoutHandler && authLogoutHandler !== logout) {
        authLogoutHandler();
        return;
    }
    // Fallback local (por si auth.js no está disponible)
    if (confirm('¿Está seguro de que desea cerrar sesión?')) {
        localStorage.removeItem('crm.token');
        localStorage.removeItem('token');
        sessionStorage.clear();
        window.location.href = '/login.html';
    }
}
*/

// Wire-up
document.addEventListener('DOMContentLoaded', function () {
    console.log('[DOMContentLoaded] Iniciando configuración del dashboard chofer');

    // Inicializar autenticación al cargar la página
    // Verifica que el usuario tenga rol 'chofer'
    if (typeof window.initAuth === 'function') {
        console.log('[DOMContentLoaded] auth.js disponible, inicializando autenticación...');
        window.initAuth('chofer')
            .then(function (user) {
                console.log('Dashboard de chofer cargado para:', user.email);

                // Actualizar nombre de usuario si existe el elemento
                var userNameEl = qs('#userName');
                if (userNameEl && user.nombre_completo) {
                    userNameEl.textContent = user.nombre_completo;
                }

                // Inicializar NotificationsManager si está disponible
                if (typeof NotificationsManager !== 'undefined') {
                    NotificationsManager.init(user.id, function (entityId, entityType) {
                        // Callback cuando se hace clic en una notificación
                        if (entityType === 'SOLICITUD' && entityId) {
                            // Recargar estado del vehículo para mostrar cambios
                            cargarEstadoVehiculo();
                        } else if (entityType === 'ORDEN_TRABAJO' && entityId) {
                            // Recargar estado del vehículo para mostrar cambios en OT
                            cargarEstadoVehiculo();
                        }
                    });

                    // Suscribirse a notificaciones de Socket.IO si el socket está disponible
                    if (socket && typeof NotificationsManager.subscribeToSocket === 'function') {
                        NotificationsManager.subscribeToSocket(
                            socket,
                            'driver:notification',
                            function (data) {
                                // Filtrar notificaciones para este usuario específico
                                return data.driverId === user.id;
                            }
                        );
                    }
                }

                return user;
            })
            .then(function () {
                console.log('[DOMContentLoaded] Autenticación exitosa, cargando estado del vehículo...');
                return cargarEstadoVehiculo();
            })
            .catch(function (err) {
                // La redirección ya se maneja en auth.js
                console.error('[DOMContentLoaded] Error de autenticación:', err);
            });
    } else {
        console.warn('[DOMContentLoaded] auth.js no está cargado. Asegúrate de incluirlo antes de este script.');
        // Fallback: verificar token básico
        var token = localStorage.getItem('crm.token') || localStorage.getItem('token');
        if (!token) {
            console.warn('[DOMContentLoaded] No hay token, redirigiendo a login...');
            window.location.replace('/login.html');
            return;
        }
        console.log('[DOMContentLoaded] Token encontrado, cargando estado del vehículo...');
        cargarEstadoVehiculo();
    }

    var btnNueva = qs('#btnNuevaSolicitud');
    console.log('[DOMContentLoaded] Botón Nueva Solicitud encontrado:', btnNueva);
    if (btnNueva) {
        console.log('[DOMContentLoaded] Registrando evento click en botón Nueva Solicitud');
        btnNueva.addEventListener('click', function (ev) {
            console.log('[btnNuevaSolicitud] Click detectado en botón', { ev, target: ev.target });
            abrirNuevaSolicitud(ev);
        });
    } else {
        console.error('[DOMContentLoaded] ❌ Botón #btnNuevaSolicitud NO encontrado en el DOM');
    }

    var menuSolicitudes = qs('#goSolicitudes');
    console.log('[DOMContentLoaded] Menú Solicitudes encontrado:', menuSolicitudes);
    if (menuSolicitudes) {
        console.log('[DOMContentLoaded] Registrando evento click en menú Solicitudes');
        menuSolicitudes.addEventListener('click', function (ev) {
            console.log('[goSolicitudes] Click detectado en menú', { ev, target: ev.target });
            abrirNuevaSolicitud(ev);
        });
    } else {
        console.warn('[DOMContentLoaded] Menú #goSolicitudes no encontrado');
    }

    var menuHistorial = qs('#goHistorial');
    if (menuHistorial) {
        menuHistorial.addEventListener('click', function (ev) {
            ev.preventDefault();
            abrirHistorial();
        });
    }

    var formSolicitud = qs('#formSolicitud');
    if (formSolicitud) formSolicitud.addEventListener('submit', crearSolicitud);

    var evidenciaInput = qs('#evidenciaInput');
    if (evidenciaInput) evidenciaInput.addEventListener('change', handleEvidenciaChange);

    var btnContactar = qs('#btnContactarTaller');
    if (btnContactar) btnContactar.addEventListener('click', handleContactarTaller);

    var btnActualizar = qs('#btnSolicitarActualizacion');
    if (btnActualizar) btnActualizar.addEventListener('click', function (ev) {
        ev.preventDefault();
        LoadingUtils.showButtonLoading(btnActualizar, 'Actualizando...');
        cargarEstadoVehiculo()
            .finally(function () {
                LoadingUtils.hideButtonLoading(btnActualizar);
            });
    });

    var btnDetalles = qs('#btnVerDetalles');
    if (btnDetalles) btnDetalles.addEventListener('click', mostrarDetallesOt);

    var btnSolicitarAsignacion = qs('#btnSolicitarAsignacion');
    if (btnSolicitarAsignacion) btnSolicitarAsignacion.addEventListener('click', function () {
        alert('Hemos notificado al equipo de flota. Te contactarán a la brevedad.');
    });

    var retiroForm = qs('#retiroForm');
    if (retiroForm) {
        retiroForm.addEventListener('submit', handleConfirmRetiroSubmit);
    }

    qsa('[data-close]').forEach(function (el) {
        el.addEventListener('click', function (ev) {
            ev.preventDefault();
            closeModal(ev);
        });
    });

    console.log('[DOMContentLoaded] ✅ Configuración completa del dashboard chofer finalizada');
    console.log('[DOMContentLoaded] Elementos verificados:', {
        btnNuevaSolicitud: !!qs('#btnNuevaSolicitud'),
        modalSolicitud: !!qs('#modalSolicitud'),
        formSolicitud: !!qs('#formSolicitud'),
        evidenciaInput: !!qs('#evidenciaInput')
    });
});