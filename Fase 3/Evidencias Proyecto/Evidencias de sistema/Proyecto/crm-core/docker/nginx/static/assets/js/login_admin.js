/* ========= CONFIG ========= */
var API_BASE = '/api';
var TOKEN_KEY = 'crm.token';

/* ========= UTILS ========= */
function $(id) {
    return document.getElementById(id);
}

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initializeLogin();
});

function initializeLogin() {
    var apiStatus = $('apiStatus');
    var adminLoginForm = $('adminLoginForm');
    var adminEmail = $('adminEmail');
    var adminPassword = $('adminPassword');
    var togglePassword = $('togglePassword');
    var adminLoginBtn = $('adminLoginBtn');
    var btnText = $('btnText');
    var btnLoader = $('btnLoader');
    var emailError = $('emailError');
    var passwordError = $('passwordError');
    var msg = $('msg');

    function setBtnLoading(loading) {
        if (!adminLoginBtn || !btnText || !btnLoader) return;
        if (loading) {
            adminLoginBtn.disabled = true;
            btnLoader.style.display = 'block';
            btnText.style.display = 'none';
        } else {
            adminLoginBtn.disabled = false;
            btnLoader.style.display = 'none';
            btnText.style.display = 'block';
        }
    }

    function flashStatus(target, kind, text) {
        if (!target) return;
        target.style.display = 'block';
        target.className = 'error-message';
        if (kind === 'ok') {
            target.style.background = '#d4edda';
            target.style.borderLeftColor = '#28a745';
            target.style.color = '#155724';
        } else if (kind === 'bad') {
            target.style.background = '#f8d7da';
            target.style.borderLeftColor = '#dc3545';
            target.style.color = '#721c24';
        } else if (kind === 'warn') {
            target.style.background = '#fff3cd';
            target.style.borderLeftColor = '#ffc107';
            target.style.color = '#856404';
        }
        target.textContent = text;
    }

    function safeMessage(res, fallback) {
        return res.json().then(function (b) {
            if (b && typeof b.message === 'string') return b.message;
            if (b && Array.isArray(b.message) && b.message.length) return b.message[0];
            return fallback;
        }).catch(function () {
            return fallback;
        });
    }

    function bearerFetch(url, opts) {
        opts = opts || {};
        var headers = new Headers(opts.headers || {});
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        var t = localStorage.getItem(TOKEN_KEY);
        if (t) headers.set('Authorization', 'Bearer ' + t);
        var merged = {};
        for (var k in opts) {
            if (Object.prototype.hasOwnProperty.call(opts, k)) merged[k] = opts[k];
        }
        merged.headers = headers;
        return fetch(url, merged);
    }

    // Mostrar/ocultar contraseña
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            var type = adminPassword.getAttribute('type') === 'password' ? 'text' : 'password';
            adminPassword.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }

    /* ========= HELPER: Verificar modo debug ========= */
    var debugModeCache = null;
    var debugModeCacheTimestamp = 0;
    var DEBUG_CACHE_TTL = 2000; // 2 segundos de caché

    function isDebugMode() {
        try {
            // Primero intentar desde localStorage (más rápido)
            var config = localStorage.getItem('crm.config');
            if (config) {
                try {
                    var parsed = JSON.parse(config);
                    if (parsed.debugMode !== undefined) {
                        return parsed.debugMode === true;
                    }
                } catch (e) {
                    // Si falla el parse, continuar con backend
                }
            }
            
            // Si no hay en localStorage o está desactualizado, usar caché en memoria
            var now = Date.now();
            if (debugModeCache !== null && (now - debugModeCacheTimestamp) < DEBUG_CACHE_TTL) {
                return debugModeCache;
            }
            
            // Si no hay caché válido, retornar false por defecto
            return false;
        } catch (e) {
            return false;
        }
    }

    /* ========= HELPER: Cargar modo debug desde backend ========= */
    async function loadDebugModeFromBackend() {
        try {
            var response = await fetch(API_BASE + '/config/debug', {
                method: 'GET',
                cache: 'no-store'
            });
            
            if (response.ok) {
                var data = await response.json();
                if (data.enabled !== undefined) {
                    debugModeCache = data.enabled === true;
                    debugModeCacheTimestamp = Date.now();
                    
                    // Sincronizar con localStorage
                    var config = { debugMode: debugModeCache };
                    localStorage.setItem('crm.config', JSON.stringify(config));
                    
                    return debugModeCache;
                }
            }
        } catch (e) {
            console.warn('[Login Admin] Error al cargar modo debug desde backend:', e);
        }
        return false;
    }

    /* ========= HEALTH CHECK ========= */
    async function checkHealth() {
        // Cargar modo debug desde backend primero
        var debugEnabled = await loadDebugModeFromBackend();
        
        // Solo verificar health si el modo debug está activado
        if (!debugEnabled) {
            // Si el modo debug no está activado, ocultar el elemento de estado
            if (apiStatus) apiStatus.style.display = 'none';
            return;
        }

        // Si el modo debug está activado, asegurarse de que el elemento sea visible
        if (apiStatus) {
            apiStatus.style.display = 'block';
        }

        fetch(API_BASE + '/auth/health', { cache: 'no-store' })
            .then(function (r) {
                if (r.ok || r.status === 304) {
                    if (apiStatus) flashStatus(apiStatus, 'ok', '✅ API conectada');
                } else {
                    if (apiStatus) flashStatus(apiStatus, 'warn', '⚠️ API respondió ' + r.status);
                }
            })
            .catch(function () {
                if (apiStatus) flashStatus(apiStatus, 'bad', '⚠️ No se pudo conectar con la API');
            });
    }

    // Ejecutar al cargar
    checkHealth();

    // Sincronizar periódicamente cada 5 segundos para detectar cambios
    setInterval(function() {
        loadDebugModeFromBackend().then(function(enabled) {
            if (enabled && apiStatus && apiStatus.style.display === 'none') {
                // Si se activó el modo debug, mostrar el elemento y verificar health
                apiStatus.style.display = 'block';
                checkHealth();
            } else if (!enabled && apiStatus && apiStatus.style.display !== 'none') {
                // Si se desactivó el modo debug, ocultar el elemento
                apiStatus.style.display = 'none';
            }
        });
    }, 5000);

    /* ========= LOGIN SUBMIT ========= */
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', function (ev) {
            ev.preventDefault();
            console.log('Formulario enviado'); // Debug
            if (msg) msg.style.display = 'none';
            if (emailError) emailError.style.display = 'none';
            if (passwordError) passwordError.style.display = 'none';
            setBtnLoading(true);

            var email = adminEmail ? adminEmail.value.trim() : '';
            var password = adminPassword ? adminPassword.value : '';

            console.log('Email:', email, 'Password length:', password.length); // Debug

            // Validación básica
            if (!email) {
                if (emailError) emailError.style.display = 'block';
                setBtnLoading(false);
                return;
            }
            if (!password) {
                if (passwordError) passwordError.style.display = 'block';
                setBtnLoading(false);
                return;
            }

            /* 1) LOGIN */
            fetch(API_BASE + '/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            })
                .then(function (res) {
                    console.log('Login response status:', res.status); // Debug
                    if (!res.ok) {
                        return safeMessage(res, 'Credenciales inválidas').then(function (t) {
                            throw new Error(t);
                        });
                    }
                    return res.json();
                })
                .then(function (data) {
                    console.log('Login success, token received'); // Debug
                    var token = data && data.access_token ? data.access_token : null;
                    if (!token) throw new Error('Token no recibido');
                    
                    // Decodificar el token para ver qué contiene
                    try {
                        var payload = JSON.parse(atob(token.split('.')[1]));
                        console.log('Token payload:', payload); // Debug - ver qué ID y email tiene el token
                        console.log('Token user ID:', payload.sub); // Debug
                        console.log('Token email:', payload.email); // Debug
                        console.log('Token rol:', payload.rol); // Debug
                    } catch (e) {
                        console.warn('No se pudo decodificar el token:', e);
                    }
                    
                    localStorage.setItem(TOKEN_KEY, token);

                    /* 2) ME - Verificar perfil y rol */
                    return bearerFetch(API_BASE + '/auth/me', {
                        cache: 'no-store'
                    });
                })
                .then(function (meRes) {
                    console.log('Me response status:', meRes.status); // Debug
                    if (!meRes.ok) {
                        return safeMessage(meRes, 'No se pudo obtener el perfil').then(function (t) {
                            throw new Error(t);
                        });
                    }
                    return meRes.json();
                })
                .then(function (me) {
                    console.log('User profile:', me); // Debug
                    var userRole = (me && me.rol) ? String(me.rol).toLowerCase() : '';
                    console.log('User role:', userRole); // Debug

                    // Verificar que el usuario tenga rol 'admin'
                    if (userRole !== 'admin') {
                        localStorage.removeItem(TOKEN_KEY);
                        var roleDisplay = userRole || 'sin rol';
                        if (msg) flashStatus(msg, 'bad', '❌ Acceso denegado: Tu usuario tiene rol "' + roleDisplay + '". Solo usuarios con rol "admin" pueden acceder al panel de administración. Por favor, contacta al administrador del sistema para cambiar tu rol.');
                        setBtnLoading(false);
                        return;
                    }

                    var nombre = (me && me.nombre_completo) ? me.nombre_completo.split(' ')[0] : (me && me.email ? me.email : '');
                    if (msg) flashStatus(msg, 'ok', '✅ Bienvenido, ' + nombre + '. Redirigiendo…');

                    /* 3) Redirigir al dashboard de admin */
                    setTimeout(function () {
                        window.location.href = '/admin_dashboard.html';
                    }, 500);
                })
                .catch(function (err) {
                    console.error('Error en login:', err); // Debug
                    if (msg) flashStatus(msg, 'bad', '❌ ' + (err && err.message ? err.message : 'Error de conexión'));
                    setBtnLoading(false);
                });
        });
    }

    /* ========= AUTO-FORWARD SI YA HAY TOKEN ========= */
    (function autoForward() {
        var t = localStorage.getItem(TOKEN_KEY);
        if (!t) return;
        
        // Verificar el token antes de hacer la petición
        try {
            var payload = JSON.parse(atob(t.split('.')[1]));
            console.log('Auto-forward: Token payload:', payload);
            console.log('Auto-forward: Token email:', payload.email);
            console.log('Auto-forward: Token rol:', payload.rol);
        } catch (e) {
            console.warn('Auto-forward: No se pudo decodificar el token:', e);
        }
        
        bearerFetch(API_BASE + '/auth/me', { cache: 'no-store' })
            .then(function (r) {
                return (r.ok || r.status === 304) ? r.json() : null;
            })
            .then(function (me) {
                if (!me) return null;
                console.log('Auto-forward: User profile:', me);
                var userRole = (me.rol || '').toLowerCase();
                // Solo redirigir si es admin
                if (userRole === 'admin') {
                    window.location.href = '/admin_dashboard.html';
                }
            })
            .catch(function (err) {
                console.error('Auto-forward error:', err);
            });
    })();
}