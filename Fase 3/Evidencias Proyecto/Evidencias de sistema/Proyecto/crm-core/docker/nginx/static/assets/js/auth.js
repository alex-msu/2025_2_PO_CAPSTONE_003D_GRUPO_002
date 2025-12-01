/**
 * ========================================================
 * MÓDULO DE AUTENTICACIÓN Y AUTORIZACIÓN COMPARTIDO
 * ========================================================
 * 
 * Este módulo proporciona funciones centralizadas para:
 * - Verificar autenticación (token válido)
 * - Verificar autorización (rol del usuario)
 * - Redirigir según rol
 * - Manejar logout seguro
 * 
 * USO:
 *   <script src="assets/js/auth.js"></script>
 *   <script>
 *     // Proteger página para un rol específico
 *     requireAuthForRole('mecanico').then(function(user) {
 *       console.log('Usuario autenticado:', user);
 *     });
 *   </script>
 */

(function() {
    'use strict';

    // ========= CONFIGURACIÓN =========
    var API_BASE = '/api';
    var TOKEN_KEY = 'crm.token';
    
    // Mapeo de roles a sus dashboards permitidos
    var ROLE_DASHBOARD_MAP = {
        'admin': ['admin_dashboard.html'],
        'jefe_taller': ['jefe_taller_dashboard.html'],
        'mecanico': ['mecanico_dashboard.html'],
        'chofer': ['chofer_dashboard.html'],
        'supervisor': ['reportes.html'],
        'coordinador_zona': ['reportes.html'],
        'guardia': ['base.html'],
        'recepcion': ['base.html'],
        'recepcionista': ['recepcionista_dashboard.html'],
        'bodeguero': ['bodeguero_dashboard.html'],
        'repuestos': ['base.html'],
        'ventas': ['base.html'],
        'llaves': ['base.html']
    };

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
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        var merged = {};
        for (var k in opts) {
            if (Object.prototype.hasOwnProperty.call(opts, k)) {
                merged[k] = opts[k];
            }
        }
        merged.headers = headers;
        merged.cache = 'no-store';
        return fetch(url, merged);
    }

    /**
     * Obtiene el perfil del usuario autenticado
     */
    function getCurrentUser() {
        var token = getToken();
        if (!token) {
            return Promise.reject(new Error('No hay token de autenticación'));
        }
        return bearerFetch(API_BASE + '/auth/me')
            .then(function(res) {
                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        // Token inválido o expirado
                        localStorage.removeItem(TOKEN_KEY);
                        throw new Error('Sesión expirada');
                    }
                    throw new Error('Error al obtener perfil: ' + res.status);
                }
                return res.json();
            });
    }

    /**
     * Verifica si el usuario tiene un rol específico
     */
    function hasRole(user, requiredRole) {
        if (!user || !user.rol) return false;
        return String(user.rol).toLowerCase() === String(requiredRole).toLowerCase();
    }

    /**
     * Obtiene el nombre del dashboard actual desde la URL
     */
    function getCurrentDashboard() {
        var path = window.location.pathname;
        var parts = path.split('/');
        return parts[parts.length - 1] || '';
    }

    /**
     * Verifica si el rol del usuario tiene acceso al dashboard actual
     */
    function canAccessDashboard(user, dashboardName) {
        if (!user || !user.rol) return false;
        var role = String(user.rol).toLowerCase();
        var allowedDashboards = ROLE_DASHBOARD_MAP[role] || [];
        return allowedDashboards.some(function(dash) {
            return dash === dashboardName || dash.toLowerCase() === dashboardName.toLowerCase();
        });
    }

    /**
     * Redirige al usuario a su dashboard según su rol
     */
    function redirectToRoleDashboard(role) {
        var roleLower = String(role || '').toLowerCase();
        var dashboards = ROLE_DASHBOARD_MAP[roleLower] || ['login.html'];
        var target = '/' + dashboards[0];
        window.location.replace(target);
    }

    /**
     * Cierra sesión y redirige al login
     */
    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.clear();
        window.location.replace('/login.html');
    }

    // ========= FUNCIONES PÚBLICAS =========

    /**
     * Requiere autenticación (cualquier usuario autenticado)
     * Si no está autenticado, redirige al login
     * 
     * @returns {Promise<Object>} Perfil del usuario
     */
    window.requireAuth = function() {
        var token = getToken();
        if (!token) {
            window.location.replace('/login.html');
            return Promise.reject(new Error('No autenticado'));
        }
        return getCurrentUser()
            .catch(function(err) {
                console.error('Error de autenticación:', err);
                window.location.replace('/login.html');
                throw err;
            });
    };

    /**
     * Requiere autenticación Y un rol específico
     * Si el usuario no tiene el rol requerido, redirige a su dashboard apropiado
     * 
     * @param {string} requiredRole - Rol requerido (ej: 'mecanico', 'jefe_taller')
     * @param {Object} options - Opciones adicionales
     * @param {boolean} options.strict - Si es true, redirige al login si el rol no coincide. 
     *                                   Si es false (default), redirige al dashboard del usuario.
     * @returns {Promise<Object>} Perfil del usuario
     */
    window.requireAuthForRole = function(requiredRole, options) {
        options = options || {};
        var strict = options.strict === true;
        
        return window.requireAuth()
            .then(function(user) {
                var currentDashboard = getCurrentDashboard();
                
                // Verificar si el rol coincide
                if (!hasRole(user, requiredRole)) {
                    console.warn('Acceso denegado: usuario con rol "' + user.rol + '" intentó acceder a dashboard de "' + requiredRole + '"');
                    
                    if (strict) {
                        // Modo estricto: redirigir al login
                        logout();
                        return Promise.reject(new Error('Rol no autorizado'));
                    } else {
                        // Modo permisivo: redirigir al dashboard apropiado del usuario
                        redirectToRoleDashboard(user.rol);
                        return Promise.reject(new Error('Redirigiendo a dashboard apropiado'));
                    }
                }
                
                // Verificar adicional: si el dashboard actual no corresponde al rol
                if (currentDashboard && !canAccessDashboard(user, currentDashboard)) {
                    console.warn('Dashboard actual no corresponde al rol del usuario');
                    redirectToRoleDashboard(user.rol);
                    return Promise.reject(new Error('Redirigiendo a dashboard apropiado'));
                }
                
                return user;
            });
    };

    /**
     * Inicializa la autenticación al cargar la página
     * Actualiza el nombre de usuario en elementos con id="currentUserName" o id="userName"
     * 
     * @param {string} requiredRole - Rol requerido (opcional)
     * @returns {Promise<Object>} Perfil del usuario
     */
    window.initAuth = function(requiredRole) {
        var initPromise;
        
        if (requiredRole) {
            initPromise = window.requireAuthForRole(requiredRole);
        } else {
            initPromise = window.requireAuth();
        }
        
        return initPromise
            .then(function(user) {
                // Actualizar nombre de usuario en la UI
                var nameElements = [
                    document.getElementById('currentUserName'),
                    document.getElementById('userName'),
                    document.querySelector('[data-user-name]')
                ];
                
                var userName = user.nombre_completo || user.email || 'Usuario';
                nameElements.forEach(function(el) {
                    if (el) el.textContent = userName;
                });
                
                // Actualizar rol en la UI
                var roleElements = [
                    document.querySelector('.user-role'),
                    document.querySelector('[data-user-role]')
                ];
                
                if (user.rol && roleElements.length > 0) {
                    roleElements.forEach(function(el) {
                        if (el) {
                            // Opcional: mostrar nombre legible del rol
                            var roleNames = {
                                'jefe_taller': 'Jefe de Taller',
                                'mecanico': 'Mecánico',
                                'chofer': 'Chofer',
                                'admin': 'Administrador',
                                'supervisor': 'Supervisor',
                                'recepcionista': 'Recepcionista',
                                'bodeguero': 'Bodeguero'
                            };
                            el.textContent = roleNames[user.rol] || user.rol;
                        }
                    });
                }
                
                return user;
            })
            .catch(function(err) {
                // Los errores ya manejan la redirección
                console.error('Error en initAuth:', err);
                throw err;
            });
    };

    /**
     * Función de logout global
     * NO sobrescribe si ya existe una función logout local
     */
    if (typeof window.logout === 'undefined') {
        window.logout = function() {
            if (confirm('¿Está seguro de que desea cerrar sesión?')) {
                logout();
            }
        };
    }

    // Exportar funciones adicionales si se necesitan
    window.authUtils = {
        getCurrentUser: getCurrentUser,
        hasRole: hasRole,
        redirectToRoleDashboard: redirectToRoleDashboard,
        bearerFetch: bearerFetch,
        getToken: getToken
    };

})();

