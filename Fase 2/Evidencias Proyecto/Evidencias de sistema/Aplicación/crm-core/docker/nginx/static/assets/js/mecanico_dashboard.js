const API_BASE = '/api';

let mechanicUser = null;
let mechanicTasks = [];
let selectedTaskId = null;
let currentPage = 1;
const pageSize = 4; // Máximo 4 OTs por página

// Filtros para la vista activa
let taskFilters = {
    patente: '',
    chofer: '',
    fecha: ''
};

// OTs ocultas manualmente (guardadas en localStorage)
let hiddenOTs = [];
function loadHiddenOTs() {
    try {
        const stored = localStorage.getItem('mecanico_hidden_ots');
        hiddenOTs = stored ? JSON.parse(stored) : [];
    } catch (e) {
        hiddenOTs = [];
    }
}
function saveHiddenOTs() {
    try {
        localStorage.setItem('mecanico_hidden_ots', JSON.stringify(hiddenOTs));
    } catch (e) {
        console.error('Error guardando OTs ocultas:', e);
    }
}
function hideOT(otId) {
    if (!hiddenOTs.includes(otId)) {
        hiddenOTs.push(otId);
        saveHiddenOTs();
    }
}
function isOTHidden(otId) {
    return hiddenOTs.includes(otId);
}
function isOTCompletedMoreThanWeek(ot) {
    if ((ot.estado || '').toUpperCase() !== 'COMPLETADO') {
        return false;
    }
    const fechaCompletado = ot.fecha_finalizacion || ot.fecha_cierre || ot.fecha_creacion;
    if (!fechaCompletado) {
        return false;
    }
    const fecha = new Date(fechaCompletado);
    const unaSemanaAtras = new Date();
    unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
    return fecha < unaSemanaAtras;
}

// Estos elementos se obtendrán cuando el DOM esté listo
let taskListEl = null;
let taskListPaginationEl = null;
let taskDetailEl = null;
const statAsignadas = document.getElementById('statAsignadas');
const statEnProceso = document.getElementById('statEnProceso');
const statEspera = document.getElementById('statEspera');
const statListas = document.getElementById('statListas');
const userNameEl = document.getElementById('userName');
const btnRefresh = document.getElementById('btnRefreshTasks');

const diagModal = document.getElementById('modalDiagnostic');
const diagForm = document.getElementById('diagnosticForm');
const diagMsg = document.getElementById('diagnosticMsg');
const diagTaskIdInput = document.getElementById('diagnostic_task_id');
const diagFechaInput = document.getElementById('diagnostic_fecha_inicio');
const diagInicialInput = document.getElementById('diagnostic_inicial');
const diagPrioridadInput = document.getElementById('diagnostic_prioridad');
const diagDiscrepanciaInputs = document.querySelectorAll('input[name="diagnostic_discrepancia"]');
const diagDiscrepanciaDetalleInput = document.getElementById('diagnostic_discrepancia_detalle');
const diagDiscrepanciaDetalleGroup = document.getElementById('diagnostic_discrepancia_detalle_group');
const diagNotasInput = document.getElementById('diagnostic_notas');
const diagEvidenceInput = document.getElementById('diagnostic_evidencias');
const diagEvidenceList = document.getElementById('diagnostic_evidencias_list');
const diagOtLabel = document.getElementById('diagnostic_ot_label');
const diagVehLabel = document.getElementById('diagnostic_vehicle_label');
const diagCheckVisual = document.getElementById('diag_check_visual');
const diagCheckEscaner = document.getElementById('diag_check_escaner');
const diagCheckPrueba = document.getElementById('diag_check_prueba');
const diagCheckSeguridad = document.getElementById('diag_check_seguridad');
const diagCheckAllOk = document.getElementById('diag_check_all_ok');

let diagEvidenceBuffer = [];

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
    return fetch(url, Object.assign({}, options, { headers }));
}

function formatDate(value) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatLocalDateTimeInput(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        'T' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
    );
}

function flashMessage(target, kind, text) {
    if (!target) return;
    target.textContent = text;
    target.classList.remove('hidden', 'ok', 'bad');
    target.classList.add(kind === 'ok' ? 'ok' : 'bad');
}

function clearMessage(target) {
    if (!target) return;
    target.textContent = '';
    target.classList.add('hidden');
    target.classList.remove('ok', 'bad');
}

function showFloatingNotification(titulo, mensaje, tipo) {
    tipo = tipo || 'info';
    var container = document.getElementById('notificationsContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationsContainer';
        container.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 10000; max-width: 400px;';
        document.body.appendChild(container);
    }

    var notification = document.createElement('div');
    notification.className = 'floating-notification floating-notification--' + tipo;
    notification.style.cssText = 'background: white; border-left: 4px solid ' +
        (tipo === 'success' ? '#28a745' : tipo === 'error' ? '#dc3545' : '#17a2b8') +
        '; padding: 15px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: flex-start; gap: 10px;';

    var content = document.createElement('div');
    content.style.cssText = 'flex: 1;';
    content.innerHTML = '<strong>' + escapeHtml(titulo) + '</strong><br>' + escapeHtml(mensaje);

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background: none; border: none; font-size: 20px; cursor: pointer; color: #888; padding: 0; width: 24px; height: 24px; line-height: 24px; text-align: center;';
    closeBtn.onclick = function () {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(function () {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    };

    notification.appendChild(content);
    notification.appendChild(closeBtn);
    container.appendChild(notification);

    // Animación de entrada
    setTimeout(function () {
        notification.style.transition = 'all 0.3s ease';
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 10);
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function computeStats(list) {
    const total = list.length;
    const enProceso = list.filter((item) => (item.estado || '').toUpperCase() === 'EN_PROCESO').length;
    const espera = list.filter((item) => (item.estado || '').toUpperCase() === 'ESPERA_REPUESTOS').length;
    const listas = list.filter((item) => (item.estado || '').toUpperCase() === 'LISTO').length;
    statAsignadas.textContent = total;
    statEnProceso.textContent = enProceso;
    statEspera.textContent = espera;
    statListas.textContent = listas;
}

function formatPriorityBadge(priority) {
    const map = {
        BAJA: 'badge badge-prioridad badge-prioridad--baja">Baja',
        NORMAL: 'badge badge-prioridad badge-prioridad--normal">Normal',
        ALTA: 'badge badge-prioridad badge-prioridad--alta">Alta',
        URGENTE: 'badge badge-prioridad badge-prioridad--urgente">Urgente',
    };
    const key = (priority || 'NORMAL').toUpperCase();
    return '<span class="' + (map[key] || map.NORMAL) + '</span>';
}

function formatStatusBadge(status) {
    const map = {
        PENDIENTE: 'status-badge status-pendiente">Pendiente',
        CITA_MANTENCION: 'status-badge status-pendiente">Citado',
        APROBADO: 'status-badge status-aprobacion">Aprobado',
        EN_PROCESO: 'status-badge status-proceso">En Proceso',
        ESPERA_REPUESTOS: 'status-badge status-aprobacion">Espera Repuestos',
        LISTO: 'status-badge status-completado">Listo',
        COMPLETADO: 'status-badge status-completado">Completado',
    };
    const key = (status || 'PENDIENTE').toUpperCase();
    return '<span class="' + (map[key] || map.PENDIENTE) + '</span>';
}

function renderTaskList(list) {
    if (!taskListEl) return;
    
    console.log('renderTaskList: Total OTs antes de filtrar:', list.length);
    
    // Filtrar OTs ocultas y completadas con más de 1 semana
    const filteredList = list.filter(function(ot) {
        // No mostrar si está oculta manualmente
        if (isOTHidden(ot.id)) {
            console.log('OT', ot.id, 'oculta manualmente');
            return false;
        }
        // No mostrar si está completada hace más de 1 semana
        if (isOTCompletedMoreThanWeek(ot)) {
            console.log('OT', ot.id, 'completada hace más de 1 semana');
            return false;
        }
        return true;
    });
    
    console.log('renderTaskList: Total OTs después de filtrar:', filteredList.length);
    
    if (!filteredList.length) {
        taskListEl.innerHTML = '<div class="empty-state">Sin órdenes asignadas.</div>';
        return;
    }
    taskListEl.innerHTML = filteredList
        .map(function (ot) {
            const vehiculo = ot.vehiculo || {};
            const estado = (ot.estado || 'PENDIENTE').toUpperCase();
            const isSelected = Number(selectedTaskId) === ot.id;
            const fechaPlan = ot.fecha_inicio_trabajo ? formatDate(ot.fecha_inicio_trabajo) : 'Sin fecha';
            const fechaFin = ot.fecha_estimada_termino ? formatDate(ot.fecha_estimada_termino) : 'Sin fecha';
            const prioridadBadge = formatPriorityBadge(ot.prioridad);
            const estadoBadge = formatStatusBadge(estado);
            const problem = ot.descripcion_problema || ot.descripcion || (ot.solicitud?.descripcion ?? '');
            const isCompleted = estado === 'COMPLETADO';
            const hideButton = isCompleted ? '<button class="btn-hide-ot" data-ot-id="' + ot.id + '" style="position: absolute; bottom: 8px; right: 8px; background: #ffb3ba; color: #8b4a4f; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: background 0.2s;" onmouseover="this.style.background=\'#ff9ca3\'" onmouseout="this.style.background=\'#ffb3ba\'" title="Ocultar del dashboard">×</button>' : '';
            return [
                '<article class="task-card ', isSelected ? 'is-selected' : '', '" data-id="', ot.id, '" style="position: relative;">',
                hideButton,
                '<div class="task-card__header">',
                '<div class="task-card__title">', vehiculo.patente || ('Vehículo #' + vehiculo.id), '</div>',
                estadoBadge,
                '</div>',
                '<div class="task-card__meta">',
                '<span>Plan: ', fechaPlan, ' → ', fechaFin, '</span>',
                '<span>Mecánico: ', ot.mecanico?.nombre_completo || 'Tú', '</span>',
                '</div>',
                problem ? '<p class="task-card__problem">' + problem.substring(0, 120) + '</p>' : '',
                '<div class="task-card__tags">', prioridadBadge, '</div>',
                '</article>',
            ].join('');
        })
        .join('');

    taskListEl.querySelectorAll('.task-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
            // No seleccionar si se hizo clic en el botón de ocultar
            if (e.target.classList.contains('btn-hide-ot') || e.target.closest('.btn-hide-ot')) {
                return;
            }
            const id = Number(card.getAttribute('data-id'));
            selectTask(id);
        });
    });
    
    // Event listeners para botones de ocultar
    taskListEl.querySelectorAll('.btn-hide-ot').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const otId = Number(btn.getAttribute('data-ot-id'));
            if (confirm('¿Deseas ocultar esta OT del dashboard? Podrás verla en el Historial.')) {
                hideOT(otId);
                // Recargar la lista
                loadAssignments();
            }
        });
    });
}

function buildTimeline(ot) {
    const events = [];
    if (ot.fecha_apertura) {
        events.push({ label: 'OT creada', date: formatDateTime(ot.fecha_apertura) });
    }
    if (ot.fecha_ingreso_recepcion) {
        events.push({ label: 'Ingreso a recepción', date: formatDateTime(ot.fecha_ingreso_recepcion) });
    }
    events.push({ label: 'Estado actual', date: formatDateTime(new Date()), extra: (ot.estado || 'PENDIENTE') });
    return events
        .map(function (evt) {
            return [
                '<li>',
                '<div class="timeline-title">', evt.label, evt.extra ? ' (' + evt.extra + ')' : '', '</div>',
                '<div class="timeline-date">', evt.date, '</div>',
                '</li>',
            ].join('');
        })
        .join('');
}

function normalizeEvidenceUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    return API_BASE + '/files/proxy?key=' + encodeURIComponent(url);
}

function collectSolicitudEvidencias(task) {
    if (!task || !task.solicitud) return [];
    var sol = task.solicitud;
    return [
        sol.evidencia_foto_principal,
        sol.evidencia_foto_adicional_1,
        sol.evidencia_foto_adicional_2,
        sol.evidencia_foto_adicional_3,
        sol.evidencia_foto_adicional_4,
        sol.evidencia_foto_adicional_5,
    ].filter(function (url) {
        return typeof url === 'string' && url.length > 0;
    });
}

function buildEvidenceGallery(urls) {
    if (!urls.length) {
        return '<span class="evidence-empty">Sin evidencias adjuntas en la solicitud.</span>';
    }
    return (
        '<div class="evidence-grid">' +
        urls
            .map(function (url, idx) {
                var finalUrl = normalizeEvidenceUrl(url);
                return (
                    '<figure class="evidence-item" onclick="window.open(\'' +
                    finalUrl +
                    '\', \'_blank\')">' +
                    '<img src="' +
                    finalUrl +
                    '" alt="Evidencia ' +
                    (idx + 1) +
                    '" loading="lazy" />' +
                    '</figure>'
                );
            })
            .join('') +
        '</div>'
    );
}

function openDiagnosticModal(task) {
    if (!diagModal || !task) return;
    diagTaskIdInput.value = task.id;
    diagFechaInput.value = formatLocalDateTimeInput(new Date());

    // Llenar diagnóstico inicial (si ya existe, mostrar el valor guardado)
    if (diagInicialInput) {
        diagInicialInput.value = task.diagnostico_inicial || '';
    }

    // Llenar discrepancia
    var tieneDiscrepancia = task.discrepancia_diagnostico === true || task.discrepancia_diagnostico === 'true';
    diagDiscrepanciaInputs.forEach(function (input) {
        if (input.value === (tieneDiscrepancia ? 'si' : 'no')) {
            input.checked = true;
        }
    });

    // Llenar detalle de discrepancia y mostrar/ocultar el campo
    if (diagDiscrepanciaDetalleInput) {
        diagDiscrepanciaDetalleInput.value = task.discrepancia_diagnostico_detalle || '';
    }
    toggleDiscrepanciaDetalle(tieneDiscrepancia);

    // Notas adicionales (mantener separado del diagnóstico inicial)
    if (diagNotasInput) {
        diagNotasInput.value = '';
    }

    diagOtLabel.textContent = task.numero_ot || ('#' + task.id);
    const veh = task.vehiculo || {};
    diagVehLabel.textContent = veh.patente || ('Vehículo #' + (veh.id || ''));
    diagEvidenceBuffer = [];
    updateDiagnosticEvidenceList();
    [diagCheckVisual, diagCheckEscaner, diagCheckPrueba, diagCheckSeguridad].forEach(function (input) {
        if (input) input.checked = false;
    });
    if (diagCheckAllOk) diagCheckAllOk.checked = false;
    clearMessage(diagMsg);

    // Asegurar que los event listeners de discrepancia estén configurados
    // (por si los elementos no estaban disponibles al cargar el script)
    var inputs = diagModal.querySelectorAll('input[name="diagnostic_discrepancia"]');
    if (inputs && inputs.length) {
        inputs.forEach(function (input) {
            // Remover listeners anteriores para evitar duplicados
            var newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            newInput.addEventListener('change', function () {
                toggleDiscrepanciaDetalle(newInput.value === 'si');
            });
        });
    }

    // Prevenir scroll del body cuando el modal está abierto
    document.body.style.overflow = 'hidden';

    // Usar display: flex directamente como en jefe_taller_dashboard.js
    diagModal.style.display = 'flex';
    diagModal.classList.add('is-active');
    diagModal.setAttribute('aria-hidden', 'false');
}

function toggleDiscrepanciaDetalle(show) {
    console.log('toggleDiscrepanciaDetalle llamado con show:', show);
    if (!diagDiscrepanciaDetalleGroup) {
        console.log('diagDiscrepanciaDetalleGroup no encontrado');
        // Intentar encontrarlo de nuevo
        diagDiscrepanciaDetalleGroup = document.getElementById('diagnostic_discrepancia_detalle_group');
        if (!diagDiscrepanciaDetalleGroup) {
            console.error('No se pudo encontrar el grupo de detalle de discrepancia');
            return;
        }
    }
    if (!diagDiscrepanciaDetalleInput) {
        diagDiscrepanciaDetalleInput = document.getElementById('diagnostic_discrepancia_detalle');
    }

    var prioridadGroup = document.getElementById('diagnostic_prioridad_group');
    var prioridadInput = diagPrioridadInput || document.getElementById('diagnostic_prioridad');

    if (show) {
        diagDiscrepanciaDetalleGroup.style.display = 'block';
        if (diagDiscrepanciaDetalleInput) {
            diagDiscrepanciaDetalleInput.setAttribute('required', 'required');
            console.log('Campo de detalle de discrepancia mostrado y marcado como requerido');
        }
        // Mostrar campo de prioridad diagnosticada solo si hay discrepancia
        if (prioridadGroup) {
            prioridadGroup.style.display = 'block';
        }
        if (prioridadInput) {
            prioridadInput.setAttribute('required', 'required');
        }
    } else {
        diagDiscrepanciaDetalleGroup.style.display = 'none';
        if (diagDiscrepanciaDetalleInput) {
            diagDiscrepanciaDetalleInput.removeAttribute('required');
            diagDiscrepanciaDetalleInput.value = '';
            console.log('Campo de detalle de discrepancia ocultado');
        }
        // Ocultar campo de prioridad diagnosticada si no hay discrepancia
        if (prioridadGroup) {
            prioridadGroup.style.display = 'none';
        }
        if (prioridadInput) {
            prioridadInput.removeAttribute('required');
            // Resetear a NORMAL si se oculta
            if (prioridadInput.value === '') {
                prioridadInput.value = 'NORMAL';
            }
        }
    }
}

function closeDiagnosticModal() {
    if (!diagModal) return;

    // Restaurar scroll del body cuando se cierra el modal
    document.body.style.overflow = '';

    // Usar display: none directamente como en jefe_taller_dashboard.js
    diagModal.style.display = 'none';
    diagModal.classList.remove('is-active');
    diagModal.setAttribute('aria-hidden', 'true');
}
window.closeDiagnosticModal = closeDiagnosticModal;
window.openDiagnosticModal = openDiagnosticModal;

function readFileAsDataUrl(file) {
    // Usar FileUtils para comprimir imágenes antes de convertir a base64
    return FileUtils.fileToBase64(file, true)
        .then(function (dataUrl) {
            return { dataUrl: dataUrl, name: file.name };
        });
}

function mechanicOpenDiagnostic() {
    var task = mechanicTasks.find(function (t) { return t && t.id === selectedTaskId; });
    if (task) {
        openDiagnosticModal(task);
    }
}
window.mechanicOpenDiagnostic = mechanicOpenDiagnostic;

function handleDiagnosticFilesChange(ev) {
    // Usar función centralizada de validaciones
    const validFiles = ValidationUtils.handleFileInputChange(ev, {
        fieldName: 'Evidencias de diagnóstico',
        maxFiles: 5,
        onEmpty: function() {
            diagEvidenceBuffer = [];
            updateDiagnosticEvidenceList();
        },
        onClear: function() {
            diagEvidenceBuffer = [];
            updateDiagnosticEvidenceList();
        },
        allowEmpty: true
    });

    // Si hay error o no hay archivos válidos, salir
    if (!validFiles || validFiles.length === 0) {
        return;
    }

    // Procesar archivos válidos
    Promise.all(validFiles.map((file) => readFileAsDataUrl(file)))
        .then(function (payload) {
            diagEvidenceBuffer = payload;
            updateDiagnosticEvidenceList();
        })
        .catch(function (err) {
            console.error(err);
            diagEvidenceBuffer = [];
            updateDiagnosticEvidenceList();
            flashMessage(diagMsg, 'bad', '❌ No se pudieron procesar las evidencias.');
        });
}

function updateDiagnosticEvidenceList() {
    if (!diagEvidenceList) return;
    if (!diagEvidenceBuffer.length) {
        diagEvidenceList.innerHTML = '';
        return;
    }
    diagEvidenceList.innerHTML = diagEvidenceBuffer
        .map(function (item, idx) {
            return '<li>Foto ' + (idx + 1) + ' · ' + (item.name || 'captura') + '</li>';
        })
        .join('');
}

function handleDiagnosticSubmit(ev) {
    ev.preventDefault();
    clearMessage(diagMsg);

    // Mostrar loading en botón de submit
    const submitBtn = diagForm.querySelector('button[type="submit"]') || diagForm.querySelector('input[type="submit"]');
    if (submitBtn) {
        LoadingUtils.showButtonLoading(submitBtn, 'Registrando diagnóstico...');
    }

    // Obtener valores de los inputs
    const taskId = Number(diagTaskIdInput.value);
    const fechaInicioValue = diagFechaInput.value;
    const diagnosticoInicialValue = diagInicialInput ? diagInicialInput.value.trim() : '';

    // Re-buscar los elementos para asegurarse de que están actualizados
    var inputsDiscrepancia = diagModal.querySelectorAll('input[name="diagnostic_discrepancia"]');

    // Obtener valor de discrepancia
    var discrepanciaValue = null;
    inputsDiscrepancia.forEach(function (input) {
        if (input.checked) {
            discrepanciaValue = input.value === 'si';
        }
    });

    // Re-buscar elementos de prioridad y detalle
    var prioridadInput = document.getElementById('diagnostic_prioridad');
    var detalleInput = document.getElementById('diagnostic_discrepancia_detalle');

    // Obtener valores del checklist
    const hasVisual = !!diagCheckVisual?.checked;
    const hasEscaner = !!diagCheckEscaner?.checked;
    const hasPrueba = !!diagCheckPrueba?.checked;
    const hasSeguridad = !!diagCheckSeguridad?.checked;
    const checklistCompleto = !!diagCheckAllOk?.checked;

    // Preparar datos para validación (incluyendo checklist)
    const diagnosticoData = {
        taskId: taskId,
        fechaInicio: fechaInicioValue,
        diagnosticoInicial: diagnosticoInicialValue,
        discrepanciaDiagnostico: discrepanciaValue,
        discrepanciaDiagnosticoDetalle: detalleInput ? detalleInput.value.trim() : '',
        prioridadDiagnosticada: prioridadInput ? prioridadInput.value : '',
        checklist: {
            inspeccionVisual: hasVisual,
            escanerElectronico: hasEscaner,
            pruebaRuta: hasPrueba,
            seguridadOperativa: hasSeguridad
        },
        checklistCompleto: checklistCompleto
    };

    // Validar usando el módulo centralizado (incluye validación del checklist)
    const validationResult = DomainValidations.validateDiagnostico(diagnosticoData);
    if (!validationResult.valid) {
        flashMessage(diagMsg, 'bad', validationResult.message);
        if (submitBtn) {
            LoadingUtils.hideButtonLoading(submitBtn);
        }
        return;
    }

    // Convertir fecha (ya validada)
    const fecha = new Date(fechaInicioValue);

    // Construir payload - asegurarse de que los valores boolean se envíen correctamente
    const payload = {
        fechaInicio: fecha.toISOString(),
        diagnosticoInicial: diagInicialInput.value.trim(),
    };

    // Re-buscar elementos de prioridad y detalle para asegurarse de que están actualizados
    var prioridadInput = document.getElementById('diagnostic_prioridad');
    var detalleInput = document.getElementById('diagnostic_discrepancia_detalle');

    console.log('handleDiagnosticSubmit: Elementos encontrados:', {
        prioridadInput: prioridadInput ? 'Sí' : 'No',
        prioridadValue: prioridadInput ? prioridadInput.value : 'N/A',
        detalleInput: detalleInput ? 'Sí' : 'No',
        detalleValue: detalleInput ? detalleInput.value : 'N/A'
    });

    // Solo incluir prioridad diagnosticada si hay discrepancia
    if (discrepanciaValue && prioridadInput && prioridadInput.value) {
        payload.prioridadDiagnosticada = prioridadInput.value;
        console.log('handleDiagnosticSubmit: Prioridad diagnosticada incluida:', prioridadInput.value);
    } else {
        console.log('handleDiagnosticSubmit: Prioridad diagnosticada NO incluida:', {
            discrepanciaValue: discrepanciaValue,
            prioridadInput: prioridadInput ? 'Existe' : 'No existe',
            prioridadValue: prioridadInput ? prioridadInput.value : 'N/A'
        });
    }

    // SIEMPRE incluir discrepanciaDiagnostico (incluso si es false)
    // Esto es importante porque el backend necesita saber si hay discrepancia o no
    payload.discrepanciaDiagnostico = discrepanciaValue === true;
    console.log('handleDiagnosticSubmit: discrepanciaDiagnostico en payload:', payload.discrepanciaDiagnostico);

    // Solo incluir detalle si hay discrepancia
    if (discrepanciaValue && detalleInput && detalleInput.value.trim()) {
        payload.discrepanciaDiagnosticoDetalle = detalleInput.value.trim();
        console.log('handleDiagnosticSubmit: Detalle de discrepancia incluido');
    } else {
        console.log('handleDiagnosticSubmit: Detalle de discrepancia NO incluido:', {
            discrepanciaValue: discrepanciaValue,
            detalleInput: detalleInput ? 'Existe' : 'No existe',
            detalleValue: detalleInput ? detalleInput.value : 'N/A'
        });
    }

    // Notas opcionales
    if (diagNotasInput && diagNotasInput.value && diagNotasInput.value.trim()) {
        payload.notas = diagNotasInput.value.trim();
    }

    // Checklist
    payload.checklist = {
        inspeccionVisual: hasVisual,
        escanerElectronico: hasEscaner,
        pruebaRuta: hasPrueba,
        seguridadOperativa: hasSeguridad,
    };
    payload.checklistCompleto = checklistCompleto;

    if (diagEvidenceBuffer.length) {
        payload.evidencias = diagEvidenceBuffer.map((item) => item.dataUrl);
    }

    // Log del payload antes de enviar
    console.log('handleDiagnosticSubmit: Enviando payload:', {
        discrepanciaDiagnostico: payload.discrepanciaDiagnostico,
        discrepanciaDiagnosticoDetalle: payload.discrepanciaDiagnosticoDetalle ? 'Presente' : 'Ausente',
        prioridadDiagnosticada: payload.prioridadDiagnosticada,
        diagnosticoInicial: payload.diagnosticoInicial ? 'Presente' : 'Ausente'
    });

    bearerFetch(API_BASE + '/workorders/' + taskId + '/diagnostic', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error(err.message || 'No se pudo registrar el diagnóstico');
                });
            }
            return res.json();
        })
        .then(function (otActualizada) {
            // Ocultar loading
            if (submitBtn) {
                LoadingUtils.hideButtonLoading(submitBtn);
            }

            flashMessage(diagMsg, 'ok', '✅ Diagnóstico registrado.');
            closeDiagnosticModal();
            diagEvidenceBuffer = [];
            updateDiagnosticEvidenceList();
            // Recargar asignaciones para obtener los datos actualizados de la OT
            loadAssignments().then(function () {
                // Si hay discrepancia, mostrar mensaje informativo
                if (otActualizada && otActualizada.discrepancia_diagnostico) {
                    var tieneDiscrepancia = otActualizada.discrepancia_diagnostico === true || otActualizada.discrepancia_diagnostico === 'true';
                    if (tieneDiscrepancia) {
                        setTimeout(function () {
                            flashMessage(diagMsg, 'info', 'ℹ️ Se ha enviado una solicitud al jefe de taller para revisar la discrepancia. El botón "Iniciar trabajo" estará deshabilitado hasta que se resuelva.');
                        }, 500);
                    }
                }
            });
        })
        .catch(function (err) {
            // Ocultar loading en caso de error
            if (submitBtn) {
                LoadingUtils.hideButtonLoading(submitBtn);
            }

            ErrorHandler.handleError(err, 'Registrar diagnóstico', {
                targetElement: diagMsg,
                useFlashMessage: true
            });
        });
}

function actionButtonsForState(ot, solicitudesRepuestos) {
    const estado = (ot.estado || 'PENDIENTE').toUpperCase();
    console.log('actionButtonsForState: estado de OT =', estado, 'OT completa:', {
        id: ot.id,
        numero_ot: ot.numero_ot,
        diagnostico_inicial: ot.diagnostico_inicial ? 'Sí' : 'No',
        discrepancia_diagnostico: ot.discrepancia_diagnostico,
        discrepancia_diagnostico_aprobada: ot.discrepancia_diagnostico_aprobada,
        discrepancia_diagnostico_rechazada: ot.discrepancia_diagnostico_rechazada
    });

    // Verificar si ya se completó el diagnóstico
    const tieneDiagnostico = !!(ot.diagnostico_inicial && ot.diagnostico_inicial.trim());

    // Verificar si hay discrepancia pendiente
    // Manejar tanto boolean true como string "true", y también null/undefined
    const tieneDiscrepancia = ot.discrepancia_diagnostico === true ||
        ot.discrepancia_diagnostico === 'true' ||
        ot.discrepancia_diagnostico === 1;
    const noAprobada = !ot.discrepancia_diagnostico_aprobada ||
        ot.discrepancia_diagnostico_aprobada === false ||
        ot.discrepancia_diagnostico_aprobada === 0;
    const noRechazada = !ot.discrepancia_diagnostico_rechazada ||
        ot.discrepancia_diagnostico_rechazada === false ||
        ot.discrepancia_diagnostico_rechazada === 0;
    const discrepanciaPendiente = tieneDiscrepancia && noAprobada && noRechazada;

    console.log('actionButtonsForState: tieneDiscrepancia =', tieneDiscrepancia, 'discrepanciaPendiente =', discrepanciaPendiente);

    const buttons = [];

    // Verificar si el trabajo ha sido iniciado (no solo el diagnóstico)
    // El trabajo se considera iniciado cuando el vehículo está en estado 'MANTENCION'
    // Esto solo ocurre cuando el mecánico hace clic en "Iniciar trabajo"
    const vehiculo = ot.vehiculo || {};
    const vehiculoEnMantencion = (vehiculo.estado || '').toUpperCase() === 'MANTENCION';
    const trabajoIniciado = vehiculoEnMantencion;

    console.log('actionButtonsForState: Verificando estado del vehículo:', {
        vehiculoEstado: vehiculo.estado,
        vehiculoEnMantencion: vehiculoEnMantencion,
        trabajoIniciado: trabajoIniciado,
        estadoOT: estado,
        tieneDiagnostico: tieneDiagnostico,
        mecanicoEstado: ot.mecanico?.estado_usuario,
        mecanico: ot.mecanico
    });

    // Verificar si hay repuestos pendientes
    let tieneRepuestosPendientes = false;
    let motivoDeshabilitado = '';
    if (solicitudesRepuestos && Array.isArray(solicitudesRepuestos)) {
        const pendientes = solicitudesRepuestos.filter(function (sol) {
            const estadoSol = (sol.estado || '').toUpperCase();
            return estadoSol === 'SOLICITADA' || estadoSol === 'APROBADA';
        });
        tieneRepuestosPendientes = pendientes.length > 0;
        if (tieneRepuestosPendientes) {
            motivoDeshabilitado = 'Hay repuestos pendientes de aprobación o recepción';
        }
    }

    // Si el trabajo ya está en proceso (iniciado), mostrar "Pausar"/"Reanudar", "Solicitar repuestos" y "Terminar trabajo"
    if (trabajoIniciado) {
        // Verificar si el usuario está en break
        // El estado del usuario debería venir en ot.mecanico.estado_usuario
        const estadoUsuario = (ot.mecanico?.estado_usuario || 'ACTIVO').toUpperCase();
        const estaEnBreak = estadoUsuario === 'EN_BREAK';

        buttons.push({
            label: estaEnBreak ? 'Reanudar' : 'Pausar',
            action: estaEnBreak ? 'resume' : 'pause',
            enabled: true,
            requiresForm: false,
        });

        // Botón "Solicitar repuestos" - disponible durante el trabajo
        buttons.push({
            label: 'Solicitar repuestos',
            action: 'solicitarRepuestos',
            enabled: !['COMPLETADO', 'CANCELADA'].includes(estado),
            requiresForm: false,
        });

        // Botón "Terminar trabajo" - deshabilitado si hay repuestos pendientes o si el trabajo está pausado
        const puedeTerminar = !tieneRepuestosPendientes && !estaEnBreak;
        if (!puedeTerminar) {
            if (estaEnBreak) {
                motivoDeshabilitado = 'El trabajo está pausado. Reanuda el trabajo para poder terminarlo.';
            } else if (tieneRepuestosPendientes && !motivoDeshabilitado) {
                motivoDeshabilitado = 'Hay repuestos pendientes de aprobación o recepción';
            }
        }

        buttons.push({
            label: 'Terminar trabajo',
            action: 'complete',
            enabled: puedeTerminar,
            nextStatus: 'LISTO',
            requiresForm: false,
            disabledReason: motivoDeshabilitado || ''
        });
        return buttons;
    }

    // Botón "Iniciar diagnóstico" - solo si NO tiene diagnóstico
    if (!tieneDiagnostico) {
        buttons.push({
            label: 'Iniciar diagnóstico',
            action: 'start',
            enabled: !['COMPLETADO', 'CANCELADA'].includes(estado),
            nextStatus: 'EN_PROCESO',
            requiresForm: true,
        });
    } else {
        // Si ya tiene diagnóstico, mostrar botón "Iniciar trabajo"
        buttons.push({
            label: 'Iniciar trabajo',
            action: 'startWork',
            // Habilitado solo si no hay discrepancia pendiente
            enabled: !discrepanciaPendiente && !['COMPLETADO', 'CANCELADA'].includes(estado),
            nextStatus: 'EN_PROCESO',
            requiresForm: false,
        });

        // Botón "Solicitar repuestos" - disponible después del diagnóstico y cuando se puede iniciar trabajo
        buttons.push({
            label: 'Solicitar repuestos',
            action: 'solicitarRepuestos',
            enabled: !discrepanciaPendiente && !['COMPLETADO', 'CANCELADA'].includes(estado),
            requiresForm: false,
        });
    }

    // Botones adicionales
    buttons.push(
        {
            label: 'Trabajo finalizado',
            action: 'complete',
            enabled: ['ESPERA_REPUESTOS'].includes(estado),
            nextStatus: 'LISTO',
        }
    );

    return buttons;
}

// ===== Modal genérico de confirmación de acción =====

let confirmActionConfig = null;

function openConfirmActionModal(options) {
    confirmActionConfig = options || {};

    var modal = document.getElementById('modalConfirmAction');
    if (!modal) return;

    var titleEl = document.getElementById('confirmActionTitle');
    var msgEl = document.getElementById('confirmActionMessage');
    var okBtn = document.getElementById('confirmActionOkBtn');
    var cancelBtn = document.getElementById('confirmActionCancelBtn');

    if (titleEl) {
        titleEl.textContent = options.title || 'Confirmar acción';
    }
    if (msgEl) {
        msgEl.textContent = options.message || '';
    }

    if (okBtn) {
        okBtn.textContent = options.confirmLabel || 'Confirmar';
        okBtn.onclick = function () {
            if (confirmActionConfig && typeof confirmActionConfig.onConfirm === 'function') {
                confirmActionConfig.onConfirm();
            }
            closeConfirmActionModal();
        };
    }

    if (cancelBtn) {
        cancelBtn.textContent = options.cancelLabel || 'Cancelar';
        cancelBtn.onclick = function () {
            if (confirmActionConfig && typeof confirmActionConfig.onCancel === 'function') {
                confirmActionConfig.onCancel();
            }
            closeConfirmActionModal();
        };
    }

    modal.style.display = 'flex';
    modal.classList.add('is-active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeConfirmActionModal() {
    var modal = document.getElementById('modalConfirmAction');
    if (!modal) return;

    modal.style.display = 'none';
    modal.classList.remove('is-active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    confirmActionConfig = null;
}

window.openConfirmActionModal = openConfirmActionModal;
window.closeConfirmActionModal = closeConfirmActionModal;

function confirmAndStartWork(taskRef, msgEl) {
    if (!taskRef) return;

    // Verificar discrepancia pendiente igual que antes
    var tieneDiscrepancia = taskRef.discrepancia_diagnostico === true || taskRef.discrepancia_diagnostico === 'true';
    var discrepanciaPendiente = tieneDiscrepancia &&
        (!taskRef.discrepancia_diagnostico_aprobada || taskRef.discrepancia_diagnostico_aprobada === false) &&
        (!taskRef.discrepancia_diagnostico_rechazada || taskRef.discrepancia_diagnostico_rechazada === false);

    if (discrepanciaPendiente) {
        flashMessage(msgEl, 'bad', '❌ No puedes iniciar el trabajo hasta que el jefe de taller apruebe o rechace la discrepancia.');
        return;
    }

    openConfirmActionModal({
        title: 'Iniciar trabajo',
        message: '¿Confirmas que deseas iniciar el trabajo de esta orden?',
        confirmLabel: 'Iniciar trabajo',
        onConfirm: function () {
            clearMessage(msgEl);
            bearerFetch(API_BASE + '/workorders/status', {
                method: 'PATCH',
                body: JSON.stringify({ id: taskRef.id, status: 'EN_PROCESO' }),
            })
                .then(function (res) {
                    if (!res.ok) {
                        return res.json().then(function (err) {
                            throw new Error(err.message || 'Error al iniciar el trabajo');
                        });
                    }
                    return res.json();
                })
                .then(function (data) {
                    flashMessage(msgEl, 'ok', '✅ Trabajo iniciado correctamente.');
                    // Recargar asignaciones y detalle
                    setTimeout(function () {
                        loadAssignments().then(function () {
                            if (selectedTaskId) {
                                loadTaskDetail(selectedTaskId);
                            }
                        });
                    }, 500);
                })
                .catch(function (err) {
                    flashMessage(msgEl, 'bad', '❌ ' + (err.message || 'No se pudo iniciar el trabajo.'));
                });
        }
    });
}


function renderTaskDetail(task) {
    if (!taskDetailEl) return;
    if (!task) {
        taskDetailEl.innerHTML = '<div class="empty-state">Selecciona una orden de la lista para ver su información.</div>';
        return;
    }

    // Cargar solicitudes de repuestos antes de renderizar para poder verificar si hay pendientes
    const solicitudesEnCache = solicitudesRepuestosCache[task.id];

    // Si no hay solicitudes en cache, cargarlas primero
    if (!solicitudesEnCache) {
        loadSolicitudesRepuestos(task.id).then(function (solicitudes) {
            solicitudesRepuestosCache[task.id] = solicitudes;
            // Re-renderizar con las solicitudes cargadas
            renderTaskDetailWithSolicitudes(task, solicitudes);
        });
        return;
    }

    // Renderizar con las solicitudes del cache
    renderTaskDetailWithSolicitudes(task, solicitudesEnCache);
}

function renderTaskDetailWithSolicitudes(task, solicitudesRepuestos) {
    if (!taskDetailEl) return;

    const vehiculo = task.vehiculo || {};
    const schedule = task.fecha_inicio_trabajo || task.fecha_estimada_termino
        ? formatDateTime(task.fecha_inicio_trabajo) + ' → ' + formatDateTime(task.fecha_estimada_termino)
        : 'Sin plan definido';
    const timeline = buildTimeline(task);
    const actions = actionButtonsForState(task, solicitudesRepuestos);
    const evidencias = collectSolicitudEvidencias(task);
    const problem = task.descripcion_problema || task.descripcion || task.solicitud?.descripcion || 'Sin descripción detallada.';

    taskDetailEl.innerHTML = [
        '<div class="detail-head">',
        '<div>',
        '<h3>OT ', task.numero_ot || ('#' + task.id), '</h3>',
        '<p>', vehiculo.patente || ('Vehículo #' + vehiculo.id || 'Sin vehículo'), ' · ', vehiculo.modelo || '-', '</p>',
        '</div>',
        formatStatusBadge(task.estado),
        '</div>',
        '<div id="mechanicActionMsg" class="status hidden"></div>',
        '<div class="detail-grid">',
        '<div class="detail-item"><span>Prioridad</span><strong>', task.prioridad || 'NORMAL', '</strong></div>',
        '<div class="detail-item"><span>Ventana planificada</span><strong>', schedule, '</strong></div>',
        '<div class="detail-item"><span>Chofer</span><strong>', task.solicitud?.conductor?.nombre_completo || 'Sin registro', '</strong></div>',
        '<div class="detail-item"><span>Estado vehículo</span><strong>', vehiculo.estado || '—', '</strong></div>',
        '</div>',
        '<div class="detail-actions">',
        actions
            .map(function (btn) {
                // Asignar clases según la acción
                var classes = '';

                if (btn.action === 'complete') {
                    // Botón "Terminar trabajo" - estilo diferente cuando está deshabilitado
                    if (btn.enabled) {
                        classes = 'btn-success';
                    } else {
                        classes = 'btn-secondary';
                    }
                } else if (btn.action === 'solicitarRepuestos') {
                    classes = 'btn-warning';
                } else if (btn.action === 'startWork') {
                    // Usar estilo especial para iniciar trabajo
                    classes = btn.enabled
                        ? 'btn-start-work'
                        : 'btn-start-work btn-start-work-disabled';
                } else {
                    classes = 'btn-primary';
                }

                var disabledAttr = btn.enabled ? '' : 'disabled';
                var titleAttr = '';
                if (!btn.enabled) {
                    if (btn.action === 'startWork') {
                        titleAttr = ' title="Esperando resolución de discrepancia por el jefe de taller"';
                    } else if (btn.action === 'complete' && btn.disabledReason) {
                        titleAttr = ' title="' + escapeHtml(btn.disabledReason) + '"';
                    }
                }

                var base = '<button class="btn ' + classes + '" data-action="' + btn.action + '" ' + disabledAttr + titleAttr + '>';
                return base + btn.label + '</button>';
            })
            .join(''),
        '</div>',
        '<div class="detail-section">',
        '<h4>Descripción</h4>',
        '<p>', problem, '</p>',
        '</div>',
        (task.comentario_rechazo ?
            '<div class="detail-section" style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px;">' +
            '<h4 style="color: #856404; margin-top: 0;">⚠️ Comentario de Rechazo</h4>' +
            '<p style="color: #856404; white-space: pre-wrap; margin: 0;">' + escapeHtml(task.comentario_rechazo) + '</p>' +
            '<p style="color: #856404; font-size: 0.9em; margin-top: 10px; font-style: italic;">Por favor, corrige el trabajo según las indicaciones y vuelve a cerrar la OT.</p>' +
            '</div>' : ''
        ),
        '<div class="detail-section">',
        '<h4>Evidencias de la solicitud</h4>',
        buildEvidenceGallery(evidencias),
        '</div>',
        '<div class="detail-section">',
        '<h4>Historial rápido</h4>',
        '<ul class="timeline">', timeline, '</ul>',
        '</div>',
        '<div class="detail-section" id="solicitudesRepuestosSection">',
        '<h4>Solicitudes de Repuestos</h4>',
        '<div id="solicitudesRepuestosList"></div>',
        '</div>',
    ].join('');

    // Renderizar lista de solicitudes de repuestos
    renderSolicitudesRepuestosList(task.id, solicitudesRepuestos);

    const msgEl = document.getElementById('mechanicActionMsg');

    // Debug: verificar que taskDetailEl existe
    console.log('renderTaskDetail: taskDetailEl =', taskDetailEl);
    console.log('renderTaskDetail: task =', task);

    // Usar setTimeout para asegurar que el DOM se haya actualizado
    setTimeout(function () {
        var buttons = taskDetailEl.querySelectorAll('button[data-action]');
        console.log('renderTaskDetail: encontrados', buttons.length, 'botones con data-action');

        buttons.forEach(function (button, index) {
            var action = button.getAttribute('data-action');
            var isDisabled = button.hasAttribute('disabled');
            console.log('Botón', index, ':', action, 'disabled:', isDisabled, button);

            // Para los botones "start" y "startWork", siempre adjuntar listener
            // "start" puede estar deshabilitado pero debe funcionar
            // "startWork" debe respetar el disabled (discrepancia pendiente)
            if (isDisabled && action !== 'start' && action !== 'startWork') {
                console.log('Botón', action, 'está deshabilitado, saltando...');
                return;
            }

            if (isDisabled && (action === 'start' || action === 'startWork')) {
                console.log('Botón', action, 'está deshabilitado pero adjuntando listener');
            }

            // Remover listeners anteriores si existen
            var newButton = button.cloneNode(true);

            // Para el botón "start" (Iniciar diagnóstico), quitar el disabled para que funcione
            // Para "startWork" (Iniciar trabajo), mantener el disabled si está deshabilitado (discrepancia pendiente)
            if (action === 'start') {
                newButton.removeAttribute('disabled');
                newButton.disabled = false;
            }
            // Para "startWork", no quitar el disabled - debe respetar si hay discrepancia pendiente

            button.parentNode.replaceChild(newButton, button);

            // Guardar referencia a task en el botón para acceso directo
            newButton._taskRef = task;
            newButton._action = action;

            // Adjuntar nuevo listener con múltiples métodos
            var clickHandler = function (ev) {
                console.log('Click en botón con action:', action);
                ev.preventDefault();
                ev.stopPropagation();

                var taskRef = ev.currentTarget._taskRef;
                if (!taskRef) {
                    console.error('No se encontró referencia a task en el botón');
                    return;
                }

                if (action === 'start') {
                    console.log('Abriendo modal de diagnóstico para task:', taskRef);
                    if (typeof openDiagnosticModal === 'function') {
                        openDiagnosticModal(taskRef);
                    } else if (typeof window.openDiagnosticModal === 'function') {
                        window.openDiagnosticModal(taskRef);
                    } else {
                        console.error('openDiagnosticModal no está definida!');
                    }
                } else if (action === 'startWork') {
                    // Usar el flujo centralizado con modal de confirmación
                    confirmAndStartWork(taskRef, msgEl)
                } else if (action === 'solicitarRepuestos') {
                    // Abrir modal para solicitar repuestos
                    openSolicitarRepuestosModal(taskRef);
                } else if (action === 'pause') {
                    // Pausar trabajo
                    console.log('Click en botón pause, llamando handlePauseResume con taskRef:', taskRef);
                    handlePauseResume(taskRef, 'pause', msgEl);
                } else if (action === 'resume') {
                    // Reanudar trabajo
                    console.log('Click en botón resume, llamando handlePauseResume con taskRef:', taskRef);
                    handlePauseResume(taskRef, 'resume', msgEl);
                } else if (action === 'complete') {
                    // Verificar si el botón está deshabilitado antes de abrir el modal
                    if (ev.target && ev.target.disabled) {
                        console.log('Click en botón complete deshabilitado, ignorando...');
                        // Mostrar mensaje con el motivo si está disponible
                        const title = ev.target.getAttribute('title');
                        if (title) {
                            flashMessage(msgEl, 'bad', '⚠️ ' + title);
                        }
                        return;
                    }
                    // Abrir modal de cierre de trabajo
                    console.log('Click en botón complete, abriendo modal de cierre para task:', taskRef);
                    openCierreTrabajoModal(taskRef);
                } else {
                    handleAction(taskRef, action, msgEl);
                }
            };

            // Solo adjuntar un listener para evitar duplicación
            newButton.addEventListener('click', clickHandler);
        });
    }, 0);
}

function handlePauseResume(task, action, msgEl) {
    console.log('handlePauseResume llamado con:', { task: task?.id, action, msgEl: !!msgEl });
    if (!task) {
        console.error('handlePauseResume: task no está definido');
        return;
    }
    if (!task.id) {
        console.error('handlePauseResume: task.id no está definido', task);
        return;
    }

    const actionText = action === 'pause' ? 'pausar' : 'reanudar';
    const endpoint = action === 'pause' ? 'pause' : 'resume';
    const url = API_BASE + '/workorders/' + task.id + '/' + endpoint;

    console.log('handlePauseResume: URL:', url);

    openConfirmActionModal({
        title: action === 'pause' ? 'Pausar trabajo' : 'Reanudar trabajo',
        message: '¿Confirmas que deseas ' + actionText + ' el trabajo de esta orden?',
        confirmLabel: action === 'pause' ? 'Pausar' : 'Reanudar',
        onConfirm: function () {
            if (msgEl) {
                clearMessage(msgEl);
            }

            console.log('handlePauseResume: Enviando petición a', url);
            bearerFetch(url, {
                method: 'POST',
            })
                .then(function (res) {
                    console.log('handlePauseResume: Respuesta recibida, status:', res.status, 'ok:', res.ok);
                    if (!res.ok) {
                        return res.json().then(function (err) {
                            console.error('handlePauseResume: Error en respuesta:', err);
                            throw new Error(err.message || 'Error al ' + actionText + ' el trabajo');
                        });
                    }
                    return res.json();
                })
                .then(function (data) {
                    console.log('handlePauseResume: Éxito, datos:', data);
                    if (msgEl) {
                        flashMessage(msgEl, 'ok', '✅ Trabajo ' + (action === 'pause' ? 'pausado' : 'reanudado') + ' correctamente.');
                    }
                    setTimeout(function () {
                        loadAssignments().then(function () {
                            if (selectedTaskId) {
                                loadTaskDetail(selectedTaskId);
                            }
                        });
                    }, 300);
                })
                .catch(function (err) {
                    console.error('handlePauseResume: Error capturado:', err);
                    ErrorHandler.handleError(err, actionText + ' trabajo', {
                        targetElement: msgEl,
                        useFlashMessage: true,
                        useAlert: !msgEl
                    });
                });
        }
    });
}

function handleAction(task, action, msgEl) {
    if (!task) return;

    // Manejar acción "startWork" (Iniciar trabajo) - diferente de "start" (Iniciar diagnóstico)
    if (action === 'startWork') {
        var msgTarget = msgEl || document.getElementById('mechanicActionMsg');
        confirmAndStartWork(task, msgTarget);
        return;
    }

    const config = {
        start: { status: 'EN_PROCESO', message: '¿Iniciar el diagnóstico de esta orden?' },
        parts: { status: 'ESPERA_REPUESTOS', message: '¿Marcar esta orden en espera de repuestos?' },
        complete: { status: 'LISTO', message: '¿Confirmar que el trabajo fue finalizado?' },
    }[action];
    if (!config) return;
    if (!window.confirm(config.message)) return;

    clearMessage(msgEl);
    bearerFetch(API_BASE + '/workorders/status', {
        method: 'PATCH',
        body: JSON.stringify({ id: task.id, status: config.status }),
    })
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error(err.message || 'Error al actualizar el estado');
                });
            }
            return res.json();
        })
        .then(function () {
            flashMessage(msgEl, 'ok', '✅ Estado actualizado correctamente.');
            loadAssignments();
        })
        .catch(function (err) {
            ErrorHandler.handleError(err, 'Actualizar orden', {
                targetElement: msgEl,
                useFlashMessage: true
            });
        });
}

function selectTask(id) {
    selectedTaskId = id;
    const task = mechanicTasks.find((item) => item.id === id);
    renderTaskList(mechanicTasks);
    renderTaskDetail(task || null);
}

function loadTaskDetail(taskId) {
    if (!taskId) {
        renderTaskDetail(null);
        return;
    }
    // Siempre recargar desde el servidor para obtener el estado más actualizado del usuario
    // Esto asegura que el estado_usuario se actualice correctamente después de pausar/reanudar
    loadAssignments().then(function () {
        const updatedTask = mechanicTasks.find((item) => item.id === taskId);
        renderTaskDetail(updatedTask || null);
    });
}

function loadAssignments(page) {
    if (!mechanicUser || !mechanicUser.id) {
        console.warn('loadAssignments: No hay usuario mecánico');
        return Promise.resolve();
    }
    
    // Asegurar que tenemos referencias a los elementos
    if (!taskListEl) {
        taskListEl = document.getElementById('taskList');
    }
    if (!taskListPaginationEl) {
        taskListPaginationEl = document.getElementById('taskListPagination');
    }
    if (!taskDetailEl) {
        taskDetailEl = document.getElementById('taskDetail');
    }
    
    if (page !== undefined) {
        currentPage = page;
    }
    
    if (taskListEl) {
        LoadingUtils.showTableLoading(taskListEl, 'Cargando órdenes...');
    }
    if (taskListPaginationEl) {
        taskListPaginationEl.innerHTML = '';
    }

    // Construir query string con filtros - SIEMPRE incluir page y limit para forzar paginación
    let queryParams = 'mecanicoId=' + encodeURIComponent(mechanicUser.id) + '&page=' + currentPage + '&limit=' + pageSize;
    
    // Agregar filtros si existen
    if (taskFilters.patente) {
        queryParams += '&vehiculoPatente=' + encodeURIComponent(taskFilters.patente);
    }
    if (taskFilters.chofer) {
        queryParams += '&chofer=' + encodeURIComponent(taskFilters.chofer);
    }
    if (taskFilters.fecha) {
        // Para filtrar por una fecha específica, usamos fechaDesde y fechaHasta con el mismo valor
        // El backend ajustará fechaHasta para incluir todo el día
        queryParams += '&fechaDesde=' + encodeURIComponent(taskFilters.fecha);
        queryParams += '&fechaHasta=' + encodeURIComponent(taskFilters.fecha);
    }

    console.log('Cargando asignaciones:', {
        page: currentPage,
        limit: pageSize,
        filters: taskFilters,
        url: API_BASE + '/workorders?' + queryParams
    });

    return bearerFetch(API_BASE + '/workorders?' + queryParams)
        .then(function (res) {
            if (!res.ok) {
                return res.json().then(function (err) {
                    throw new Error(err.message || 'No se pudieron cargar las órdenes');
                });
            }
            return res.json();
        })
        .then(function (response) {
            console.log('Respuesta del backend:', response);
            
            // Manejar respuesta con paginación o sin paginación (compatibilidad hacia atrás)
            const data = response.data || response;
            const pagination = response.pagination;

            // NO filtrar aquí - el backend ya filtró por mecanicoId y estado
            // Solo usar los datos que vienen del backend
            mechanicTasks = Array.isArray(data) ? data : [];
            
            // Esto asegura que las OTs nuevas o que cambiaron de estado aparezcan
            const estadosActivos = ['EN_PROCESO', 'ESPERA_REPUESTOS', 'LISTO', 'APROBADO', 'PENDIENTE'];
            let hiddenOTsUpdated = false;
            mechanicTasks.forEach(function(ot) {
                const estado = (ot.estado || '').toUpperCase();
                if (estadosActivos.includes(estado) && isOTHidden(ot.id)) {
                    console.log('Desocultando OT', ot.id, 'porque está en estado activo:', estado);
                    const index = hiddenOTs.indexOf(ot.id);
                    if (index !== -1) {
                        hiddenOTs.splice(index, 1);
                        hiddenOTsUpdated = true;
                    }
                }
            });
            if (hiddenOTsUpdated) {
                saveHiddenOTs();
                console.log('OTs ocultas actualizadas. Nueva lista:', hiddenOTs);
            }
            
            console.log('OTs recibidas:', mechanicTasks.length, 'de', pagination?.total || 'desconocido');
            console.log('OTs recibidas (detalle):', mechanicTasks.map(function(ot) {
                return {
                    id: ot.id,
                    numero_ot: ot.numero_ot,
                    estado: ot.estado,
                    fecha_ingreso_recepcion: ot.fecha_ingreso_recepcion,
                    mecanico_asignado_id: ot.mecanico_asignado_id,
                    mecanico: ot.mecanico,
                    estaOculta: isOTHidden(ot.id)
                };
            }));
            
            // Calcular estadísticas con todas las OTs (no solo las de la página actual)
            // Para esto necesitamos cargar todas las OTs sin paginación solo para stats
            // Por ahora, usamos las OTs de la página actual para las stats
            computeStats(mechanicTasks);
            
            // Renderizar solo las OTs de la página actual (ya limitadas por el backend)
            renderTaskList(mechanicTasks);

            // Renderizar paginación si está disponible
            if (pagination && typeof window.PaginationUtils !== 'undefined' && window.PaginationUtils.createPagination) {
                console.log('Renderizando paginación:', pagination);
                if (taskListPaginationEl) {
                    window.PaginationUtils.createPagination(taskListPaginationEl, pagination, function (newPage) {
                        console.log('Cambiando a página:', newPage);
                        loadAssignments(newPage);
                    });
                } else {
                    console.error('taskListPaginationEl no existe');
                }
            } else {
                console.warn('No se puede renderizar paginación:', {
                    hasPagination: !!pagination,
                    pagination: pagination,
                    hasPaginationUtils: typeof window.PaginationUtils !== 'undefined',
                    hasCreatePagination: typeof window.PaginationUtils?.createPagination === 'function',
                    hasElement: !!taskListPaginationEl
                });
                if (taskListPaginationEl) {
                    taskListPaginationEl.innerHTML = '';
                }
            }

            if (selectedTaskId) {
                const existing = mechanicTasks.find((ot) => ot.id === selectedTaskId);
                renderTaskDetail(existing || null);
            } else {
                renderTaskDetail(null);
            }
        })
        .catch(function (err) {
            console.error(err);
            if (taskListEl) {
                taskListEl.innerHTML = '<div class="empty-state">No se pudieron cargar las órdenes.</div>';
            }
            if (taskListPaginationEl) {
                taskListPaginationEl.innerHTML = '';
            }
            renderTaskDetail(null);
        });
}

// Variable para el HistoryViewer del modal
let historialViewer = null;

function openHistorialModal() {
    const modal = document.getElementById('modalHistorial');
    if (!modal) {
        console.error('Modal de historial no encontrado');
        return;
    }
    
    if (!mechanicUser || !mechanicUser.id) {
        alert('No se pudo identificar al usuario. Por favor, recarga la página.');
        return;
    }
    
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Inicializar HistoryViewer si no existe
    const container = document.getElementById('historialContainer');
    if (!container) {
        console.error('Contenedor de historial no encontrado');
        return;
    }
    
    if (!historialViewer) {
        // Limpiar contenedor antes de inicializar
        container.innerHTML = '';
        
        historialViewer = new HistoryViewer({
            container: container,
            entityType: window.HistoryViewerEntityTypes ? window.HistoryViewerEntityTypes.ORDENES_TRABAJO : 'ordenes_trabajo',
            bearerFetch: bearerFetch,
            userRoles: ['MECANICO', 'mecanico'],
            availableEntityTypes: [window.HistoryViewerEntityTypes ? window.HistoryViewerEntityTypes.ORDENES_TRABAJO : 'ordenes_trabajo'],
            pageSize: 20,
            usuarioId: mechanicUser.id,
            onRowClick: function(otId, rowData) {
                // Al hacer clic en una fila, ofrecer exportar esa OT individual
                if (confirm('¿Deseas exportar esta OT individual a CSV?')) {
                    exportOTIndividual(otId, rowData);
                }
            },
            onExport: function(entityType) {
                console.log('Exportación general completada para:', entityType);
            }
        });
        
        // Cargar datos iniciales
        setTimeout(function() {
            historialViewer.load();
        }, 100);
    } else {
        // Si no la tiene (porque se limpió o se cerró el modal), volver a renderizar
        const hasStructure = container.querySelector('.history-thead') && container.querySelector('.history-tbody');
        if (!hasStructure) {
            console.log('[openHistorialModal] Estructura HTML faltante, llamando render()...');
            // Asegurarse de que el contenedor esté actualizado
            historialViewer.container = container;
            historialViewer.render();
            historialViewer.attachEventListeners();
        } else {
            // Aunque tenga estructura, asegurarse de que el contenedor esté actualizado
            historialViewer.container = container;
        }
        
        // Actualizar filtro de usuario y recargar datos
        historialViewer.filters.usuarioId = mechanicUser.id;
        
        // Pequeño delay para asegurar que el DOM esté listo
        setTimeout(function() {
            historialViewer.load();
        }, 50);
    }
}

function closeHistorialModal() {
    const modal = document.getElementById('modalHistorial');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
}

// Función para escapar valores CSV (igual que el backend)
function escapeCSV(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Función para exportar una OT individual a CSV
function exportOTIndividual(otId, rowData) {
    try {
        if (!rowData) {
            alert('No hay datos de la OT para exportar');
            return;
        }
        
        // Obtener todos los campos del objeto
        const headers = Object.keys(rowData);
        
        // Labels en español para los headers
        const headerLabels = {
            id: 'ID',
            numero_ot: 'Número OT',
            vehiculo: 'Vehículo',
            mecanico: 'Mecánico',
            estado: 'Estado',
            prioridad: 'Prioridad',
            descripcion_problema: 'Descripción Problema',
            taller: 'Taller',
            fecha_creacion: 'Fecha Creación',
            fecha_asignacion: 'Fecha Asignación',
            fecha_inicio_trabajo: 'Fecha Inicio Trabajo',
            fecha_finalizacion: 'Fecha Finalización',
            fecha_cierre: 'Fecha Cierre'
        };
        
        // Crear fila de headers
        const headerRow = headers.map(h => escapeCSV(headerLabels[h] || h)).join(',');
        
        // Crear fila de datos
        const dataRow = headers.map(h => {
            let value = rowData[h];
            
            // Manejar valores nulos o undefined
            if (value === null || value === undefined) {
                return '';
            }
            
            // Manejar objetos anidados (vehículo, mecánico, taller)
            if (typeof value === 'object' && !(value instanceof Date)) {
                // Si es un objeto, extraer información relevante
                if (value.patente) {
                    value = value.patente; // Para vehículo
                } else if (value.nombre_completo) {
                    value = value.nombre_completo; // Para mecánico o taller
                } else if (value.nombre) {
                    value = value.nombre; // Para taller u otros
                } else {
                    // Si no tiene propiedades conocidas, convertir a JSON
                    value = JSON.stringify(value);
                }
            }
            
            // Manejar fechas
            if (value instanceof Date) {
                value = value.toISOString();
            } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                // Si es una fecha en formato ISO, mantenerla así
                value = value;
            }
            
            return escapeCSV(value);
        }).join(',');
        
        // Crear contenido CSV completo
        const csvContent = headerRow + '\n' + dataRow;
        
        // Crear blob con BOM para Excel
        const csvBlob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const csvUrl = window.URL.createObjectURL(csvBlob);
        const csvLink = document.createElement('a');
        csvLink.href = csvUrl;
        csvLink.download = `ot_individual_${otId}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(csvLink);
        csvLink.click();
        document.body.removeChild(csvLink);
        window.URL.revokeObjectURL(csvUrl);
        
    } catch (error) {
        console.error('Error al exportar OT individual:', error);
        alert('Error al exportar OT individual: ' + error.message);
    }
}

window.openHistorialModal = openHistorialModal;
window.closeHistorialModal = closeHistorialModal;
window.exportOTIndividual = exportOTIndividual;

// ========== GESTIÓN DE STOCK (Mecánico) ==========
var stockMecanicoCache = [];
var currentTallerIdMecanico = 1; // Por defecto, taller principal

function setStockTextMec(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
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

window.stockMecanicoReload = async function () {
    const tbody = document.getElementById('stockMecanicoTBody');
    if (!tbody) {
        console.error('stockMecanicoReload: No se encontró el elemento stockMecanicoTBody');
        return;
    }

    setStockTextMec('#stock-total-repuestos-mec', '...');
    setStockTextMec('#stock-bajo-mec', '...');
    setStockTextMec('#stock-critico-mec', '...');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Cargando...</td></tr>';

    try {
        const [inventariosRes, stockBajoRes] = await Promise.all([
            bearerFetch(`${API_BASE}/stock/inventarios?tallerId=${currentTallerIdMecanico}`),
            bearerFetch(`${API_BASE}/stock/inventarios/stock-bajo?tallerId=${currentTallerIdMecanico}`)
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

        stockMecanicoCache = inventarios;

        // Actualizar estadísticas
        setStockTextMec('#stock-total-repuestos-mec', inventarios.length || 0);
        const bajo = stockBajo.filter(item => item.cantidad_disponible > 0 && item.cantidad_disponible <= item.nivel_minimo_stock);
        const critico = stockBajo.filter(item => item.cantidad_disponible === 0 || item.cantidad_disponible < item.nivel_minimo_stock * 0.5);
        setStockTextMec('#stock-bajo-mec', bajo.length || 0);
        setStockTextMec('#stock-critico-mec', critico.length || 0);

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
    }
};

// ========== GESTIÓN DE TABS ==========
function switchTabMecanico(tabName) {
    // Ocultar todas las secciones con clase .tab
    const sections = document.querySelectorAll('.tab');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Mostrar la sección seleccionada
    const targetSection = document.getElementById('tab-' + tabName);
    if (targetSection) {
        targetSection.style.display = 'block';
    } else {
        console.warn('No se encontró la sección tab-' + tabName);
    }
    
    // Actualizar nav activo
    const navItems = document.querySelectorAll('.nav-menu a');
    navItems.forEach(item => {
        item.classList.remove('active');
        const itemTab = item.getAttribute('data-tab');
        if (itemTab === tabName || (tabName === 'dashboard' && (itemTab === 'dashboard' || !itemTab))) {
            item.classList.add('active');
        }
    });
    
    // Cargar datos según la tab
    if (tabName === 'stock' && typeof window.stockMecanicoReload === 'function') {
        window.stockMecanicoReload();
    }
}

window.switchTabMecanico = switchTabMecanico;

document.addEventListener('DOMContentLoaded', function () {
    // Cargar OTs ocultas desde localStorage
    loadHiddenOTs();
    
    // Obtener referencias a elementos del DOM
    taskListEl = document.getElementById('taskList');
    taskListPaginationEl = document.getElementById('taskListPagination');
    taskDetailEl = document.getElementById('taskDetail');
    
    console.log('Elementos del DOM:', {
        taskListEl: !!taskListEl,
        taskListPaginationEl: !!taskListPaginationEl,
        taskDetailEl: !!taskDetailEl
    });
    
    // Configurar click en nav-item "Historial"
    const navHistorial = document.getElementById('navHistorial');
    if (navHistorial) {
        navHistorial.addEventListener('click', function(e) {
            e.preventDefault();
            openHistorialModal();
        });
    }
    
    // Configurar clicks en nav-items para tabs
    const navItems = document.querySelectorAll('.nav-menu a[data-tab]');
    navItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');
            if (tabName) {
                switchTabMecanico(tabName);
            }
        });
    });
    
    // Configurar click en Dashboard (sin data-tab)
    const navDashboard = document.querySelector('.nav-menu a[data-tab="dashboard"]') || document.querySelector('.nav-menu a.active');
    if (navDashboard && !navDashboard.getAttribute('data-tab')) {
        navDashboard.addEventListener('click', function(e) {
            e.preventDefault();
            switchTabMecanico('dashboard');
        });
    }
    
    if (typeof window.initAuth === 'function') {
        window.initAuth('mecanico')
            .then(function (user) {
                mechanicUser = user;
                if (userNameEl) {
                    userNameEl.textContent = user.nombre_completo || user.email || 'Mecánico';
                }

                // Inicializar NotificationsManager
                if (typeof NotificationsManager !== 'undefined') {
                    NotificationsManager.init(user.id, function (entityId, entityType) {
                        // Callback cuando se hace clic en una notificación
                        if (entityType === 'ORDEN_TRABAJO' && entityId) {
                            selectedTaskId = entityId;
                            loadTaskDetail(entityId);
                        }
                    });
                }

                loadAssignments();
            })
            .catch(function (err) {
                console.error('Error de autenticación:', err);
            });
    } else {
        console.error('auth.js no está cargado.');
        if (!localStorage.getItem('crm.token')) {
            window.location.replace('/login.html');
        }
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', function() {
            currentPage = 1;
            loadAssignments();
        });
    }

    // Configurar filtros - usar setTimeout para asegurar que el DOM esté completamente cargado
    setTimeout(function() {
        const filterPatente = document.getElementById('filterPatente');
        const filterChofer = document.getElementById('filterChofer');
        const filterFecha = document.getElementById('filterFecha');
        const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
        const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

        console.log('Configurando filtros:', {
            filterPatente: !!filterPatente,
            filterChofer: !!filterChofer,
            filterFecha: !!filterFecha,
            btnAplicarFiltros: !!btnAplicarFiltros,
            btnLimpiarFiltros: !!btnLimpiarFiltros
        });

        // Función para aplicar filtros
        function aplicarFiltros() {
            console.log('Aplicando filtros...');
            // Obtener valores de los inputs
            taskFilters.patente = filterPatente ? filterPatente.value.trim() : '';
            taskFilters.chofer = filterChofer ? filterChofer.value.trim() : '';
            taskFilters.fecha = filterFecha ? filterFecha.value : '';
            
            console.log('Filtros aplicados:', taskFilters);
            
            // Resetear a página 1 cuando se aplican filtros
            currentPage = 1;
            loadAssignments();
        }

        // Función para limpiar filtros
        function limpiarFiltros() {
            console.log('Limpiando filtros...');
            taskFilters = {
                patente: '',
                chofer: '',
                fecha: ''
            };
            
            if (filterPatente) filterPatente.value = '';
            if (filterChofer) filterChofer.value = '';
            if (filterFecha) filterFecha.value = '';
            
            console.log('Filtros limpiados:', taskFilters);
            
            // Resetear a página 1 cuando se limpian filtros
            currentPage = 1;
            loadAssignments();
        }

        // Event listeners para filtros
        if (btnAplicarFiltros) {
            btnAplicarFiltros.addEventListener('click', function(e) {
                e.preventDefault();
                aplicarFiltros();
            });
            console.log('Event listener agregado a btnAplicarFiltros');
        } else {
            console.error('btnAplicarFiltros no encontrado');
        }

        if (btnLimpiarFiltros) {
            btnLimpiarFiltros.addEventListener('click', function(e) {
                e.preventDefault();
                limpiarFiltros();
            });
            console.log('Event listener agregado a btnLimpiarFiltros');
        } else {
            console.error('btnLimpiarFiltros no encontrado');
        }

        // Permitir búsqueda con Enter en los campos de filtro
        if (filterPatente) {
            filterPatente.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    aplicarFiltros();
                }
            });
        }

        if (filterChofer) {
            filterChofer.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    aplicarFiltros();
                }
            });
        }

        if (filterFecha) {
            filterFecha.addEventListener('change', function() {
                // Aplicar filtros automáticamente al cambiar la fecha
                aplicarFiltros();
            });
        }
    }, 100);

    if (diagForm) {
        diagForm.addEventListener('submit', handleDiagnosticSubmit);
    }

    if (diagEvidenceInput) {
        diagEvidenceInput.addEventListener('change', handleDiagnosticFilesChange);
    }

    // Event listener para los radio buttons de discrepancia usando delegación de eventos
    // Esto asegura que funcione incluso si los elementos se agregan dinámicamente
    if (diagModal) {
        diagModal.addEventListener('change', function (ev) {
            if (ev.target && ev.target.name === 'diagnostic_discrepancia') {
                toggleDiscrepanciaDetalle(ev.target.value === 'si');
            }
        });
    }

    // También agregar listeners directos si los elementos ya están disponibles
    if (diagDiscrepanciaInputs && diagDiscrepanciaInputs.length) {
        diagDiscrepanciaInputs.forEach(function (input) {
            input.addEventListener('change', function () {
                toggleDiscrepanciaDetalle(input.value === 'si');
            });
        });
    }

    // Fallback: delegación de eventos por si el listener directo no se adjunta
    document.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest && ev.target.closest('#taskDetail button[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        if (action !== 'start') return;
        var task = mechanicTasks.find(function (t) { return t && t.id === selectedTaskId; });
        if (task) {
            openDiagnosticModal(task);
        }
    });

    // Configurar Socket.IO para recibir notificaciones y actualizaciones
    if (window.io) {
        var socket = window.io('/', { path: '/socket.io/' });
        socket.on('connect', function () {
            console.log('Socket conectado para mecánico');
        });
        socket.on('mechanic:notification', function (data) {
            // Verificar que la notificación sea para este mecánico
            if (mechanicUser && data.mechanicId === mechanicUser.id) {
                var tipoNotif = 'info';
                if (data.tipo === 'DISCREPANCIA_RESUELTA') {
                    tipoNotif = data.titulo.includes('aprobada') ? 'success' : 'error';
                } else if (data.tipo === 'success' || data.tipo === 'error') {
                    // Para notificaciones de solicitudes de repuestos
                    tipoNotif = data.tipo;
                }
                showFloatingNotification(data.titulo, data.mensaje, tipoNotif);

                // Actualizar NotificationsManager si está disponible
                if (typeof NotificationsManager !== 'undefined') {
                    // Recargar notificaciones desde BD después de un breve delay
                    setTimeout(function () {
                        NotificationsManager.loadUnreadNotifications();
                    }, 500);
                }

                // Si hay un otId, refrescar el detalle de la tarea
                if (data.otId) {
                    if (selectedTaskId === data.otId) {
                        // Limpiar el cache de solicitudes para forzar una recarga
                        delete solicitudesRepuestosCache[data.otId];
                        // Recargar el detalle con un pequeño delay para asegurar que el backend haya procesado
                        setTimeout(function () {
                            loadTaskDetail(data.otId);
                        }, 300);
                    }
                    // También refrescar la lista completa para que se actualice el estado
                    loadAssignments();
                }
            }
        });
        // Escuchar eventos de actualización de OTs para refrescar el dashboard
        socket.on('solicitud:refresh', function () {
            // Refrescar las asignaciones cuando hay cambios en solicitudes/OTs
            console.log('Evento solicitud:refresh recibido, refrescando asignaciones...');
            loadAssignments();
        });
        socket.on('reception:refresh', function () {
            // Refrescar cuando hay cambios en recepción
            loadAssignments();
        });
        socket.on('workorders:refresh', function () {
            console.log('Evento workorders:refresh recibido, refrescando asignaciones...');
            loadAssignments();
        });
        socket.on('solicitudes-repuestos:refresh', function () {
            // Refrescar cuando hay cambios en solicitudes de repuestos
            console.log('Evento solicitudes-repuestos:refresh recibido, refrescando...');

            // Limpiar el cache de solicitudes para forzar una recarga
            if (selectedTaskId) {
                delete solicitudesRepuestosCache[selectedTaskId];
            }

            // Actualizar la lista completa de asignaciones
            loadAssignments();

            // Si hay una tarea seleccionada, actualizar también su detalle
            // Usar un pequeño delay para asegurar que el backend haya guardado los cambios
            if (selectedTaskId) {
                setTimeout(function () {
                    // Recargar las solicitudes y actualizar el detalle
                    loadSolicitudesRepuestos(selectedTaskId).then(function (solicitudes) {
                        solicitudesRepuestosCache[selectedTaskId] = solicitudes;
                        // Re-renderizar el detalle con las nuevas solicitudes
                        const task = mechanicTasks.find(function (t) { return t.id === selectedTaskId; });
                        if (task) {
                            renderTaskDetailWithSolicitudes(task, solicitudes);
                        }
                    }).catch(function (error) {
                        console.error('Error al recargar solicitudes después de evento Socket.IO:', error);
                        // Fallback: intentar recargar el detalle completo
                        loadTaskDetail(selectedTaskId);
                    });
                }, 300);
            }
        });
    }
});

// ========== SOLICITUDES DE REPUESTOS ==========
let repuestosCache = [];
let solicitudesRepuestosCache = {};

let repuestosSelectOptions = '';
let repuestoRowCounter = 0;

function openSolicitarRepuestosModal(task) {
    if (!task) return;

    const modal = document.getElementById('modalSolicitarRepuestos');
    if (!modal) {
        console.error('Modal modalSolicitarRepuestos no encontrado');
        return;
    }

    document.getElementById('sol_rep_ot_id').value = task.id;
    document.getElementById('sol_rep_ot_label').textContent = task.numero_ot || ('OT-' + task.id);
    document.getElementById('sol_rep_vehiculo_label').textContent = task.vehiculo?.patente || 'Sin vehículo';

    // Limpiar formulario
    document.getElementById('repuestosListContainer').innerHTML = '';
    document.getElementById('sol_rep_comentarios').value = '';
    repuestoRowCounter = 0;

    // Cargar repuestos y agregar primera fila
    loadRepuestosForSelect().then(() => {
        agregarFilaRepuesto();
    });

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function agregarFilaRepuesto() {
    const container = document.getElementById('repuestosListContainer');
    if (!container) return;

    const rowId = 'repuesto_row_' + (++repuestoRowCounter);
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'repuesto-row';
    row.style.cssText = 'display: flex; gap: 10px; align-items: flex-start; margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;';

    row.innerHTML = `
        <div style="flex: 1;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 0.9em;">Repuesto (*)</label>
            <select class="repuesto-select" required style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                <option value="">Selecciona un repuesto</option>
                ${repuestosSelectOptions}
            </select>
        </div>
        <div style="width: 120px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 0.9em;">Cantidad (*)</label>
            <input type="number" class="repuesto-cantidad" min="1" required style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
        </div>
        <div style="width: 150px;">
            <label style="display: block; margin-bottom: 5px; font-weight: 500; font-size: 0.9em;">Urgencia</label>
            <select class="repuesto-urgencia" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;">
                <option value="NORMAL">Normal</option>
                <option value="URGENTE">Urgente</option>
            </select>
        </div>
        <div style="width: 50px; padding-top: 25px;">
            <button type="button" class="btn btn-sm btn-danger" onclick="eliminarFilaRepuesto('${rowId}')" style="width: 100%; padding: 8px;">✕</button>
        </div>
    `;

    container.appendChild(row);
}

window.eliminarFilaRepuesto = function (rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
    }

    // Si no quedan filas, agregar una nueva
    const container = document.getElementById('repuestosListContainer');
    if (container && container.children.length === 0) {
        agregarFilaRepuesto();
    }
};

window.agregarFilaRepuesto = agregarFilaRepuesto;

window.openSolicitarRepuestosModal = openSolicitarRepuestosModal;

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
}

window.closeModal = closeModal;

async function loadRepuestosForSelect() {
    try {
        const res = await bearerFetch(API_BASE + '/stock/repuestos');
        if (!res.ok) throw new Error('Error al cargar repuestos');

        const repuestos = await res.json();
        repuestosCache = repuestos;

        repuestosSelectOptions = repuestos.map(rep =>
            `<option value="${rep.id}">${rep.sku} - ${rep.nombre}</option>`
        ).join('');

        return repuestos;
    } catch (error) {
        console.error('Error cargando repuestos:', error);
        repuestosSelectOptions = '<option value="">Error al cargar repuestos</option>';
        throw error;
    }
}

// Formulario de solicitar repuestos
document.getElementById('solicitarRepuestosForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const msgEl = document.getElementById('solRepMsg');

    const otId = Number(document.getElementById('sol_rep_ot_id').value);
    const container = document.getElementById('repuestosListContainer');
    const rows = container.querySelectorAll('.repuesto-row');
    const comentarios = document.getElementById('sol_rep_comentarios').value.trim();

    // Validar OT usando módulo de validaciones
    const otResult = ValidationUtils.validateRequired(otId, 'OT');
    if (!otResult.valid) {
        flashMessage(msgEl, 'bad', 'Error: ' + otResult.message);
        return;
    }

    // Validar que haya al menos una fila
    if (rows.length === 0) {
        flashMessage(msgEl, 'bad', 'Debes agregar al menos un repuesto');
        return;
    }

    // Validar y recopilar datos de cada fila
    const solicitudes = [];
    let hasErrors = false;

    rows.forEach((row, index) => {
        const repuestoSelect = row.querySelector('.repuesto-select');
        const cantidadInput = row.querySelector('.repuesto-cantidad');
        const urgenciaSelect = row.querySelector('.repuesto-urgencia');

        const repuestoId = Number(repuestoSelect.value);
        const cantidad = Number(cantidadInput.value);
        const urgencia = urgenciaSelect.value || 'NORMAL';

        // Preparar datos para validación
        const solicitudData = {
            orden_trabajo_id: otId,
            repuesto_id: repuestoId,
            cantidad_solicitada: cantidad,
            urgencia: urgencia
        };

        // Validar usando módulo de validaciones
        const validationResult = DomainValidations.validateSolicitudRepuesto(solicitudData);
        if (!validationResult.valid) {
            hasErrors = true;
            row.style.borderColor = '#dc3545';
            return;
        }

        row.style.borderColor = '#dee2e6';

        solicitudes.push({
            orden_trabajo_id: otId,
            repuesto_id: repuestoId,
            cantidad_solicitada: cantidad,
            urgencia: urgencia,
            comentarios: comentarios || undefined
        });
    });

    if (hasErrors) {
        flashMessage(msgEl, 'bad', 'Completa todos los campos requeridos en todas las filas');
        return;
    }

    // Validar que haya al menos una solicitud válida usando módulo
    const finalValidation = DomainValidations.validateSolicitudesRepuestos(solicitudes);
    if (!finalValidation.valid) {
        flashMessage(msgEl, 'bad', finalValidation.message);
        return;
    }

    // Mostrar loading en botón de submit
    const submitBtn = e.target.querySelector('button[type="submit"]') || e.target.querySelector('input[type="submit"]');
    if (submitBtn) {
        LoadingUtils.showButtonLoading(submitBtn, 'Enviando solicitudes...');
    }

    // Enviar todas las solicitudes
    try {
        clearMessage(msgEl);

        const results = await Promise.all(
            solicitudes.map(sol =>
                bearerFetch(API_BASE + '/stock/solicitudes', {
                    method: 'POST',
                    body: JSON.stringify(sol)
                })
            )
        );

        // Verificar si todas fueron exitosas
        const errors = [];
        for (let i = 0; i < results.length; i++) {
            if (!results[i].ok) {
                const error = await results[i].json();
                errors.push(`Repuesto ${i + 1}: ${error.message || 'Error desconocido'}`);
            }
        }

        if (errors.length > 0) {
            throw new Error('Algunas solicitudes fallaron:\n' + errors.join('\n'));
        }

        // Ocultar loading
        if (submitBtn) {
            LoadingUtils.hideButtonLoading(submitBtn);
        }

        // Actualizar el cache de solicitudes para reflejar los cambios
        if (selectedTaskId) {
            const solicitudesActualizadas = await loadSolicitudesRepuestos(selectedTaskId);
            solicitudesRepuestosCache[selectedTaskId] = solicitudesActualizadas;
            // Re-renderizar el detalle para actualizar los botones con el nuevo estado
            const task = mechanicTasks.find(function (t) { return t.id === selectedTaskId; });
            if (task) {
                renderTaskDetailWithSolicitudes(task, solicitudesActualizadas);
            }
        }

        flashMessage(msgEl, 'ok', `✅ ${solicitudes.length} solicitud(es) enviada(s) correctamente`);
        closeModal('modalSolicitarRepuestos');
    } catch (error) {
        // Ocultar loading en caso de error
        if (submitBtn) {
            LoadingUtils.hideButtonLoading(submitBtn);
        }

        console.error('Error:', error);
        flashMessage(msgEl, 'bad', '❌ ' + (error.message || 'Error al crear solicitudes'));
    }
});

// Botón para agregar repuesto
document.getElementById('btnAgregarRepuesto')?.addEventListener('click', function () {
    agregarFilaRepuesto();
});

// Cargar solicitudes de repuestos para una OT
async function loadSolicitudesRepuestos(otId) {
    const solicitudesListEl = document.getElementById('solicitudesRepuestosList');
    try {
        const res = await bearerFetch(API_BASE + '/stock/solicitudes/ot/' + otId);
        if (!res.ok) {
            if (solicitudesListEl) {
                LoadingUtils.hideTableLoading(solicitudesListEl);
                solicitudesListEl.innerHTML = '<div class="empty-state">No se pudieron cargar las solicitudes.</div>';
            }
            return [];
        }
        const solicitudes = await res.json();
        if (solicitudesListEl) {
            LoadingUtils.hideTableLoading(solicitudesListEl);
        }
        return solicitudes;
    } catch (error) {
        console.error('Error cargando solicitudes de repuestos:', error);
        if (solicitudesListEl) {
            LoadingUtils.hideTableLoading(solicitudesListEl);
            solicitudesListEl.innerHTML = '<div class="empty-state">Error al cargar solicitudes.</div>';
        }
        return [];
    }
}

// Renderizar lista de solicitudes de repuestos
function renderSolicitudesRepuestosList(otId, solicitudes) {
    const container = document.getElementById('solicitudesRepuestosList');
    if (!container) return;

    if (!solicitudes || solicitudes.length === 0) {
        container.innerHTML = '<p style="color: #6c757d;">No hay solicitudes de repuestos para esta OT.</p>';
        return;
    }

    const aprobadasPendientes = solicitudes.filter(s => s.estado === 'APROBADA');
    const recibidas = solicitudes.filter(s => s.estado === 'RECIBIDA');
    const todasRecibidas = aprobadasPendientes.length === 0 && recibidas.length > 0;

    let html = '<div style="margin-bottom: 15px;">';

    solicitudes.forEach(sol => {
        const estadoBadge = sol.estado === 'SOLICITADA' ? '<span class="status-badge" style="background:#ffc107;">Solicitada</span>' :
            sol.estado === 'APROBADA' ? '<span class="status-badge" style="background:#17a2b8;">Aprobada</span>' :
                sol.estado === 'RECHAZADA' ? '<span class="status-badge" style="background:#dc3545;">Rechazada</span>' :
                    '<span class="status-badge" style="background:#28a745;">Recibida</span>';

        html += '<div style="padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
        html += '<div>';
        html += '<strong>' + (sol.repuesto?.nombre || 'Repuesto') + '</strong> (' + (sol.repuesto?.sku || 'N/A') + ')';
        html += '<br><span style="color: #6c757d; font-size: 0.9em;">Cantidad: ' + sol.cantidad_solicitada + ' ' + (sol.repuesto?.unidad || '') + '</span>';
        html += '</div>';
        html += '<div>' + estadoBadge + '</div>';
        html += '</div>';

        if (sol.estado === 'APROBADA') {
            html += '<div style="margin-top: 10px;">';
            html += '<label style="display: flex; align-items: center; cursor: pointer;">';
            html += '<input type="checkbox" value="' + sol.id + '" style="margin-right: 8px;">';
            html += '<span>Confirmar recepción</span>';
            html += '</label>';
            if (sol.fecha_estimada_entrega) {
                const fechaHora = new Date(sol.fecha_estimada_entrega);
                html += '<p style="font-size: 0.85em; color: #6c757d; margin-top: 5px;">Fecha y hora estimada: ' + fechaHora.toLocaleString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</p>';
            }
            html += '</div>';
        }

        if (sol.comentarios) {
            html += '<p style="font-size: 0.85em; color: #6c757d; margin-top: 5px;">' + escapeHtml(sol.comentarios) + '</p>';
        }

        html += '</div>';
    });

    html += '</div>';

    if (aprobadasPendientes.length > 0) {
        html += '<button class="btn btn-primary" onclick="openConfirmarRecepcionModal(' + otId + ')">Confirmar Recepción de Repuestos Aprobados</button>';
    }

    container.innerHTML = html;
}

function openConfirmarRecepcionModal(otId) {
    const solicitudes = solicitudesRepuestosCache[otId] || [];
    const aprobadas = solicitudes.filter(s => s.estado === 'APROBADA');

    if (aprobadas.length === 0) {
        alert('No hay solicitudes aprobadas pendientes de confirmación');
        return;
    }

    const modal = document.getElementById('modalConfirmarRecepcion');
    const list = document.getElementById('recepcionRepuestosList');

    if (!modal || !list) {
        console.error('Modal o lista de recepción no encontrados');
        return;
    }

    list.innerHTML = aprobadas.map(sol => {
        return '<div style="padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px;">' +
            '<label style="display: flex; align-items: center; cursor: pointer;">' +
            '<input type="checkbox" value="' + sol.id + '" checked style="margin-right: 8px;">' +
            '<div>' +
            '<strong>' + (sol.repuesto?.nombre || 'Repuesto') + '</strong> (' + (sol.repuesto?.sku || 'N/A') + ')<br>' +
            '<span style="color: #6c757d; font-size: 0.9em;">Cantidad: ' + sol.cantidad_solicitada + ' ' + (sol.repuesto?.unidad || '') + '</span>' +
            '</div>' +
            '</label>' +
            '</div>';
    }).join('');

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

window.openConfirmarRecepcionModal = openConfirmarRecepcionModal;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Confirmar recepción de repuestos
async function confirmarRecepcionRepuestos(solicitudIds) {
    if (!Array.isArray(solicitudIds) || solicitudIds.length === 0) return;

    try {
        await Promise.all(solicitudIds.map(id =>
            bearerFetch(API_BASE + '/stock/solicitudes/' + id + '/confirmar-recepcion', {
                method: 'PATCH'
            })
        ));

        // Cerrar el modal primero para evitar problemas de accesibilidad
        closeModal('modalConfirmarRecepcion');

        // Actualizar el cache de solicitudes para reflejar los cambios
        if (selectedTaskId) {
            const solicitudes = await loadSolicitudesRepuestos(selectedTaskId);
            solicitudesRepuestosCache[selectedTaskId] = solicitudes;
            // Re-renderizar el detalle para actualizar los botones con el nuevo estado
            const task = mechanicTasks.find(function (t) { return t.id === selectedTaskId; });
            if (task) {
                renderTaskDetailWithSolicitudes(task, solicitudes);
            }
            flashMessage(document.getElementById('mechanicActionMsg'), 'ok', '✅ Recepción confirmada correctamente');
        } else {
            flashMessage(document.getElementById('mechanicActionMsg'), 'ok', '✅ Recepción confirmada correctamente');
        }
    } catch (error) {
        console.error('Error confirmando recepción:', error);
        flashMessage(document.getElementById('mechanicActionMsg'), 'bad', '❌ Error al confirmar recepción');
    }
}

window.confirmarRecepcionRepuestos = confirmarRecepcionRepuestos;

// Botón de confirmar recepción
document.getElementById('btnConfirmarRecepcion')?.addEventListener('click', function () {
    const list = document.getElementById('recepcionRepuestosList');
    const checkboxes = list.querySelectorAll('input[type="checkbox"]:checked');
    const ids = Array.from(checkboxes).map(cb => Number(cb.value));

    if (ids.length === 0) {
        alert('Selecciona al menos una solicitud para confirmar recepción');
        return;
    }

    confirmarRecepcionRepuestos(ids);
});

// Función para verificar si hay repuestos pendientes
async function tieneRepuestosPendientes(otId) {
    try {
        const solicitudes = await loadSolicitudesRepuestos(otId);
        if (!solicitudes || solicitudes.length === 0) {
            return false;
        }

        // Verificar si hay solicitudes en estados pendientes
        // SOLICITADA: pendiente de aprobación/rechazo
        // APROBADA: aprobada pero no recibida (pendiente de recepción)
        const pendientes = solicitudes.filter(function (sol) {
            const estado = (sol.estado || '').toUpperCase();
            return estado === 'SOLICITADA' || estado === 'APROBADA';
        });

        return pendientes.length > 0;
    } catch (error) {
        console.error('Error verificando repuestos pendientes:', error);
        // En caso de error, permitir continuar (no bloquear por error de red)
        return false;
    }
}

// Función para abrir modal de cierre de trabajo
async function openCierreTrabajoModal(task) {
    if (!task) return;

    // Asegurarse de que las solicitudes estén cargadas en el cache
    if (!solicitudesRepuestosCache[task.id]) {
        const solicitudes = await loadSolicitudesRepuestos(task.id);
        solicitudesRepuestosCache[task.id] = solicitudes;
    }

    // Verificar si hay repuestos pendientes antes de abrir el modal
    const tienePendientes = await tieneRepuestosPendientes(task.id);
    if (tienePendientes) {
        const solicitudes = solicitudesRepuestosCache[task.id] || [];
        const pendientes = solicitudes.filter(function (sol) {
            const estado = (sol.estado || '').toUpperCase();
            return estado === 'SOLICITADA' || estado === 'APROBADA';
        });

        const mensaje = '⚠️ No puedes terminar el trabajo mientras haya repuestos pendientes.\n\n' +
            'Repuestos pendientes:\n' +
            pendientes.map(function (sol) {
                const nombre = sol.repuesto?.nombre || 'Repuesto';
                const estado = sol.estado === 'SOLICITADA' ? 'Solicitado (pendiente de aprobación)' :
                    sol.estado === 'APROBADA' ? 'Aprobado (pendiente de recepción)' : sol.estado;
                return `- ${nombre}: ${estado}`;
            }).join('\n') +
            '\n\nPor favor, espera a que los repuestos sean aprobados/rechazados y recibidos antes de terminar el trabajo.';

        alert(mensaje);
        return;
    }

    const modal = document.getElementById('modalCierreTrabajo');
    if (!modal) {
        console.error('Modal modalCierreTrabajo no encontrado');
        return;
    }

    document.getElementById('cierre_task_id').value = task.id;
    document.getElementById('cierre_ot_label').textContent = task.numero_ot || ('OT-' + task.id);
    document.getElementById('cierre_vehicle_label').textContent = task.vehiculo?.patente || 'Sin vehículo';

    // Limpiar formulario
    document.getElementById('cierre_descripcion').value = '';
    document.getElementById('cierre_evidencias').value = '';
    document.getElementById('cierre_evidencias_list').innerHTML = '';
    const cierreMsg = document.getElementById('cierreMsg');
    if (cierreMsg) {
        cierreMsg.textContent = '';
        cierreMsg.className = 'status hidden';
    }

    // Manejar selección de archivos usando función centralizada
    const fileInput = document.getElementById('cierre_evidencias');
    if (fileInput) {
        fileInput.onchange = function (e) {
            const listEl = document.getElementById('cierre_evidencias_list');
            if (!listEl) return;

            // Usar función centralizada de validaciones
            const validFiles = ValidationUtils.handleFileInputChange(e, {
                fieldName: 'Evidencias de cierre',
                maxFiles: 10,
                onEmpty: function() {
                    listEl.innerHTML = '';
                },
                onClear: function() {
                    listEl.innerHTML = '';
                },
                allowEmpty: true
            });

            // Si hay error o no hay archivos válidos, salir
            if (!validFiles || validFiles.length === 0) {
                return;
            }

            // Mostrar lista de archivos válidos
            listEl.innerHTML = '';
            validFiles.forEach(function (file, index) {
                const li = document.createElement('li');
                li.textContent = file.name + ' (' + (file.size / 1024).toFixed(2) + ' KB)';
                listEl.appendChild(li);
            });
        };
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

// Manejar submit del formulario de cierre
const cierreTrabajoForm = document.getElementById('cierreTrabajoForm');
if (cierreTrabajoForm) {
    cierreTrabajoForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const taskId = document.getElementById('cierre_task_id').value;
        const descripcion = document.getElementById('cierre_descripcion').value.trim();
        const fileInput = document.getElementById('cierre_evidencias');
        const cierreMsg = document.getElementById('cierreMsg');

        if (!descripcion) {
            flashMessage(cierreMsg, 'bad', '❌ La descripción del proceso realizado es obligatoria.');
            return;
        }

        // Asegurarse de que las solicitudes estén cargadas en el cache
        if (!solicitudesRepuestosCache[parseInt(taskId)]) {
            const solicitudes = await loadSolicitudesRepuestos(parseInt(taskId));
            solicitudesRepuestosCache[parseInt(taskId)] = solicitudes;
        }

        // Verificar nuevamente si hay repuestos pendientes antes de enviar
        const tienePendientes = await tieneRepuestosPendientes(parseInt(taskId));
        if (tienePendientes) {
            const solicitudes = solicitudesRepuestosCache[parseInt(taskId)] || [];
            const pendientes = solicitudes.filter(function (sol) {
                const estado = (sol.estado || '').toUpperCase();
                return estado === 'SOLICITADA' || estado === 'APROBADA';
            });

            const mensaje = '⚠️ No puedes terminar el trabajo mientras haya repuestos pendientes.\n\n' +
                'Repuestos pendientes:\n' +
                pendientes.map(function (sol) {
                    const nombre = sol.repuesto?.nombre || 'Repuesto';
                    const estado = sol.estado === 'SOLICITADA' ? 'Solicitado (pendiente de aprobación)' :
                        sol.estado === 'APROBADA' ? 'Aprobado (pendiente de recepción)' : sol.estado;
                    return `- ${nombre}: ${estado}`;
                }).join('\n') +
                '\n\nPor favor, espera a que los repuestos sean aprobados/rechazados y recibidos antes de terminar el trabajo.';

            flashMessage(cierreMsg, 'bad', mensaje);
            return;
        }

        clearMessage(cierreMsg);

        // Mostrar loading en botón de submit
        const submitBtn = e.target.querySelector('button[type="submit"]') || e.target.querySelector('input[type="submit"]');
        if (submitBtn) {
            LoadingUtils.showButtonLoading(submitBtn, 'Finalizando trabajo...');
        }

        // Convertir archivos a base64 (con compresión para imágenes)
        const files = Array.from(fileInput.files || []);
        const evidenciasPromises = files.slice(0, 10).map(function (file) {
            return FileUtils.fileToBase64(file, true);
        });

        Promise.all(evidenciasPromises)
            .then(function (evidenciasBase64) {
                return bearerFetch(API_BASE + '/workorders/' + taskId + '/close', {
                    method: 'POST',
                    body: JSON.stringify({
                        descripcionProcesoRealizado: descripcion,
                        evidencias: evidenciasBase64
                    })
                });
            })
            .then(function (res) {
                return ErrorHandler.handleResponse(res, 'Cerrar trabajo');
            })
            .then(function (data) {
                // Ocultar loading
                if (submitBtn) {
                    LoadingUtils.hideButtonLoading(submitBtn);
                }

                flashMessage(cierreMsg, 'ok', '✅ Trabajo finalizado correctamente. Pendiente de verificación.');

                // Cerrar modal después de un momento
                setTimeout(function () {
                    closeModal('modalCierreTrabajo');
                    // Recargar asignaciones para actualizar la lista
                    loadAssignments().then(function () {
                        // Limpiar el detalle de la tarea ya que fue completada
                        if (selectedTaskId === parseInt(taskId)) {
                            selectedTaskId = null;
                            if (taskDetailEl) {
                                taskDetailEl.innerHTML = '<div class="empty-state">Selecciona una orden de la lista para ver su información.</div>';
                            }
                        }
                    });
                }, 1500);
            })
            .catch(function (err) {
                // Ocultar loading en caso de error
                if (submitBtn) {
                    LoadingUtils.hideButtonLoading(submitBtn);
                }

                ErrorHandler.handleError(err, 'Cerrar trabajo', {
                    targetElement: cierreMsg,
                    useFlashMessage: true
                });
            });
    });
}

// ========== LOGOUT (OBSOLETO - Ahora se usa logout_button.js) ==========
// Esta función se mantiene solo por compatibilidad hacia atrás
// El logout ahora se maneja automáticamente con logout_button.js
/*
if (typeof window.logout === 'undefined') {
    window.logout = function() {
        if (confirm('¿Está seguro de que desea cerrar sesión?')) {
            localStorage.removeItem('crm.token');
            window.location.href = '/login.html';
        }
    };
}
*/