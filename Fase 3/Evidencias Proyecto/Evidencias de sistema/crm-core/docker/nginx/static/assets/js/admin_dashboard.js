// ========= CONFIGURACIÓN =========
var API_BASE = '/api';
var TOKEN_KEY = 'crm.token';

// ========= UTILIDADES =========

/**
 * Obtiene el token del localStorage
 */
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Realiza una petición fetch con el token de autenticación
 */
function bearerFetch(url, opts) {
    opts = opts || {};
    var headers = new Headers(opts.headers || {});
    var token = getToken();
    if (token) {
        headers.set('Authorization', 'Bearer ' + token);
    }
    // Solo establecer Content-Type si no se proporcionó explícitamente y no se solicita omitirlo
    if (!headers.has('Content-Type') && !opts.skipContentType) {
        headers.set('Content-Type', 'application/json');
    }
    var merged = {};
    for (var k in opts) {
        if (Object.prototype.hasOwnProperty.call(opts, k) && k !== 'skipContentType') {
            merged[k] = opts[k];
        }
    }
    merged.headers = headers;
    merged.cache = 'no-store';
    return fetch(url, merged);
}

/**
 * Obtiene todos los usuarios de la API
 */
function fetchUsers() {
    return bearerFetch(API_BASE + '/users')
        .then(function(res) {
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    localStorage.removeItem(TOKEN_KEY);
                    throw new Error('Sesión expirada');
                }
                throw new Error('Error al obtener usuarios: ' + res.status);
            }
            return res.json();
        });
}

/**
 * Abre el modal para agregar un nuevo usuario
 */
function openAddUserModal() {
    currentEditId = null;
    if (modalTitle) modalTitle.textContent = 'Agregar Usuario';
    if (userForm) userForm.reset();
    
    // Mostrar campos de creación (password, rut, telefono)
    var passwordGroup = document.getElementById('passwordGroup');
    var passwordInput = document.getElementById('userPassword');
    if (passwordGroup) passwordGroup.style.display = 'block';
    if (passwordInput) {
        passwordInput.required = true;
        passwordInput.value = '';
    }
    
    // Ocultar campo de estado (los nuevos usuarios siempre se crean activos)
    var statusGroup = document.getElementById('statusGroup');
    if (statusGroup) statusGroup.style.display = 'none';
    
    if (userModal) userModal.style.display = 'flex';
}

/**
 * Maneja el guardado de usuario (crear o editar)
 */
function handleSaveUser() {
    var nameInput = document.getElementById('userName');
    var emailInput = document.getElementById('userEmail');
    var passwordInput = document.getElementById('userPassword');
    var rutInput = document.getElementById('userRut');
    var telefonoInput = document.getElementById('userTelefono');
    var roleInput = document.getElementById('userRole');
    var statusInput = document.getElementById('userStatus');

    var name = nameInput ? nameInput.value.trim() : '';
    var email = emailInput ? emailInput.value.trim() : '';
    var password = passwordInput ? passwordInput.value : '';
    var rut = rutInput ? rutInput.value.trim() : '';
    var telefono = telefonoInput ? telefonoInput.value.trim() : '';
    var role = roleInput ? roleInput.value : '';
    var status = statusInput ? statusInput.value : 'active';

    // Validaciones básicas
    if (!name || !email || !role) {
        alert('Por favor complete todos los campos requeridos');
        return;
    }

    // Si estamos creando, validar password
    if (!currentEditId) {
        if (!password || password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres');
            return;
        }
    }

    // Convertir estado a boolean
    var activo = status === 'active';

    // Si estamos editando, llamar a la API de actualización
    if (currentEditId) {
        var updateData = {
            nombre_completo: name,
            email: email,
            rol: role,
            activo: activo
        };
        
        // Solo incluir password si se proporcionó
        if (password && password.length >= 6) {
            updateData.password = password;
        }
        
        // Incluir campos opcionales si tienen valor
        if (rut) updateData.rut = rut;
        if (telefono) updateData.telefono = telefono;
        
        updateUser(currentEditId, updateData);
    } else {
        // Si estamos creando, llamar a la API de creación
        var createData = {
            nombre_completo: name,
            email: email,
            password: password,
            rol: role
        };
        
        // Incluir campos opcionales si tienen valor
        if (rut) createData.rut = rut;
        if (telefono) createData.telefono = telefono;
        
        createUser(createData);
    }
}

/**
 * Crea un nuevo usuario en la API
 */
function createUser(userData) {
    console.log('Creando usuario:', userData);
    
    // Deshabilitar el botón mientras se procesa
    if (saveUserBtn) {
        LoadingUtils.showButtonLoading(saveUserBtn, 'Creando...');
    }

    return bearerFetch(API_BASE + '/users', {
        method: 'POST',
        body: JSON.stringify(userData)
    })
    .then(function(res) {
        if (!res.ok) {
            return res.json().then(function(err) {
                var errorMsg = err.message || 'Error al crear usuario: ' + res.status;
                throw new Error(errorMsg);
            });
        }
        return res.json();
    })
    .then(function(newUser) {
        console.log('Usuario creado:', newUser);
        alert('Usuario creado correctamente');
        
        // Cerrar modal
        if (userModal) userModal.style.display = 'none';
        currentEditId = null;
        
        // Recargar usuarios
        loadUsersFromAPI();
    })
    .catch(function(err) {
        ErrorHandler.handleError(err, 'Crear usuario', {
            useAlert: true
        });
    })
    .finally(function() {
        // Rehabilitar el botón
        if (saveUserBtn) {
            LoadingUtils.hideButtonLoading(saveUserBtn);
        }
    });
}

/**
 * Actualiza un usuario en la API
 */
function updateUser(userId, userData) {
    console.log('Actualizando usuario:', userId, userData);
    
    // Deshabilitar el botón mientras se procesa
    if (saveUserBtn) {
        LoadingUtils.showButtonLoading(saveUserBtn, 'Guardando...');
    }

    return bearerFetch(API_BASE + '/users/' + userId, {
        method: 'PATCH',
        body: JSON.stringify(userData)
    })
    .then(function(res) {
        if (!res.ok) {
            return res.json().then(function(err) {
                var errorMsg = err.message || 'Error al actualizar usuario: ' + res.status;
                throw new Error(errorMsg);
            });
        }
        return res.json();
    })
    .then(function(updatedUser) {
        console.log('Usuario actualizado:', updatedUser);
        alert('Usuario actualizado correctamente');
        
        // Cerrar modal
        if (userModal) userModal.style.display = 'none';
        currentEditId = null;
        
        // Recargar usuarios
        loadUsersFromAPI();
    })
    .catch(function(err) {
        ErrorHandler.handleError(err, 'Actualizar usuario', {
            useAlert: true
        });
    })
    .finally(function() {
        // Rehabilitar el botón
        if (saveUserBtn) {
            LoadingUtils.hideButtonLoading(saveUserBtn);
        }
    });
}

// ========= VARIABLES GLOBALES =========
var users = [];
var usersTableBody = null;
var userModal = null;
var modalTitle = null;
var userForm = null;
var addUserBtn = null;
var closeModal = null;
var cancelBtn = null;
var saveUserBtn = null;
var currentEditId = null;
var scheduleModal = null;
var scheduleUserName = null;
var scheduleSaveBtn = null;
var scheduleCancelBtn = null;
var currentScheduleUserId = null;
var scheduleDayConfig = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miercoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' }
];

// ========= INICIALIZACIÓN =========

// Inicializar autenticación al cargar la página
// Verifica que el usuario tenga rol 'admin'
document.addEventListener('DOMContentLoaded', function () {
    // Obtener referencias a elementos del DOM
    usersTableBody = document.getElementById('usersTableBody');
    userModal = document.getElementById('userModal');
    modalTitle = document.getElementById('modalTitle');
    userForm = document.getElementById('userForm');
    addUserBtn = document.getElementById('addUserBtn');
    closeModal = document.getElementById('closeModal');
    cancelBtn = document.getElementById('cancelBtn');
    saveUserBtn = document.getElementById('saveUserBtn');
    scheduleModal = document.getElementById('scheduleModal');
    scheduleUserName = document.getElementById('scheduleUserName');
    scheduleSaveBtn = document.getElementById('scheduleSaveBtn');
    scheduleCancelBtn = document.getElementById('scheduleCancelBtn');

    // Registrar event listeners del modal
    setupModalListeners();
    setupScheduleModalListeners();

    if (typeof window.initAuth === 'function') {
        window.initAuth('admin')
            .then(function (user) {
                console.log('Dashboard de admin cargado para:', user.email);

                // Actualizar información del usuario en la UI
                var userAvatar = document.querySelector('.user-avatar');
                var userInfo = document.querySelector('.user-info > div > div');
                var userEmail = document.querySelector('.user-info > div > div:last-child');

                if (userAvatar && user.nombre_completo) {
                    // Mostrar primera letra del nombre
                    userAvatar.textContent = user.nombre_completo.charAt(0).toUpperCase();
                }
                if (userInfo) {
                    userInfo.textContent = user.nombre_completo || 'Administrador';
                }
                if (userEmail) {
                    userEmail.textContent = user.email || 'admin@pepsico.cl';
                }

                // Cargar usuarios desde la API
                loadUsersFromAPI();
            })
            .catch(function (err) {
                // La redirección ya se maneja en auth.js
                console.error('Error de autenticación:', err);
            });
    } else {
        console.error('auth.js no está cargado. Asegúrate de incluirlo antes de este script.');
        // Fallback: redirigir al login si no hay auth.js
        if (!localStorage.getItem(TOKEN_KEY)) {
            window.location.replace('/login.html');
        } else {
            // Intentar cargar usuarios de todas formas
            loadUsersFromAPI();
        }
    }
});

// ========== LOGOUT (OBSOLETO - Ahora se usa logout_button.js) ==========
// Esta función se mantiene solo por compatibilidad hacia atrás
// El logout ahora se maneja automáticamente con logout_button.js
/*
if (typeof window.logout === 'undefined') {
    window.logout = function() {
        // Confirmar antes de cerrar sesión
        if (confirm('¿Está seguro de que desea cerrar sesión?')) {
            // Limpiar token y redirigir
            localStorage.removeItem(TOKEN_KEY);
            sessionStorage.clear();
            window.location.replace('/login.html');
        }
    };
}
*/

// ========= FUNCIONES DE CARGA DE DATOS =========

/**
 * Carga usuarios desde la API y actualiza la UI
 */
function loadUsersFromAPI() {
    console.log('Cargando usuarios desde la API...');
    fetchUsers()
        .then(function(usersData) {
            console.log('Usuarios cargados:', usersData);
            users = usersData || [];
            
            // Actualizar cards con estadísticas
            updateDashboardCards();
            
            // Actualizar tabla
            loadUsersTable();
        })
        .catch(function(err) {
            console.error('Error al cargar usuarios:', err);
            alert('Error al cargar usuarios: ' + err.message);
        });
}

/**
 * Actualiza los cards del dashboard con estadísticas reales
 */
function updateDashboardCards() {
    if (!users || users.length === 0) {
        // Si no hay usuarios, mostrar ceros
        updateCardValue('Total Usuarios', 0);
        updateCardValue('Perfiles Activos', 0);
        updateCardValue('Usuarios Activos', 0);
        updateCardValue('Usuarios Inactivos', 0);
        return;
    }

    // Calcular estadísticas
    var totalUsuarios = users.length;
    
    // Contar usuarios activos e inactivos
    var usuariosActivos = users.filter(function(u) {
        return u.activo === true || u.activo === 'true' || u.activo === 1;
    }).length;
    var usuariosInactivos = totalUsuarios - usuariosActivos;
    
    // Contar perfiles únicos (roles diferentes)
    var rolesUnicos = new Set();
    users.forEach(function(u) {
        if (u.rol) {
            rolesUnicos.add(String(u.rol).toLowerCase());
        }
    });
    var perfilesActivos = rolesUnicos.size;

    // Actualizar los cards
    updateCardValue('Total Usuarios', totalUsuarios);
    updateCardValue('Perfiles Activos', perfilesActivos);
    updateCardValue('Usuarios Activos', usuariosActivos);
    updateCardValue('Usuarios Inactivos', usuariosInactivos);
}

/**
 * Actualiza el valor de un card específico
 */
function updateCardValue(cardTitle, value) {
    var cards = document.querySelectorAll('.card');
    cards.forEach(function(card) {
        var titleElement = card.querySelector('.card-title');
        if (titleElement && titleElement.textContent.trim() === cardTitle) {
            var valueElement = card.querySelector('.card-value');
            if (valueElement) {
                valueElement.textContent = value;
            }
        }
    });
}

/**
 * Carga usuarios en la tabla
 */
function loadUsersTable() {
    if (!usersTableBody) {
        console.error('usersTableBody no está disponible');
        return;
    }

    usersTableBody.innerHTML = '';
    
    if (!users || users.length === 0) {
        var row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center; padding: 20px;">No hay usuarios registrados</td>';
        usersTableBody.appendChild(row);
        return;
    }

    users.forEach(function(user) {
        var row = document.createElement('tr');
        var isActive = user.activo === true || user.activo === 'true' || user.activo === 1;
        var statusClass = isActive ? 'status-active' : 'status-inactive';
        var statusText = isActive ? 'Activo' : 'Inactivo';
        
        // Generar botones según el estado del usuario
        var actionButtons = `
            <button class="btn-edit" onclick="editUser(${user.id})">Editar</button>
            <button class="btn-schedule" onclick="openScheduleModal(${user.id})">Horario</button>
        `;
        
        if (isActive) {
            // Usuario activo: mostrar botón "Desactivar"
            actionButtons += `<button class="btn-deactivate" onclick="deactivateUser(${user.id}, event)">Desactivar</button>`;
        } else {
            // Usuario inactivo: mostrar botones "Activar" y "Eliminar"
            actionButtons += `<button class="btn-activate" onclick="activateUser(${user.id}, event)">Activar</button>`;
            actionButtons += `<button class="btn-delete" onclick="deleteUser(${user.id}, event)">Eliminar</button>`;
        }
        
        row.innerHTML = `
            <td>${escapeHtml(user.nombre_completo || 'N/A')}</td>
            <td>${escapeHtml(user.email || 'N/A')}</td>
            <td>${escapeHtml(getRoleDisplayName(user.rol) || 'N/A')}</td>
            <td>${escapeHtml(user.rol || 'N/A')}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${renderScheduleSummary(user.horario)}</td>
            <td>
                <div class="action-buttons">
                    ${actionButtons}
                </div>
            </td>
        `;
        usersTableBody.appendChild(row);
    });
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Obtiene el nombre del cargo basado en el rol
 */
function getRoleDisplayName(role) {
    if (!role) return 'N/A';
    var roleMap = {
        'ADMIN': 'Administrador',
        'JEFE_TALLER': 'Jefe de Taller',
        'MECANICO': 'Mecánico',
        'CHOFER': 'Chofer',
        'BODEGUERO': 'Bodeguero',
        'RECEPCIONISTA': 'Recepcionista',
        'LOGISTICA': 'Logística'
    };
    // Normalizar a mayúsculas para la búsqueda
    var normalizedRole = String(role).toUpperCase();
    return roleMap[normalizedRole] || role;
}

/**
 * Obtiene el nombre del perfil (alias para compatibilidad)
 */
function getRoleName(role) {
    return getRoleDisplayName(role);
}

// ========= MANEJO DE MODAL =========

/**
 * Configura los event listeners del modal
 */
function setupModalListeners() {
    // Abrir modal para agregar usuario
    if (addUserBtn) {
        addUserBtn.addEventListener('click', function() {
            openAddUserModal();
        });
    }

    // Cerrar modal con la X
    if (closeModal) {
        closeModal.addEventListener('click', function() {
            if (userModal) userModal.style.display = 'none';
        });
    }

    // Cerrar modal con botón Cancelar
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            if (userModal) userModal.style.display = 'none';
        });
    }

    // Guardar usuario (agregar o editar)
    if (saveUserBtn) {
        saveUserBtn.addEventListener('click', function() {
            handleSaveUser();
        });
    }

    // Cerrar modal al hacer clic fuera del contenido
    if (userModal) {
        userModal.addEventListener('click', function(e) {
            // Si el clic fue directamente en el modal (no en el contenido), cerrar
            if (e.target === userModal) {
                userModal.style.display = 'none';
            }
        });
    }
}

function setupScheduleModalListeners() {
    if (scheduleCancelBtn) {
        scheduleCancelBtn.addEventListener('click', function() {
            closeScheduleModal();
        });
    }
    var closeSchedule = document.getElementById('closeScheduleModal');
    if (closeSchedule) {
        closeSchedule.addEventListener('click', function() {
            closeScheduleModal();
        });
    }
    if (scheduleModal) {
        scheduleModal.addEventListener('click', function(e) {
            if (e.target === scheduleModal) {
                closeScheduleModal();
            }
        });
    }
    if (scheduleSaveBtn) {
        scheduleSaveBtn.addEventListener('click', function() {
            handleSaveSchedule();
        });
    }
}

// Editar usuario
window.editUser = function (id) {
    var user = users.find(function(u) { return u.id === id; });
    if (user && userModal && modalTitle) {
        currentEditId = id;
        modalTitle.textContent = 'Editar Usuario';
        
        var nameInput = document.getElementById('userName');
        var emailInput = document.getElementById('userEmail');
        var passwordInput = document.getElementById('userPassword');
        var rutInput = document.getElementById('userRut');
        var telefonoInput = document.getElementById('userTelefono');
        var roleInput = document.getElementById('userRole');
        var statusInput = document.getElementById('userStatus');

        if (nameInput) nameInput.value = user.nombre_completo || '';
        if (emailInput) emailInput.value = user.email || '';
        if (rutInput) rutInput.value = user.rut || '';
        if (telefonoInput) telefonoInput.value = user.telefono || '';
        if (roleInput) roleInput.value = user.rol || '';
        if (statusInput) {
            var isActive = user.activo === true || user.activo === 'true' || user.activo === 1;
            statusInput.value = isActive ? 'active' : 'inactive';
        }
        
        // Ocultar campo de password (opcional en edición)
        var passwordGroup = document.getElementById('passwordGroup');
        if (passwordGroup) passwordGroup.style.display = 'none';
        if (passwordInput) {
            passwordInput.required = false;
            passwordInput.value = '';
        }
        
        // Mostrar campo de estado en edición
        var statusGroup = document.getElementById('statusGroup');
        if (statusGroup) statusGroup.style.display = 'block';
        
        userModal.style.display = 'flex';
    }
};

// Desactivar usuario
window.deactivateUser = function (id, event) {
    if (!confirm('¿Está seguro de que desea desactivar este usuario?')) {
        return;
    }

    // Buscar el usuario para mostrar su nombre en el mensaje
    var user = users.find(function(u) { return u.id === id; });
    var userName = user ? user.nombre_completo : 'este usuario';

    // Obtener el botón que disparó el evento
    var deactivateBtn = null;
    if (event && event.target) {
        deactivateBtn = event.target;
    } else {
        // Si no hay event, buscar el botón en el DOM
        var buttons = document.querySelectorAll('.btn-deactivate');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf('deactivateUser(' + id + ')') !== -1) {
                deactivateBtn = btn;
                break;
            }
        }
    }

    // Deshabilitar el botón mientras se procesa
    if (deactivateBtn) {
        LoadingUtils.showButtonLoading(deactivateBtn, 'Desactivando...');
    }

    // Actualizar el estado del usuario a inactivo
    updateUser(id, { activo: false })
        .then(function(updatedUser) {
            console.log('Usuario desactivado:', updatedUser);
            alert('Usuario "' + userName + '" desactivado correctamente');
            
            // Recargar usuarios
            loadUsersFromAPI();
        })
        .catch(function(err) {
            ErrorHandler.handleError(err, 'Desactivar usuario', {
                useAlert: true
            });
        })
        .finally(function() {
            // Rehabilitar el botón
            if (deactivateBtn) {
                LoadingUtils.hideButtonLoading(deactivateBtn);
            }
        });
};

// Activar usuario
window.activateUser = function (id, event) {
    // Buscar el usuario para mostrar su nombre en el mensaje
    var user = users.find(function(u) { return u.id === id; });
    var userName = user ? user.nombre_completo : 'este usuario';

    // Obtener el botón que disparó el evento
    var activateBtn = null;
    if (event && event.target) {
        activateBtn = event.target;
    } else {
        // Si no hay event, buscar el botón en el DOM
        var buttons = document.querySelectorAll('.btn-activate');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf('activateUser(' + id + ')') !== -1) {
                activateBtn = btn;
                break;
            }
        }
    }

    // Deshabilitar el botón mientras se procesa
    if (activateBtn) {
        LoadingUtils.showButtonLoading(activateBtn, 'Activando...');
    }

    // Actualizar el estado del usuario a activo
    updateUser(id, { activo: true })
        .then(function(updatedUser) {
            console.log('Usuario activado:', updatedUser);
            alert('Usuario "' + userName + '" activado correctamente');
            
            // Recargar usuarios
            loadUsersFromAPI();
        })
        .catch(function(err) {
            ErrorHandler.handleError(err, 'Activar usuario', {
                useAlert: true
            });
        })
        .finally(function() {
            // Rehabilitar el botón
            if (activateBtn) {
                LoadingUtils.hideButtonLoading(activateBtn);
            }
        });
};

// Eliminar usuario (solo para usuarios inactivos)
window.deleteUser = function (id, event) {
    if (!confirm('¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.')) {
        return;
    }

    // Buscar el usuario para mostrar su nombre en el mensaje
    var user = users.find(function(u) { return u.id === id; });
    var userName = user ? user.nombre_completo : 'este usuario';

    // Obtener el botón que disparó el evento
    var deleteBtn = null;
    if (event && event.target) {
        deleteBtn = event.target;
    } else {
        // Si no hay event, buscar el botón en el DOM
        var buttons = document.querySelectorAll('.btn-delete');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf('deleteUser(' + id + ')') !== -1) {
                deleteBtn = btn;
                break;
            }
        }
    }

    // Deshabilitar el botón mientras se procesa
    if (deleteBtn) {
        LoadingUtils.showButtonLoading(deleteBtn, 'Eliminando...');
    }

    bearerFetch(API_BASE + '/users/' + id, {
        method: 'DELETE'
    })
    .then(function(res) {
        if (!res.ok) {
            return res.json().then(function(err) {
                var errorMsg = err.message || 'Error al eliminar usuario: ' + res.status;
                throw new Error(errorMsg);
            });
        }
        return res.json();
    })
    .then(function(result) {
        console.log('Usuario eliminado:', result);
        alert('Usuario "' + userName + '" eliminado correctamente');
        
        // Recargar usuarios
        loadUsersFromAPI();
    })
    .catch(function(err) {
        ErrorHandler.handleError(err, 'Eliminar usuario', {
            useAlert: true
        });
    })
    .finally(function() {
        // Rehabilitar el botón
        if (deleteBtn) {
            LoadingUtils.hideButtonLoading(deleteBtn);
        }
    });
};

function formatHour(value) {
    if (!value) return '--:--';
    return String(value).slice(0, 5);
}

function renderScheduleSummary(horario) {
    if (!horario) {
        return '<div class="schedule-chip"><span class="empty">Sin horario</span></div>';
    }
    var chips = [];
    scheduleDayConfig.forEach(function(day) {
        var info = horario[day.key];
        if (info && info.activo && info.hora_inicio && info.hora_salida) {
            chips.push('<span><strong>' + day.label.slice(0,3) + '</strong> ' + formatHour(info.hora_inicio) + '-' + formatHour(info.hora_salida) + '</span>');
        }
    });
    if (!chips.length) {
        return '<div class="schedule-chip"><span class="empty">Sin horario</span></div>';
    }
    return '<div class="schedule-chip">' + chips.join('') + '</div>';
}

window.openScheduleModal = function(userId) {
    var user = users.find(function(u) { return u.id === userId; });
    if (!user || !scheduleModal) return;
    currentScheduleUserId = userId;
    if (scheduleUserName) {
        scheduleUserName.textContent = user.nombre_completo || user.email || 'Usuario';
    }
    fillScheduleForm(user.horario || {});
    scheduleModal.style.display = 'flex';
};

function fillScheduleForm(horario) {
    scheduleDayConfig.forEach(function(day) {
        var activeInput = document.querySelector('.schedule-active[data-day="' + day.key + '"]');
        var startInput = document.querySelector('.schedule-start[data-day="' + day.key + '"]');
        var endInput = document.querySelector('.schedule-end[data-day="' + day.key + '"]');
        var breakStart = document.querySelector('.schedule-break-start[data-day="' + day.key + '"]');
        var breakEnd = document.querySelector('.schedule-break-end[data-day="' + day.key + '"]');

        var data = horario[day.key] || {};
        var isActive = !!data.activo;

        if (activeInput) activeInput.checked = isActive;
        if (startInput) startInput.value = isActive && data.hora_inicio ? formatHour(data.hora_inicio) : '';
        if (endInput) endInput.value = isActive && data.hora_salida ? formatHour(data.hora_salida) : '';
        if (breakStart) breakStart.value = isActive && data.colacion_inicio ? formatHour(data.colacion_inicio) : '';
        if (breakEnd) breakEnd.value = isActive && data.colacion_salida ? formatHour(data.colacion_salida) : '';
    });
}

function collectScheduleForm() {
    var schedule = {};
    scheduleDayConfig.forEach(function(day) {
        var activeInput = document.querySelector('.schedule-active[data-day="' + day.key + '"]');
        var startInput = document.querySelector('.schedule-start[data-day="' + day.key + '"]');
        var endInput = document.querySelector('.schedule-end[data-day="' + day.key + '"]');
        var breakStart = document.querySelector('.schedule-break-start[data-day="' + day.key + '"]');
        var breakEnd = document.querySelector('.schedule-break-end[data-day="' + day.key + '"]');

        var isActive = activeInput ? activeInput.checked : false;
        schedule[day.key] = {
            activo: isActive,
            hora_inicio: isActive && startInput && startInput.value ? startInput.value : null,
            hora_salida: isActive && endInput && endInput.value ? endInput.value : null,
            colacion_inicio: isActive && breakStart && breakStart.value ? breakStart.value : null,
            colacion_salida: isActive && breakEnd && breakEnd.value ? breakEnd.value : null
        };
    });
    return schedule;
}

function handleSaveSchedule() {
    if (!currentScheduleUserId) return;
    var schedulePayload = collectScheduleForm();

    if (scheduleSaveBtn) {
        LoadingUtils.showButtonLoading(scheduleSaveBtn, 'Guardando...');
    }

    updateUserSchedule(currentScheduleUserId, schedulePayload)
        .then(function() {
            alert('Horario actualizado correctamente');
            closeScheduleModal();
            loadUsersFromAPI();
        })
        .catch(function(err) {
            console.error('Error al actualizar horario:', err);
            alert('Error al actualizar horario: ' + err.message);
        })
        .finally(function() {
            if (scheduleSaveBtn) {
                LoadingUtils.hideButtonLoading(scheduleSaveBtn);
            }
        });
}

function updateUserSchedule(userId, schedule) {
    return bearerFetch(API_BASE + '/users/' + userId + '/schedule', {
        method: 'PATCH',
        body: JSON.stringify(schedule)
    }).then(function(res) {
        if (!res.ok) {
            return res.json().then(function(err) {
                throw new Error(err.message || 'Error al actualizar horario');
            });
        }
        return res.json();
    });
}

function closeScheduleModal() {
    if (scheduleModal) scheduleModal.style.display = 'none';
    currentScheduleUserId = null;
}

// ========= HISTORIALES =========
var historyViewer = null;
var historialesSection = null;
var historialTypeSelect = null;

// Función global para cambiar de sección (reutilizable)
function switchSection(sectionId, menuItem) {
    console.log('[switchSection] Cambiando a sección:', sectionId);
    
    // Mapeo de títulos para cada sección
    var sectionTitles = {
        'usuarios-section': 'Gestión de Usuarios',
        'flota-section': 'Gestión de Flota',
        'historiales-section': 'Historiales del Sistema',
        'reportes-section': 'Reportes y Estadísticas',
        'configuracion-section': 'Configuración del Sistema'
    };
    
    // Actualizar título en el header común
    var sectionTitleEl = document.getElementById('sectionTitle');
    if (sectionTitleEl && sectionTitles[sectionId]) {
        sectionTitleEl.textContent = sectionTitles[sectionId];
    }
    
    // Ocultar todas las secciones
    var sections = document.querySelectorAll('.content-section');
    console.log('[switchSection] Secciones encontradas:', sections.length);
    sections.forEach(function(section) {
        section.style.display = 'none';
        console.log('[switchSection] Ocultando sección:', section.id);
    });

    // Remover active de todos los items
    var menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(function(item) {
        item.classList.remove('active');
    });

    // Mostrar sección seleccionada
    var targetSection = document.getElementById(sectionId);
    console.log('[switchSection] Sección objetivo encontrada:', targetSection);
    if (targetSection) {
        // Usar 'block' o el display original si tenía uno
        var originalDisplay = targetSection.getAttribute('data-original-display') || 'block';
        targetSection.style.display = originalDisplay;
        console.log('[switchSection] Sección mostrada. Display:', window.getComputedStyle(targetSection).display);
        console.log('[switchSection] Sección height:', targetSection.offsetHeight);
        console.log('[switchSection] Sección width:', targetSection.offsetWidth);
        console.log('[switchSection] Sección visible:', targetSection.offsetHeight > 0 && targetSection.offsetWidth > 0);
    } else {
        console.error('[switchSection] Sección no encontrada:', sectionId);
    }

    // Marcar item del menú como activo
    if (menuItem) {
        menuItem.classList.add('active');
    }
}

function initHistoriales() {
    console.log('[Historiales] Inicializando módulo de historiales...');
    
    historialesSection = document.getElementById('historiales-section');
    historialTypeSelect = document.getElementById('historial-type-select');
    
    console.log('[Historiales] historialesSection:', historialesSection);
    console.log('[Historiales] historialTypeSelect:', historialTypeSelect);
    
    if (!historialesSection || !historialTypeSelect) {
        console.warn('[Historiales] No se encontraron elementos necesarios. historialesSection:', historialesSection, 'historialTypeSelect:', historialTypeSelect);
        return;
    }

    // Verificar que HistoryViewer esté disponible
    console.log('[Historiales] HistoryViewer disponible:', typeof window.HistoryViewer !== 'undefined');
    
    // Crear viewer inicial
    var container = document.getElementById('history-container');
    console.log('[Historiales] Container encontrado:', container);
    
    if (container && typeof window.HistoryViewer !== 'undefined') {
        try {
            console.log('[Historiales] Creando HistoryViewer con entityType:', historialTypeSelect.value);
            
            // Obtener roles del usuario actual
            var userRoles = [];
            try {
                var userStr = localStorage.getItem('crm.user');
                if (userStr) {
                    var user = JSON.parse(userStr);
                    userRoles = user.roles || [user.rol] || ['admin'];
                } else {
                    userRoles = ['admin', 'ADMIN'];
                }
            } catch (e) {
                console.warn('[Historiales] No se pudo obtener roles del usuario, usando default');
                userRoles = ['admin', 'ADMIN'];
            }
            
            historyViewer = new window.HistoryViewer({
                container: container,
                entityType: historialTypeSelect.value,
                entityTypeSelect: historialTypeSelect, // Pasar el selector para que se configure automáticamente
                bearerFetch: bearerFetch,
                userRoles: userRoles,
                pageSize: 20
            });
            console.log('[Historiales] HistoryViewer creado exitosamente:', historyViewer);
        } catch (error) {
            console.error('[Historiales] Error al crear HistoryViewer:', error);
        }
    } else {
        console.warn('[Historiales] No se pudo crear HistoryViewer. Container:', container, 'HistoryViewer disponible:', typeof window.HistoryViewer !== 'undefined');
    }

    // El event listener ahora se maneja internamente en HistoryViewer cuando se pasa entityTypeSelect
    // Pero mantenemos este como fallback por si acaso
    historialTypeSelect.addEventListener('change', function() {
        console.log('[Historiales] Cambiando tipo de historial a:', this.value);
        if (historyViewer) {
            historyViewer.entityType = this.value;
            historyViewer.filters.entityType = this.value;
            historyViewer.filters.page = 1;
            
            // Actualizar el header
            if (typeof historyViewer.updateHeader === 'function') {
                historyViewer.updateHeader();
            }
            
            console.log('[Historiales] Cargando historial...');
            historyViewer.load();
        } else {
            console.warn('[Historiales] historyViewer no está inicializado');
        }
    });

    // Manejar clicks en menú de usuarios
    var usuariosMenuItem = document.querySelector('[data-section="usuarios"]');
    if (usuariosMenuItem) {
        usuariosMenuItem.addEventListener('click', function() {
            switchSection('usuarios-section', this);
        });
    }

    // Manejar clicks en menú de historiales
    var historialesMenuItem = document.querySelector('[data-section="historiales"]');
    console.log('[Historiales] Menu item encontrado:', historialesMenuItem);
    
    if (historialesMenuItem) {
        historialesMenuItem.addEventListener('click', function() {
            console.log('[Historiales] Click en menú de historiales');
            switchSection('historiales-section', this);
            
            // Verificar que la sección esté visible
            var section = document.getElementById('historiales-section');
            console.log('[Historiales] Sección después de switchSection:', section);
            console.log('[Historiales] Display de la sección:', section ? window.getComputedStyle(section).display : 'N/A');
            console.log('[Historiales] Visibility de la sección:', section ? window.getComputedStyle(section).visibility : 'N/A');

            // Cargar historial si no está cargado
            if (historyViewer && historialTypeSelect) {
                console.log('[Historiales] Cargando historial desde menú. Tipo:', historialTypeSelect.value);
                historyViewer.entityType = historialTypeSelect.value;
                historyViewer.filters.entityType = historialTypeSelect.value;
                
                // Actualizar el header
                if (typeof historyViewer.updateHeader === 'function') {
                    historyViewer.updateHeader();
                }
                
                historyViewer.load();
            } else {
                console.warn('[Historiales] No se puede cargar historial. historyViewer:', historyViewer, 'historialTypeSelect:', historialTypeSelect);
                // Intentar inicializar si no está inicializado
                if (!historyViewer) {
                    console.log('[Historiales] Intentando inicializar HistoryViewer...');
                    var container = document.getElementById('history-container');
                    console.log('[Historiales] Container encontrado:', container);
                    console.log('[Historiales] Container visible:', container ? window.getComputedStyle(container).display !== 'none' : 'N/A');
                    
                    if (container && typeof window.HistoryViewer !== 'undefined') {
                        try {
                            // Obtener roles del usuario actual
                            var userRoles = [];
                            try {
                                var userStr = localStorage.getItem('crm.user');
                                if (userStr) {
                                    var user = JSON.parse(userStr);
                                    userRoles = user.roles || [user.rol] || ['admin'];
                                } else {
                                    userRoles = ['admin', 'ADMIN'];
                                }
                            } catch (e) {
                                userRoles = ['admin', 'ADMIN'];
                            }
                            
                            historyViewer = new window.HistoryViewer({
                                container: container,
                                entityType: historialTypeSelect ? historialTypeSelect.value : 'solicitudes_repuestos',
                                entityTypeSelect: historialTypeSelect, // Pasar el selector
                                bearerFetch: bearerFetch,
                                userRoles: userRoles,
                                pageSize: 20
                            });
                            console.log('[Historiales] HistoryViewer inicializado desde click del menú');
                            historyViewer.load();
                        } catch (error) {
                            console.error('[Historiales] Error al inicializar HistoryViewer desde click:', error);
                        }
                    } else {
                        console.error('[Historiales] No se pudo inicializar. Container:', container, 'HistoryViewer disponible:', typeof window.HistoryViewer !== 'undefined');
                    }
                }
            }
        });
    }
}

// Inicializar historiales cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHistoriales);
} else {
    initHistoriales();
}

// ========= VEHÍCULOS/FLOTA =========

var vehiclesViewer = null;
var flotaSection = null;

/**
 * Inicializar sección de flota
 */
function initFlota() {
    console.log('[Flota] Inicializando módulo de flota...');
    
    flotaSection = document.getElementById('flota-section');
    var vehiclesContainer = document.getElementById('vehicles-container');
    
    if (!flotaSection || !vehiclesContainer) {
        console.warn('[Flota] Elementos necesarios no encontrados');
        return;
    }

    // Verificar que VehiclesViewer esté disponible
    if (typeof window.VehiclesViewer === 'undefined') {
        console.error('[Flota] VehiclesViewer no está disponible');
        vehiclesContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Error: VehiclesViewer no está disponible</div>';
        return;
    }

    try {
        vehiclesViewer = new window.VehiclesViewer({
            container: vehiclesContainer,
            bearerFetch: bearerFetch,
            showGenerateOTButton: false // Admin no necesita generar OT desde aquí
        });
        console.log('[Flota] VehiclesViewer creado exitosamente:', vehiclesViewer);
    } catch (error) {
        console.error('[Flota] Error al crear VehiclesViewer:', error);
        vehiclesContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">Error al inicializar la gestión de flota: ' + error.message + '</div>';
    }

    // Manejar clicks en menú de flota
    var flotaMenuItem = document.querySelector('[data-section="flota"]');
    if (flotaMenuItem) {
        flotaMenuItem.addEventListener('click', function() {
            switchSection('flota-section', this);
            
            // Cargar vehículos si no están cargados
            if (vehiclesViewer) {
                vehiclesViewer.load();
            }
        });
    } else {
        console.warn('[Flota] No se encontró el menú item de flota');
    }
}

// Inicializar flota cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFlota);
} else {
    initFlota();
}

// ========= REPORTES =========

var reportsViewer = null;
var reportesSection = null;
var reporteTypeSelect = null;
var currentUserRole = 'admin';

/**
 * Inicializar sección de reportes
 */
function initReportes() {
    console.log('[Reportes] Inicializando módulo de reportes...');
    
    reportesSection = document.getElementById('reportes-section');
    reporteTypeSelect = document.getElementById('reporte-type-select');
    var reportsContainer = document.getElementById('reports-container');
    
    if (!reportesSection || !reporteTypeSelect || !reportsContainer) {
        console.warn('[Reportes] Elementos necesarios no encontrados');
        return;
    }

    // Obtener rol del usuario actual
    try {
        var token = localStorage.getItem('crm.token');
        if (token) {
            var payload = JSON.parse(atob(token.split('.')[1]));
            currentUserRole = payload.rol || payload.role || 'admin';
        }
    } catch (e) {
        console.warn('[Reportes] No se pudo obtener el rol del usuario, usando admin por defecto');
        currentUserRole = 'admin';
    }

    console.log('[Reportes] Rol del usuario:', currentUserRole);

    // Obtener reportes disponibles para este rol
    var availableReports = ReportsViewer.getAvailableReports(currentUserRole);
    console.log('[Reportes] Reportes disponibles:', availableReports);

    // Llenar select con reportes disponibles
    reporteTypeSelect.innerHTML = '';
    if (availableReports.length === 0) {
        reporteTypeSelect.innerHTML = '<option value="">No hay reportes disponibles</option>';
        reportsContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No tienes acceso a ningún reporte</p>';
        return;
    }

    availableReports.forEach(function(report) {
        var option = document.createElement('option');
        option.value = report.type;
        option.textContent = report.label;
        reporteTypeSelect.appendChild(option);
    });

    // Crear viewer inicial con el primer reporte disponible
    var initialReportType = availableReports[0].type;
    try {
        reportsViewer = new ReportsViewer({
            container: reportsContainer,
            reportType: initialReportType,
            userRole: currentUserRole,
            bearerFetch: bearerFetch
        });
        console.log('[Reportes] ReportsViewer creado exitosamente');
    } catch (error) {
        console.error('[Reportes] Error al crear ReportsViewer:', error);
        reportsContainer.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 40px;">Error al inicializar reportes: ' + error.message + '</p>';
        return;
    }

    // Manejar cambio de tipo de reporte
    reporteTypeSelect.addEventListener('change', function() {
        var tipo = this.value;
        console.log('[Reportes] Cambiando tipo de reporte a:', tipo);
        
        if (reportsViewer) {
            try {
                reportsViewer.setReportType(tipo);
                console.log('[Reportes] Tipo de reporte cambiado exitosamente');
            } catch (error) {
                console.error('[Reportes] Error al cambiar tipo de reporte:', error);
                alert('Error al cambiar tipo de reporte: ' + error.message);
            }
        }
    });

    // Manejar clicks en menú de reportes
    var reportesMenuItem = document.querySelector('[data-section="reportes"]');
    if (reportesMenuItem) {
        reportesMenuItem.addEventListener('click', function() {
            console.log('[Reportes] Click en menú de reportes');
            switchSection('reportes-section', this);
        });
    } else {
        console.warn('[Reportes] No se encontró el menú item de reportes');
    }
}

// Inicializar reportes cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReportes);
} else {
    initReportes();
}

// ========= CONFIGURACIÓN =========
function initConfiguracion() {
    console.log('[Configuración] Inicializando módulo de configuración...');
    
    var debugToggle = document.getElementById('debugModeToggle');
    var debugStatus = document.getElementById('debugStatus');
    var debugStatusText = document.getElementById('debugStatusText');
    
    if (!debugToggle) {
        console.warn('[Configuración] No se encontró el toggle de debug');
        return;
    }
    
    // Cargar estado actual
    if (typeof window.ConfigManager !== 'undefined') {
        var isDebugEnabled = window.ConfigManager.isDebugMode();
        debugToggle.checked = isDebugEnabled;
        updateDebugStatus(isDebugEnabled);
    }
    
    // Manejar cambio de toggle
    debugToggle.addEventListener('change', function() {
        var enabled = this.checked;
        console.log('[Configuración] Modo debug cambiado a:', enabled);
        
        if (typeof window.ConfigManager !== 'undefined') {
            // Verificar estado antes de cambiar
            var beforeState = window.ConfigManager.isDebugMode();
            console.log('[Configuración] Estado antes del cambio:', beforeState);
            
            window.ConfigManager.setDebugMode(enabled).then(function() {
                // Verificar que se guardó correctamente
                var afterState = window.ConfigManager.isDebugMode();
                var storedConfig = localStorage.getItem('crm.config');
                console.log('[Configuración] Estado después del cambio:', afterState);
                console.log('[Configuración] Configuración guardada en localStorage:', storedConfig);
                
                if (afterState === enabled) {
                    updateDebugStatus(enabled);
                    alert('Modo debug ' + (enabled ? 'activado' : 'desactivado') + ' correctamente.');
                } else {
                    console.error('[Configuración] El estado no se guardó correctamente. Esperado:', enabled, 'Obtenido:', afterState);
                    alert('Error: El modo debug no se guardó correctamente. Por favor, intenta nuevamente.');
                    debugToggle.checked = !enabled;
                }
            }).catch(function(err) {
                console.error('[Configuración] Error al cambiar modo debug:', err);
                alert('Error al cambiar modo debug. Por favor, intenta nuevamente.');
                // Revertir toggle
                debugToggle.checked = !enabled;
            });
        } else {
            console.error('[Configuración] ConfigManager no está disponible');
            alert('Error: ConfigManager no está disponible. Por favor, recarga la página.');
            debugToggle.checked = !enabled;
        }
    });
    
    function updateDebugStatus(enabled) {
        if (debugStatus && debugStatusText) {
            debugStatus.style.display = 'block';
            debugStatusText.textContent = enabled ? 'Activado' : 'Desactivado';
            debugStatus.style.backgroundColor = enabled ? '#E8F5E9' : '#FFEBEE';
            debugStatus.style.color = enabled ? '#388E3C' : '#D32F2F';
            debugStatusText.style.fontWeight = 'bold';
        }
    }
    
    // Manejar clicks en menú de configuración
    var configuracionMenuItem = document.querySelector('[data-section="configuracion"]');
    if (configuracionMenuItem) {
        configuracionMenuItem.addEventListener('click', function() {
            console.log('[Configuración] Click en menú de configuración');
            switchSection('configuracion-section', this);
            
            // Actualizar estado del toggle al abrir la sección
            if (typeof window.ConfigManager !== 'undefined') {
                var isDebugEnabled = window.ConfigManager.isDebugMode();
                if (debugToggle) {
                    debugToggle.checked = isDebugEnabled;
                    updateDebugStatus(isDebugEnabled);
                }
            }
        });
    } else {
        console.warn('[Configuración] No se encontró el menú item de configuración');
    }
}

// Inicializar configuración cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConfiguracion);
} else {
    initConfiguracion();
}