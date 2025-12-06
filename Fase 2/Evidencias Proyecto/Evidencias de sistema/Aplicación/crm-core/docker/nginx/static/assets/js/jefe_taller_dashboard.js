function updateSelectedMechanicScheduleSet(mecanicoId) {
    if (!mecanicoId) {
        G_OT_SELECTED_SCHEDULE_DAYS = null;
        return;
    }
    var mec = G_LISTA_USUARIOS.find(function (m) { return m.id === mecanicoId; });
    if (!mec || !mec.horario) {
        G_OT_SELECTED_SCHEDULE_DAYS = null;
        return;
    }
    var set = new Set();
    Object.keys(mec.horario).forEach(function (key) {
        var data = mec.horario[key];
        var idx = DAY_KEY_TO_INDEX[key];
        if (data && data.activo && typeof idx === 'number') {
            set.add(idx);
        }
    });
    G_OT_SELECTED_SCHEDULE_DAYS = set.size ? set : null;
}

function isDateAllowedForSelectedMechanic(date) {
    if (!G_OT_SELECTED_SCHEDULE_DAYS || !(date instanceof Date)) {
        console.log('isDateAllowedForSelectedMechanic: Sin restricciones - G_OT_SELECTED_SCHEDULE_DAYS:', G_OT_SELECTED_SCHEDULE_DAYS, 'date:', date);
        return true;
    }
    var dayOfWeek = date.getDay();
    var isAllowed = G_OT_SELECTED_SCHEDULE_DAYS.has(dayOfWeek);
    console.log('isDateAllowedForSelectedMechanic: Fecha', formatISODateLocal(date), 'día de semana:', dayOfWeek, 'permitido:', isAllowed, 'días permitidos:', Array.from(G_OT_SELECTED_SCHEDULE_DAYS));
    return isAllowed;
}

function mapUrgenciaToPrioridad(urgencia, tipoSolicitud) {
    var tipo = (tipoSolicitud || '').toUpperCase();
    if (tipo === 'EMERGENCIA') {
        return 'URGENTE';
    }
    var normalized = (urgencia || '').toUpperCase();
    if (normalized === 'URGENTE') return 'URGENTE';
    if (normalized === 'ALTA') return 'ALTA';
    return 'NORMAL';
}

function setOtPrioridad(value) {
    if (!otPrioridadSelect) return;
    otPrioridadSelect.value = value || 'NORMAL';
}

/* ======================================================== */
/* --- VARIABLES GLOBALES --- */
/* ======================================================== */
var API_BASE = '/api';
var TOKEN_KEY = 'crm.token';

// Exponer funciones globales temprano para que estén disponibles cuando se rendericen los botones
window.mecMostrarHorario = function (id) {
    if (typeof G_LISTA_USUARIOS !== 'undefined' && Array.isArray(G_LISTA_USUARIOS)) {
        var usuario = G_LISTA_USUARIOS.find(function (u) { return u.id === id; });
        if (!usuario) return;

        var nombreEl = document.getElementById('mecModalNombre');
        var emailEl = document.getElementById('mecModalEmail');
        var tbody = document.getElementById('mecHorarioTableBody');

        if (nombreEl) nombreEl.textContent = usuario.nombre_completo || '—';
        if (emailEl) emailEl.textContent = usuario.email || '—';

        if (tbody && typeof DAY_LABELS !== 'undefined' && typeof formatHour === 'function') {
            tbody.innerHTML = DAY_LABELS.map(function (day) {
                var data = usuario.horario ? usuario.horario[day.key] : null;
                var activo = data && data.activo;
                var jornada = activo && data.hora_inicio && data.hora_salida ?
                    '<span>' + formatHour(data.hora_inicio) + ' - ' + formatHour(data.hora_salida) + '</span>' :
                    '<span class="schedule-chip__empty">Fuera de turno</span>';
                var colacion = activo && data.colacion_inicio && data.colacion_salida ?
                    formatHour(data.colacion_inicio) + ' - ' + formatHour(data.colacion_salida) :
                    '—';
                return [
                    '<tr>',
                    '<td>', day.label, '</td>',
                    '<td>', jornada, '</td>',
                    '<td>', colacion, '</td>',
                    '</tr>'
                ].join('');
            }).join('');
        }

        if (typeof openModal === 'function') {
            setTimeout(function () {
                var modal = document.getElementById('modalMecanicoHorario');
                if (modal) {
                    modal.style.display = 'flex';
                }
            }, 10);
        }
    } else {
        setTimeout(function () {
            if (typeof window.mecMostrarHorario === 'function') {
                window.mecMostrarHorario(id);
            }
        }, 100);
    }
};

window.otOpenEdit = function (id) {
    if (typeof otFetchById === 'function' && typeof fillOtEditModal === 'function') {
        otFetchById(id)
            .then(function (ot) {
                fillOtEditModal(ot);
                // Abrir modal directamente sin usar openModal para evitar problemas
                setTimeout(function () {
                    var modal = document.getElementById('modalOtEdit');
                    if (modal) {
                        modal.style.display = 'flex';
                    }
                }, 10);
            })
            .catch(function (err) {
                ErrorHandler.handleError(err, 'Cargar orden', {
                    useFloatingNotification: true
                });
            });
    } else {
        setTimeout(function () {
            if (typeof window.otOpenEdit === 'function') {
                window.otOpenEdit(id);
            }
        }, 100);
    }
};
var vehFormAdd = document.getElementById('vehFormAdd');
var vehFormEdit = document.getElementById('vehFormEdit');
var vehTBody = document.querySelector('#vehTabla tbody');
var mecTBody = document.querySelector('#mecTBody'); // La <tbody> de la nueva tabla
var vehPendNavLabel = document.getElementById('vehPendNavLabel');
var vehPendTitle = document.getElementById('vehiculosPendLabel');
var vehAddMecanicoSelect = document.getElementById('veh_add_mecanico');
var vehAddFechaInicioInput = document.getElementById('veh_add_fecha_inicio');
var vehAddFechaFinInput = document.getElementById('veh_add_fecha_fin');
var otDateRangeContainer = document.getElementById('otDateRange');
var otDatePickerPopover = document.getElementById('otDatePicker');
var otFechaInicioDisplay = document.getElementById('ot_gen_fecha_inicio_display');
var otFechaFinDisplay = document.getElementById('ot_gen_fecha_fin_display');
var otRangePicker = null;
var otFechaInicioInput = document.getElementById('ot_gen_fecha_inicio');
var otFechaFinInput = document.getElementById('ot_gen_fecha_fin');
var otFechaInicioTimeInput = document.getElementById('ot_gen_hora_inicio');
var otFechaFinTimeInput = document.getElementById('ot_gen_hora_fin');
var otFechaAlertBox = document.getElementById('ot_gen_schedule_alert');
var G_OT_SELECTED_MECANICO = null;
var G_MECANICO_BUSY_CACHE = {};
var G_MECANICO_BUSY_PENDING = {};
var G_OT_SELECTED_RANGE = { start: '', end: '' };
var MECANICO_SCHEDULE_TTL = 2 * 60 * 1000; // 2 minutos
var G_LISTA_USUARIOS = []; // Caché para guardar la lista de usuarios
var DEFAULT_START_TIME = '09:00';
var DEFAULT_END_TIME = '18:00';
var DAY_LABELS = [
    { key: 'lunes', label: 'Lunes', abbr: 'Lun' },
    { key: 'martes', label: 'Martes', abbr: 'Mar' },
    { key: 'miercoles', label: 'Miércoles', abbr: 'Mié' },
    { key: 'jueves', label: 'Jueves', abbr: 'Jue' },
    { key: 'viernes', label: 'Viernes', abbr: 'Vie' }
];

/* ======================================================== */
/* --- HELPERS (Formato y Mensajes "Wapos") --- */
/* ======================================================== */

// Formatea fecha a DD/MM/AAAA
function formatDate(isoString) {
    if (!isoString) return '-';
    try {
        var d = new Date(isoString);
        return d.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return '-';
    }
}

function formatShortDate(date) {
    if (!date) return '';
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
}

function formatISODateLocal(date) {
    if (!date) return '';
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function parseISODate(value) {
    if (!value) return null;
    var parts = value.split('-');
    if (parts.length !== 3) return null;
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(year, month, day);
}

function addDays(date, days) {
    var base = new Date(date.getTime());
    base.setDate(base.getDate() + days);
    return base;
}

function ensureTimeFormat(value) {
    if (!value) return '';
    if (value.length === 5) return value + ':00';
    return value;
}

function combineDateAndTime(dateValue, timeValue, defaultTime) {
    if (!dateValue) return '';
    var time = (timeValue && timeValue.trim()) ? timeValue.trim() : (defaultTime || '');
    var formatted = ensureTimeFormat(time || '00:00');

    // Parsear la fecha (formato YYYY-MM-DD)
    var dateParts = dateValue.split('-');
    if (dateParts.length !== 3) return dateValue + 'T' + formatted;

    // Parsear la hora (formato HH:MM o HH:MM:SS)
    var timeParts = formatted.split(':');
    if (timeParts.length < 2) return dateValue + 'T' + formatted;

    var year = parseInt(dateParts[0], 10);
    var month = parseInt(dateParts[1], 10) - 1; // Los meses en Date son 0-indexados
    var day = parseInt(dateParts[2], 10);
    var hours = parseInt(timeParts[0], 10);
    var minutes = parseInt(timeParts[1], 10);

    // Crear un Date en hora local con la fecha y hora especificadas
    var localDate = new Date(year, month, day, hours, minutes, 0, 0);

    // Convertir a ISO string (UTC) para enviar al servidor
    return localDate.toISOString();
}

function toDateOnly(value) {
    if (!value) return null;
    var d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rangesOverlap(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB) return false;
    return startA.getTime() <= endB.getTime() && startB.getTime() <= endA.getTime();
}

function createDateRangePicker(config) {
    if (!config || !config.container || !config.popover) return null;
    var monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var weekdayLabels = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
    var state = {
        start: null,
        end: null,
        visible: new Date()
    };
    state.visible.setDate(1);
    var isOpen = false;
    var metaGetter = typeof config.getDayMetadata === 'function' ? config.getDayMetadata : null;
    var isDateAllowed = typeof config.isDateAllowed === 'function' ? config.isDateAllowed : null;
    var onRangeChange = typeof config.onRangeChange === 'function' ? config.onRangeChange : null;

    function normalize(value) {
        if (!value) return null;
        if (value instanceof Date) {
            return new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }
        if (typeof value === 'string') {
            return parseISODate(value);
        }
        return null;
    }

    function emitRangeChange() {
        if (!onRangeChange) return;
        onRangeChange({
            start: state.start ? formatISODateLocal(state.start) : '',
            end: state.end ? formatISODateLocal(state.end) : '',
            startDate: state.start ? new Date(state.start.getTime()) : null,
            endDate: state.end ? new Date(state.end.getTime()) : null
        });
    }

    function syncOutputs() {
        if (config.startInput) {
            config.startInput.value = state.start ? formatISODateLocal(state.start) : '';
        }
        if (config.endInput) {
            config.endInput.value = state.end ? formatISODateLocal(state.end) : '';
        }
        if (config.startDisplay) {
            config.startDisplay.value = state.start ? formatShortDate(state.start) : '';
        }
        if (config.endDisplay) {
            config.endDisplay.value = state.end ? formatShortDate(state.end) : '';
        }
        emitRangeChange();
    }

    function buildCalendarCells() {
        var year = state.visible.getFullYear();
        var month = state.visible.getMonth();
        var first = new Date(year, month, 1);
        var offset = (first.getDay() + 6) % 7; // lunes = 0
        var total = new Date(year, month + 1, 0).getDate();
        var cells = [];
        for (var i = 0; i < offset; i++) cells.push(null);
        for (var d = 1; d <= total; d++) {
            cells.push(new Date(year, month, d));
        }
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }

    function isInRange(date) {
        if (!state.start || !state.end) return false;
        return date > state.start && date < state.end;
    }

    function handleDaySelection(date) {
        if (!state.start || (state.start && state.end)) {
            state.start = date;
            state.end = null;
        } else if (date < state.start) {
            state.end = state.start;
            state.start = date;
        } else if (date.getTime() === state.start.getTime()) {
            state.end = date;
        } else {
            state.end = date;
            closePicker();
        }
        syncOutputs();
        renderPopover();
    }

    function handleOutside(ev) {
        if (!config.container.contains(ev.target) && !config.popover.contains(ev.target)) {
            closePicker();
        }
    }

    function openPicker() {
        if (isOpen) return;
        isOpen = true;
        config.container.setAttribute('aria-expanded', 'true');
        config.popover.classList.add('is-open');
        config.popover.setAttribute('aria-hidden', 'false');
        renderPopover();
        document.addEventListener('click', handleOutside, true);
    }

    function closePicker() {
        if (!isOpen) return;
        isOpen = false;
        config.container.setAttribute('aria-expanded', 'false');
        config.popover.classList.remove('is-open');
        config.popover.setAttribute('aria-hidden', 'true');
        config.popover.innerHTML = '';
        document.removeEventListener('click', handleOutside, true);
    }

    function renderPopover() {
        if (!isOpen) return;
        var monthLabel = monthNames[state.visible.getMonth()] + ' ' + state.visible.getFullYear();
        var cells = buildCalendarCells();
        var gridHtml = cells.map(function (cell) {
            if (!cell) {
                return '<span class="date-picker__day is-empty"></span>';
            }
            var iso = formatISODateLocal(cell);
            var classes = ['date-picker__day'];
            var isStart = state.start && cell.getTime() === state.start.getTime();
            var isEnd = state.end && cell.getTime() === state.end.getTime();
            var today = new Date();
            var isToday = cell.toDateString() === today.toDateString();
            // Llamar a las funciones de validación y metadata
            var allowed = isDateAllowed ? !!isDateAllowed(cell) : true;
            var metadata = metaGetter ? metaGetter(cell) : null;

            // DEBUG: Log para los primeros días del mes
            if (cell.getDate() <= 3) {
                console.log('Date picker DEBUG - Día:', formatISODateLocal(cell), {
                    allowed: allowed,
                    metadata: metadata,
                    hasIsDateAllowed: !!isDateAllowed,
                    hasMetaGetter: !!metaGetter,
                    G_OT_SELECTED_MECANICO: G_OT_SELECTED_MECANICO,
                    G_OT_SELECTED_SCHEDULE_DAYS: G_OT_SELECTED_SCHEDULE_DAYS
                });
            }

            // Aplicar clases en el orden correcto
            if (isStart || isEnd) classes.push('is-selected');
            if (isStart) classes.push('is-start');
            if (isEnd) classes.push('is-end');
            if (isInRange(cell)) classes.push('is-in-range');
            if (isToday) classes.push('is-today');
            // Aplicar is-busy si el día está ocupado
            if (metadata && metadata.busy) {
                classes.push('is-busy');
                if (cell.getDate() <= 3) {
                    console.log('  -> Aplicando is-busy para', formatISODateLocal(cell));
                }
            }
            // Aplicar is-disabled solo si no está permitido (tiene prioridad sobre is-busy)
            if (!allowed) {
                classes.push('is-disabled');
                if (cell.getDate() <= 3) {
                    console.log('  -> Aplicando is-disabled para', formatISODateLocal(cell));
                }
            }
            var attrs = '';
            if (metadata && metadata.tooltip) {
                attrs += ' title="' + escapeHtml(metadata.tooltip) + '"';
            }
            if (metadata && typeof metadata.count === 'number') {
                attrs += ' data-busy-count="' + metadata.count + '"';
            }
            if (!allowed) {
                attrs += ' disabled';
            }
            return '<button type="button" class="' + classes.join(' ') + '" data-day="' + iso + '"' + attrs + '>' + cell.getDate() + '</button>';
        }).join('');

        config.popover.innerHTML = [
            '<div class="date-picker">',
            '<div class="date-picker__header">',
            '<button type="button" class="date-picker__nav" data-nav="-1" aria-label="Mes anterior">‹</button>',
            '<span class="date-picker__month">', monthLabel, '</span>',
            '<button type="button" class="date-picker__nav" data-nav="1" aria-label="Mes siguiente">›</button>',
            '</div>',
            '<div class="date-picker__weekdays">',
            weekdayLabels.map(function (lbl) { return '<span class="date-picker__weekday">' + lbl + '</span>'; }).join(''),
            '</div>',
            '<div class="date-picker__grid">',
            gridHtml,
            '</div>',
            '</div>'
        ].join('');

        var navButtons = config.popover.querySelectorAll('[data-nav]');
        navButtons.forEach(function (btn) {
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                var delta = parseInt(btn.getAttribute('data-nav'), 10);
                state.visible.setMonth(state.visible.getMonth() + delta);
                renderPopover();
            });
        });

        var dayButtons = config.popover.querySelectorAll('[data-day]');
        dayButtons.forEach(function (btn) {
            var iso = btn.getAttribute('data-day');
            if (!iso) return;
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                var date = parseISODate(iso);
                if (date && (!isDateAllowed || isDateAllowed(date))) {
                    handleDaySelection(date);
                }
            });
        });
    }

    config.container.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (config.container.hasAttribute('disabled') || config.container.hasAttribute('data-disabled') || config.container.classList.contains('disabled')) {
            return;
        }
        openPicker();
    });
    config.container.addEventListener('keydown', function (ev) {
        if (config.container.hasAttribute('disabled') || config.container.hasAttribute('data-disabled') || config.container.classList.contains('disabled')) {
            return;
        }
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openPicker();
        } else if (ev.key === 'Escape') {
            closePicker();
        }
    });
    if (config.popover) {
        config.popover.addEventListener('click', function (ev) {
            ev.stopPropagation();
        });
    }

    syncOutputs();

    return {
        setRange: function (startValue, endValue) {
            state.start = normalize(startValue);
            state.end = normalize(endValue);
            var reference = state.start || state.end || new Date();
            state.visible = new Date(reference.getFullYear(), reference.getMonth(), 1);
            syncOutputs();
            if (isOpen) {
                renderPopover();
            }
        },
        close: closePicker,
        getRange: function () {
            return {
                start: state.start ? formatISODateLocal(state.start) : '',
                end: state.end ? formatISODateLocal(state.end) : '',
            };
        },
        refreshMetadata: function () {
            if (isOpen) {
                renderPopover();
            }
        }
    };
}

function buildBusyLookup(list) {
    var busyDays = {};
    var busyRanges = [];
    list.forEach(function (ot) {
        var rawStart = ot.fecha_inicio_trabajo || ot.fecha_asignacion || ot.fecha_apertura;
        var rawEnd = ot.fecha_finalizacion || ot.fecha_estimada_termino || ot.fecha_cierre || ot.fecha_inicio_trabajo || ot.fecha_asignacion || ot.fecha_apertura;
        var startDate = toDateOnly(rawStart);
        var endDate = toDateOnly(rawEnd);
        if (!startDate && !endDate) return;
        if (!startDate) startDate = new Date(endDate.getTime());
        if (!endDate) endDate = new Date(startDate.getTime());
        if (endDate.getTime() < startDate.getTime()) {
            var tmp = startDate;
            startDate = endDate;
            endDate = tmp;
        }
        var range = {
            id: ot.id,
            numero: ot.numero_ot || null,
            vehiculo: ot.vehiculo && ot.vehiculo.patente ? ot.vehiculo.patente : null,
            start: startDate,
            end: endDate,
            estado: ot.estado || 'PENDIENTE'
        };
        busyRanges.push(range);
        var cursor = new Date(startDate.getTime());
        while (cursor.getTime() <= endDate.getTime()) {
            var key = formatISODateLocal(cursor);
            if (!busyDays[key]) busyDays[key] = [];
            busyDays[key].push(range);
            cursor = addDays(cursor, 1);
        }
    });
    return { busyDays: busyDays, busyRanges: busyRanges };
}

function fetchMechanicAgenda(mecanicoId) {
    if (!mecanicoId) return Promise.resolve(null);
    var cache = G_MECANICO_BUSY_CACHE[mecanicoId];
    if (cache && (Date.now() - cache.timestamp) < MECANICO_SCHEDULE_TTL) {
        return Promise.resolve(cache);
    }
    if (G_MECANICO_BUSY_PENDING[mecanicoId]) {
        return G_MECANICO_BUSY_PENDING[mecanicoId];
    }
    var request = bearerFetch(API_BASE + '/workorders?mecanicoId=' + encodeURIComponent(mecanicoId))
        .then(function (res) {
            if (!res.ok) throw new Error('No se pudo cargar la agenda del mecánico.');
            return res.json();
        })
        .then(function (list) {
            var lookup = buildBusyLookup(Array.isArray(list) ? list : []);
            var payload = {
                timestamp: Date.now(),
                busyDays: lookup.busyDays,
                busyRanges: lookup.busyRanges
            };
            G_MECANICO_BUSY_CACHE[mecanicoId] = payload;
            return payload;
        })
        .catch(function (err) {
            console.error(err);
            throw err;
        })
        .finally(function () {
            delete G_MECANICO_BUSY_PENDING[mecanicoId];
        });
    G_MECANICO_BUSY_PENDING[mecanicoId] = request;
    return request;
}

function getSelectedMechanicBusyData() {
    if (!G_OT_SELECTED_MECANICO) {
        console.log('getSelectedMechanicBusyData: No hay mecánico seleccionado');
        return null;
    }
    var data = G_MECANICO_BUSY_CACHE[G_OT_SELECTED_MECANICO] || null;
    if (data) {
        console.log('getSelectedMechanicBusyData: Datos encontrados para mecánico', G_OT_SELECTED_MECANICO, 'busyDays count:', data.busyDays ? Object.keys(data.busyDays).length : 0);
    } else {
        console.log('getSelectedMechanicBusyData: No hay datos en caché para mecánico', G_OT_SELECTED_MECANICO, 'cache keys:', Object.keys(G_MECANICO_BUSY_CACHE));
    }
    return data;
}

function getDayMetadataForSelectedMechanic(date) {
    var data = getSelectedMechanicBusyData();
    if (!data || !data.busyDays) {
        console.log('getDayMetadataForSelectedMechanic: Sin datos - data:', data, 'G_OT_SELECTED_MECANICO:', G_OT_SELECTED_MECANICO);
        return null;
    }
    var key = formatISODateLocal(date);
    var entries = data.busyDays[key];
    if (!entries || !entries.length) {
        // Solo log para los primeros días para no saturar la consola
        if (date.getDate() <= 3) {
            console.log('getDayMetadataForSelectedMechanic: Sin entradas para', key, 'busyDays keys:', Object.keys(data.busyDays).slice(0, 5));
        }
        return null;
    }
    var tooltip = entries.slice(0, 3).map(function (item) {
        var label = item.numero || ('OT #' + item.id);
        if (item.vehiculo) label += ' · ' + item.vehiculo;
        return label + ' [' + formatShortDate(item.start) + ' → ' + formatShortDate(item.end) + ']';
    }).join('\n');
    if (entries.length > 3) {
        tooltip += '\n+' + (entries.length - 3) + ' asignaciones adicionales';
    }
    console.log('getDayMetadataForSelectedMechanic: Día ocupado encontrado para', key, 'entradas:', entries.length);
    return { busy: true, tooltip: tooltip, count: entries.length };
}

function handlePlannerRangeChange(range) {
    G_OT_SELECTED_RANGE.start = range && range.start ? range.start : '';
    G_OT_SELECTED_RANGE.end = range && range.end ? range.end : '';
    updateScheduleWarning();
}

function handleMecanicoSelectChange() {
    var mecanicoId = otMecanicoSelect && otMecanicoSelect.value ? parseInt(otMecanicoSelect.value, 10) : null;
    if (isNaN(mecanicoId)) mecanicoId = null;
    setSelectedMechanic(mecanicoId);
    toggleFechasHorasFields(!!mecanicoId);
}

/**
 * Habilitar o deshabilitar los campos de fechas y horas según si hay un mecánico seleccionado
 * @param {boolean} enabled - true para habilitar, false para deshabilitar
 */
function toggleFechasHorasFields(enabled) {
    // Deshabilitar/habilitar el contenedor del date range picker
    if (otDateRangeContainer) {
        if (enabled) {
            otDateRangeContainer.removeAttribute('disabled');
            otDateRangeContainer.removeAttribute('data-disabled');
            otDateRangeContainer.classList.remove('disabled');
            otDateRangeContainer.style.pointerEvents = 'auto';
            otDateRangeContainer.style.opacity = '1';
            otDateRangeContainer.style.cursor = 'pointer';
            otDateRangeContainer.setAttribute('tabindex', '0');
        } else {
            otDateRangeContainer.setAttribute('disabled', 'disabled');
            otDateRangeContainer.setAttribute('data-disabled', 'true');
            otDateRangeContainer.classList.add('disabled');
            otDateRangeContainer.style.pointerEvents = 'none';
            otDateRangeContainer.style.opacity = '0.5';
            otDateRangeContainer.style.cursor = 'not-allowed';
            otDateRangeContainer.setAttribute('tabindex', '-1');
            // Cerrar el picker si está abierto
            if (otRangePicker && typeof otRangePicker.close === 'function') {
                otRangePicker.close();
            } else if (otDatePickerPopover) {
                otDatePickerPopover.classList.remove('is-open');
                otDatePickerPopover.setAttribute('aria-hidden', 'true');
                otDateRangeContainer.setAttribute('aria-expanded', 'false');
            }
        }
    }
    
    // Deshabilitar/habilitar los inputs de hora
    if (otFechaInicioTimeInput) {
        otFechaInicioTimeInput.disabled = !enabled;
    }
    if (otFechaFinTimeInput) {
        otFechaFinTimeInput.disabled = !enabled;
    }
    
    // Deshabilitar/habilitar los time picker wrappers y sus inputs
    var horaInicioInput = document.getElementById('ot_gen_hora_inicio');
    var horaFinInput = document.getElementById('ot_gen_hora_fin');
    var horaInicioWrapper = horaInicioInput?.parentElement?.parentElement;
    var horaFinWrapper = horaFinInput?.parentElement?.parentElement;
    
    if (horaInicioWrapper) {
        if (enabled) {
            horaInicioWrapper.style.pointerEvents = 'auto';
            horaInicioWrapper.style.opacity = '1';
            if (horaInicioInput) {
                horaInicioInput.style.cursor = 'pointer';
            }
        } else {
            horaInicioWrapper.style.pointerEvents = 'none';
            horaInicioWrapper.style.opacity = '0.5';
            if (horaInicioInput) {
                horaInicioInput.style.cursor = 'not-allowed';
            }
        }
    }
    
    if (horaFinWrapper) {
        if (enabled) {
            horaFinWrapper.style.pointerEvents = 'auto';
            horaFinWrapper.style.opacity = '1';
            if (horaFinInput) {
                horaFinInput.style.cursor = 'pointer';
            }
        } else {
            horaFinWrapper.style.pointerEvents = 'none';
            horaFinWrapper.style.opacity = '0.5';
            if (horaFinInput) {
                horaFinInput.style.cursor = 'not-allowed';
            }
        }
    }
    
    // Deshabilitar/habilitar los popovers de time picker
    var horaInicioPicker = document.getElementById('ot_gen_hora_inicio_picker');
    var horaFinPicker = document.getElementById('ot_gen_hora_fin_picker');
    
    if (horaInicioPicker) {
        if (!enabled) {
            horaInicioPicker.classList.remove('is-open');
            horaInicioPicker.setAttribute('aria-hidden', 'true');
        }
    }
    
    if (horaFinPicker) {
        if (!enabled) {
            horaFinPicker.classList.remove('is-open');
            horaFinPicker.setAttribute('aria-hidden', 'true');
        }
    }
    
    console.log('[toggleFechasHorasFields] Campos de fechas y horas:', enabled ? 'habilitados' : 'deshabilitados');
}

function setSelectedMechanic(mecanicoId) {
    G_OT_SELECTED_MECANICO = mecanicoId || null;
    updateSelectedMechanicScheduleSet(G_OT_SELECTED_MECANICO);
    if (!G_OT_SELECTED_MECANICO) {
        updateScheduleWarning();
        if (otRangePicker && typeof otRangePicker.refreshMetadata === 'function') {
            otRangePicker.refreshMetadata();
        }
        return;
    }
    fetchMechanicAgenda(G_OT_SELECTED_MECANICO)
        .then(function () {
            updateScheduleWarning();
            if (otRangePicker && typeof otRangePicker.refreshMetadata === 'function') {
                otRangePicker.refreshMetadata();
            }
        })
        .catch(function () {
            if (otFechaAlertBox) {
                otFechaAlertBox.classList.remove('hidden');
                otFechaAlertBox.textContent = '⚠️ No se pudo cargar la agenda del mecánico seleccionado.';
            }
        });
}

function findBusyOverlaps(startDate, endDate) {
    var data = getSelectedMechanicBusyData();
    if (!data || !data.busyRanges || !data.busyRanges.length) return [];
    return data.busyRanges.filter(function (range) {
        return rangesOverlap(range.start, range.end, startDate, endDate);
    });
}

function getCurrentScheduleOverlaps() {
    if (!G_OT_SELECTED_MECANICO) return [];
    var start = parseISODate(G_OT_SELECTED_RANGE.start);
    var end = parseISODate(G_OT_SELECTED_RANGE.end);
    if (!start || !end) return [];
    return findBusyOverlaps(start, end);
}

function updateScheduleWarning() {
    if (!otFechaAlertBox) return;
    var overlaps = getCurrentScheduleOverlaps();
    if (!overlaps.length) {
        otFechaAlertBox.classList.add('hidden');
        otFechaAlertBox.innerHTML = '';
        return;
    }
    var header = overlaps.length === 1 ?
        '⚠️ El mecánico ya tiene 1 asignación en ese rango.' :
        '⚠️ El mecánico ya tiene ' + overlaps.length + ' asignaciones en ese rango.';
    var detailHtml = overlaps.slice(0, 2).map(function (item) {
        var numero = escapeHtml(item.numero || ('OT #' + item.id));
        var vehiculo = item.vehiculo ? ' · ' + escapeHtml(item.vehiculo) : '';
        var rangeLabel = '[' + formatShortDate(item.start) + ' → ' + formatShortDate(item.end) + ']';
        return '<div class="schedule-warning__item">' + numero + vehiculo + ' ' + rangeLabel + '</div>';
    }).join('');
    var extra = overlaps.length > 2 ?
        '<div class="schedule-warning__item">+' + (overlaps.length - 2) + ' asignaciones adicionales.</div>' :
        '';
    var footer = '<div class="schedule-warning__cta">Puedes continuar si confirmas el solapamiento.</div>';
    otFechaAlertBox.innerHTML = header + detailHtml + extra + footer;
    otFechaAlertBox.classList.remove('hidden');
}

function initOtDatePicker() {
    if (!otDateRangeContainer || !otDatePickerPopover || !otFechaInicioInput || !otFechaFinInput) {
        console.log('initOtDatePicker: Elementos del DOM no encontrados');
        return;
    }
    console.log('initOtDatePicker: Inicializando date picker con funciones:', {
        getDayMetadata: typeof getDayMetadataForSelectedMechanic,
        isDateAllowed: typeof isDateAllowedForSelectedMechanic
    });
    otRangePicker = createDateRangePicker({
        container: otDateRangeContainer,
        popover: otDatePickerPopover,
        startInput: otFechaInicioInput,
        endInput: otFechaFinInput,
        startDisplay: otFechaInicioDisplay,
        endDisplay: otFechaFinDisplay,
        getDayMetadata: getDayMetadataForSelectedMechanic,
        isDateAllowed: isDateAllowedForSelectedMechanic,
        onRangeChange: handlePlannerRangeChange,
    });
    if (otRangePicker) {
        otRangePicker.setRange(null, null);
        console.log('initOtDatePicker: Date picker inicializado correctamente');
    } else {
        console.log('initOtDatePicker: Error al crear date picker');
    }
}

function ensureMechanicsList() {
    if (Array.isArray(G_LISTA_USUARIOS) && G_LISTA_USUARIOS.length) {
        return Promise.resolve(G_LISTA_USUARIOS);
    }
    return bearerFetch(API_BASE + '/users?rol=mecanico')
        .then(function (res) {
            if (!res.ok) throw new Error('No se pudo obtener el listado de mecánicos');
            return res.json();
        })
        .then(function (list) {
            G_LISTA_USUARIOS = list || [];
            return G_LISTA_USUARIOS;
        });
}

function populateMechanicSelect(selectEl, placeholder) {
    if (!selectEl) return Promise.resolve();
    LoadingUtils.showTableLoading(selectEl.parentElement || selectEl, 'Cargando mecánicos...');
    selectEl.disabled = true;
    return ensureMechanicsList()
        .then(function (list) {
            if (!list.length) {
                selectEl.innerHTML = '<option value="">(Sin mecánicos disponibles)</option>';
                selectEl.disabled = true;
                return;
            }
            var options = ['<option value="">' + (placeholder || 'Selecciona un mecánico') + '</option>'].concat(
                list.map(function (mec) {
                    var label = (mec.nombre_completo || mec.email || ('ID ' + mec.id));
                    return '<option value="' + mec.id + '">' + escapeHtml(label) + '</option>';
                })
            );
            selectEl.innerHTML = options.join('');
            selectEl.disabled = false;
        })
        .catch(function (err) {
            console.error(err);
            selectEl.innerHTML = '<option value="">(Error al cargar)</option>';
            selectEl.disabled = true;
        });
}

function bindDateRange(startInput, endInput) {
    if (!startInput || !endInput) return;
    startInput.addEventListener('change', function () {
        if (startInput.value) {
            endInput.min = startInput.value;
            if (endInput.value && endInput.value < startInput.value) {
                endInput.value = startInput.value;
            }
        } else {
            endInput.min = '';
        }
    });
    endInput.addEventListener('change', function () {
        if (startInput.value && endInput.value && endInput.value < startInput.value) {
            startInput.value = endInput.value;
        }
    });
}

function resetDateRange(startInput, endInput) {
    if (startInput) {
        startInput.value = '';
        startInput.max = '';
    }
    if (endInput) {
        endInput.value = '';
        endInput.min = '';
    }
}

function updateVehiculosIndicators(totalVehiculos, totalSolicitudes) {
    if (vehPendNavLabel) {
        if (totalVehiculos > 0) {
            vehPendNavLabel.textContent = '(' + totalVehiculos + ')';
            vehPendNavLabel.classList.remove('is-hidden');
        } else {
            vehPendNavLabel.textContent = '';
            vehPendNavLabel.classList.add('is-hidden');
        }
    }

    if (vehPendTitle) {
        if (totalVehiculos > 0) {
            var label = '(' + totalSolicitudes + ' solicitudes · ' + totalVehiculos + ' vehículos)';
            vehPendTitle.textContent = label;
            vehPendTitle.classList.remove('is-hidden');
        } else {
            vehPendTitle.textContent = '';
            vehPendTitle.classList.add('is-hidden');
        }
    }
}

// Muestra un mensaje "wapo" global (arriba)
function flashMainStatus(kind, text) {
    var el = document.getElementById('mainStatus');
    if (!el) return;
    el.innerHTML = text; // Añadimos íconos
    el.className = 'status ' + kind; // kind puede ser 'ok' o 'bad'

    // Ocultar el mensaje después de 4 segundos
    setTimeout(function () {
        el.className = 'status hidden';
    }, 4000);
}

// Muestra un mensaje "wapo" dentro de un modal
function flashStatus(element, kind, text) {
    if (!element) return;
    element.innerHTML = text;
    element.className = 'status ' + kind;
}

/* ======================================================== */
/* --- AUTENTICACIÓN Y NAVEGACIÓN (Tu "esencia") --- */
/* ======================================================== */

// ========== LOGOUT (OBSOLETO - Ahora se usa logout_button.js) ==========
// Esta función se mantiene solo por compatibilidad hacia atrás
// El logout ahora se maneja automáticamente con logout_button.js
/*
function logout() {
    // openModal se define más adelante, pero podemos usar una referencia
    // que se actualizará cuando openModal esté disponible
    var modalId = 'modalLogoutConfirm';
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    } else {
        // Fallback: si el modal no existe, usar confirmación directa
        if (confirm('¿Está seguro de que desea cerrar sesión?')) {
            localStorage.removeItem(TOKEN_KEY);
            sessionStorage.clear();
            window.location.replace('/login.html');
        }
    }
}
// Exportar logout inmediatamente para que esté disponible cuando el HTML se carga
window.logout = logout;
*/

function bearerFetch(url, opts) {
    opts = opts || {};
    var h = new Headers(opts.headers || {});
    var t = localStorage.getItem(TOKEN_KEY);
    if (t) h.set('Authorization', 'Bearer ' + t);
    if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
    var o = {};
    for (var k in opts)
        if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    o.headers = h;
    o.cache = 'no-store';
    return fetch(url, o);
}

// Verifica el token al cargar, o redirige al login
// ACTUALIZADO: Ahora verifica el rol también
// IMPORTANTE: Esta función se llama requireAuthLocal() para NO interferir con window.requireAuth() de auth.js
// Esto evita recursión infinita cuando requireAuthForRole llama a window.requireAuth()
function requireAuthLocal() {
    // Si auth.js está disponible, usar requireAuthForRole directamente
    // requireAuthForRole internamente llama a window.requireAuth() de auth.js (NO a esta función)
    if (typeof window.requireAuthForRole === 'function') {
        return window.requireAuthForRole('jefe_taller')
            .then(function (user) {
                var n = document.getElementById('currentUserName');
                if (n) n.textContent = user.nombre_completo || user.email || 'Usuario';
                return user;
            });
    }

    // Fallback: implementación original (sin verificación de rol)
    // Usar bearerFetch directamente, NO window.requireAuth() para evitar recursión
    var t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
        window.location.replace('/login.html');
        return Promise.reject(new Error('No token'));
    }
    return bearerFetch(API_BASE + '/auth/me') // Llama a tu @Get('me')
        .then(function (r) {
            if (!r.ok) throw 0; // Si falla (404 o 401), va al catch
            return r.json();
        })
        .then(function (me) {
            // Verificar rol manualmente como fallback
            var userRole = (me.rol || '').toLowerCase();
            if (userRole !== 'jefe_taller') {
                console.warn('Usuario con rol "' + userRole + '" intentó acceder a dashboard de jefe_taller');
                // Redirigir al dashboard apropiado
                if (userRole === 'mecanico') {
                    window.location.replace('/mecanico_dashboard.html');
                } else if (userRole === 'chofer') {
                    window.location.replace('/chofer_dashboard.html');
                } else if (userRole === 'admin') {
                    window.location.replace('/admin_dashboard.html');
                } else {
                    window.location.replace('/login.html');
                }
                throw new Error('Rol no autorizado');
            }

            var n = document.getElementById('currentUserName');
            if (n) n.textContent = me.nombre_completo || me.email || 'Usuario';
            return me;
        })
        .catch(function () {
            // Si el token es inválido o expiró, borra el token y patea al login
            localStorage.removeItem(TOKEN_KEY);
            window.location.replace('/login.html');
            return Promise.reject(new Error('Auth failed'));
        });
}

// Lógica de pestañas (Tu "esencia")
function switchTab(name) {
    var sections = document.querySelectorAll('.tab');
    for (var i = 0; i < sections.length; i++) sections[i].classList.remove('active');
    var target = document.getElementById('tab-' + name);
    if (target) target.classList.add('active');

    var links = document.querySelectorAll('.nav-menu a');
    for (var j = 0; j < links.length; j++) links[j].classList.remove('active');
    var link = document.querySelector('.nav-menu a[data-tab="' + name + '"]');
    if (link) link.classList.add('active');

    if (name === 'dashboard') {
        // Actualizar estadísticas cuando se cambia al dashboard
        if (typeof loadDashboardStats === 'function') {
            loadDashboardStats();
        }
    }
    if (name === 'vehiculos') {
        if (window.vehiclesViewerJefe && typeof window.vehiclesViewerJefe.load === 'function') {
            window.vehiclesViewerJefe.load();
        } else if (typeof vehReload === 'function') {
            vehReload(); // Fallback al método antiguo
        }
    }
    if (name === 'ordenes-trabajo') {
        // Cargar órdenes de trabajo cuando se cambia a la pestaña
        if (typeof otList === 'function') {
            otList();
        }
    }
    if (name === 'mecanicos') mecReload();
    if (name === 'stock' && typeof window.stockJefeReload === 'function') {
        window.stockJefeReload();
    }
    if (name === 'verificaciones') {
        verificacionesReload();
    }
    if (name === 'historial-solicitudes') {
        initHistorialSolicitudes();
    }
}
window.switchTab = switchTab; // Para los botones del dashboard

// Conecta los clics de las pestañas
function bindTabs() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    nav.addEventListener('click', function (ev) {
        var a = ev.target.closest('a');
        if (!a) return;
        var tab = a.getAttribute('data-tab');
        if (!tab) return;
        ev.preventDefault();
        switchTab(tab);
    });
}

// Lógica de modales (Tu "esencia")
function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}

function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';

    if (id === 'modalGenerarOT' && otRangePicker) {
        otRangePicker.close();
    }

    // Limpiar mensajes de error al cerrar
    var msgDiv = el ? el.querySelector('.status.bad') : null;
    if (msgDiv) msgDiv.className = 'status hidden';
}
window.openModal = openModal;
window.closeModal = closeModal;

/* ======================================================== */
/* --- CRUD VEHÍCULOS (¡ARREGLADO!) --- */
/* ======================================================== */

// Dibuja los badges de estado (Tu "esencia")
function vehBadge(estado) {
    var map = {
        OPERATIVO: 'status-completado">Operativo',
        EN_TALLER: 'status-taller">En Taller',
        MANTENCION: 'status-mantencion">Mantención',
        INACTIVO: 'status-danger">Inactivo',
        CITA_MANTENCION: 'status-cita">Cita Mantención',
        STANDBY: 'status-standby">Standby',
        EN_REVISION: 'status-revision">En Revisión',
        COMPLETADO: 'status-completado">Completado',
        LISTO_PARA_RETIRO: 'status-completado">Listo para Retiro'
    };
    var inner = map[estado] || map.OPERATIVO;
    return '<span class="status-badge ' + inner + '</span>';
}

// Dibuja la tabla
function vehRender(list) {
    if (!vehTBody) return;
    list = Array.isArray(list) ? list : [];
    var totalVehPend = 0;
    var totalSolicPend = 0;

    vehTBody.innerHTML = list.map(function (v) {
        var pendCount = Number(v.solicitudesPendientes || 0);
        if (pendCount > 0) {
            totalVehPend++;
            totalSolicPend += pendCount;
        }

        var rowClass = pendCount > 0 ? 'veh-row-pendiente' : '';
        var pendText = pendCount ? 'Solicitud pendiente (' + pendCount + ')' : '';
        var pendingTag = pendCount ?
            '<div class="veh-pending-tag">' + pendText + '</div>' :
            '';

        var fecha = formatDate(v.fecha_creacion || v.fechaIngreso);

        return `
            <tr data-id="${v.id}" class="${rowClass}">
                <td>${v.id}</td>
                <td>
                    <div class="veh-patente-cell">
                        <strong>${v.patente}</strong>
                        ${pendingTag}
                    </div>
                </td>
                <td>${v.marca || '-'}</td>
                <td>${v.modelo || '-'}</td>
                <td>${v.anio_modelo || '-'}</td>
                <td>${v.vin || '-'}</td>
                <td>${vehBadge(v.estado)}</td>
                <td>${fecha}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm" onclick="vehOpenEdit(${v.id})">
                            <span class="btn-icon">✏️</span> Editar
                        </button>
                        <button class="btn btn-success btn-sm" onclick="vehGenerarOT(${v.id}, '${v.patente}')">
                            <span class="btn-icon">🔧</span> OT
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="vehDelete(${v.id})">
                            <span class="btn-icon">🗑️</span> Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateVehiculosIndicators(totalVehPend, totalSolicPend);
    // updateDashboardStats ya no se llama aquí porque ahora necesita datos de OTs también
    // Se llama desde loadDashboardStats() que carga ambos
}

// Carga la lista de vehículos
function vehList() {
    return bearerFetch(API_BASE + '/vehicles')
        .then(function (r) {
            if (!r.ok) throw new Error('No se pudo listar');
            return r.json();
        })
        .then(vehRender)
        .catch(function (e) {
            flashMainStatus('bad', '❌ Error al cargar vehículos: ' + e.message);
        });
}

function vehReload() {
    return vehList();
}
window.vehReload = vehReload; // Para el botón de "Actualizar Lista"

// Función para mostrar/ocultar campos de OT
function toggleOtFields() {
    var checkbox = document.getElementById('veh_add_generar_ot');
    var fields = document.getElementById('veh_add_ot_fields');
    var problema = document.getElementById('veh_add_problema');
    var estadoOt = document.getElementById('veh_add_estado_ot');

    if (checkbox && fields) {
        if (checkbox.checked) {
            fields.style.display = 'block';
            if (problema) problema.required = true;
            if (estadoOt) estadoOt.required = true;
            if (vehAddMecanicoSelect) {
                vehAddMecanicoSelect.required = true;
                populateMechanicSelect(vehAddMecanicoSelect, 'Selecciona un mecánico');
            }
            if (vehAddFechaInicioInput) vehAddFechaInicioInput.required = true;
            if (vehAddFechaFinInput) vehAddFechaFinInput.required = true;
        } else {
            fields.style.display = 'none';
            if (problema) {
                problema.required = false;
                problema.value = '';
            }
            if (estadoOt) {
                estadoOt.required = false;
                estadoOt.value = '';
            }
            if (vehAddMecanicoSelect) {
                vehAddMecanicoSelect.required = false;
                vehAddMecanicoSelect.value = '';
            }
            if (vehAddFechaInicioInput) {
                vehAddFechaInicioInput.required = false;
                vehAddFechaInicioInput.value = '';
            }
            if (vehAddFechaFinInput) {
                vehAddFechaFinInput.required = false;
                vehAddFechaFinInput.value = '';
            }
        }
    }
}
window.toggleOtFields = toggleOtFields;

/* --- CREAR (Mensaje Arreglado) --- */
function vehHandleAddSubmit(ev) {
    ev.preventDefault();
    var msgDiv = document.getElementById('vehAddMsg');
    if (msgDiv) msgDiv.classList.add('hidden');

    // Validar campos de OT si el checkbox está marcado
    var generarOt = document.getElementById('veh_add_generar_ot').checked;
    if (generarOt) {
        var problema = document.getElementById('veh_add_problema').value.trim();
        var estadoOt = document.getElementById('veh_add_estado_ot').value;

        if (!problema) {
            if (msgDiv) flashStatus(msgDiv, 'bad', '❌ El problema es requerido cuando se genera una orden de trabajo');
            document.getElementById('veh_add_problema').focus();
            return;
        }

        if (!estadoOt) {
            if (msgDiv) flashStatus(msgDiv, 'bad', '❌ El estado de la orden de trabajo es requerido');
            document.getElementById('veh_add_estado_ot').focus();
            return;
        }
    }

    // 1. Leer datos del modal 'vehFormAdd'
    var patente = document.getElementById('veh_add_patente').value.trim().toUpperCase();
    var marca = document.getElementById('veh_add_marca').value.trim();
    var modelo = document.getElementById('veh_add_modelo').value.trim();
    var anio_modelo = document.getElementById('veh_add_anio_modelo').value;
    var vin = document.getElementById('veh_add_vin').value.trim();
    var problema = generarOt ? document.getElementById('veh_add_problema').value.trim() : '';

    // 2. Crear el 'body' que coincide con el CreateVehicleDto
    // NOTA: El vehículo se crea sin estado - el backend lo establecerá como OPERATIVO por defecto
    // El estado del vehículo se actualizará después si se crea una OT
    var data = {
        patente: patente,
        marca: marca,
        modelo: modelo,
        ...(anio_modelo && { anio_modelo: parseInt(anio_modelo, 10) }),
        ...(vin && { vin: vin })
    };

    // 3. Usar bearerFetch para enviar el token
    bearerFetch(API_BASE + '/vehicles', {
        method: 'POST',
        body: JSON.stringify(data)
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    var msj = (err.message || 'Error al crear');
                    if (Array.isArray(msj)) msj = msj.join(', ');
                    throw new Error(msj);
                });
            }
            return res.json();
        })
        .then(function (nuevoVehiculo) {
            var mensaje = generarOt && problema ?
                '✅ Vehículo ' + nuevoVehiculo.patente + ' registrado. Completa la orden a continuación.' :
                '✅ Vehículo ' + nuevoVehiculo.patente + ' registrado con éxito.';
            flashMainStatus('ok', mensaje);
            closeModal('modalVehAdd');
            if (vehFormAdd) vehFormAdd.reset();
            document.getElementById('veh_add_generar_ot').checked = false;
            toggleOtFields();
            vehReload();
            if (generarOt && problema) {
                setTimeout(function () {
                    vehGenerarOT(nuevoVehiculo.id, nuevoVehiculo.patente);
                }, 250);
            }
        })
        .catch(function (err) {
            if (msgDiv) flashStatus(msgDiv, 'bad', '❌ ' + (err.message || 'Error'));
        });
}

/* --- EDITAR (Abrir) (¡ARREGLADO!) --- */
function vehOpenEdit(id) {
    bearerFetch(API_BASE + '/vehicles/' + id) // Pide solo 1
        .then(function (r) {
            if (!r.ok) throw new Error('Vehículo no encontrado');
            return r.json();
        })
        .then(function (v) {
            if (!v) throw new Error('No existe el vehículo');

            // Llenar el formulario de EDICIÓN (el nuevo)
            document.getElementById('veh_edit_id').value = v.id;
            document.getElementById('veh_edit_patente').value = v.patente;
            document.getElementById('veh_edit_marca').value = v.marca || '';
            document.getElementById('veh_edit_modelo').value = v.modelo || '';
            document.getElementById('veh_edit_anio_modelo').value = v.anio_modelo || '';
            document.getElementById('veh_edit_vin').value = v.vin || '';
            document.getElementById('veh_edit_estado').value = v.estado;

            openModal('modalVehEdit');
        })
        .catch(function (e) {
            flashMainStatus('bad', '❌ Error al abrir editor: ' + e.message);
        });
}
window.vehOpenEdit = vehOpenEdit;

/* --- EDITAR (Guardar) (¡ARREGLADO!) --- */
// Esta era la función que te faltaba
function vehHandleEditSubmit(ev) {
    ev.preventDefault();
    var msgDiv = document.getElementById('vehEditMsg');
    if (msgDiv) msgDiv.classList.add('hidden');

    var id = document.getElementById('veh_edit_id').value;
    if (!id) {
        if (msgDiv) flashStatus(msgDiv, 'bad', '❌ No se encontró el ID del vehículo.');
        return;
    }

    // 2. Leer datos del modal 'vehFormEdit' (el nuevo)
    var patente = document.getElementById('veh_edit_patente').value.trim().toUpperCase();
    var marca = document.getElementById('veh_edit_marca').value.trim();
    var modelo = document.getElementById('veh_edit_modelo').value.trim();
    var anio_modelo = document.getElementById('veh_edit_anio_modelo').value;
    var vin = document.getElementById('veh_edit_vin').value.trim();
    var estado = document.getElementById('veh_edit_estado').value;

    // 3. Crear el 'body' que coincide con el UpdateVehicleDto
    var data = {
        patente: patente,
        marca: marca,
        modelo: modelo,
        estado: estado,
        ...(anio_modelo && { anio_modelo: parseInt(anio_modelo, 10) }),
        ...(vin && { vin: vin })
    };

    // 4. Usar bearerFetch con PATCH y el ID en la URL
    bearerFetch(API_BASE + '/vehicles/' + id, {
        method: 'PATCH',
        body: JSON.stringify(data)
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    var msj = (err.message || 'Error al actualizar');
                    if (Array.isArray(msj)) msj = msj.join(', ');
                    throw new Error(msj);
                });
            }
            return res.json();
        })
        .then(function (vehiculoActualizado) {
            flashMainStatus('ok', '✅ Vehículo ' + vehiculoActualizado.patente + ' actualizado.');
            closeModal('modalVehEdit');
            if (vehFormEdit) vehFormEdit.reset();
            vehReload();
        })
        .catch(function (err) {
            if (msgDiv) flashStatus(msgDiv, 'bad', '❌ ' + (err.message || 'Error'));
        });
}

/* --- ELIMINAR (¡ARREGLADO!) --- */
// Arreglado para no esperar un JSON
function vehDelete(id) {
    if (!confirm('¿Eliminar vehículo ID ' + id + '?')) return;
    bearerFetch(API_BASE + '/vehicles/' + id, {
        method: 'DELETE'
    })
        .then(function (r) {
            if (!r.ok) {
                // Si el error SÍ tiene JSON (como un 403), lo leemos
                return r.json().then(function (b) {
                    throw new Error(b.message || 'No se pudo eliminar');
                }).catch(function () {
                    // Si el error no tiene JSON (como un 500)
                    throw new Error('Error ' + r.status + ': No se pudo eliminar');
                });
            }
            /* * ¡ARREGLO! No llamamos a r.json() si r.ok es true.
             * Un DELETE exitoso (204 No Content) no tiene cuerpo
             * y causaba el error "Unexpected end of JSON input".
             */
            return r; // Solo pasamos la respuesta exitosa
        })
        .then(function () {
            // Usamos el 'id' que ya teníamos
            flashMainStatus('ok', '✅ Vehículo ID ' + id + ' eliminado.');
            vehReload();
        })
        .catch(function (err) {
            flashMainStatus('bad', '❌ Error al eliminar: ' + err.message);
        });
}

function vehConfirmDelete() {
    var id = +document.getElementById('veh_edit_id').value;
    if (!id) return;
    closeModal('modalVehEdit');
    vehDelete(id);
}
window.vehDelete = vehDelete;
window.vehConfirmDelete = vehConfirmDelete;

// Dibuja los badges de estado de USUARIO
function mecBadge(activo) {
    if (activo) {
        return '<span class="status-badge status-completado">Activo</span>';
    } else {
        return '<span class="status-badge status-danger">Inactivo</span>';
    }
}

// Dibuja la tabla de usuarios, aplicando el filtro
function mecRender() {
    if (!mecTBody) return;

    mecTBody.innerHTML = G_LISTA_USUARIOS.map(function (u) {
        return `
            <tr data-id="${u.id}">
                <td><strong>#${u.id}</strong></td>
                <td>
                    <div class="user-info">
                        <div class="user-name">${escapeHtml(u.nombre_completo || '')}</div>
                        <div class="user-email">${escapeHtml(u.email || '')}</div>
                    </div>
                </td>
                <td>${escapeHtml(u.rut || '-')}</td>
                <td>${mecBadge(u.activo)}</td>
                <td>${renderScheduleCompact(u.horario)}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="mecMostrarHorario(${u.id})">
                        <span class="btn-icon">📅</span> Horario
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Limpiar el tbody (excepto el template)
var existingRows = mecTBody.querySelectorAll('tr:not(#mecRowTemplate)');
existingRows.forEach(function (row) { row.remove(); });

// Crear filas desde el template
G_LISTA_USUARIOS.forEach(function (u) {
    var row = template.cloneNode(true);
    row.id = ''; // Remover el ID del template
    row.style.display = ''; // Mostrar la fila
    row.setAttribute('data-id', u.id);

    // Llenar los campos
    row.querySelector('.mec-id').textContent = u.id;
    row.querySelector('.mec-nombre').textContent = u.nombre_completo || '';
    row.querySelector('.mec-email').textContent = u.email || '';
    row.querySelector('.mec-rut').textContent = u.rut || '-';
    row.querySelector('.mec-estado').innerHTML = mecBadge(u.activo);
    row.querySelector('.mec-horario').innerHTML = renderScheduleCompact(u.horario);
    row.querySelector('.mec-acciones').innerHTML = renderScheduleAction(u);

    mecTBody.appendChild(row);
});


function populateMecanicoSelect() {
    if (!otMecanicoSelect) return;
    if (!G_LISTA_USUARIOS.length) {
        otMecanicoSelect.innerHTML = '<option value="">Sin mecánicos disponibles</option>';
        otMecanicoSelect.disabled = true;
        return;
    }
    var options = ['<option value="">Selecciona un mecánico</option>'];
    G_LISTA_USUARIOS.forEach(function (u) {
        var label = u.nombre_completo || u.email || ('Mecánico #' + u.id);
        options.push('<option value="' + u.id + '">' + escapeHtml(label) + '</option>');
    });
    otMecanicoSelect.innerHTML = options.join('');
    otMecanicoSelect.disabled = false;
}

function formatHour(value) {
    if (!value) return '--:--';
    return value.slice(0, 5);
}

function renderScheduleCompact(horario) {
    if (!horario) {
        return '<div class="schedule-chip"><span class="schedule-chip__empty">Sin horario</span></div>';
    }
    var bloques = [];
    DAY_LABELS.forEach(function (day) {
        var data = horario[day.key];
        if (data && data.activo && data.hora_inicio && data.hora_salida) {
            bloques.push('<span><strong>' + day.abbr + ':</strong> ' + formatHour(data.hora_inicio) + '-' + formatHour(data.hora_salida) + '</span>');
        }
    });
    if (!bloques.length) {
        return '<div class="schedule-chip"><span class="schedule-chip__empty">Sin horario</span></div>';
    }
    return '<div class="schedule-chip">' + bloques.join('') + '</div>';
}

function renderScheduleAction(usuario) {
    if (!usuario.horario) {
        return '<button class="btn btn-warning btn-sm" disabled>Sin horario</button>';
    }
    // Usar concatenación de strings explícita para evitar problemas
    return '<button class="btn btn-primary btn-sm" onclick="mecMostrarHorario(' + usuario.id + ')">Ver horario</button>';
}

function mecMostrarHorario(id) {
    var usuario = G_LISTA_USUARIOS.find(function (u) { return u.id === id; });
    if (!usuario) return;

    var tbody = document.getElementById('mecHorarioTableBody');
    if (tbody) {
        tbody.innerHTML = DAY_LABELS.map(function (day) {
            var data = usuario.horario ? usuario.horario[day.key] : null;
            var activo = data && data.activo;
            var jornada = activo && data.hora_inicio && data.hora_salida ?
                `<div class="schedule-time">
                     <span class="time-range">${formatHour(data.hora_inicio)} - ${formatHour(data.hora_salida)}</span>
                   </div>` :
                '<div class="schedule-off"><span>Fuera de turno</span></div>';

            var colacion = activo && data.colacion_inicio && data.colacion_salida ?
                `<div class="break-time">
                     <span>${formatHour(data.colacion_inicio)} - ${formatHour(data.colacion_salida)}</span>
                   </div>` :
                '<div class="no-break"><span>—</span></div>';

            var statusClass = activo ? 'day-active' : 'day-inactive';

            return `
                <tr class="${statusClass}">
                    <td class="day-name">
                        <strong>${day.label}</strong>
                    </td>
                    <td class="work-hours">
                        ${jornada}
                    </td>
                    <td class="break-hours">
                        ${colacion}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Actualizar información del modal
    var nombreEl = document.getElementById('mecModalNombre');
    var emailEl = document.getElementById('mecModalEmail');
    if (nombreEl) nombreEl.textContent = usuario.nombre_completo || '—';
    if (emailEl) emailEl.textContent = usuario.email || '—';

    openModal('modalMecanicoHorario');
}
window.mecMostrarHorario = mecMostrarHorario;

function mecReload() {
    // Usamos el endpoint del backend que ya tienes
    bearerFetch(API_BASE + '/users?rol=mecanico')
        .then(function (r) {
            if (r.status === 403) { // 403 (Forbidden)
                throw new Error('No tienes permiso para ver esta lista.');
            }
            if (!r.ok) {
                throw new Error('No se pudo listar los usuarios.');
            }
            return r.json();
        })
        .then(function (listaDeUsuarios) {
            G_LISTA_USUARIOS = listaDeUsuarios; // Guardamos en caché
            mecRender(); // Dibujamos por primera vez
            populateMecanicoSelect();
        })
        .catch(function (e) {
            flashMainStatus('bad', '❌ Error al cargar usuarios: ' + e.message);
            if (mecTBody) mecTBody.innerHTML = '<tr><td colspan="7">' + escapeHtml(e.message) + '</td></tr>';
        });
}

/* ======================================================== */
/* --- ÓRDENES DE TRABAJO --- */
/* ======================================================== */
var otTBody = document.querySelector('#otTBody');
var otFilters = { search: '', estado: '', fechaDesde: '', fechaHasta: '' };
var otCurrentPage = 1;
var otPageLimit = 12;
var otAllData = []; // Cache de todos los datos para paginación del lado del cliente
var solList = document.getElementById('solicitudesList');
var solListChoferes = document.getElementById('solicitudesChoferesList');
var solListMecanicos = document.getElementById('solicitudesMecanicosList');
var solModal = null;
var solModalBody = null;
var otSolicitudSelect = document.getElementById('ot_gen_solicitud');
var otNuevaSolicitudContainer = document.getElementById('ot_new_fields');
var otNuevaEvidenciaInput = document.getElementById('ot_new_evidencia');
var otNuevaEvidenciaResumen = document.getElementById('ot_new_evidencia_resumen');
var otNuevaEmergenciaCheckbox = document.getElementById('ot_new_emergencia');
var otMecanicoSelect = document.getElementById('ot_gen_mecanico');
var otPrioridadSelect = document.getElementById('ot_gen_prioridad');
var otFechaInicioInput = document.getElementById('ot_gen_fecha_inicio');
var otFechaFinInput = document.getElementById('ot_gen_fecha_fin');
// Wrappers para campos condicionales
var otProblemaWrapper = document.getElementById('ot_gen_problema_wrapper');
var otEvidenciasWrapper = document.getElementById('ot_new_evidencias_wrapper');
var otMecanicoWrapper = document.getElementById('ot_gen_mecanico_wrapper');
var otPrioridadWrapper = document.getElementById('ot_gen_prioridad_wrapper');
var otFechasWrapper = document.getElementById('ot_gen_fechas_wrapper');
var otEstadoWrapper = document.getElementById('ot_gen_estado_wrapper');
var otEditForm = document.getElementById('otFormEdit');
var otEditIdInput = document.getElementById('ot_edit_id');
var otEditProblemaInput = document.getElementById('ot_edit_problema');
var otEditPrioridadSelect = document.getElementById('ot_edit_prioridad');
var otEditEstadoSelect = document.getElementById('ot_edit_estado');
var otEditFechaInicioInput = document.getElementById('ot_edit_fecha_inicio');
var otEditFechaFinInput = document.getElementById('ot_edit_fecha_fin');
var otEditHoraInicioInput = document.getElementById('ot_edit_hora_inicio');
var otEditHoraFinInput = document.getElementById('ot_edit_hora_fin');
var otEditMsg = document.getElementById('otEditMsg');
var G_OT_EDIT_CURRENT = null;
var G_OT_SELECTED_SCHEDULE_DAYS = null;
var G_WORK_ORDERS_CACHE = []; // Cache global de work orders para verificar asociaciones con solicitudes
var DAY_KEY_TO_INDEX = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    sábado: 6
};
var G_SOLICITUDES_CACHE = [];
var G_OT_NUEVAS_EVIDENCIAS = [];
var G_OT_CURRENT_VEHICULO = null;
var SOLICITUD_TTL_DIAS = 3;
var socket = typeof window.io === 'function' ? window.io('/', { path: '/socket.io/' }) : null;
if (socket) {
    socket.on('connect', function () {
        console.log('Socket conectado para jefe de taller');
    });
    socket.on('solicitud:refresh', function () {
        console.log('Evento solicitud:refresh recibido en jefe de taller, refrescando solicitudes...');
        solReload();
        // Actualizar contador de verificaciones inmediatamente (sin importar en qué tab esté)
        updateVerificacionesPendNavLabel().then(function () {
            console.log('[Socket.IO] Contador de verificaciones actualizado');
        }).catch(function (err) {
            console.error('[Socket.IO] Error actualizando contador de verificaciones:', err);
        });
        // Si estamos en la pestaña de verificaciones, recargar la tabla completa
        var verificacionesTab = document.getElementById('tab-verificaciones');
        if (verificacionesTab && verificacionesTab.classList.contains('active')) {
            console.log('[Socket.IO] Recargando tabla de verificaciones (tab activa)');
            verificacionesReload();
        }
    });
    socket.on('reception:refresh', function () {
        console.log('Evento reception:refresh recibido en jefe de taller');
        // Refrescar también las solicitudes ya que pueden incluir OTs con discrepancia
        solReload();
        // Actualizar contador de verificaciones inmediatamente
        updateVerificacionesPendNavLabel().then(function () {
            console.log('[Socket.IO] Contador de verificaciones actualizado');
        }).catch(function (err) {
            console.error('[Socket.IO] Error actualizando contador de verificaciones:', err);
        });
        // Si estamos en la pestaña de verificaciones, recargar la tabla completa
        var verificacionesTab = document.getElementById('tab-verificaciones');
        if (verificacionesTab && verificacionesTab.classList.contains('active')) {
            verificacionesReload();
        }
    });
    socket.on('jefe-taller:notification', function (data) {
        console.log('Notificación recibida para jefe de taller:', data);

        // NotificationsManager manejará la notificación si está inicializado
        // Aquí solo manejamos actualizaciones de UI adicionales
        // Actualizar contador de verificaciones si hay un otId (OT cerrada o aprobada)
        if (data.otId) {
            updateVerificacionesPendNavLabel().then(function () {
                console.log('[Socket.IO] Contador de verificaciones actualizado (notificación)');
            }).catch(function (err) {
                console.error('[Socket.IO] Error actualizando contador de verificaciones:', err);
            });
            // Si estamos en la pestaña de verificaciones, recargar la tabla completa
            var verificacionesTab = document.getElementById('tab-verificaciones');
            if (verificacionesTab && verificacionesTab.classList.contains('active')) {
                verificacionesReload();
            }
        }
        // También recargar solicitudes
        solReload();
    });

    // Escuchar eventos de órdenes de trabajo para actualizar VehiclesViewer
    socket.on('workorders:refresh', function () {
        console.log('[Jefe Taller] Evento workorders:refresh recibido - recargando VehiclesViewer...');
        // Actualizar contador de verificaciones inmediatamente (sin importar en qué tab esté)
        updateVerificacionesPendNavLabel().then(function () {
            console.log('[Socket.IO] Contador de verificaciones actualizado (workorders:refresh)');
        }).catch(function (err) {
            console.error('[Socket.IO] Error actualizando contador de verificaciones:', err);
        });
        // Recargar VehiclesViewer manualmente como fallback
        if (window.vehiclesViewerJefe && typeof window.vehiclesViewerJefe.load === 'function') {
            window.vehiclesViewerJefe.load();
        }
        // También recargar lista de OTs
        if (typeof otReload === 'function') {
            otReload();
        }
        // Si estamos en la pestaña de verificaciones, recargar la tabla completa
        var verificacionesTab = document.getElementById('tab-verificaciones');
        if (verificacionesTab && verificacionesTab.classList.contains('active')) {
            verificacionesReload();
        }
    });
}

// Función auxiliar para crear OT desde un vehículo
function crearOTDesdeVehiculo(vehiculoId, problema, estado, solicitudId, extras) {
    var data = {
        vehiculoId: vehiculoId,
        descripcion: problema,
        prioridad: (extras && extras.prioridad) ? extras.prioridad : 'NORMAL',
        estado: estado || 'PENDIENTE' // Estado inicial de la OT
    };
    if (solicitudId) data.solicitudId = solicitudId;
    if (extras && extras.mecanicoId) data.mecanicoId = extras.mecanicoId;
    if (extras && extras.fechaInicioPlan) data.fechaInicioPlan = extras.fechaInicioPlan;
    if (extras && extras.fechaFinPlan) data.fechaFinPlan = extras.fechaFinPlan;

    return bearerFetch(API_BASE + '/workorders', {
        method: 'POST',
        body: JSON.stringify(data)
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    var msj = (err.message || 'Error al crear orden de trabajo');
                    if (Array.isArray(msj)) msj = msj.join(', ');
                    throw new Error(msj);
                });
            }
            return res.json();
        })
        .then(function (ot) {
            // Mapear el estado de la OT al estado válido del vehículo
            // Estados válidos de vehículos: OPERATIVO, EN_TALLER, MANTENCION, INACTIVO
            // Estados de OT: PENDIENTE, EN_PROCESO, ESPERA_REPUESTOS, LISTO, APROBADO, COMPLETADO
            var estadoVehiculo = null;
            if (estado) {
                if (estado === 'PENDIENTE' || estado === 'APROBADO') {
                    estadoVehiculo = 'CITA_MANTENCION';
                } else if (estado === 'EN_PROCESO') {
                    estadoVehiculo = 'MANTENCION';
                } else if (estado === 'ESPERA_REPUESTOS') {
                    estadoVehiculo = 'EN_TALLER';
                } else if (estado === 'LISTO') {
                    estadoVehiculo = 'MANTENCION';
                } else if (estado === 'COMPLETADO') {
                    estadoVehiculo = 'COMPLETADO';
                }
            }

            // Actualizar el estado del vehículo si se determinó un estado válido
            if (estadoVehiculo) {
                return bearerFetch(API_BASE + '/vehicles/' + vehiculoId, {
                    method: 'PATCH',
                    body: JSON.stringify({ estado: estadoVehiculo })
                })
                    .then(function () { return ot; })
                    .catch(function (err) {
                        // Si falla la actualización del vehículo, no fallar toda la operación
                        console.warn('No se pudo actualizar el estado del vehículo:', err);
                        return ot;
                    });
            }
            return ot;
        });
}

// Abrir modal para generar OT desde un vehículo existente
function vehGenerarOT(vehiculoId, patente) {
    document.getElementById('ot_gen_vehiculo_id').value = vehiculoId;
    document.getElementById('ot_gen_vehiculo_patente').value = patente;
    document.getElementById('ot_gen_problema').value = '';
    document.getElementById('ot_gen_estado').value = 'PENDIENTE';
    G_OT_CURRENT_VEHICULO = vehiculoId;
    G_SOLICITUDES_CACHE = [];
    G_OT_NUEVAS_EVIDENCIAS = [];
    if (otSolicitudSelect) otSolicitudSelect.value = '';
    if (otNuevaEmergenciaCheckbox) otNuevaEmergenciaCheckbox.checked = false;
    if (otNuevaEvidenciaInput) otNuevaEvidenciaInput.value = '';
    if (otNuevaEvidenciaResumen) otNuevaEvidenciaResumen.textContent = 'Debes adjuntar al menos una imagen.';
    mostrarCamposNuevaSolicitud(true);
    cargarSolicitudesParaVehiculo(vehiculoId);
    if (otMecanicoSelect) {
        if (!G_LISTA_USUARIOS.length) {
            otMecanicoSelect.innerHTML = '<option value="">Cargando mecánicos...</option>';
            otMecanicoSelect.disabled = true;
            mecReload();
        } else {
            populateMecanicoSelect();
            otMecanicoSelect.value = '';
        }
    }
    setOtPrioridad('NORMAL');
    setSelectedMechanic(null);
    toggleFechasHorasFields(false);
    if (otRangePicker) {
        var hoy = new Date();
        var manana = addDays(hoy, 1);
        otRangePicker.setRange(hoy, manana);
    } else {
        if (otFechaInicioInput) otFechaInicioInput.value = '';
        if (otFechaFinInput) otFechaFinInput.value = '';
    }
    if (otFechaInicioTimeInput) otFechaInicioTimeInput.value = DEFAULT_START_TIME;
    if (otFechaFinTimeInput) otFechaFinTimeInput.value = DEFAULT_END_TIME;
    // Actualizar visibilidad de campos condicionales al abrir el modal
    updateConditionalFieldsVisibility();
    openModal('modalGenerarOT');
}
window.vehGenerarOT = vehGenerarOT;

function cargarSolicitudesParaVehiculo(vehiculoId) {
    if (!otSolicitudSelect) return;
    otSolicitudSelect.innerHTML = '<option value="">-- Sin solicitud --</option>';
    bearerFetch(API_BASE + '/solicitudes/vehicle/' + vehiculoId)
        .then(function (res) {
            if (!res.ok) throw new Error('No se pudieron obtener las solicitudes');
            return res.json();
        })
        .then(function (list) {
            G_SOLICITUDES_CACHE = Array.isArray(list) ? list : [];
            var options = ['<option value="">-- Sin solicitud --</option>'].concat(
                G_SOLICITUDES_CACHE.map(function (sol) {
                    var texto = (sol.numero_solicitud || ('SOL-' + sol.id)) + ' — ' + (sol.descripcion_problema || '').slice(0, 40);
                    return '<option value="' + sol.id + '">' + escapeHtml(texto) + '</option>';
                })
            );
            otSolicitudSelect.innerHTML = options.join('');
            if (G_SOLICITUDES_CACHE.length) {
                otSolicitudSelect.value = String(G_SOLICITUDES_CACHE[0].id);
                handleSolicitudSelectChange();
            } else {
                mostrarCamposNuevaSolicitud(true);
                setOtPrioridad('NORMAL');
                updateConditionalFieldsVisibility();
            }
        })
        .catch(function (err) {
            console.error(err);
            otSolicitudSelect.innerHTML = '<option value="">(Error al cargar)</option>';
        });
}

function handleSolicitudSelectChange() {
    if (!otSolicitudSelect) return;
    var value = otSolicitudSelect.value;
    if (!value) {
        mostrarCamposNuevaSolicitud(true);
        setOtPrioridad('NORMAL');
        updateConditionalFieldsVisibility();
        return;
    }
    var sol = G_SOLICITUDES_CACHE.find(function (s) { return String(s.id) === String(value); });
    if (sol) {
        var problemaInput = document.getElementById('ot_gen_problema');
        if (problemaInput) problemaInput.value = sol.descripcion_problema || '';
        setOtPrioridad(mapUrgenciaToPrioridad(sol.urgencia, sol.tipo_solicitud));
        mostrarCamposNuevaSolicitud(false);
        // Cuando hay solicitud seleccionada, mostrar todos los campos
        showAllConditionalFields();
    } else {
        mostrarCamposNuevaSolicitud(true);
        setOtPrioridad('NORMAL');
        updateConditionalFieldsVisibility();
    }
}

function mostrarCamposNuevaSolicitud(show) {
    if (!otNuevaSolicitudContainer) return;
    otNuevaSolicitudContainer.style.display = show ? 'block' : 'none';
    if (show && (!otSolicitudSelect || !otSolicitudSelect.value)) {
        syncNuevaSolicitudPrioridad();
    }
}

function syncNuevaSolicitudPrioridad() {
    if (!otPrioridadSelect) return;
    if (otSolicitudSelect && otSolicitudSelect.value) return;
    if (otNuevaEmergenciaCheckbox && otNuevaEmergenciaCheckbox.checked) {
        otPrioridadSelect.value = 'URGENTE';
    } else {
        otPrioridadSelect.value = 'NORMAL';
    }
    // Actualizar visibilidad cuando cambia el checkbox de emergencia
    updateConditionalFieldsVisibility();
}

// Actualizar visibilidad de campos condicionales basado en selección de solicitud y checkbox de emergencia
function updateConditionalFieldsVisibility() {
    var sinSolicitud = !otSolicitudSelect || !otSolicitudSelect.value;
    var esEmergencia = otNuevaEmergenciaCheckbox && otNuevaEmergenciaCheckbox.checked;

    // Si hay solicitud seleccionada, mostrar todos los campos
    if (!sinSolicitud) {
        showAllConditionalFields();
        return;
    }

    // Si no hay solicitud y es emergencia, mostrar todos los campos
    if (sinSolicitud && esEmergencia) {
        showAllConditionalFields();
        return;
    }

    // Si no hay solicitud y NO es emergencia, ocultar campos condicionales
    if (sinSolicitud && !esEmergencia) {
        hideConditionalFields();
        return;
    }
}

// Mostrar todos los campos condicionales
function showAllConditionalFields() {
    var fields = [otProblemaWrapper, otEvidenciasWrapper, otMecanicoWrapper, otPrioridadWrapper, otFechasWrapper, otEstadoWrapper];
    fields.forEach(function (field) {
        if (field) field.style.display = 'block';
    });
}

// Ocultar campos condicionales (excepto el checkbox de emergencia)
function hideConditionalFields() {
    var fields = [otProblemaWrapper, otEvidenciasWrapper, otMecanicoWrapper, otPrioridadWrapper, otFechasWrapper, otEstadoWrapper];
    fields.forEach(function (field) {
        if (field) field.style.display = 'none';
    });
}

function handleNuevaEvidenciaChange(ev) {
    // Usar función centralizada de validaciones
    var validFiles = ValidationUtils.handleFileInputChange(ev, {
        fieldName: 'Evidencias',
        maxFiles: 5,
        onEmpty: function() {
            G_OT_NUEVAS_EVIDENCIAS = [];
            if (otNuevaEvidenciaResumen) otNuevaEvidenciaResumen.textContent = 'Debes adjuntar al menos un archivo.';
        },
        onClear: function() {
            G_OT_NUEVAS_EVIDENCIAS = [];
            if (otNuevaEvidenciaResumen) otNuevaEvidenciaResumen.textContent = 'Debes adjuntar al menos un archivo.';
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
            G_OT_NUEVAS_EVIDENCIAS = resultados.filter(Boolean);
            if (otNuevaEvidenciaResumen) {
                var nombres = validFiles.map(function (f) { return f.name; }).join(', ');
                otNuevaEvidenciaResumen.textContent = 'Listas: ' + nombres;
            }
        })
        .catch(function (err) {
            console.error(err);
            G_OT_NUEVAS_EVIDENCIAS = [];
            if (otNuevaEvidenciaResumen) otNuevaEvidenciaResumen.textContent = 'No se pudieron procesar los archivos.';
            alert('Error al procesar los archivos.');
        });
}

function leerArchivoComoBase64(file) {
    // Usar FileUtils para comprimir imágenes antes de convertir a base64
    return FileUtils.fileToBase64(file, true);
}

function crearSolicitudInterna(payload) {
    if (!payload || !payload.vehiculoId) {
        return Promise.reject(new Error('Vehículo no válido'));
    }
    if (!payload.imagenes || !payload.imagenes.length) {
        return Promise.reject(new Error('Debes adjuntar al menos una imagen'));
    }
    return bearerFetch(API_BASE + '/solicitudes/internal', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error(err.message || 'Error al crear solicitud');
                });
            }
            return res.json();
        })
        .then(function (sol) {
            return sol.id;
        });
}

// Manejar submit del formulario de generar OT
function otHandleGenerarSubmit(ev) {
    ev.preventDefault();
    var msgDiv = document.getElementById('otGenMsg');
    if (msgDiv) msgDiv.classList.add('hidden');

    var vehiculoId = parseInt(document.getElementById('ot_gen_vehiculo_id').value, 10);
    var problemaInput = document.getElementById('ot_gen_problema');
    var problema = problemaInput ? problemaInput.value.trim() : '';
    var estadoInput = document.getElementById('ot_gen_estado');
    var estado = estadoInput ? estadoInput.value : 'PENDIENTE';
    var solicitudId = otSolicitudSelect && otSolicitudSelect.value ? Number(otSolicitudSelect.value) : null;
    var emergencia = otNuevaEmergenciaCheckbox ? !!otNuevaEmergenciaCheckbox.checked : false;
    var mecanicoId = otMecanicoSelect && otMecanicoSelect.value ? parseInt(otMecanicoSelect.value, 10) : null;
    var prioridad = otPrioridadSelect && otPrioridadSelect.value ? otPrioridadSelect.value : 'NORMAL';
    var fechaInicioBase = otFechaInicioInput ? otFechaInicioInput.value : '';
    var fechaFinBase = otFechaFinInput ? otFechaFinInput.value : '';
    var fechaInicioIso = fechaInicioBase ? combineDateAndTime(fechaInicioBase, otFechaInicioTimeInput ? otFechaInicioTimeInput.value : '', DEFAULT_START_TIME) : '';
    var fechaFinIso = fechaFinBase ? combineDateAndTime(fechaFinBase, otFechaFinTimeInput ? otFechaFinTimeInput.value : '', DEFAULT_END_TIME) : '';

    // Determinar qué campos son visibles
    var sinSolicitud = !solicitudId;
    var esEmergencia = emergencia;
    var camposVisibles = !sinSolicitud || esEmergencia;

    // Validar solo campos visibles usando validations.js
    if (camposVisibles) {
        // Validar problema (requerido y mínimo 10 caracteres)
        if (problemaInput && otProblemaWrapper && otProblemaWrapper.style.display !== 'none') {
            var problemaRequired = ValidationUtils.validateRequired(problema, 'La descripción del problema');
            if (!problemaRequired.valid) {
                if (msgDiv) flashStatus(msgDiv, 'bad', problemaRequired.message);
                return;
            }
            var problemaMinLength = ValidationUtils.validateMinLength(problema, 10, 'La descripción del problema');
            if (!problemaMinLength.valid) {
                if (msgDiv) flashStatus(msgDiv, 'bad', problemaMinLength.message);
                return;
            }
        }

        // Validar mecánico
        if (otMecanicoSelect && otMecanicoWrapper && otMecanicoWrapper.style.display !== 'none') {
            var mecanicoRequired = ValidationUtils.validateRequired(mecanicoId, 'Asignar mecánico');
            if (!mecanicoRequired.valid) {
                if (msgDiv) flashStatus(msgDiv, 'bad', '❌ Debes seleccionar un mecánico para continuar.');
                return;
            }
        }

        // Validar fechas
        if (otFechasWrapper && otFechasWrapper.style.display !== 'none') {
            var fechaInicioRequired = ValidationUtils.validateRequired(fechaInicioBase, 'Fecha de inicio');
            var fechaFinRequired = ValidationUtils.validateRequired(fechaFinBase, 'Fecha de término');
            if (!fechaInicioRequired.valid) {
                if (msgDiv) flashStatus(msgDiv, 'bad', '❌ Selecciona el rango de fechas planificadas.');
                return;
            }
            if (!fechaFinRequired.valid) {
                if (msgDiv) flashStatus(msgDiv, 'bad', '❌ Selecciona el rango de fechas planificadas.');
                return;
            }

            var inicioDate = fechaInicioIso ? new Date(fechaInicioIso) : null;
            var finDate = fechaFinIso ? new Date(fechaFinIso) : null;
            if (!inicioDate || !finDate || isNaN(inicioDate.getTime()) || isNaN(finDate.getTime()) || finDate < inicioDate) {
                if (msgDiv) flashStatus(msgDiv, 'bad', '❌ La fecha de término debe ser posterior a la de inicio.');
                return;
            }
        }

        // Validar evidencias si no hay solicitud
        if (sinSolicitud && otEvidenciasWrapper && otEvidenciasWrapper.style.display !== 'none') {
            if (G_OT_NUEVAS_EVIDENCIAS.length === 0) {
                if (msgDiv) flashStatus(msgDiv, 'bad', '❌ Debes adjuntar al menos una imagen para crear la solicitud.');
                return;
            }
        }
    } else {
        // Si no hay campos visibles, no se puede generar OT sin emergencia
        if (msgDiv) flashStatus(msgDiv, 'bad', '❌ Debes marcar "Es emergencia" o seleccionar una solicitud para generar la OT.');
        return;
    }

    if (G_OT_SELECTED_MECANICO && !getSelectedMechanicBusyData() && G_MECANICO_BUSY_PENDING[G_OT_SELECTED_MECANICO]) {
        if (msgDiv) flashStatus(msgDiv, 'bad', '⌛ Espera a que carguemos la agenda del mecánico antes de continuar.');
        return;
    }

    var overlaps = getCurrentScheduleOverlaps();
    if (overlaps.length) {
        var confirmar = window.confirm('El mecánico seleccionado ya tiene ' + overlaps.length + ' asignación(es) en el rango indicado. ¿Deseas continuar igualmente?');
        if (!confirmar) {
            if (msgDiv) flashStatus(msgDiv, 'bad', '⚠️ Se canceló la generación para evitar el solapamiento.');
            return;
        }
    }

    var flujo = solicitudId ?
        Promise.resolve(solicitudId) :
        crearSolicitudInterna({
            vehiculoId: vehiculoId,
            descripcion: problema,
            emergencia: emergencia,
            imagenes: G_OT_NUEVAS_EVIDENCIAS
        });
    var extraPayload = {
        mecanicoId: mecanicoId,
        fechaInicioPlan: fechaInicioIso,
        fechaFinPlan: fechaFinIso,
        fechaEstimadaTermino: fechaFinIso,
        prioridad: prioridad
    };

    flujo
        .then(function (solId) {
            return crearOTDesdeVehiculo(vehiculoId, problema, estado, solId || null, extraPayload);
        })
        .then(function (ot) {
            flashMainStatus('ok', '✅ Orden de Trabajo ' + (ot.numero_ot || ot.id) + ' creada con éxito.');
            closeModal('modalGenerarOT');
            var form = document.getElementById('otFormGenerar');
            if (form) form.reset();
            if (otRangePicker) otRangePicker.setRange(null, null);
            G_OT_NUEVAS_EVIDENCIAS = [];
            vehReload();
            if (typeof otReload === 'function') otReload();

            // Recargar VehiclesViewer manualmente como fallback (además del evento Socket.IO)
            if (window.vehiclesViewerJefe && typeof window.vehiclesViewerJefe.load === 'function') {
                console.log('[Jefe Taller] Recargando VehiclesViewer manualmente después de crear OT...');
                window.vehiclesViewerJefe.load();
            }
        })
        .catch(function (err) {
            if (msgDiv) flashStatus(msgDiv, 'bad', '❌ ' + (err.message || 'Error'));
        });
}

// Badge de estado para OT
function otBadge(estado) {
    var map = {
        PENDIENTE: 'status-pendiente">Pendiente',
        EN_PROCESO: 'status-proceso">En Proceso',
        ESPERA_REPUESTOS: 'status-aprobacion">Espera Repuestos',
        LISTO: 'status-completado">Listo',
        APROBADO: 'status-completado">Aprobado',
        COMPLETADO: 'status-completado">Completado',
        CANCELADA: 'status-danger">Cancelada',
        PENDIENTE_AUTORIZACION_SUPERVISOR: 'status-aprobacion">Pendiente Autorización',
        PENDIENTE_VERIFICACION: 'status-aprobacion">Pendiente Verificación'
    };
    var inner = map[estado] || map.PENDIENTE;
    return '<span class="status-badge ' + inner + '</span>';
}

// Badge de prioridad para OT
function otPrioridadBadge(prioridad) {
    var map = {
        BAJA: 'status-completado">Baja',
        NORMAL: 'status-proceso">Normal',
        ALTA: 'status-aprobacion">Alta',
        URGENTE: 'status-danger">Urgente'
    };
    var inner = map[prioridad] || map.NORMAL;
    return '<span class="status-badge ' + inner + '</span>';
}

// Renderizar tabla de órdenes de trabajo
function otRender(list) {
    if (!otTBody) return;
    if (!list || list.length === 0) {
        otTBody.innerHTML = '<tr><td colspan="9">No hay órdenes de trabajo</td></tr>';
        return;
    }

    otTBody.innerHTML = list.map(function (ot) {
        var vehiculo = ot.vehiculo ? (ot.vehiculo.patente || '-') : '-';
        var mecanico = ot.mecanico ? (ot.mecanico.nombre_completo || ot.mecanico.email || '-') : '-';
        var problema = (ot.descripcion_problema || ot.problema || '-').substring(0, 50);
        if ((ot.descripcion_problema || ot.problema || '').length > 50) problema += '...';
        var fechaCreacion = formatDate(ot.fecha_apertura || ot.fecha_creacion);
        var fechaEstimada = formatDate(ot.fecha_estimada_termino || ot.fecha_finalizacion || ot.fecha_cierre);

        return [
            '<tr data-id="', ot.id, '">',
            '<td>', ot.numero_ot || ot.id, '</td>',
            '<td>', vehiculo, '</td>',
            '<td>', problema, '</td>',
            '<td>', mecanico, '</td>',
            '<td>', otPrioridadBadge(ot.prioridad || 'NORMAL'), '</td>',
            '<td>', otBadge(ot.estado), '</td>',
            '<td>', fechaCreacion, '</td>',
            '<td>', fechaEstimada || '-', '</td>',
            '<td>',
            '<button class="btn btn-primary btn-sm" onclick="otOpenEdit(' + ot.id + ')">Editar</button> ',
            '<button class="btn btn-danger btn-sm" onclick="otConfirmDelete(' + ot.id + ')">Eliminar</button>',
            '</td>',
            '</tr>'
        ].join('');
    }).join('');
}

function otFetchById(id) {
    return bearerFetch(API_BASE + '/workorders/' + id)
        .then(function (res) {
            if (!res.ok) throw new Error('No se pudo cargar la orden');
            return res.json();
        });
}

function extractTimeFromISO(isoString) {
    if (!isoString) return '';
    try {
        var date = new Date(isoString);
        var hours = String(date.getHours()).padStart(2, '0');
        var minutes = String(date.getMinutes()).padStart(2, '0');
        return hours + ':' + minutes;
    } catch (e) {
        return '';
    }
}

function fillOtEditModal(ot) {
    if (!ot) return;
    G_OT_EDIT_CURRENT = ot;
    if (otEditIdInput) otEditIdInput.value = ot.id;

    // Mostrar información de solo lectura
    var numeroDisplay = document.getElementById('ot_edit_numero_display');
    if (numeroDisplay) numeroDisplay.textContent = ot.numero_ot || ('OT-' + ot.id);

    var vehiculoDisplay = document.getElementById('ot_edit_vehiculo_display');
    if (vehiculoDisplay) {
        var vehiculo = ot.vehiculo ? (ot.vehiculo.patente || 'N/A') : 'N/A';
        vehiculoDisplay.textContent = vehiculo;
    }

    var mecanicoDisplay = document.getElementById('ot_edit_mecanico_display');
    if (mecanicoDisplay) {
        var mecanico = ot.mecanico ? (ot.mecanico.nombre_completo || ot.mecanico.email || 'N/A') : 'Sin asignar';
        mecanicoDisplay.textContent = mecanico;
    }

    if (otEditProblemaInput) otEditProblemaInput.value = ot.descripcion_problema || ot.descripcion || '';
    if (otEditPrioridadSelect) otEditPrioridadSelect.value = ot.prioridad || 'NORMAL';
    if (otEditEstadoSelect) otEditEstadoSelect.value = ot.estado || 'PENDIENTE';

    // Llenar fecha y hora de inicio
    var fechaInicioISO = ot.fecha_inicio_trabajo || ot.fecha_inicio_plan || ot.fecha_asignacion;
    if (otEditFechaInicioInput && fechaInicioISO) {
        var fechaInicio = new Date(fechaInicioISO);
        otEditFechaInicioInput.value = formatISODateLocal(fechaInicio);
    } else if (otEditFechaInicioInput) {
        otEditFechaInicioInput.value = '';
    }
    if (otEditHoraInicioInput && fechaInicioISO) {
        var timeInicio = extractTimeFromISO(fechaInicioISO);
        otEditHoraInicioInput.value = timeInicio;
        if (otEditHoraInicioInput.setTimeValue) {
            otEditHoraInicioInput.setTimeValue(timeInicio);
        }
    } else if (otEditHoraInicioInput) {
        otEditHoraInicioInput.value = DEFAULT_START_TIME;
        if (otEditHoraInicioInput.setTimeValue) {
            otEditHoraInicioInput.setTimeValue(DEFAULT_START_TIME);
        }
    }

    // Llenar fecha y hora de término
    var fechaFinISO = ot.fecha_estimada_termino || ot.fecha_finalizacion || ot.fecha_cierre || ot.fecha_fin_plan;
    if (otEditFechaFinInput && fechaFinISO) {
        var fechaFin = new Date(fechaFinISO);
        otEditFechaFinInput.value = formatISODateLocal(fechaFin);
    } else if (otEditFechaFinInput) {
        otEditFechaFinInput.value = '';
    }
    if (otEditHoraFinInput && fechaFinISO) {
        var timeFin = extractTimeFromISO(fechaFinISO);
        otEditHoraFinInput.value = timeFin;
        if (otEditHoraFinInput.setTimeValue) {
            otEditHoraFinInput.setTimeValue(timeFin);
        }
    } else if (otEditHoraFinInput) {
        otEditHoraFinInput.value = DEFAULT_END_TIME;
        if (otEditHoraFinInput.setTimeValue) {
            otEditHoraFinInput.setTimeValue(DEFAULT_END_TIME);
        }
    }

    if (otEditMsg) otEditMsg.classList.add('hidden');
}

function otOpenEdit(id) {
    otFetchById(id)
        .then(function (ot) {
            fillOtEditModal(ot);
            // Usar setTimeout para asegurar que el DOM esté listo, igual que otros modales
            setTimeout(function () {
                var modal = document.getElementById('modalOtEdit');
                if (modal) {
                    modal.style.display = 'flex';
                } else {
                    flashMainStatus('bad', '❌ Error: Modal no encontrado');
                }
            }, 10);
        })
        .catch(function (err) {
            flashMainStatus('bad', '❌ ' + (err.message || 'No se pudo cargar la orden'));
        });
}
window.otOpenEdit = otOpenEdit;

function buildOtEditPayload() {
    var payload = {};
    var descripcion = otEditProblemaInput ? otEditProblemaInput.value.trim() : '';
    if (descripcion) payload.descripcion = descripcion;
    var prioridad = otEditPrioridadSelect ? otEditPrioridadSelect.value : '';
    if (prioridad) payload.prioridad = prioridad;
    var estado = otEditEstadoSelect ? otEditEstadoSelect.value : '';
    if (estado) payload.estado = estado;

    // Combinar fecha y hora de inicio
    if (otEditFechaInicioInput && otEditFechaInicioInput.value) {
        var horaInicio = otEditHoraInicioInput ? otEditHoraInicioInput.value : DEFAULT_START_TIME;
        payload.fechaInicioPlan = combineDateAndTime(otEditFechaInicioInput.value, horaInicio, DEFAULT_START_TIME);
    }

    // Combinar fecha y hora de término
    if (otEditFechaFinInput && otEditFechaFinInput.value) {
        var horaFin = otEditHoraFinInput ? otEditHoraFinInput.value : DEFAULT_END_TIME;
        payload.fechaEstimadaTermino = combineDateAndTime(otEditFechaFinInput.value, horaFin, DEFAULT_END_TIME);
    }

    return payload;
}

function otHandleEditSubmit(ev) {
    ev.preventDefault();
    if (!otEditIdInput || !otEditIdInput.value) return;
    var msg = otEditMsg;
    if (msg) msg.classList.add('hidden');
    var payload = buildOtEditPayload();
    if (!Object.keys(payload).length) {
        if (msg) flashStatus(msg, 'bad', '⚠️ No hay cambios para guardar.');
        return;
    }
    bearerFetch(API_BASE + '/workorders/' + otEditIdInput.value, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error(err.message || 'No se pudo editar la orden');
                });
            }
            return res.json();
        })
        .then(function () {
            flashMainStatus('ok', '✅ Orden actualizada correctamente.');
            closeModal('modalOtEdit');
            if (otEditForm) otEditForm.reset();
            G_OT_EDIT_CURRENT = null;
            otReload();
            vehReload();
        })
        .catch(function (err) {
            if (msg) flashStatus(msg, 'bad', '❌ ' + (err.message || 'Error al editar'));
        });
}

function otConfirmDelete(id) {
    if (!id) return;
    if (!window.confirm('¿Eliminar la orden de trabajo seleccionada?')) return;
    bearerFetch(API_BASE + '/workorders/' + id, { method: 'DELETE' })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error(err.message || 'No se pudo eliminar la OT');
                });
            }
            return res.json();
        })
        .then(function () {
            flashMainStatus('ok', '✅ Orden cancelada.');
            otReload();
            vehReload();
        })
        .catch(function (err) {
            flashMainStatus('bad', '❌ ' + (err.message || 'No se pudo eliminar la OT'));
        });
}
window.otConfirmDelete = otConfirmDelete;

// Cargar lista de órdenes de trabajo con paginación
function otList(page) {
    // Actualizar página si se proporciona
    if (page !== undefined) {
        otCurrentPage = page;
    }

    // Construir query string con filtros
    var queryParams = [];

    // Cargar todos los datos (sin límite del servidor) para aplicar filtros y paginación del lado del cliente
    // Esto permite filtrado preciso con múltiples criterios
    queryParams.push('limit=1000'); // Cargar suficientes datos

    if (otFilters.search) {
        queryParams.push('search=' + encodeURIComponent(otFilters.search));
    }
    if (otFilters.estado) {
        queryParams.push('estado=' + encodeURIComponent(otFilters.estado));
    }
    if (otFilters.fechaDesde) {
        queryParams.push('fechaDesde=' + encodeURIComponent(otFilters.fechaDesde));
    }
    if (otFilters.fechaHasta) {
        queryParams.push('fechaHasta=' + encodeURIComponent(otFilters.fechaHasta));
    }

    var url = API_BASE + '/workorders';
    if (queryParams.length > 0) {
        url += '?' + queryParams.join('&');
    }

    // Mostrar loading
    if (otTBody) {
        otTBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">Cargando órdenes de trabajo...</td></tr>';
    }
    var paginationContainer = document.getElementById('otPagination');
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
    }

    return bearerFetch(url)
        .then(function (r) {
            if (r.status === 404) {
                // Si el endpoint no existe, retornar lista vacía
                return { data: [], pagination: null };
            }
            if (!r.ok) {
                throw new Error('No se pudo listar órdenes de trabajo');
            }
            return r.json();
        })
        .then(function (response) {
            // Manejar respuesta con paginación o sin paginación (compatibilidad hacia atrás)
            var allData = response.data || response;
            if (!Array.isArray(allData)) {
                allData = [];
            }

            // Guardar todos los datos en cache
            otAllData = allData;

            // Aplicar paginación del lado del cliente
            var total = allData.length;
            var totalPages = Math.ceil(total / otPageLimit);
            var startIndex = (otCurrentPage - 1) * otPageLimit;
            var endIndex = startIndex + otPageLimit;
            var paginatedData = allData.slice(startIndex, endIndex);

            // Renderizar datos paginados
            otRender(paginatedData);

            // Renderizar controles de paginación
            if (typeof window.PaginationUtils !== 'undefined' && window.PaginationUtils.createPagination && paginationContainer && totalPages > 1) {
                window.PaginationUtils.createPagination(paginationContainer, {
                    page: otCurrentPage,
                    limit: otPageLimit,
                    total: total,
                    totalPages: totalPages
                }, function (newPage) {
                    otList(newPage);
                });
            } else if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
        })
        .catch(function (e) {
            // Si hay error (endpoint no existe), mostrar mensaje pero no bloquear
            console.warn('Error al cargar órdenes de trabajo:', e.message);
            if (otTBody) otTBody.innerHTML = '<tr><td colspan="9">No se pudo cargar las órdenes de trabajo. El endpoint puede no estar disponible aún.</td></tr>';
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
        });
}

function otReload() {
    otList();
}

// ========== FUNCIONES DE FILTROS ==========
function applyOtFilters() {
    var searchInput = document.getElementById('otSearchInput');
    var estadoFilter = document.getElementById('otEstadoFilter');
    var fechaDesdeInput = document.getElementById('otFechaDesde');
    var fechaHastaInput = document.getElementById('otFechaHasta');

    otFilters.search = searchInput ? searchInput.value.trim() : '';
    otFilters.estado = estadoFilter ? estadoFilter.value : '';
    otFilters.fechaDesde = fechaDesdeInput ? fechaDesdeInput.value : '';
    otFilters.fechaHasta = fechaHastaInput ? fechaHastaInput.value : '';

    // Resetear a página 1 cuando se aplican filtros
    otCurrentPage = 1;
    otList();
}

function clearOtFilters() {
    otFilters = { search: '', estado: '', fechaDesde: '', fechaHasta: '' };
    var searchInput = document.getElementById('otSearchInput');
    var estadoFilter = document.getElementById('otEstadoFilter');
    var fechaDesdeInput = document.getElementById('otFechaDesde');
    var fechaHastaInput = document.getElementById('otFechaHasta');

    if (searchInput) searchInput.value = '';
    if (estadoFilter) estadoFilter.value = '';
    if (fechaDesdeInput) fechaDesdeInput.value = '';
    if (fechaHastaInput) fechaHastaInput.value = '';

    // Resetear a página 1 cuando se limpian filtros
    otCurrentPage = 1;
    otList();
}

window.applyOtFilters = applyOtFilters;
window.clearOtFilters = clearOtFilters;
window.otReload = otReload;

// ========= REPORTES =========
var reportsViewerJefe = null;
var reporteTypeSelectJefe = null;
var currentUserRoleJefe = 'jefe_taller';

/**
 * Inicializar sección de reportes para jefe de taller
 */
function initReportesJefe() {
    console.log('[Reportes Jefe] Inicializando módulo de reportes...');

    var reportsContainer = document.getElementById('reports-container-jefe');
    reporteTypeSelectJefe = document.getElementById('reporte-type-select-jefe');

    if (!reportsContainer || !reporteTypeSelectJefe) {
        console.warn('[Reportes Jefe] Elementos necesarios no encontrados');
        return;
    }

    // Obtener rol del usuario actual
    try {
        var token = localStorage.getItem('crm.token');
        if (token) {
            var payload = JSON.parse(atob(token.split('.')[1]));
            currentUserRoleJefe = payload.rol || payload.role || 'jefe_taller';
        }
    } catch (e) {
        console.warn('[Reportes Jefe] No se pudo obtener el rol del usuario, usando jefe_taller por defecto');
        currentUserRoleJefe = 'jefe_taller';
    }

    console.log('[Reportes Jefe] Rol del usuario:', currentUserRoleJefe);

    // Obtener reportes disponibles para este rol
    if (typeof ReportsViewer === 'undefined') {
        console.error('[Reportes Jefe] ReportsViewer no está disponible');
        reportsContainer.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 40px;">Error: Módulo de reportes no está disponible</p>';
        return;
    }

    var availableReports = ReportsViewer.getAvailableReports(currentUserRoleJefe);
    console.log('[Reportes Jefe] Reportes disponibles:', availableReports);

    // Llenar select con reportes disponibles
    reporteTypeSelectJefe.innerHTML = '';
    if (availableReports.length === 0) {
        reporteTypeSelectJefe.innerHTML = '<option value="">No hay reportes disponibles</option>';
        reportsContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No tienes acceso a ningún reporte</p>';
        return;
    }

    availableReports.forEach(function (report) {
        var option = document.createElement('option');
        option.value = report.type;
        option.textContent = report.label;
        reporteTypeSelectJefe.appendChild(option);
    });

    // Crear viewer inicial con el primer reporte disponible
    var initialReportType = availableReports[0].type;
    try {
        reportsViewerJefe = new ReportsViewer({
            container: reportsContainer,
            reportType: initialReportType,
            userRole: currentUserRoleJefe,
            bearerFetch: bearerFetch
        });
        console.log('[Reportes Jefe] ReportsViewer creado exitosamente');
    } catch (error) {
        console.error('[Reportes Jefe] Error al crear ReportsViewer:', error);
        reportsContainer.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 40px;">Error al inicializar reportes: ' + error.message + '</p>';
        return;
    }

    // Manejar cambio de tipo de reporte
    reporteTypeSelectJefe.addEventListener('change', function () {
        var tipo = this.value;
        console.log('[Reportes Jefe] Cambiando tipo de reporte a:', tipo);

        if (reportsViewerJefe) {
            try {
                reportsViewerJefe.setReportType(tipo);
                console.log('[Reportes Jefe] Tipo de reporte cambiado exitosamente');
            } catch (error) {
                console.error('[Reportes Jefe] Error al cambiar tipo de reporte:', error);
                alert('Error al cambiar tipo de reporte: ' + error.message);
            }
        }
    });
}

window.initReportesJefe = initReportesJefe;

/* ===== STATS ===== */
// Función actualizada para calcular estadísticas desde vehículos y OTs
function updateDashboardStats(vehicles, workOrders) {
    try {
        // Calcular "Vehículos en Taller"
        // Un vehículo está en taller si tiene una OT activa (no completada/cancelada)
        // Prioridad: OTs con fecha_ingreso_recepcion > OTs activas > Estados de vehículo
        var vehiculosEnTaller = 0;
        var vehiculosEnTallerSet = new Set(); // Para evitar contar el mismo vehículo dos veces

        if (workOrders && Array.isArray(workOrders)) {
            console.log('[updateDashboardStats] Procesando', workOrders.length, 'OTs para calcular vehículos en taller');

            for (var k = 0; k < workOrders.length; k++) {
                var ot = workOrders[k];
                var estadoOt = (ot.estado || '').toUpperCase();

                // Un vehículo está en taller si:
                // 1. Tiene una OT que no está completada o cancelada
                // 2. Y tiene un vehículo asociado
                if (ot.vehiculo && ot.vehiculo.id &&
                    estadoOt !== 'COMPLETADO' &&
                    estadoOt !== 'CANCELADA') {

                    // Priorizar OTs que fueron recibidas en el taller (tienen fecha_ingreso_recepcion)
                    // pero también contar OTs activas sin fecha_ingreso_recepcion
                    if (ot.fecha_ingreso_recepcion) {
                        vehiculosEnTallerSet.add(ot.vehiculo.id);
                        console.log('[updateDashboardStats] Vehículo', ot.vehiculo.id, 'en taller (OT recibida):', ot.numero_ot);
                    } else if (estadoOt === 'EN_PROCESO' || estadoOt === 'APROBADO' || estadoOt === 'ESPERA_REPUESTOS' || estadoOt === 'LISTO' || estadoOt === 'PENDIENTE_VERIFICACION') {
                        // OT activa pero sin fecha_ingreso_recepcion (aún no recibida físicamente)
                        vehiculosEnTallerSet.add(ot.vehiculo.id);
                        console.log('[updateDashboardStats] Vehículo', ot.vehiculo.id, 'en taller (OT activa):', ot.numero_ot);
                    }
                }
            }
        }
        vehiculosEnTaller = vehiculosEnTallerSet.size;
        console.log('[updateDashboardStats] Total vehículos en taller (desde OTs):', vehiculosEnTaller);

        // Fallback: Si no hay OTs o el conteo es 0, contar por estado del vehículo
        if (vehiculosEnTaller === 0 && vehicles && Array.isArray(vehicles)) {
            console.log('[updateDashboardStats] Usando fallback: contando por estado del vehículo');
            for (var i = 0; i < vehicles.length; i++) {
                var v = vehicles[i];
                var estado = (v.estado || '').toUpperCase();
                // Estados que indican que el vehículo está en taller
                if (estado === 'EN_TALLER' ||
                    estado === 'MANTENCION' ||
                    estado === 'CITA_MANTENCION' ||
                    estado === 'EN_REVISION' ||
                    estado === 'COMPLETADO' ||
                    estado === 'LISTO_PARA_RETIRO') {
                    vehiculosEnTaller++;
                    console.log('[updateDashboardStats] Vehículo', v.id, 'en taller (por estado):', estado);
                }
            }
        }

        console.log('[updateDashboardStats] Total final vehículos en taller:', vehiculosEnTaller);

        // Calcular estadísticas de OTs
        var enProceso = 0;
        var completadosHoy = 0;
        var pendientesAprobacion = 0;

        if (workOrders && Array.isArray(workOrders)) {
            var hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            for (var j = 0; j < workOrders.length; j++) {
                var ot = workOrders[j];
                var estado = (ot.estado || '').toUpperCase();

                if (estado === 'EN_PROCESO') {
                    enProceso++;
                } else if (estado === 'PENDIENTE_VERIFICACION') {
                    pendientesAprobacion++;
                } else if (estado === 'COMPLETADO' && ot.fecha_completado) {
                    var fechaCompletado = new Date(ot.fecha_completado);
                    fechaCompletado.setHours(0, 0, 0, 0);
                    if (fechaCompletado.getTime() === hoy.getTime()) {
                        completadosHoy++;
                    }
                }
            }
        }

        // Actualizar elementos del DOM
        var a = document.getElementById('total-vehiculos');
        if (a) a.textContent = vehiculosEnTaller;

        var b = document.getElementById('vehiculos-proceso');
        if (b) b.textContent = enProceso;

        var c = document.getElementById('completados-hoy');
        if (c) c.textContent = completadosHoy;

        var d = document.getElementById('pendientes-aprobacion');
        if (d) d.textContent = pendientesAprobacion;
    } catch (e) {
        console.error('Error al actualizar estadísticas del dashboard:', e);
    }
}

// Función para cargar y actualizar todas las estadísticas
function loadDashboardStats() {
    Promise.all([
        bearerFetch(API_BASE + '/vehicles')
            .then(function (r) {
                if (!r.ok) return [];
                return r.json();
            })
            .catch(function () { return []; }),
        bearerFetch(API_BASE + '/workorders')
            .then(function (r) {
                if (!r.ok) return [];
                return r.json().then(function (data) {
                    return data.data || data || [];
                });
            })
            .catch(function () { return []; })
    ]).then(function (results) {
        var vehicles = results[0];
        var workOrders = results[1];
        updateDashboardStats(vehicles, workOrders);
    }).catch(function (err) {
        console.error('Error al cargar estadísticas:', err);
    });
}

/* ======================================================== */
/* --- INIT --- */
/* ======================================================== */
(function init() {
    var authPromise = requireAuthLocal();

    // Si requireAuth retorna una Promise, esperarla
    if (authPromise && typeof authPromise.then === 'function') {
        authPromise
            .then(function (user) {
                // Autenticación exitosa, inicializar el resto
                initializeDashboard(user);
            })
            .catch(function (err) {
                // Si hay error, requireAuth ya maneja la redirección
                // Pero por si acaso, no inicializar nada más
                console.error('Error de autenticación en init:', err);
            });
    } else {
        // Fallback: si requireAuth no retorna Promise, inicializar inmediatamente
        initializeDashboard();
    }

    function initializeDashboard(user) {
        // Inicializar NotificationsManager si está disponible
        if (user && typeof NotificationsManager !== 'undefined') {
            NotificationsManager.init(user.id, function (entityId, entityType) {
                // Callback cuando se hace clic en una notificación
                if (entityType === 'ORDEN_TRABAJO' && entityId) {
                    // Abrir modal de revisar OT si está disponible
                    if (typeof openRevisarOTModal === 'function') {
                        openRevisarOTModal(entityId);
                    } else {
                        // Alternativa: cambiar a la pestaña de verificaciones
                        if (typeof switchTab === 'function') {
                            switchTab('verificaciones');
                        }
                    }
                }
            });

            // Suscribirse a notificaciones de Socket.IO si el socket está disponible
            if (socket && typeof NotificationsManager.subscribeToSocket === 'function') {
                NotificationsManager.subscribeToSocket(
                    socket,
                    'jefe-taller:notification',
                    function (data) {
                        // Filtrar notificaciones para este usuario específico
                        return data.jefeId === user.id;
                    }
                );
            }
        }

        // Tareas de arranque (solo después de autenticación exitosa)
        bindTabs();

        // Inicializar VehiclesViewer para jefe de taller
        if (typeof window.VehiclesViewer !== 'undefined') {
            var vehiclesContainerJefe = document.getElementById('vehicles-container-jefe');
            if (vehiclesContainerJefe) {
                try {
                    window.vehiclesViewerJefe = new window.VehiclesViewer({
                        container: vehiclesContainerJefe,
                        bearerFetch: bearerFetch,
                        socket: socket, // Pasar el socket para actualizaciones en tiempo real
                        enableSocketIO: true, // Habilitar Socket.IO
                        showGenerateOTButton: true, // Jefe de taller puede generar OT
                        onGenerateOT: function (vehicleId, patente) {
                            // Callback para generar OT desde vehículo
                            if (typeof vehGenerarOT === 'function') {
                                vehGenerarOT(vehicleId, patente);
                            }
                        },
                        onVehicleAdded: function (vehicle) {
                            // Actualizar estadísticas del dashboard
                            if (typeof vehReload === 'function') {
                                vehReload(); // Para actualizar stats
                            }
                        },
                        onVehicleUpdated: function (vehicle) {
                            // Actualizar estadísticas del dashboard
                            if (typeof vehReload === 'function') {
                                vehReload(); // Para actualizar stats
                            }
                        },
                        onVehicleDeleted: function (vehicleId) {
                            // Actualizar estadísticas del dashboard
                            if (typeof vehReload === 'function') {
                                vehReload(); // Para actualizar stats
                            }
                        },
                        onVehiclesLoaded: function (vehicles, totalVehPend, totalSolicPend) {
                            // Actualizar indicadores de solicitudes pendientes en el menú
                            if (typeof updateVehiculosIndicators === 'function') {
                                updateVehiculosIndicators(totalVehPend, totalSolicPend);
                            }
                        }
                    });
                    console.log('[Jefe Taller] VehiclesViewer inicializado:', window.vehiclesViewerJefe);

                    // Cargar vehículos inmediatamente para actualizar el contador del menú
                    if (window.vehiclesViewerJefe && typeof window.vehiclesViewerJefe.load === 'function') {
                        console.log('[Jefe Taller] Cargando vehículos iniciales para actualizar contador...');
                        window.vehiclesViewerJefe.load();
                    }
                } catch (error) {
                    console.error('[Jefe Taller] Error al inicializar VehiclesViewer:', error);
                }
            }
        }

        // Cargar estadísticas del dashboard
        loadDashboardStats();

        // Cargar vehículos (para compatibilidad con código existente)
        vehReload();

        initReportesJefe(); // Inicializar módulo de reportes

        // Mantener formularios antiguos por compatibilidad (si existen)
        if (vehFormAdd) {
            vehFormAdd.addEventListener('submit', vehHandleAddSubmit);
        }
        if (vehFormEdit) {
            vehFormEdit.addEventListener('submit', vehHandleEditSubmit);
        }
        initOtDatePicker();

        // Conectar formulario de generar OT
        var otFormGenerar = document.getElementById('otFormGenerar');
        if (otFormGenerar) {
            otFormGenerar.addEventListener('submit', otHandleGenerarSubmit);
        }
        if (otSolicitudSelect) {
            otSolicitudSelect.addEventListener('change', handleSolicitudSelectChange);
        }
        if (otMecanicoSelect) {
            otMecanicoSelect.addEventListener('change', handleMecanicoSelectChange);
        }
        if (otNuevaEmergenciaCheckbox) {
            otNuevaEmergenciaCheckbox.addEventListener('change', function () {
                syncNuevaSolicitudPrioridad();
                updateConditionalFieldsVisibility();
            });
        }
        if (otNuevaEvidenciaInput) {
            otNuevaEvidenciaInput.addEventListener('change', handleNuevaEvidenciaChange);
        }
        if (otEditForm) {
            otEditForm.addEventListener('submit', otHandleEditSubmit);
        }

        // Cargar órdenes de trabajo al inicializar
        if (typeof otReload === 'function') {
            otReload();
        }

        solReload();

        // Actualizar contador de verificaciones pendientes al inicializar
        if (typeof updateVerificacionesPendNavLabel === 'function') {
            updateVerificacionesPendNavLabel();
        }

        // Cargar mecánicos para que el modal/tab tenga datos disponibles
        mecReload();

        handleMecanicoSelectChange();

        // ========== LOGOUT (OBSOLETO - Ahora se usa logout_button.js) ==========
        // Event listeners removidos - ahora se manejan automáticamente con logout_button.js
        /*
        var btnLogout = document.getElementById('btnConfirmLogout');
        if (btnLogout) {
            btnLogout.addEventListener('click', function() {
                try {
                    localStorage.removeItem(TOKEN_KEY);
                    sessionStorage.clear();
                } finally {
                    closeModal('modalLogoutConfirm');
                    window.location.replace('/login.html');
                }
            });
        }
        */

    }
})();

/* ======================================================== */
/* --- Solicitudes --- */
/* ======================================================== */
function solReload() {
    // Re-inicializar contenedores si no se encontraron inicialmente
    if (!solListChoferes) {
        solListChoferes = document.getElementById('solicitudesChoferesList');
    }
    if (!solListMecanicos) {
        solListMecanicos = document.getElementById('solicitudesMecanicosList');
    }

    // Mostrar mensaje de carga en ambos contenedores
    if (solListChoferes) {
        LoadingUtils.showTableLoading(solListChoferes, 'Cargando solicitudes...');
    }
    if (solListMecanicos) {
        LoadingUtils.showTableLoading(solListMecanicos, 'Cargando solicitudes...');
    }

    // Cargar solicitudes y OTs con discrepancia pendiente en paralelo
    return Promise.all([
        bearerFetch(API_BASE + '/solicitudes').then(function (res) {
            if (!res.ok) throw new Error('No se pudo obtener las solicitudes');
            return res.json();
        }),
        bearerFetch(API_BASE + '/workorders').then(function (res) {
            if (!res.ok) return [];
            return res.json();
        }).catch(function () {
            return [];
        })
    ])
        .then(function (results) {
            var solicitudes = results[0] || [];
            var workOrders = results[1] || [];

            // Guardar workOrders en cache global para verificar asociaciones
            G_WORK_ORDERS_CACHE = workOrders;

            console.log('[JEFE TALLER - solReload] ===== RECEPCIÓN DE SOLICITUDES =====');
            console.log('[JEFE TALLER - solReload] Total solicitudes recibidas:', solicitudes.length);
            console.log('[JEFE TALLER - solReload] Total WorkOrders recibidas:', workOrders.length);

            // Logging detallado de cada solicitud recibida
            solicitudes.forEach(function (sol, index) {
                console.log(`[JEFE TALLER - solReload] Solicitud ${index + 1}:`, {
                    id: sol.id,
                    numero_solicitud: sol.numero_solicitud,
                    vehiculo_id: sol.vehiculo?.id || 'NO ASIGNADO',
                    vehiculo_patente: sol.vehiculo?.patente || 'NO DISPONIBLE',
                    vehiculo_marca: sol.vehiculo?.marca || 'N/A',
                    vehiculo_modelo: sol.vehiculo?.modelo || 'N/A',
                    conductor_id: sol.conductor?.id || 'NO ASIGNADO',
                    conductor_nombre: sol.conductor?.nombre_completo || 'N/A',
                    estado: sol.estado,
                    tipo_solicitud: sol.tipo_solicitud,
                    vehiculoCompleto: sol.vehiculo,
                    conductorCompleto: sol.conductor,
                    solicitudCompleta: sol
                });

                // Verificar inconsistencias
                if (!sol.vehiculo) {
                    console.warn(`[JEFE TALLER - solReload] ⚠️ ADVERTENCIA: Solicitud ${sol.id} (${sol.numero_solicitud}) NO TIENE VEHÍCULO ASIGNADO`);
                } else if (!sol.vehiculo.patente) {
                    console.warn(`[JEFE TALLER - solReload] ⚠️ ADVERTENCIA: Solicitud ${sol.id} (${sol.numero_solicitud}) tiene vehículo ID ${sol.vehiculo.id} pero SIN PATENTE`);
                } else if (sol.vehiculo.patente === 'NO DISPONIBLE' || sol.vehiculo.patente === 'N/A') {
                    console.warn(`[JEFE TALLER - solReload] ⚠️ ADVERTENCIA: Solicitud ${sol.id} (${sol.numero_solicitud}) tiene patente inválida: "${sol.vehiculo.patente}"`);
                }
            });
            console.log('solReload: Primeras 3 OTs:', workOrders.slice(0, 3).map(function (ot) {
                return {
                    id: ot.id,
                    numero_ot: ot.numero_ot,
                    discrepancia_diagnostico: ot.discrepancia_diagnostico,
                    discrepancia_diagnostico_aprobada: ot.discrepancia_diagnostico_aprobada,
                    discrepancia_diagnostico_rechazada: ot.discrepancia_diagnostico_rechazada
                };
            }));

            // Filtrar OTs con discrepancia pendiente (sin aprobar ni rechazar)
            var otsConDiscrepancia = workOrders.filter(function (ot) {
                // Verificar discrepancia (puede venir como boolean true, string "true", o número 1)
                var tieneDiscrepancia = ot.discrepancia_diagnostico === true ||
                    ot.discrepancia_diagnostico === 'true' ||
                    ot.discrepancia_diagnostico === 1;
                var noAprobada = !ot.discrepancia_diagnostico_aprobada ||
                    ot.discrepancia_diagnostico_aprobada === false ||
                    ot.discrepancia_diagnostico_aprobada === 0;
                var noRechazada = !ot.discrepancia_diagnostico_rechazada ||
                    ot.discrepancia_diagnostico_rechazada === false ||
                    ot.discrepancia_diagnostico_rechazada === 0;
                var resultado = tieneDiscrepancia && noAprobada && noRechazada;
                if (resultado) {
                    console.log('OT con discrepancia pendiente encontrada:', ot.id, ot.numero_ot, {
                        discrepancia_diagnostico: ot.discrepancia_diagnostico,
                        aprobada: ot.discrepancia_diagnostico_aprobada,
                        rechazada: ot.discrepancia_diagnostico_rechazada
                    });
                }
                return resultado;
            });

            console.log('Total de OTs con discrepancia pendiente:', otsConDiscrepancia.length);

            // Convertir OTs con discrepancia a formato de "solicitud" para mostrarlas en "Solicitudes de Mecánicos"
            var solicitudesDiscrepancia = otsConDiscrepancia.map(function (ot) {
                return {
                    id: 'ot-' + ot.id, // Prefijo para distinguir de solicitudes normales
                    numero_solicitud: ot.numero_ot,
                    tipo_solicitud: 'DISCREPANCIA',
                    descripcion_problema: ot.descripcion_problema,
                    estado: 'PENDIENTE',
                    fecha_solicitud: ot.discrepancia_diagnostico_fecha || ot.fecha_creacion,
                    vehiculo: ot.vehiculo,
                    conductor: null, // Sin conductor para que aparezca en "Solicitudes de Mecánicos"
                    mecanico: ot.mecanico,
                    // Datos adicionales de la discrepancia
                    _esDiscrepancia: true,
                    _otId: ot.id,
                    _discrepanciaDetalle: ot.discrepancia_diagnostico_detalle,
                    _diagnosticoInicial: ot.diagnostico_inicial,
                    _diagnosticoEvidencias: ot.diagnostico_evidencias,
                    _prioridadDiagnosticada: ot.prioridad_diagnosticada,
                    _prioridadOriginal: ot.prioridad,
                    // Evidencias de la solicitud original (si existe)
                    _solicitudEvidencias: ot.solicitud ? [
                        ot.solicitud.evidencia_foto_principal,
                        ot.solicitud.evidencia_foto_adicional_1,
                        ot.solicitud.evidencia_foto_adicional_2,
                        ot.solicitud.evidencia_foto_adicional_3,
                        ot.solicitud.evidencia_foto_adicional_4
                    ].filter(Boolean) : []
                };
            });

            // Combinar solicitudes normales con solicitudes de discrepancia
            var todasLasSolicitudes = solicitudes.concat(solicitudesDiscrepancia);

            console.log('[JEFE TALLER - solReload] Total solicitudes a renderizar (incluyendo discrepancias):', todasLasSolicitudes.length);
            console.log('[JEFE TALLER - solReload] ===== FIN RECEPCIÓN DE SOLICITUDES =====');

            renderSolicitudes(todasLasSolicitudes);
            return vehReload();
        })
        .catch(function (err) {
            console.error(err);
            var errorMsg = '<div class="task-card">Error al cargar: ' + err.message + '</div>';
            if (solListChoferes) solListChoferes.innerHTML = errorMsg;
            if (solListMecanicos) solListMecanicos.innerHTML = errorMsg;
        });
}
window.solReload = solReload;

// Badge de vehículos mejorado
function vehBadge(estado) {
    var map = {
        OPERATIVO: { class: 'status-completado', text: 'Operativo', icon: '✅' },
        EN_TALLER: { class: 'status-proceso', text: 'En Taller', icon: '🔧' },
        MANTENCION: { class: 'status-aprobacion', text: 'Mantención', icon: '⚙️' },
        INACTIVO: { class: 'status-danger', text: 'Inactivo', icon: '⏸️' }
    };

    var config = map[estado] || map.OPERATIVO;
    return `<span class="status-badge ${config.class}">
        <span class="badge-icon">${config.icon}</span>
        ${config.text}
    </span>`;
}

// Badge de mecánicos mejorado
function mecBadge(activo) {
    if (activo) {
        return `<span class="status-badge status-completado">
            <span class="badge-icon">✅</span>
            Activo
        </span>`;
    } else {
        return `<span class="status-badge status-danger">
            <span class="badge-icon">⏸️</span>
            Inactivo
        </span>`;
    }
}

function renderSolicitudes(list) {
    // Re-inicializar contenedores si no se encontraron inicialmente
    if (!solListChoferes) {
        solListChoferes = document.getElementById('solicitudesChoferesList');
    }
    if (!solListMecanicos) {
        solListMecanicos = document.getElementById('solicitudesMecanicosList');
    }

    // Verificar que los contenedores existan
    if (!solListChoferes && !solListMecanicos) {
        console.warn('Contenedores de solicitudes no encontrados');
        return;
    }

    list = Array.isArray(list) ? list : [];

    // Ordenar todas las solicitudes por fecha (más recientes primero)
    list.sort(function (a, b) {
        var fechaA = seguroFecha(a.fecha_solicitud);
        var fechaB = seguroFecha(b.fecha_solicitud);
        return new Date(fechaB) - new Date(fechaA); // Descendente (más reciente primero)
    });

    // Dividir solicitudes: choferes (con conductor_id) vs mecánicos/internas (sin conductor_id)
    var solicitudesChoferes = list.filter(function (sol) {
        return sol.conductor && sol.conductor.id;
    });
    var solicitudesMecanicos = list.filter(function (sol) {
        return !sol.conductor || !sol.conductor.id;
    });

    // Limitar a 6 solicitudes por categoría (las más recientes)
    var MAX_SOLICITUDES_DASHBOARD = 6;
    var totalChoferes = solicitudesChoferes.length;
    var totalMecanicos = solicitudesMecanicos.length;

    solicitudesChoferes = solicitudesChoferes.slice(0, MAX_SOLICITUDES_DASHBOARD);
    solicitudesMecanicos = solicitudesMecanicos.slice(0, MAX_SOLICITUDES_DASHBOARD);

    // Obtener el template (debe estar disponible incluso si el contenedor está oculto)
    var template = document.getElementById('solicitudCardTemplate');
    if (!template) {
        console.warn('Template de solicitud no encontrado');
        // Fallback al método anterior si no hay template
        if (!list.length) {
            if (solListChoferes) solListChoferes.innerHTML = '<div class="task-card">Sin solicitudes pendientes</div>';
            if (solListMecanicos) solListMecanicos.innerHTML = '<div class="task-card">Sin solicitudes pendientes</div>';
            return;
        }
        // Renderizar en el contenedor original para compatibilidad
        solList.innerHTML = list.map(function (sol) {
            var esFinal = ['APROBADA', 'RECHAZADA', 'CONVERTIDA_OT', 'CITA_MANTENCION'].includes((sol.estado || '').toUpperCase());
            var restante = esFinal ? diasRestantesSolicitud(sol) : null;
            var esEmergencia = (sol.tipo_solicitud || '').toUpperCase() === 'EMERGENCIA';
            var cardClasses = ['task-card', 'solicitud-card'];
            if (esEmergencia) cardClasses.push('solicitud-card--emergencia');
            return [
                '<div class="', cardClasses.join(' '), '" data-status="', escapeHtml(sol.estado || 'PENDIENTE'), '" onclick="openSolicitudModal(' + sol.id + ')">',
                '<div class="solicitud-card__header">',
                '<h4>', escapeHtml((sol.vehiculo && sol.vehiculo.patente) || 'Vehículo sin patente'), '</h4>',
                '<span class="status-badge ', badgeClassForSolicitud(sol.estado), '">', formatEstadoSolicitud(sol.estado), '</span>',
                '</div>',
                esEmergencia ? '<div class="solicitud-pill">🚨 Emergencia</div>' : '',
                '<p><strong>Chofer:</strong> ', escapeHtml((sol.conductor && sol.conductor.nombre_completo) || 'N/A'), '</p>',
                '<p><strong>Tipo:</strong> ', escapeHtml(sol.tipo_solicitud || '-'), '</p>',
                '<p>', escapeHtml((sol.descripcion_problema || '').slice(0, 80)), '...</p>',
                '<footer>',
                '<span>', formatDate(seguroFecha(sol.fecha_solicitud)), esFinal && restante !== null ? ' · Se elimina en ' + restante + 'd' : '', '</span>',
                esFinal ? '<button class="btn btn-danger btn-sm solicitud-delete" onclick="event.stopPropagation(); eliminarSolicitud(' + sol.id + ');">✕</button>' : '',
                '</footer>',
                '</div>',
            ].join('');
        }).join('');
        return;
    }

    // Función auxiliar para renderizar una lista de solicitudes en un contenedor
    function renderSolicitudesEnContenedor(solicitudes, contenedor, totalCount) {
        if (!contenedor) return;

        solicitudes = Array.isArray(solicitudes) ? solicitudes : [];
        totalCount = totalCount || solicitudes.length;

        // Si no hay solicitudes, mostrar mensaje
        if (solicitudes.length === 0) {
            contenedor.innerHTML = '<div class="task-card" style="text-align: center; padding: 20px; color: #666;">Sin solicitudes pendientes</div>';
            return;
        }

        var html = solicitudes.map(function (sol) {
            var estado = (sol.estado || '').toUpperCase();
            var esFinal = ['APROBADA', 'RECHAZADA', 'CONVERTIDA_OT', 'CITA_MANTENCION'].indexOf(estado) !== -1;
            var restante = esFinal ? diasRestantesSolicitud(sol) : null;
            var esEmergencia = (sol.tipo_solicitud || '').toUpperCase() === 'EMERGENCIA';
            var esDiscrepancia = !!sol._esDiscrepancia;

            // LOGGING: Verificar patente antes de renderizar
            var patente = (sol.vehiculo && sol.vehiculo.patente) || 'Vehículo sin patente';
            if (!sol.vehiculo || !sol.vehiculo.patente) {
                console.warn('[JEFE TALLER - renderSolicitudes] ⚠️ ADVERTENCIA: Solicitud sin patente al renderizar:', {
                    solicitud_id: sol.id,
                    numero_solicitud: sol.numero_solicitud,
                    vehiculo: sol.vehiculo,
                    vehiculo_id: sol.vehiculo?.id,
                    patente: patente
                });
            } else {
                console.log('[JEFE TALLER - renderSolicitudes] Renderizando solicitud con patente:', {
                    solicitud_id: sol.id,
                    numero_solicitud: sol.numero_solicitud,
                    patente: patente,
                    vehiculo_id: sol.vehiculo.id
                });
            }

            var cardClasses = ['solicitud-card'];
            if (esEmergencia) cardClasses.push('solicitud-emergencia');
            if (esDiscrepancia) cardClasses.push('solicitud-discrepancia');

            // ID que se pasa al modal:
            //  - "ot-<id>" para discrepancias (lo captura openSolicitudModal y llama a openDiscrepanciaModal)
            //  - "<id>" normal para solicitudes comunes
            var idParam = esDiscrepancia ? ('ot-' + sol._otId) : String(sol.id);

            var tipoLabel = esDiscrepancia ?
                'Discrepancia' :
                (sol.tipo_solicitud || '-');

            return [
                '<div class="', cardClasses.join(' '), '" onclick="openSolicitudModal(\'', idParam, '\')">',
                '<div class="solicitud-header">',
                '<div class="solicitud-title">',
                '<h4>', escapeHtml(patente), '</h4>',
                esEmergencia ? '<span class="emergency-badge">🚨 Emergencia</span>' : '',
                esDiscrepancia ? '<span class="discrepancia-badge">🔍 Discrepancia</span>' : '',
                '</div>',
                '<span class="status-badge ', badgeClassForSolicitud(sol.estado), '">',
                formatEstadoSolicitud(sol.estado),
                '</span>',
                '</div>',

                '<div class="solicitud-info">',
                '<div class="info-row">',
                '<span class="info-label">Chofer:</span>',
                '<span class="info-value">',
                escapeHtml((sol.conductor && sol.conductor.nombre_completo) || 'N/A'),
                '</span>',
                '</div>',
                '<div class="info-row">',
                '<span class="info-label">Tipo:</span>',
                '<span class="info-value">',
                escapeHtml(tipoLabel),
                '</span>',
                '</div>',
                '<div class="info-row">',
                '<span class="info-label">Descripción:</span>',
                '<span class="info-value">',
                escapeHtml((sol.descripcion_problema || '').slice(0, 80)), '...',
                '</span>',
                '</div>',
                '</div>',

                '<div class="solicitud-footer">',
                '<span class="solicitud-date">',
                formatDate(seguroFecha(sol.fecha_solicitud)),
                (restante !== null && restante !== undefined ?
                    ' · Se elimina en ' + restante + 'd' :
                    ''),
                '</span>',
                esFinal ?
                    '<button class="btn btn-danger btn-sm btn-delete" onclick="event.stopPropagation(); eliminarSolicitud(' + sol.id + ');">✕</button>' :
                    '',
                '</div>',
                '</div>'
            ].join('');
        }).join('');

        // Agregar mensaje si hay más solicitudes de las mostradas
        if (totalCount > solicitudes.length) {
            var restantes = totalCount - solicitudes.length;
            html += '<div class="task-card" style="text-align: center; padding: 15px; background: #f8f9fa; border: 1px dashed #dee2e6; color: #6c757d; font-size: 14px;">';
            html += '<strong>' + restantes + '</strong> solicitud' + (restantes > 1 ? 'es' : '') + ' más ';
            html += '<a href="#" onclick="event.preventDefault(); switchTab(\'historial-solicitudes\');" style="color: #007bff; text-decoration: underline;">ver en historial</a>';
            html += '</div>';
        }

        contenedor.innerHTML = html;
    }

    // Renderizar en los contenedores correspondientes
    renderSolicitudesEnContenedor(solicitudesChoferes, solListChoferes, totalChoferes);
    renderSolicitudesEnContenedor(solicitudesMecanicos, solListMecanicos, totalMecanicos);
}

function openSolicitudModal(id, viewOnly) {
    // viewOnly: si es true, no mostrar mensaje de error ni botones
    viewOnly = viewOnly === true;
    
    // Verificar si es una discrepancia (prefijo 'ot-')
    if (typeof id === 'string' && id.startsWith('ot-')) {
        var otId = parseInt(id.replace('ot-', ''), 10);
        if (!isNaN(otId)) {
            openDiscrepanciaModal(otId);
            return;
        }
    }

    solModal = solModal || buildSolicitudModal();
    solModalBody = solModalBody || solModal.querySelector('.modal-body');
    solModalBody.innerHTML = 'Cargando...';
    openModal('modalSolicitudDetalle');
    
    // Cargar solicitud y verificar OT asociada en paralelo
    Promise.all([
        bearerFetch(API_BASE + '/solicitudes/' + id).then(function (res) {
            if (!res.ok) throw new Error('Error al cargar la solicitud');
            return res.json();
        }),
        // Cargar workOrders para verificar asociación (si no están en cache o para asegurar)
        bearerFetch(API_BASE + '/workorders').then(function (res) {
            if (!res.ok) return [];
            return res.json();
        }).catch(function () {
            return [];
        })
    ])
        .then(function (results) {
            var sol = results[0];
            var workOrders = results[1];
            
            // Actualizar cache de workOrders con la última información
            if (Array.isArray(workOrders)) {
                G_WORK_ORDERS_CACHE = workOrders;
            }
            solModalBody.innerHTML = solicitudDetalleHtml(sol);
            var btnApprove = document.getElementById('solicitudApprove');
            var btnReject = document.getElementById('solicitudReject');
            
            // En modo viewOnly, ocultar botones y no mostrar mensajes
            if (viewOnly) {
                if (btnApprove) {
                    btnApprove.style.display = 'none';
                    btnApprove.style.visibility = 'hidden';
                    btnApprove.disabled = true;
                    btnApprove.onclick = null;
                }
                if (btnReject) {
                    btnReject.style.display = 'none';
                    btnReject.style.visibility = 'hidden';
                    btnReject.disabled = true;
                    btnReject.onclick = null;
                }
                // Limpiar cualquier mensaje existente
                var modalFooter = solModal.querySelector('.modal-footer');
                if (modalFooter) {
                    var existingMsg = modalFooter.querySelector('.form-hint');
                    if (existingMsg) {
                        existingMsg.remove();
                    }
                }
                return; // Salir temprano en modo viewOnly
            }
            
            // Verificar condiciones para ocultar/deshabilitar botones (solo si no es viewOnly)
            var tieneOT = solicitudTieneOTAsociada(sol);
            var rechazadaMasDe3Dias = solicitudRechazadaMasDe3Dias(sol);
            
            // Logging para debugging
            console.log('[openSolicitudModal] Verificando solicitud:', {
                id: sol.id,
                estado: sol.estado,
                tieneOT: tieneOT,
                rechazadaMasDe3Dias: rechazadaMasDe3Dias,
                fecha_actualizacion: sol.fecha_actualizacion,
                fecha_aprobacion: sol.fecha_aprobacion,
                fecha_creacion: sol.fecha_creacion
            });
            
            // Determinar si los botones deben estar ocultos/deshabilitados
            // Regla 1: Si tiene OT asociada, no se pueden aprobar/rechazar
            // Regla 2: Si está rechazada hace más de 3 días, no se pueden aprobar/rechazar
            var debeOcultarBotones = tieneOT || rechazadaMasDe3Dias;
            
            console.log('[openSolicitudModal] debeOcultarBotones:', debeOcultarBotones);
            
            // Función auxiliar para ocultar botones de forma robusta
            function ocultarBoton(btn) {
                if (!btn) return;
                btn.style.display = 'none';
                btn.style.visibility = 'hidden';
                btn.style.opacity = '0';
                btn.disabled = true;
                btn.onclick = null;
                btn.setAttribute('disabled', 'disabled');
                btn.classList.add('hidden');
                btn.setAttribute('aria-hidden', 'true');
            }
            
            // Función auxiliar para mostrar botones
            function mostrarBoton(btn, onClickHandler) {
                if (!btn) return;
                btn.style.display = 'inline-block';
                btn.style.visibility = 'visible';
                btn.style.opacity = '1';
                btn.disabled = false;
                btn.removeAttribute('disabled');
                btn.classList.remove('hidden');
                btn.removeAttribute('aria-hidden');
                if (onClickHandler) {
                    btn.onclick = onClickHandler;
                }
            }
            
            if (btnApprove) {
                if (debeOcultarBotones) {
                    ocultarBoton(btnApprove);
                    console.log('[openSolicitudModal] Botón Aprobar ocultado');
                } else {
                    mostrarBoton(btnApprove, function () { actualizarSolicitud(sol.id, 'APROBADA'); });
                }
            }
            
            if (btnReject) {
                if (debeOcultarBotones) {
                    ocultarBoton(btnReject);
                    console.log('[openSolicitudModal] Botón Rechazar ocultado');
                } else {
                    mostrarBoton(btnReject, function () { actualizarSolicitud(sol.id, 'RECHAZADA'); });
                }
            }
            
            // Asegurar que los botones se oculten después de que el DOM se actualice
            if (debeOcultarBotones) {
                setTimeout(function () {
                    if (btnApprove) {
                        ocultarBoton(btnApprove);
                    }
                    if (btnReject) {
                        ocultarBoton(btnReject);
                    }
                }, 10);
            }
            
            // Si ambos botones están ocultos, mostrar un mensaje informativo
            if (debeOcultarBotones) {
                // Limpiar mensajes anteriores si existen
                var modalFooter = solModal.querySelector('.modal-footer');
                if (modalFooter) {
                    var existingMsg = modalFooter.querySelector('.form-hint');
                    if (existingMsg) {
                        existingMsg.remove();
                    }
                    
                    var infoMsg = document.createElement('div');
                    infoMsg.className = 'form-hint';
                    infoMsg.style.marginTop = '10px';
                    infoMsg.style.padding = '10px';
                    infoMsg.style.backgroundColor = '#f8f9fa';
                    infoMsg.style.borderRadius = '4px';
                    infoMsg.style.width = '100%';
                    infoMsg.style.marginBottom = '10px';
                    if (tieneOT) {
                        infoMsg.textContent = 'Esta solicitud ya tiene una Orden de Trabajo asociada y no puede ser modificada.';
                    } else if (rechazadaMasDe3Dias) {
                        infoMsg.textContent = 'Esta solicitud fue rechazada hace más de 3 días y ya no puede ser modificada.';
                    }
                    modalFooter.insertBefore(infoMsg, modalFooter.firstChild);
                }
            }
        })
        .catch(function (err) {
            solModalBody.innerHTML = '<p>Error: ' + err.message + '</p>';
        });
}

// Función para abrir modal de solicitud en modo solo lectura (para historiales)
function openSolicitudModalViewOnly(id) {
    openSolicitudModal(id, true);
}
window.openSolicitudModalViewOnly = openSolicitudModalViewOnly;

// Función para abrir modal de OT en modo solo lectura (para historiales)
function openOtViewModal(id) {
    var modal = document.getElementById('modalOtView');
    if (!modal) {
        // Crear el modal si no existe
        modal = document.createElement('div');
        modal.id = 'modalOtView';
        modal.className = 'modal';
        modal.innerHTML = [
            '<div class="modal-content modal-lg">',
            '<div class="modal-header">',
            '<h3>Detalle de Orden de Trabajo</h3>',
            '<button class="close-btn" onclick="closeModal(\'modalOtView\')">&times;</button>',
            '</div>',
            '<div class="modal-body" id="otViewModalBody"></div>',
            '<div class="modal-footer">',
            '<button class="btn btn-secondary" onclick="closeModal(\'modalOtView\')">Cerrar</button>',
            '</div>',
            '</div>',
        ].join('');
        document.body.appendChild(modal);
    }

    var modalBody = document.getElementById('otViewModalBody');
    modalBody.innerHTML = 'Cargando...';
    openModal('modalOtView');

    otFetchById(id)
        .then(function (ot) {
            if (!ot) {
                throw new Error('No se pudo cargar la orden de trabajo');
            }

            // Formatear fechas
            function formatDateSafe(dateString) {
                if (!dateString) return 'N/A';
                try {
                    var date = new Date(dateString);
                    return formatDate(date);
                } catch (e) {
                    return dateString;
                }
            }

            function formatDateTimeSafe(dateString) {
                if (!dateString) return 'N/A';
                try {
                    var date = new Date(dateString);
                    return formatDate(date) + ' ' + extractTimeFromISO(dateString);
                } catch (e) {
                    return dateString;
                }
            }

            function formatEstadoLabel(estado) {
                if (!estado) return 'N/A';
                var map = {
                    'PENDIENTE': 'Pendiente',
                    'APROBADO': 'Aprobado',
                    'EN_PROCESO': 'En Proceso',
                    'ESPERA_REPUESTOS': 'Espera Repuestos',
                    'LISTO': 'Listo',
                    'PENDIENTE_VERIFICACION': 'Pendiente Verificación',
                    'COMPLETADO': 'Completado',
                    'CANCELADA': 'Cancelada'
                };
                return map[estado.toUpperCase()] || estado;
            }

            function formatPrioridadLabel(prioridad) {
                if (!prioridad) return 'N/A';
                var map = {
                    'NORMAL': 'Normal',
                    'ALTA': 'Alta',
                    'URGENTE': 'Urgente'
                };
                return map[prioridad.toUpperCase()] || prioridad;
            }

            var numeroOt = ot.numero_ot || ('OT-' + ot.id);
            var vehiculo = ot.vehiculo ? (ot.vehiculo.patente || 'N/A') : 'N/A';
            var vehiculoInfo = ot.vehiculo ? [
                ot.vehiculo.patente || '',
                ot.vehiculo.marca || '',
                ot.vehiculo.modelo || ''
            ].filter(Boolean).join(' ') : 'N/A';
            var mecanico = ot.mecanico ? (ot.mecanico.nombre_completo || ot.mecanico.email || 'N/A') : 'Sin asignar';
            var descripcion = escapeHtml(ot.descripcion_problema || ot.descripcion || 'Sin descripción');
            var prioridad = formatPrioridadLabel(ot.prioridad);
            var estado = formatEstadoLabel(ot.estado);
            var fechaCreacion = formatDateTimeSafe(ot.fecha_creacion);
            var fechaInicio = formatDateTimeSafe(ot.fecha_inicio_trabajo || ot.fecha_inicio_plan || ot.fecha_asignacion);
            var fechaTermino = formatDateTimeSafe(ot.fecha_estimada_termino || ot.fecha_finalizacion || ot.fecha_cierre || ot.fecha_fin_plan);
            var diagnosticoInicial = escapeHtml(ot.diagnostico_inicial || 'N/A');
            var procesoRealizado = escapeHtml(ot.proceso_realizado || 'N/A');

            var html = [
                '<div class="ot-view-body">',
                '<div class="form-info" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px;">',
                '<p><strong>N° OT:</strong> ' + escapeHtml(numeroOt) + '</p>',
                '<p><strong>Vehículo:</strong> ' + escapeHtml(vehiculoInfo) + '</p>',
                '<p><strong>Mecánico:</strong> ' + escapeHtml(mecanico) + '</p>',
                '<p><strong>Estado:</strong> <span class="status-badge">' + escapeHtml(estado) + '</span></p>',
                '<p><strong>Prioridad:</strong> ' + escapeHtml(prioridad) + '</p>',
                '</div>',
                '<div class="form-group">',
                '<label><strong>Descripción del Problema</strong></label>',
                '<div style="padding: 15px; background: #f8f9fa; border-radius: 4px; margin-top: 10px;">',
                '<p style="margin: 0; white-space: pre-wrap;">' + descripcion + '</p>',
                '</div>',
                '</div>',
                '<div class="form-group">',
                '<label><strong>Fechas</strong></label>',
                '<div style="padding: 15px; background: #f8f9fa; border-radius: 4px; margin-top: 10px;">',
                '<p><strong>Creación:</strong> ' + fechaCreacion + '</p>',
                '<p><strong>Inicio:</strong> ' + fechaInicio + '</p>',
                '<p><strong>Estimación Término:</strong> ' + fechaTermino + '</p>',
                '</div>',
                '</div>'
            ];

            if (diagnosticoInicial !== 'N/A') {
                html.push(
                    '<div class="form-group">',
                    '<label><strong>Diagnóstico Inicial</strong></label>',
                    '<div style="padding: 15px; background: #e8f5e9; border-radius: 4px; margin-top: 10px;">',
                    '<p style="margin: 0; white-space: pre-wrap;">' + diagnosticoInicial + '</p>',
                    '</div>',
                    '</div>'
                );
            }

            if (procesoRealizado !== 'N/A') {
                html.push(
                    '<div class="form-group">',
                    '<label><strong>Proceso Realizado</strong></label>',
                    '<div style="padding: 15px; background: #e8f5e9; border-radius: 4px; margin-top: 10px;">',
                    '<p style="margin: 0; white-space: pre-wrap;">' + procesoRealizado + '</p>',
                    '</div>',
                    '</div>'
                );
            }

            html.push('</div>');

            modalBody.innerHTML = html.join('');
        })
        .catch(function (err) {
            modalBody.innerHTML = '<p style="color: #dc3545; padding: 20px;">Error: ' + escapeHtml(err.message) + '</p>';
        });
}
window.openOtViewModal = openOtViewModal;

function openDiscrepanciaModal(otId) {
    var modal = document.getElementById('modalDiscrepancia');
    if (!modal) {
        // Crear el modal si no existe
        modal = document.createElement('div');
        modal.id = 'modalDiscrepancia';
        modal.className = 'modal';
        modal.innerHTML = [
            '<div class="modal-content modal-lg">',
            '<div class="modal-header">',
            '<h3>Discrepancia de Diagnóstico</h3>',
            '<button class="close-btn" onclick="closeModal(\'modalDiscrepancia\')">&times;</button>',
            '</div>',
            '<div class="modal-body" id="discrepanciaModalBody"></div>',
            '<div class="modal-footer">',
            '<button class="btn btn-warning" onclick="closeModal(\'modalDiscrepancia\')">Cancelar</button>',
            '<button class="btn btn-success" id="discrepanciaApprove">Aprobar</button>',
            '<button class="btn btn-danger" id="discrepanciaReject">Rechazar</button>',
            '</div>',
            '</div>',
        ].join('');
        document.body.appendChild(modal);
    }

    var modalBody = document.getElementById('discrepanciaModalBody');
    modalBody.innerHTML = 'Cargando...';
    openModal('modalDiscrepancia');

    bearerFetch(API_BASE + '/workorders/' + otId)
        .then(function (res) {
            if (!res.ok) throw new Error('Error al cargar la orden de trabajo');
            return res.json();
        })
        .then(function (ot) {
            if (!ot.discrepancia_diagnostico) {
                throw new Error('Esta OT no tiene discrepancia');
            }

            // Construir HTML del modal
            var html = [
                '<div class="discrepancia-info">',
                '<div class="form-info" style="margin-bottom: 20px;">',
                '<p><strong>OT:</strong> ' + escapeHtml(ot.numero_ot || 'N/A') + '</p>',
                '<p><strong>Vehículo:</strong> ' + escapeHtml((ot.vehiculo && ot.vehiculo.patente) || 'N/A') + '</p>',
                '<p><strong>Mecánico:</strong> ' + escapeHtml((ot.mecanico && ot.mecanico.nombre_completo) || 'N/A') + '</p>',
                '<p><strong>Prioridad Original:</strong> ' + escapeHtml(ot.prioridad || 'N/A') + '</p>',
                '<p><strong>Prioridad Diagnosticada:</strong> ' + escapeHtml(ot.prioridad_diagnosticada || 'N/A') + '</p>',
                '</div>',
                '<div class="form-group">',
                '<label>Descripción del Problema (OT)</label>',
                '<p>' + escapeHtml(ot.descripcion_problema || 'N/A') + '</p>',
                '</div>',
                '<div class="form-group">',
                '<label>Diagnóstico Inicial del Mecánico</label>',
                '<p>' + escapeHtml(ot.diagnostico_inicial || 'N/A') + '</p>',
                '</div>',
                '<div class="form-group">',
                '<label>Detalle de la Discrepancia</label>',
                '<p>' + escapeHtml(ot.discrepancia_diagnostico_detalle || 'N/A') + '</p>',
                '</div>',
                '<div class="form-group">',
                '<label>Imágenes de la Solicitud Original</label>',
                '<div id="discrepanciaSolicitudImagenes" class="image-gallery"></div>',
                '</div>',
                '<div class="form-group">',
                '<label>Imágenes del Diagnóstico del Mecánico</label>',
                '<div id="discrepanciaDiagnosticoImagenes" class="image-gallery"></div>',
                '</div>',
                '<div class="form-group">',
                '<label for="discrepanciaResolucionDetalle">Comentarios (opcional)</label>',
                '<textarea id="discrepanciaResolucionDetalle" rows="3" placeholder="Comentarios adicionales sobre la resolución..."></textarea>',
                '</div>',
                '</div>'
            ].join('');

            modalBody.innerHTML = html;

            // Cargar y mostrar imágenes de la solicitud original
            var solicitudImagenesContainer = document.getElementById('discrepanciaSolicitudImagenes');
            if (solicitudImagenesContainer) {
                if (ot.solicitud && ot.solicitud.evidencia_foto_principal) {
                    var solicitudEvidencias = [
                        ot.solicitud.evidencia_foto_principal,
                        ot.solicitud.evidencia_foto_adicional_1,
                        ot.solicitud.evidencia_foto_adicional_2,
                        ot.solicitud.evidencia_foto_adicional_3,
                        ot.solicitud.evidencia_foto_adicional_4
                    ].filter(Boolean);

                    if (solicitudEvidencias.length) {
                        solicitudImagenesContainer.innerHTML = solicitudEvidencias.map(function (url, idx) {
                            return '<img src="' + escapeHtml(url) + '" alt="Evidencia ' + (idx + 1) + '" loading="lazy" style="max-width: 200px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;" onclick="window.open(this.src, \'_blank\')">';
                        }).join('');
                    } else {
                        solicitudImagenesContainer.innerHTML = '<p style="color: #888;">No hay imágenes disponibles</p>';
                    }
                } else {
                    solicitudImagenesContainer.innerHTML = '<p style="color: #888;">No hay solicitud asociada o no hay imágenes disponibles</p>';
                }
            }

            // Cargar y mostrar imágenes del diagnóstico
            var diagnosticoImagenesContainer = document.getElementById('discrepanciaDiagnosticoImagenes');
            if (diagnosticoImagenesContainer) {
                if (ot.diagnostico_evidencias && ot.diagnostico_evidencias.length) {
                    diagnosticoImagenesContainer.innerHTML = ot.diagnostico_evidencias.map(function (url, idx) {
                        return '<img src="' + escapeHtml(url) + '" alt="Diagnóstico ' + (idx + 1) + '" loading="lazy" style="max-width: 200px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;" onclick="window.open(this.src, \'_blank\')">';
                    }).join('');
                } else {
                    diagnosticoImagenesContainer.innerHTML = '<p style="color: #888;">No hay imágenes disponibles</p>';
                }
            }

            // Configurar botones de aprobar/rechazar
            var btnApprove = document.getElementById('discrepanciaApprove');
            var btnReject = document.getElementById('discrepanciaReject');

            if (btnApprove) {
                btnApprove.onclick = function () {
                    resolverDiscrepancia(otId, true);
                };
            }

            if (btnReject) {
                btnReject.onclick = function () {
                    resolverDiscrepancia(otId, false);
                };
            }
        })
        .catch(function (err) {
            modalBody.innerHTML = '<p style="color: red;">Error: ' + escapeHtml(err.message) + '</p>';
        });
}

function resolverDiscrepancia(otId, aprobar) {
    var detalleInput = document.getElementById('discrepanciaResolucionDetalle');
    var detalle = detalleInput ? detalleInput.value.trim() : undefined;

    var payload = {
        aprobar: aprobar,
        detalle: detalle || undefined
    };

    bearerFetch(API_BASE + '/workorders/' + otId + '/discrepancy/resolve', {
        method: 'POST',
        body: JSON.stringify(payload)
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error(err.message || 'Error al resolver la discrepancia');
                });
            }
            return res.json();
        })
        .then(function () {
            flashMainStatus('ok', aprobar ? '✅ Discrepancia aprobada' : '❌ Discrepancia rechazada');
            closeModal('modalDiscrepancia');
            solReload();
        })
        .catch(function (err) {
            flashMainStatus('bad', '❌ ' + (err.message || 'Error al resolver la discrepancia'));
        });
}

function buildSolicitudModal() {
    var modal = document.createElement('div');
    modal.id = 'modalSolicitudDetalle';
    modal.className = 'modal';
    modal.innerHTML = [
        '<div class="modal-content modal-lg">',
        '<div class="modal-header">',
        '<h3>Detalle de la Solicitud</h3>',
        '<button class="close-btn" onclick="closeModal(\'modalSolicitudDetalle\')">&times;</button>',
        '</div>',
        '<div class="modal-body"></div>',
        '<div class="modal-footer">',
        '<button class="btn btn-success" id="solicitudApprove">Aprobar</button>',
        '<button class="btn btn-danger" id="solicitudReject">Rechazar</button>',
        '</div>',
        '</div>',
    ].join('');
    document.body.appendChild(modal);
    return modal;
}

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function solicitudDetalleHtml(sol) {
    var evidenciaList = [];
    var evidencias = [
        sol.evidencia_foto_principal,
        sol.evidencia_foto_adicional_1,
        sol.evidencia_foto_adicional_2,
        sol.evidencia_foto_adicional_3,
        sol.evidencia_foto_adicional_4,
        sol.evidencia_foto_adicional_5,
    ].filter(Boolean);

    if (evidencias.length) {
        evidenciaList = evidencias.map(function (url, idx) {
            return (
                '<figure class="evidencia-item">' +
                    '<img src="' + url + '" alt="Evidencia ' + (idx + 1) + '" loading="lazy" ' +
                        'onclick="window.open(\'' + url + '\', \'_blank\')" />' +
                '</figure>'
            );
        });
    } else {
        evidenciaList = [
            '<span class="evidencia-empty">Sin evidencia adjunta</span>'
        ];
    }

    var vehiculo = escapeHtml((sol.vehiculo && sol.vehiculo.patente) || 'N/A');
    var chofer = escapeHtml((sol.conductor && sol.conductor.nombre_completo) || 'Sin asignar');
    var tipo = escapeHtml(sol.tipo_solicitud || '-');
    var descripcion = escapeHtml(sol.descripcion_problema || 'Sin descripción');
    var fecha = formatDate(seguroFecha(sol.fecha_solicitud));

    return [
        '<div class="solicitud-modal-body">',

            '<div class="info-grid">',
                '<div class="info-item">',
                    '<label>Vehículo</label>',
                    '<span>' + vehiculo + '</span>',
                '</div>',

                '<div class="info-item">',
                    '<label>Chofer</label>',
                    '<span>' + chofer + '</span>',
                '</div>',

                '<div class="info-item">',
                    '<label>Tipo de solicitud</label>',
                    '<span>' + tipo + '</span>',
                '</div>',

                '<div class="info-item">',
                    '<label>Fecha</label>',
                    '<span>' + fecha + '</span>',
                '</div>',

                '<div class="info-item full-width">',
                    '<label>Descripción del problema</label>',
                    '<p>' + descripcion + '</p>',
                '</div>',
            '</div>',

            '<div class="solicitud-evidencias">',
                '<h4>Evidencias</h4>',
                '<div class="evidencia-grid">',
                    evidenciaList.join(''),
                '</div>',
            '</div>',

        '</div>'
    ].join('');
}

function actualizarSolicitud(id, estado) {
    bearerFetch(API_BASE + '/solicitudes/' + id, {
        method: 'PATCH',
        body: JSON.stringify({ estado: estado }),
    })
        .then(function (res) {
            if (!res.ok) throw new Error('Error al actualizar solicitud');
            return res.json();
        })
        .then(function () {
            flashMainStatus('ok', 'Solicitud ' + estado.toLowerCase() + ' correctamente.');
            closeModal('modalSolicitudDetalle');
            solReload();
        })
        .catch(function (err) {
            alert('Error al actualizar: ' + err.message);
        });
}

function seguroFecha(value) {
    return value ? value : new Date();
}

function eliminarSolicitud(id) {
    if (!confirm('¿Ocultar esta solicitud del dashboard? (Los datos se mantendrán para el historial)')) return;
    bearerFetch(API_BASE + '/solicitudes/' + id, {
        method: 'DELETE'
    })
        .then(function (res) {
            if (!res.ok) {
                // Intentar extraer el mensaje de error del cuerpo de la respuesta
                return res.json().then(function (errorData) {
                    var errorMessage = errorData.message || errorData.error || 'No se pudo eliminar la solicitud';
                    throw new Error(errorMessage);
                }).catch(function () {
                    // Si no se puede parsear el JSON, usar un mensaje genérico
                    throw new Error('No se pudo eliminar la solicitud');
                });
            }
            return res.json();
        })
        .then(function () {
            flashMainStatus('ok', 'Solicitud ocultada del dashboard.');
            solReload();
        })
        .catch(function (err) {
            flashMainStatus('error', 'Error: ' + err.message);
            console.error('Error al eliminar solicitud:', err);
        });
}
window.eliminarSolicitud = eliminarSolicitud;

function badgeClassForSolicitud(estado) {
    var map = {
        'PENDIENTE': 'status-pendiente',
        'APROBADA': 'status-completado',
        'RECHAZADA': 'status-danger',
        'CONVERTIDA_OT': 'status-proceso',
        'CITA_MANTENCION': 'status-aprobacion'
    };
    return map[(estado || '').toUpperCase()] || 'status-pendiente';
}

function formatEstadoSolicitud(estado) {
    if (!estado) return 'Pendiente';
    var map = {
        'APROBADA': 'Aprobada',
        'RECHAZADA': 'Rechazada',
        'CONVERTIDA_OT': 'Convertida a OT',
        'CITA_MANTENCION': 'Cita Mantención',
        'PENDIENTE': 'Pendiente'
    };
    return map[(estado || '').toUpperCase()] || estado;
}

function diasRestantesSolicitud(sol) {
    if (!sol || !sol.fecha_actualizacion) return null;
    var fecha = new Date(sol.fecha_actualizacion);
    var limite = new Date(fecha);
    limite.setDate(limite.getDate() + SOLICITUD_TTL_DIAS);
    var diff = Math.ceil((limite.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
}

/**
 * Verifica si una solicitud tiene una OT asociada.
 * Realiza múltiples verificaciones para asegurar que funcione con datos históricos o irregulares.
 * @param {Object} sol - Objeto de solicitud
 * @returns {boolean} - true si la solicitud tiene OT asociada
 */
function solicitudTieneOTAsociada(sol) {
    if (!sol || !sol.id) return false;

    // Verificación 1: Estado CONVERTIDA_OT (más confiable)
    var estado = (sol.estado || '').toUpperCase();
    if (estado === 'CONVERTIDA_OT') {
        console.log('[solicitudTieneOTAsociada] Solicitud', sol.id, 'tiene estado CONVERTIDA_OT');
        return true;
    }

    // Verificación 2: Si la solicitud tiene campos que indiquen OT asociada directamente
    if (sol.orden_trabajo_id || sol.ot_id || sol.workorder_id || sol.orden_trabajo || sol.ot || sol.workorder) {
        console.log('[solicitudTieneOTAsociada] Solicitud', sol.id, 'tiene campo de OT asociada');
        return true;
    }

    // Verificación 3: Buscar en cache de workOrders por solicitud_id
    if (Array.isArray(G_WORK_ORDERS_CACHE) && G_WORK_ORDERS_CACHE.length > 0) {
        var tieneOT = G_WORK_ORDERS_CACHE.some(function (ot) {
            // Verificar si la OT tiene una solicitud asociada
            if (ot.solicitud) {
                // Puede venir como objeto con id o como número
                var solicitudId = typeof ot.solicitud === 'object' ? ot.solicitud.id : ot.solicitud;
                if (String(solicitudId) === String(sol.id)) {
                    console.log('[solicitudTieneOTAsociada] Solicitud', sol.id, 'encontrada en OT', ot.id, 'vía ot.solicitud');
                    return true;
                }
            }
            // También verificar solicitud_id directo si existe
            if (ot.solicitud_id) {
                if (String(ot.solicitud_id) === String(sol.id)) {
                    console.log('[solicitudTieneOTAsociada] Solicitud', sol.id, 'encontrada en OT', ot.id, 'vía ot.solicitud_id');
                    return true;
                }
            }
            return false;
        });
        if (tieneOT) {
            return true;
        }
    }

    return false;
}

/**
 * Verifica si una solicitud rechazada tiene más de 3 días de antigüedad.
 * @param {Object} sol - Objeto de solicitud
 * @returns {boolean} - true si la solicitud rechazada tiene más de 3 días
 */
function solicitudRechazadaMasDe3Dias(sol) {
    if (!sol) return false;

    var estado = (sol.estado || '').toUpperCase();
    if (estado !== 'RECHAZADA') {
        return false; // Solo aplica a solicitudes rechazadas
    }

    var ahora = new Date();
    
    // Si tenemos fecha_creacion y fecha_actualizacion, usar la diferencia entre ellas
    // como referencia (esto funciona mejor con datos de prueba donde las fechas pueden estar en el futuro)
    if (sol.fecha_creacion && sol.fecha_actualizacion) {
        var fechaCreacion = new Date(sol.fecha_creacion);
        var fechaActualizacion = new Date(sol.fecha_actualizacion);
        
        if (!isNaN(fechaCreacion.getTime()) && !isNaN(fechaActualizacion.getTime())) {
            // Calcular la diferencia entre creación y actualización (rechazo)
            var diffMsEntreFechas = fechaActualizacion.getTime() - fechaCreacion.getTime();
            var diffDiasEntreFechas = Math.floor(diffMsEntreFechas / (1000 * 60 * 60 * 24));
            
            // Si la diferencia es mayor a 3 días, considerar que fue rechazada hace más de 3 días
            // (asumiendo que fecha_actualizacion es cuando se rechazó)
            console.log('[solicitudRechazadaMasDe3Dias] Usando diferencia entre fecha_creacion y fecha_actualizacion:', {
                fecha_creacion: sol.fecha_creacion,
                fecha_actualizacion: sol.fecha_actualizacion,
                diffDiasEntreFechas: diffDiasEntreFechas,
                resultado: diffDiasEntreFechas > 3
            });
            return diffDiasEntreFechas > 3;
        }
    }
    
    // Fallback: usar fecha_actualizacion o fecha_aprobacion para calcular desde hoy
    var fechaRechazo = sol.fecha_actualizacion || sol.fecha_aprobacion || sol.fecha_creacion;
    
    if (!fechaRechazo) {
        console.log('[solicitudRechazadaMasDe3Dias] Solicitud', sol.id, 'rechazada pero sin fecha de rechazo');
        return false;
    }

    var fecha = new Date(fechaRechazo);
    
    // Validar que la fecha sea válida
    if (isNaN(fecha.getTime())) {
        console.log('[solicitudRechazadaMasDe3Dias] Solicitud', sol.id, 'tiene fecha inválida:', fechaRechazo);
        return false;
    }
    
    var diffMs = ahora.getTime() - fecha.getTime();
    var diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    console.log('[solicitudRechazadaMasDe3Dias] Solicitud', sol.id, {
        fechaRechazo: fechaRechazo,
        fecha: fecha.toISOString(),
        ahora: ahora.toISOString(),
        diffMs: diffMs,
        diffDias: diffDias,
        resultado: diffDias > 3
    });

    return diffDias > 3;
}

/* ====== TIME PICKER ====== */
function initTimePicker(inputId, pickerId) {
    var input = document.getElementById(inputId);
    var picker = document.getElementById(pickerId);
    if (!input || !picker) return;

    var pickerData = picker.getAttribute('data-picker') || inputId;
    var timeWrap = picker.querySelector('.time-wrap .time');
    var hourPart = picker.querySelector('.part.hour');
    var minPart = picker.querySelector('.part.min');
    var hourFace = picker.querySelector('.face-set.hour');
    var minFace = picker.querySelector('.face-set.min');
    var faceWrap = picker.querySelector('.face-wrap');
    var hour24Controls = picker.querySelector('.hour-24-controls');
    var hourBtns = hour24Controls ? hour24Controls.querySelectorAll('.hour-btn') : [];

    if (!timeWrap || !hourPart || !minPart || !hourFace || !minFace) return;

    var currentHour = 9;
    var currentMin = 0;
    var isMinMode = false;
    var isMouseDown = false;
    var currentHour24Base = 0; // 0 o 12 para formato 24 horas

    function pad(num, size) {
        var s = String(num);
        while (s.length < size) s = '0' + s;
        return s;
    }

    function setHandle(face, angle, length, anim) {
        if (angle == null) return;
        if (length === 'hidden') {
            length = face.classList.contains('min') ? 5.5 : 4;
        } else if (length == null) {
            length = face.classList.contains('min') ? 6 : 5.5;
        }
        var deg = angle * 30;
        var handle = face.querySelector('.handle');
        var handleBar = face.querySelector('.handle-bar');
        var bl = angle % 1 === 0 ? length - 0.25 : length;

        if (handle) {
            handle.style.transform = 'rotate(' + deg.toFixed(20) + 'deg) translateY(-' + length + 'em)';
            if (anim) handle.classList.add('anim');
            else handle.classList.remove('anim');
        }
        if (handleBar) {
            handleBar.style.transform = 'rotate(' + deg.toFixed(20) + 'deg) scaleY(' + bl + ')';
            if (anim) handleBar.classList.add('anim');
            else handleBar.classList.remove('anim');
        }
        face.setAttribute('data-hand-ang', angle);
    }

    function minMode(yes) {
        isMinMode = yes;
        var cl = yes ? 'min' : 'hour';
        var activeFace = yes ? minFace : hourFace;
        var inactiveFace = yes ? hourFace : minFace;

        inactiveFace.classList.add('face-off');
        setHandle(inactiveFace, parseFloat(inactiveFace.getAttribute('data-hand-ang') || '0'), 'hidden', true);

        activeFace.classList.remove('face-off');
        setHandle(activeFace, parseFloat(activeFace.getAttribute('data-hand-ang') || '0'), null, true);

        hourPart.classList.toggle('active', !yes);
        minPart.classList.toggle('active', yes);
    }

    function setHour(hour) {
        if (hour === 0) hour = 12;
        hourPart.textContent = hour;
        var hour12 = hour === 12 ? 0 : hour;
        setHandle(hourFace, hour12, null, false);
        currentHour = currentHour24Base + hour12;
        if (currentHour === 24) currentHour = 0;
        updateDisplay();
    }

    function setMin(min) {
        if (min === 60) min = 0;
        if (min < 0) min = 0;
        if (min > 59) min = 59;
        minPart.textContent = pad(min, 2);
        // Para minutos, usar posición basada en minutos reales (0-59) en lugar de múltiplos de 5
        var minAngle = (min / 60) * 12; // Convertir minutos a posición en reloj de 12 horas
        setHandle(minFace, minAngle, null, false);
        currentMin = min;
        updateDisplay();
    }

    function updateDisplay() {
        var timeStr = pad(currentHour, 2) + ':' + pad(currentMin, 2);
        input.value = timeStr;
    }

    function handleMove(e) {
        if (!isMouseDown) return;
        e.preventDefault();
        var rect = faceWrap.getBoundingClientRect();
        var cent = {
            left: rect.left + rect.width / 2,
            top: rect.top + rect.height / 2
        };
        var x = e.clientX - cent.left;
        var y = e.clientY - cent.top;
        var distance = Math.sqrt(x * x + y * y);
        var radius = rect.width / 2;

        // Calcular ángulo (0° = arriba)
        var angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        if (isMinMode) {
            // Modo minutos: permitir cualquier minuto (0-59)
            var minute = Math.round((angle / 360) * 60);
            if (minute === 60) minute = 0;
            setMin(minute);
        } else {
            // Modo hora: usar números del reloj (1-12)
            var hour12 = Math.round((angle / 360) * 12);
            if (hour12 === 0) hour12 = 12;
            if (hour12 > 12) hour12 = 12;
            setHour(hour12);
        }
    }

    // Abrir/cerrar picker
    input.addEventListener('click', function (e) {
        e.stopPropagation();
        if (input.disabled) {
            return;
        }
        var isHidden = picker.getAttribute('aria-hidden') === 'true';
        picker.setAttribute('aria-hidden', !isHidden);

        // Cerrar otros pickers
        document.querySelectorAll('.time-picker-popover').forEach(function (p) {
            if (p !== picker) {
                p.setAttribute('aria-hidden', 'true');
            }
        });

        // Inicializar modo minutos al abrir
        if (!isHidden) {
            minMode(true);
        }
    });

    // Cerrar al hacer click fuera
    document.addEventListener('click', function (e) {
        if (!picker.contains(e.target) && !input.contains(e.target)) {
            picker.setAttribute('aria-hidden', 'true');
            isMouseDown = false;
        }
    });

    // Mouse events para el reloj
    faceWrap.addEventListener('mousedown', function (e) {
        isMouseDown = true;
        handleMove(e);
    });

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', function () {
        if (isMouseDown && !isMinMode) {
            minMode(true);
        }
        isMouseDown = false;
    });

    // Click en hora/minuto para cambiar modo
    hourPart.addEventListener('click', function () {
        minMode(false);
    });

    minPart.addEventListener('click', function () {
        minMode(true);
    });

    // Botones AM/PM
    hourBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var hour = parseInt(btn.getAttribute('data-hour'), 10);
            currentHour24Base = hour;
            var hour12 = currentHour % 12;
            if (hour12 === 0) hour12 = 12;
            setHour(hour12);
            hourBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
        });
    });

    // Función para establecer el valor desde código externo
    function setTimeValue(timeStr) {
        if (!timeStr) {
            updateDisplay();
            return;
        }
        var parts = timeStr.split(':');
        if (parts.length === 2) {
            var hour = parseInt(parts[0], 10) || 0;
            var minute = parseInt(parts[1], 10) || 0;

            currentHour = hour;
            currentMin = minute;

            // Determinar base de hora (0 o 12)
            currentHour24Base = hour >= 12 ? 12 : 0;
            var hour12 = hour % 12;
            if (hour12 === 0) hour12 = 12;

            setHour(hour12);
            setMin(minute);

            // Actualizar botones de hora 24
            hourBtns.forEach(function (btn) {
                var btnHour = parseInt(btn.getAttribute('data-hour'), 10);
                btn.classList.toggle('active', btnHour === currentHour24Base);
            });
        }
    }

    // Exponer función para establecer valor desde código externo
    input.setTimeValue = setTimeValue;

    // Inicializar
    minMode(false);
    minMode(true);

    // Inicializar con valores por defecto si está vacío
    if (!input.value) {
        setTimeValue('09:00');
    } else {
        setTimeValue(input.value);
    }
}

// Inicializar time pickers cuando el DOM esté listo
(function () {
    function initAllTimePickers() {
        initTimePicker('ot_gen_hora_inicio', 'ot_gen_hora_inicio_picker');
        initTimePicker('ot_gen_hora_fin', 'ot_gen_hora_fin_picker');
        initTimePicker('ot_edit_hora_inicio', 'ot_edit_hora_inicio_picker');
        initTimePicker('ot_edit_hora_fin', 'ot_edit_hora_fin_picker');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllTimePickers);
    } else {
        initAllTimePickers();
    }
})();

// Agregar debounce a búsqueda de OTs
document.addEventListener('DOMContentLoaded', function () {
    var searchInput = document.getElementById('otSearchInput');
    if (searchInput && typeof window.FilterUtils !== 'undefined') {
        var debouncedBusqueda = window.FilterUtils.debounce(function () {
            if (typeof applyOtFilters === 'function') {
                applyOtFilters();
            }
        }, 300);
        searchInput.addEventListener('input', debouncedBusqueda);
    }
});

// ========== GESTIÓN DE STOCK (Jefe de Taller) ==========
var stockJefeCache = [];
var currentTallerIdJefe = 1; // Por defecto, taller principal

function formatCurrency(value) {
    if (!value) return '$0';
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
}

function setStockText(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
}

window.stockJefeReload = async function () {
    const tbody = document.getElementById('stockJefeTBody');
    if (!tbody) {
        console.error('stockJefeReload: No se encontró el elemento stockJefeTBody');
        return;
    }

    setStockText('#stock-total-repuestos', '...');
    setStockText('#stock-bajo-jefe', '...');
    setStockText('#stock-critico-jefe', '...');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Cargando...</td></tr>';

    try {
        const [inventariosRes, stockBajoRes] = await Promise.all([
            bearerFetch(`${API_BASE}/stock/inventarios?tallerId=${currentTallerIdJefe}`),
            bearerFetch(`${API_BASE}/stock/inventarios/stock-bajo?tallerId=${currentTallerIdJefe}`)
        ]);

        if (!inventariosRes.ok) {
            const errorText = await inventariosRes.text();
            console.error('Error al cargar inventarios:', inventariosRes.status, errorText);
            throw new Error('Error al cargar inventarios: ' + inventariosRes.status);
        }
        if (!stockBajoRes.ok) {
            const errorText = await stockBajoRes.text();
            console.error('Error al cargar stock bajo:', stockBajoRes.status, errorText);
            throw new Error('Error al cargar stock bajo: ' + stockBajoRes.status);
        }

        const inventarios = await inventariosRes.json();
        const stockBajo = await stockBajoRes.json();

        console.log('Inventarios cargados:', inventarios);
        console.log('Stock bajo cargado:', stockBajo);

        stockJefeCache = inventarios;

        // Actualizar estadísticas
        setStockText('#stock-total-repuestos', inventarios.length || 0);
        const bajo = stockBajo.filter(item => item.cantidad_disponible > 0 && item.cantidad_disponible <= item.nivel_minimo_stock);
        const critico = stockBajo.filter(item => item.cantidad_disponible === 0 || item.cantidad_disponible < item.nivel_minimo_stock * 0.5);
        setStockText('#stock-bajo-jefe', bajo.length || 0);
        setStockText('#stock-critico-jefe', critico.length || 0);

        // Renderizar tabla
        if (!inventarios || inventarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">No hay inventarios registrados</td></tr>';
            return;
        }

        tbody.innerHTML = inventarios.map(inv => {
            const rep = inv.repuesto || {};
            if (!rep.sku || !rep.nombre) {
                console.warn('Inventario sin repuesto válido:', inv);
                return null;
            }

            const cantidad = inv.cantidad_disponible || 0;
            const minimo = inv.nivel_minimo_stock || 0;
            const maximo = inv.nivel_maximo_stock || 0;

            const stockStatus = cantidad === 0 ? 'critico' :
                cantidad <= minimo ? 'bajo' : 'normal';
            const statusBadge = stockStatus === 'critico' ? '<span class="status-badge" style="background:#dc3545;">Crítico</span>' :
                stockStatus === 'bajo' ? '<span class="status-badge" style="background:#ffc107;">Bajo</span>' :
                    '<span class="status-badge" style="background:#28a745;">Normal</span>';

            return `
                <tr>
                    <td>${escapeHtml(rep.sku)}</td>
                    <td>${escapeHtml(rep.nombre)}</td>
                    <td><strong>${cantidad}</strong></td>
                    <td>${minimo}</td>
                    <td>${maximo}</td>
                    <td>${escapeHtml(inv.ubicacion_almacen || '—')}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).filter(row => row !== null).join('');

    } catch (error) {
        console.error('Error cargando stock:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#dc3545;">Error al cargar stock: ' + escapeHtml(error.message || 'Error desconocido') + '</td></tr>';
        if (typeof flashMainStatus === 'function') {
            flashMainStatus('bad', 'Error al cargar stock: ' + (error.message || 'Error desconocido'));
        }
    }
};

// ========== VERIFICACIONES PENDIENTES ==========
let verificacionesCache = [];

// Función para actualizar solo el contador del nav (sin recargar la tabla)
async function updateVerificacionesPendNavLabel() {
    try {
        const res = await bearerFetch(API_BASE + '/workorders');
        if (!res.ok) return;
        
        const allOTs = await res.json();
        // Filtrar solo OTs en PENDIENTE_VERIFICACION
        const verificaciones = allOTs.filter(function (ot) {
            return ot.estado === 'PENDIENTE_VERIFICACION';
        });
        
        const navLabel = document.getElementById('verificacionesPendNavLabel');
        if (navLabel) {
            if (verificaciones.length > 0) {
                navLabel.textContent = '(' + verificaciones.length + ')';
                navLabel.classList.remove('is-hidden');
            } else {
                navLabel.textContent = '';
                navLabel.classList.add('is-hidden');
            }
        }
    } catch (error) {
        console.error('Error actualizando contador de verificaciones:', error);
    }
}

window.verificacionesReload = async function () {
    const tbody = document.getElementById('verificacionesTBody');
    const navLabel = document.getElementById('verificacionesPendNavLabel');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Cargando verificaciones...</td></tr>';

    try {
        const res = await bearerFetch(API_BASE + '/workorders');
        if (!res.ok) {
            throw new Error('Error al cargar verificaciones');
        }

        const allOTs = await res.json();
        // Filtrar solo OTs en PENDIENTE_VERIFICACION
        const verificaciones = allOTs.filter(function (ot) {
            return ot.estado === 'PENDIENTE_VERIFICACION';
        });

        verificacionesCache = verificaciones;

        // Actualizar contador en navegación
        if (navLabel) {
            if (verificaciones.length > 0) {
                navLabel.textContent = '(' + verificaciones.length + ')';
                navLabel.classList.remove('is-hidden');
            } else {
                navLabel.textContent = '';
                navLabel.classList.add('is-hidden');
            }
        }

        if (verificaciones.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">No hay OTs pendientes de verificación</td></tr>';
            return;
        }

        tbody.innerHTML = verificaciones.map(function (ot) {
            const fechaFinalizacion = ot.fecha_finalizacion ?
                new Date(ot.fecha_finalizacion).toLocaleDateString('es-CL', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }) :
                'N/A';

            return `
                <tr>
                    <td>${escapeHtml(ot.numero_ot || 'N/A')}</td>
                    <td>${escapeHtml(ot.vehiculo?.patente || 'Sin vehículo')}</td>
                    <td>${escapeHtml(ot.mecanico?.nombre_completo || 'Sin mecánico')}</td>
                    <td>${fechaFinalizacion}</td>
                    <td>
                        <button class="btn btn-primary" onclick="openRevisarOTModal(${ot.id})">Revisar</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error cargando verificaciones:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#dc3545;">Error al cargar verificaciones: ' + escapeHtml(error.message || 'Error desconocido') + '</td></tr>';
        flashMainStatus('bad', 'Error al cargar verificaciones: ' + (error.message || 'Error desconocido'));
    }
};

window.openRevisarOTModal = async function (otId) {
    const modal = document.getElementById('modalRevisarOT');
    if (!modal) {
        console.error('Modal modalRevisarOT no encontrado');
        return;
    }

    try {
        const res = await bearerFetch(API_BASE + '/workorders/' + otId);
        if (!res.ok) {
            throw new Error('Error al cargar la OT');
        }

        const ot = await res.json();

        // Llenar información básica
        document.getElementById('revisar_ot_id').value = ot.id;
        document.getElementById('revisar_ot_numero').textContent = ot.numero_ot || 'N/A';
        document.getElementById('revisar_ot_vehiculo').textContent = (ot.vehiculo && ot.vehiculo.patente) || 'Sin vehículo';
        document.getElementById('revisar_ot_mecanico').textContent = (ot.mecanico && ot.mecanico.nombre_completo) || 'Sin mecánico';

        const fechaFinalizacion = ot.fecha_finalizacion ?
            new Date(ot.fecha_finalizacion).toLocaleString('es-CL', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }) :
            'N/A';
        document.getElementById('revisar_ot_fecha_finalizacion').textContent = fechaFinalizacion;

        // Descripción del problema original
        document.getElementById('revisar_ot_problema').textContent = ot.descripcion_problema || 'Sin descripción';

        // Evidencias originales (de la solicitud)
        const evidenciasOriginalesGroup = document.getElementById('revisar_ot_evidencias_originales_group');
        const evidenciasOriginalesContainer = document.getElementById('revisar_ot_evidencias_originales');
        if (ot.solicitud) {
            const evidenciasOriginales = [];
            if (ot.solicitud.evidencia_foto_principal) evidenciasOriginales.push(ot.solicitud.evidencia_foto_principal);
            if (ot.solicitud.evidencia_foto_adicional_1) evidenciasOriginales.push(ot.solicitud.evidencia_foto_adicional_1);
            if (ot.solicitud.evidencia_foto_adicional_2) evidenciasOriginales.push(ot.solicitud.evidencia_foto_adicional_2);
            if (ot.solicitud.evidencia_foto_adicional_3) evidenciasOriginales.push(ot.solicitud.evidencia_foto_adicional_3);
            if (ot.solicitud.evidencia_foto_adicional_4) evidenciasOriginales.push(ot.solicitud.evidencia_foto_adicional_4);
            if (ot.solicitud.evidencia_foto_adicional_5) evidenciasOriginales.push(ot.solicitud.evidencia_foto_adicional_5);

            if (evidenciasOriginales.length > 0) {
                evidenciasOriginalesContainer.innerHTML = evidenciasOriginales.map(function (evidencia) {
                    if (!evidencia) return '';
                    return `
                        <div style="position: relative;">
                            <img src="${escapeHtml(evidencia)}" alt="Evidencia" loading="lazy" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${escapeHtml(evidencia)}', '_blank')" />
                        </div>
                    `;
                }).join('');
                evidenciasOriginalesGroup.style.display = 'block';
            } else {
                evidenciasOriginalesGroup.style.display = 'none';
            }
        } else {
            evidenciasOriginalesGroup.style.display = 'none';
        }

        // Descripción del proceso realizado
        document.getElementById('revisar_ot_proceso_realizado').textContent = ot.descripcion_proceso_realizado || 'Sin descripción del proceso';

        // Evidencias del cierre (ya vienen con URLs firmadas del backend)
        const evidenciasCierreGroup = document.getElementById('revisar_ot_evidencias_cierre_group');
        const evidenciasCierreContainer = document.getElementById('revisar_ot_evidencias_cierre');
        if (ot.cierre_evidencias && ot.cierre_evidencias.length > 0) {
            evidenciasCierreContainer.innerHTML = ot.cierre_evidencias.map(function (url) {
                return `
                    <div style="position: relative;">
                        <img src="${escapeHtml(url)}" alt="Evidencia cierre" loading="lazy" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${escapeHtml(url)}', '_blank')" />
                    </div>
                `;
            }).join('');
            evidenciasCierreGroup.style.display = 'block';
        } else {
            evidenciasCierreGroup.style.display = 'none';
        }

        // Mostrar comentario de rechazo previo si existe
        const comentarioRechazoGroup = document.getElementById('revisar_ot_comentario_rechazo_group');
        const comentarioRechazoField = document.getElementById('revisar_ot_comentario_rechazo');
        if (ot.comentario_rechazo) {
            if (comentarioRechazoGroup) {
                comentarioRechazoGroup.style.display = 'block';
            }
            if (comentarioRechazoField) {
                comentarioRechazoField.value = ot.comentario_rechazo;
                comentarioRechazoField.readOnly = true;
                comentarioRechazoField.style.background = '#fff3cd';
            }
            // Mostrar alerta de rechazo previo
            const alertaRechazo = document.createElement('div');
            alertaRechazo.className = 'alert alert-warning';
            alertaRechazo.style.cssText = 'padding: 15px; margin-bottom: 20px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;';
            alertaRechazo.innerHTML = '<strong>⚠️ Rechazo Previo:</strong> Esta OT fue rechazada anteriormente. El comentario de rechazo se muestra arriba.';
            const procesoRealizadoGroup = document.querySelector('#revisar_ot_proceso_realizado').parentElement;
            if (procesoRealizadoGroup && !document.querySelector('#alerta-rechazo-previo')) {
                alertaRechazo.id = 'alerta-rechazo-previo';
                procesoRealizadoGroup.insertAdjacentElement('afterend', alertaRechazo);
            }
        } else {
            if (comentarioRechazoGroup) {
                comentarioRechazoGroup.style.display = 'none';
            }
            if (comentarioRechazoField) {
                comentarioRechazoField.value = '';
                comentarioRechazoField.readOnly = false;
                comentarioRechazoField.style.background = '';
            }
            // Eliminar alerta si existe
            const alertaExistente = document.getElementById('alerta-rechazo-previo');
            if (alertaExistente) {
                alertaExistente.remove();
            }
        }

        // Resetear estado de los botones y campo de comentario (si no hay rechazo previo)
        const btnRechazar = document.getElementById('btnRechazarOT');
        const btnAprobar = document.getElementById('btnAprobarOT');
        const btnConfirmarRechazo = document.getElementById('btnConfirmarRechazo');
        const msgEl = document.getElementById('revisarOTMsg');

        if (!ot.comentario_rechazo) {
            // Si no hay rechazo previo, ocultar el campo de comentario
            if (comentarioRechazoGroup) {
                comentarioRechazoGroup.style.display = 'none';
            }
            if (comentarioRechazoField) {
                comentarioRechazoField.value = '';
                comentarioRechazoField.readOnly = false;
                comentarioRechazoField.style.background = '';
                comentarioRechazoField.required = false;
            }
        }

        if (btnRechazar) {
            btnRechazar.textContent = 'Rechazar';
            btnRechazar.classList.remove('btn-warning');
            btnRechazar.classList.add('btn-danger');
        }
        if (btnAprobar) {
            btnAprobar.style.display = 'inline-block';
        }
        if (btnConfirmarRechazo) {
            btnConfirmarRechazo.style.display = 'none';
        }
        if (msgEl) {
            msgEl.textContent = '';
            msgEl.className = 'status hidden';
        }

        openModal('modalRevisarOT');

    } catch (error) {
        console.error('Error abriendo modal de revisión:', error);
        flashMainStatus('bad', 'Error al cargar la OT: ' + (error.message || 'Error desconocido'));
    }
};

window.openAprobarOTModal = function () {
    const otId = document.getElementById('revisar_ot_id').value;
    if (!otId) {
        flashMainStatus('bad', 'Error: No se encontró el ID de la OT');
        return;
    }

    document.getElementById('aprobar_ot_id').value = otId;
    document.getElementById('aprobar_ot_password').value = '';
    const msgEl = document.getElementById('aprobarOTMsg');
    if (msgEl) {
        msgEl.textContent = '';
        msgEl.className = 'status hidden';
    }

    closeModal('modalRevisarOT');
    openModal('modalAprobarOT');
};

// Función para mostrar/ocultar el campo de comentario de rechazo
window.toggleRechazarOT = function () {
    const comentarioGroup = document.getElementById('revisar_ot_comentario_rechazo_group');
    const comentarioField = document.getElementById('revisar_ot_comentario_rechazo');
    const btnRechazar = document.getElementById('btnRechazarOT');
    const btnAprobar = document.getElementById('btnAprobarOT');
    const btnConfirmarRechazo = document.getElementById('btnConfirmarRechazo');

    if (comentarioGroup && comentarioField && btnRechazar) {
        if (comentarioGroup.style.display === 'none' || !comentarioGroup.style.display) {
            // Mostrar campo de comentario
            comentarioGroup.style.display = 'block';
            comentarioField.value = '';
            comentarioField.required = true;
            btnRechazar.textContent = 'Cancelar Rechazo';
            btnRechazar.classList.remove('btn-danger');
            btnRechazar.classList.add('btn-warning');
            if (btnAprobar) {
                btnAprobar.style.display = 'none';
            }
            if (btnConfirmarRechazo) {
                btnConfirmarRechazo.style.display = 'inline-block';
            }
        } else {
            // Ocultar campo de comentario
            comentarioGroup.style.display = 'none';
            comentarioField.value = '';
            comentarioField.required = false;
            btnRechazar.textContent = 'Rechazar';
            btnRechazar.classList.remove('btn-warning');
            btnRechazar.classList.add('btn-danger');
            if (btnAprobar) {
                btnAprobar.style.display = 'inline-block';
            }
            if (btnConfirmarRechazo) {
                btnConfirmarRechazo.style.display = 'none';
            }
        }
    }
};

// Función para rechazar OT
window.rechazarOT = async function () {
    const otId = document.getElementById('revisar_ot_id').value;
    const comentario = document.getElementById('revisar_ot_comentario_rechazo').value.trim();
    const msgEl = document.getElementById('revisarOTMsg');

    if (!otId) {
        flashStatus(msgEl, 'bad', 'Error: No se encontró el ID de la OT');
        return;
    }

    if (!comentario) {
        flashStatus(msgEl, 'bad', '❌ El comentario de rechazo es obligatorio.');
        return;
    }

    if (!window.confirm('¿Estás seguro de que deseas rechazar esta OT? El mecánico deberá corregir el trabajo y volver a cerrar la OT.')) {
        return;
    }

    if (msgEl) {
        msgEl.textContent = '';
        msgEl.className = 'status hidden';
    }

    try {
        const res = await bearerFetch(API_BASE + '/workorders/' + otId + '/reject', {
            method: 'POST',
            body: JSON.stringify({
                comentario: comentario
            })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Error al rechazar la OT');
        }

        flashStatus(msgEl, 'ok', '✅ OT rechazada correctamente. El mecánico ha sido notificado.');

        // Cerrar modal después de un momento
        setTimeout(function () {
            closeModal('modalRevisarOT');
            // Recargar verificaciones
            verificacionesReload();
            // Recargar OTs
            otReload();
        }, 1500);
    } catch (error) {
        console.error('Error rechazando OT:', error);
        flashStatus(msgEl, 'bad', '❌ ' + (error.message || 'Error al rechazar la OT'));
    }
};

// Manejar submit del formulario de aprobación
const aprobarOTForm = document.getElementById('aprobarOTForm');
if (aprobarOTForm) {
    aprobarOTForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const otId = document.getElementById('aprobar_ot_id').value;
        const password = document.getElementById('aprobar_ot_password').value;
        const msgEl = document.getElementById('aprobarOTMsg');

        if (!password) {
            flashStatus(msgEl, 'bad', '❌ La contraseña es obligatoria.');
            return;
        }

        if (msgEl) {
            msgEl.textContent = '';
            msgEl.className = 'status hidden';
        }

        try {
            const res = await bearerFetch(API_BASE + '/workorders/' + otId + '/approve', {
                method: 'POST',
                body: JSON.stringify({
                    password: password
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Error al aprobar la OT');
            }

            const data = await res.json();
            flashStatus(msgEl, 'ok', '✅ OT aprobada y firmada correctamente.');

            // Cerrar modal después de un momento
            setTimeout(function () {
                closeModal('modalAprobarOT');
                // Recargar verificaciones
                verificacionesReload();
                // Actualizar dashboard
                if (typeof solReload === 'function') {
                    solReload();
                }
            }, 1500);

        } catch (error) {
            console.error('Error aprobando OT:', error);
            flashStatus(msgEl, 'bad', '❌ ' + (error.message || 'Error al aprobar la OT. Verifica tu contraseña.'));
        }
    });
}

/* ======================================================== */
/* --- Historiales (Universalizado) --- */
/* ======================================================== */
var historialesViewerJefe = null;

function initHistorialSolicitudes() {
    var container = document.getElementById('historial-solicitudes-container');
    var entityTypeSelect = document.getElementById('historial-type-select-jefe');
    var categoryFilterSelect = document.getElementById('historial-categoria-filter-jefe');
    var categoryFilterWrapper = document.getElementById('historial-categoria-filter-wrapper');

    if (!container) {
        console.warn('[initHistorialSolicitudes] Contenedor no encontrado');
        return;
    }

    // Si ya existe el viewer, solo recargar
    if (historialesViewerJefe) {
        historialesViewerJefe.load();
        return;
    }

    // Verificar que initHistoryViewer esté disponible
    if (typeof window.initHistoryViewer === 'undefined') {
        console.error('[initHistorialSolicitudes] initHistoryViewer no está disponible');
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Error: HistoryViewer no está disponible</div>';
        return;
    }

    // Obtener roles del usuario actual (desde el contexto global o localStorage)
    var userRoles = [];
    try {
        var userStr = localStorage.getItem('crm.user');
        if (userStr) {
            var user = JSON.parse(userStr);
            userRoles = user.roles || [user.rol] || ['jefe_taller'];
        } else {
            userRoles = ['jefe_taller', 'JEFE_TALLER'];
        }
    } catch (e) {
        console.warn('[initHistorialSolicitudes] No se pudo obtener roles del usuario, usando default');
        userRoles = ['jefe_taller', 'JEFE_TALLER'];
    }

    console.log('[initHistorialSolicitudes] Inicializando historiales con roles:', userRoles);
    console.log('[initHistorialSolicitudes] bearerFetch disponible:', typeof bearerFetch === 'function');

    try {
        // Inicializar el viewer usando la función helper universalizada
        historialesViewerJefe = window.initHistoryViewer({
            container: container,
            entityTypeSelect: entityTypeSelect,
            categoryFilterSelect: categoryFilterSelect,
            bearerFetch: bearerFetch || window.bearerFetch,
            userRoles: userRoles,
            initialEntityType: 'solicitudes_mantenimiento',
            onRowClick: function (itemId, rowData) {
                // Verificar el entityType actual del viewer dinámicamente
                var currentEntityType = historialesViewerJefe ? historialesViewerJefe.entityType : null;
                
                if (!currentEntityType) {
                    console.warn('[initHistorialSolicitudes] No se pudo determinar el entityType actual');
                    return;
                }
                
                console.log('[initHistorialSolicitudes] Click en item ID:', itemId, 'EntityType:', currentEntityType);
                
                // Solo procesar clicks para tipos permitidos: ordenes_trabajo y solicitudes_mantenimiento
                if (currentEntityType === 'ordenes_trabajo') {
                    // Para OTs, abrir modal de solo lectura (para historiales)
                    if (typeof openOtViewModal === 'function') {
                        openOtViewModal(Number(itemId));
                    } else if (typeof window.openOtViewModal === 'function') {
                        window.openOtViewModal(Number(itemId));
                    } else {
                        console.error('[initHistorialSolicitudes] openOtViewModal no está disponible');
                        alert('No se pudo abrir el detalle de la orden de trabajo. La función no está disponible.');
                    }
                } else if (currentEntityType === 'solicitudes_mantenimiento') {
                    // Para solicitudes, abrir modal en modo solo lectura (sin mensaje de error)
                    if (typeof openSolicitudModalViewOnly === 'function') {
                        openSolicitudModalViewOnly(Number(itemId));
                    } else if (typeof window.openSolicitudModalViewOnly === 'function') {
                        window.openSolicitudModalViewOnly(Number(itemId));
                    } else {
                        console.error('[initHistorialSolicitudes] openSolicitudModalViewOnly no está disponible, usando openSolicitudModal normal');
                        // Fallback a función normal si no existe la versión view-only
                        if (typeof openSolicitudModal === 'function') {
                            openSolicitudModal(Number(itemId));
                        } else if (typeof window.openSolicitudModal === 'function') {
                            window.openSolicitudModal(Number(itemId));
                        }
                    }
                } else {
                    // Para otros tipos de historial, no hacer nada (no permitir clicks)
                    console.log('[initHistorialSolicitudes] Tipo de historial no permite clicks:', currentEntityType);
                    return;
                }
            },
            pageSize: 20
        });

        console.log('[initHistorialSolicitudes] HistorialesViewer creado exitosamente:', historialesViewerJefe);

        // Observar cambios en el selector de tipo de historial para mostrar/ocultar filtro de categoría
        if (entityTypeSelect && categoryFilterWrapper) {
            var originalChangeHandler = entityTypeSelect.onchange;
            entityTypeSelect.addEventListener('change', function () {
                // Mostrar filtro de categoría solo para solicitudes_mantenimiento
                if (this.value === 'solicitudes_mantenimiento') {
                    categoryFilterWrapper.style.display = 'block';
                } else {
                    categoryFilterWrapper.style.display = 'none';
                    if (categoryFilterSelect) {
                        categoryFilterSelect.value = '';
                    }
                }

                // Llamar al handler original si existe
                if (originalChangeHandler) {
                    originalChangeHandler.call(this);
                }
            });

            // Configurar estado inicial
            if (entityTypeSelect.value === 'solicitudes_mantenimiento') {
                categoryFilterWrapper.style.display = 'block';
            } else {
                categoryFilterWrapper.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('[initHistorialSolicitudes] Error al crear HistorialesViewer:', error);
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Error al inicializar los historiales: ' + error.message + '</div>';
        return;
    }
}

window.initHistorialSolicitudes = initHistorialSolicitudes;