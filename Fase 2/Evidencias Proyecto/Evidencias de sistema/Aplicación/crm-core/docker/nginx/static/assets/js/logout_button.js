/**
 * Controlador Global de Cierre de Sesión
 * Versión: 1.0
 * Características:
 * - Confirmación única con modal personalizable
 * - Limpieza automática de caché
 * - Adaptable a cualquier HTML/CSS
 * - No afecta funcionalidades existentes
 */

const SessionController = {
    // Configuración por defecto - personalizable
    config: {
        // Selectores CSS personalizables
        selectors: {
            logoutButton: '#btnLogout',
            confirmButton: '#btnConfirmLogout',
            modal: '#modalLogoutConfirm'
        },
        
        // Mensajes personalizables
        messages: {
            confirmTitle: 'Confirmar Cierre de Sesión',
            confirmMessage: '¿Está seguro de que desea cerrar sesión?',
            confirmAction: 'Cerrar Sesión',
            cancelAction: 'Cancelar'
        },
        
        // Configuración de almacenamiento
        storage: {
            tokenKey: 'crm.token',
            clearSessionStorage: true,
            clearLocalStorage: true
        },
        
        // Redirección después del logout
        redirect: {
            enabled: true,
            url: '/login.html',
            delay: 0
        }
    },

    // Inicializar el controlador
    init(customConfig = {}) {
        // Fusionar configuración personalizada
        this.config = { ...this.config, ...customConfig };
        
        // Asegurar que el modal esté oculto inicialmente
        const modal = document.querySelector(this.config.selectors.modal);
        if (modal) {
            modal.setAttribute('aria-hidden', 'true');
            modal.style.display = 'none';
        }
        
        this.bindEvents();
        this.injectModalIfNotExists();
        
        // Re-vincular eventos después de un pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
            this.bindEvents();
        }, 100);
        
        console.log('SessionController inicializado correctamente');
    },

    // Vincular eventos del DOM
    bindEvents() {
        const { logoutButton, confirmButton, modal } = this.config.selectors;
        
        // Botón de logout principal - soporta múltiples selectores
        const logoutSelectors = [
            logoutButton,
            'button[onclick*="logout"]',
            'button[onclick*="Logout"]',
            '.btn-logout',
            '[data-logout]'
        ];
        
        let logoutBtn = null;
        for (const selector of logoutSelectors) {
            logoutBtn = document.querySelector(selector);
            if (logoutBtn) break;
        }
        
        if (logoutBtn && !logoutBtn.hasAttribute('data-logout-listener')) {
            // Remover onclick existente si existe
            if (logoutBtn.onclick) {
                logoutBtn.removeAttribute('onclick');
            }
            
            logoutBtn.setAttribute('data-logout-listener', 'true');
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showConfirmation();
            });
        }

        // Botón de confirmación en el modal
        const confirmBtn = document.querySelector(confirmButton);
        if (confirmBtn && !confirmBtn.hasAttribute('data-logout-listener')) {
            // Remover onclick existente si existe
            if (confirmBtn.onclick) {
                confirmBtn.removeAttribute('onclick');
            }
            
            confirmBtn.setAttribute('data-logout-listener', 'true');
            confirmBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.performLogout();
            });
        }

        // Vincular botones de cancelar en el modal
        const modalElement = document.querySelector(modal);
        if (modalElement) {
            const cancelBtns = modalElement.querySelectorAll('.btn-cancel, .btn-secondary.btn-warning, .btn-warning.btn-secondary, .btn-logout-cancel');
            cancelBtns.forEach(btn => {
                if (!btn.hasAttribute('data-logout-listener')) {
                    if (btn.onclick) {
                        btn.removeAttribute('onclick');
                    }
                    btn.setAttribute('data-logout-listener', 'true');
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.hideConfirmation();
                    });
                }
            });

            // Vincular botones de cerrar (X) en el modal
            const closeBtns = modalElement.querySelectorAll('.close-btn');
            closeBtns.forEach(btn => {
                if (!btn.hasAttribute('data-logout-listener')) {
                    if (btn.onclick) {
                        btn.removeAttribute('onclick');
                    }
                    btn.setAttribute('data-logout-listener', 'true');
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.hideConfirmation();
                    });
                }
            });
        }

        // Cerrar modal con Escape key (solo una vez)
        if (!this._escapeHandler) {
            this._escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    const modalEl = document.querySelector(modal);
                    if (modalEl && modalEl.getAttribute('aria-hidden') !== 'true') {
                        this.hideConfirmation();
                    }
                }
            };
            document.addEventListener('keydown', this._escapeHandler);
        }
        
        // Cerrar modal al hacer click fuera
        if (modalElement && !modalElement.hasAttribute('data-click-outside-handled')) {
            modalElement.setAttribute('data-click-outside-handled', 'true');
            modalElement.addEventListener('click', (e) => {
                if (e.target === modalElement) {
                    this.hideConfirmation();
                }
            });
        }
    },

    // Mostrar modal de confirmación
    showConfirmation() {
        const { modal } = this.config.selectors;
        const modalElement = document.querySelector(modal);
        
        if (modalElement) {
            // Actualizar contenido antes de mostrar
            this.updateModalContent();
            
            // Asegurar que los eventos estén vinculados
            this.bindEvents();
            
            // Mostrar el modal
            modalElement.style.display = 'flex';
            modalElement.setAttribute('aria-hidden', 'false');
        } else {
            // Fallback si el modal no existe
            if (confirm(this.config.messages.confirmMessage)) {
                this.performLogout();
            }
        }
    },

    // Ocultar modal de confirmación
    hideConfirmation() {
        const { modal } = this.config.selectors;
        const modalElement = document.querySelector(modal);
        
        if (modalElement) {
            modalElement.style.display = 'none';
            modalElement.setAttribute('aria-hidden', 'true');
        }
    },

    // Actualizar contenido del modal según configuración
    updateModalContent() {
        const { modal, confirmButton } = this.config.selectors;
        const { messages } = this.config;
        
        const modalElement = document.querySelector(modal);
        if (!modalElement) return;

        // Actualizar título si existe
        const title = modalElement.querySelector('.modal-title, h3, h4');
        if (title) {
            title.textContent = messages.confirmTitle;
        }

        // Actualizar mensaje si existe (solo el primer párrafo principal)
        const message = modalElement.querySelector('.modal-body p:first-of-type, .modal-message, div[style*="padding"] > p:first-of-type');
        if (message) {
            message.textContent = messages.confirmMessage;
        }

        // Actualizar botón de confirmar si existe
        const confirmBtn = modalElement.querySelector(confirmButton);
        if (confirmBtn) {
            confirmBtn.textContent = messages.confirmAction;
        }

        // Vincular botones de cancelar (sin reemplazarlos para mantener event listeners)
        const cancelBtns = modalElement.querySelectorAll('.btn-cancel, .btn-secondary.btn-warning, .btn-warning.btn-secondary, .btn-logout-cancel');
        cancelBtns.forEach(btn => {
            // Solo actualizar botones de cancelar que estén en el modal
            if (btn.closest(modal)) {
                // Actualizar texto si no tiene el texto correcto
                if (btn.textContent.trim() !== messages.cancelAction) {
                    btn.textContent = messages.cancelAction;
                }
                // Remover onclick existente si existe
                if (btn.onclick) {
                    btn.removeAttribute('onclick');
                }
                // Vincular evento solo si no tiene ya un listener
                if (!btn.hasAttribute('data-logout-listener')) {
                    btn.setAttribute('data-logout-listener', 'true');
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.hideConfirmation();
                    });
                }
            }
        });
        
        // Vincular botones de cerrar (X) - sin reemplazarlos
        const closeBtns = modalElement.querySelectorAll('.close-btn');
        closeBtns.forEach(btn => {
            // Solo si está en el modal de logout
            if (btn.closest(modal)) {
                // Remover onclick existente si existe
                if (btn.onclick) {
                    btn.removeAttribute('onclick');
                }
                // Vincular evento solo si no tiene ya un listener
                if (!btn.hasAttribute('data-logout-listener')) {
                    btn.setAttribute('data-logout-listener', 'true');
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.hideConfirmation();
                    });
                }
            }
        });
    },

    // Inyectar modal básico si no existe
    injectModalIfNotExists() {
        const { modal } = this.config.selectors;
        
        if (!document.querySelector(modal)) {
            const modalHTML = `
                <div id="${modal.replace('#', '')}" class="modal" aria-hidden="true" style="display: none;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title">${this.config.messages.confirmTitle}</h3>
                            <button class="close-btn" onclick="SessionController.hideConfirmation()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p>${this.config.messages.confirmMessage}</p>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary btn-cancel">${this.config.messages.cancelAction}</button>
                            <button id="${this.config.selectors.confirmButton.replace('#', '')}" class="btn btn-danger">
                                ${this.config.messages.confirmAction}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Re-vincular eventos después de inyectar
            setTimeout(() => this.bindEvents(), 100);
        }
    },

    // Ejecutar el cierre de sesión
    performLogout() {
        const { storage, redirect } = this.config;
        
        try {
            // Preservar configuración del sistema (como modo debug) antes de limpiar
            const systemConfig = localStorage.getItem('crm.config');
            
            // Limpiar almacenamiento según configuración
            if (storage.clearLocalStorage) {
                localStorage.removeItem(storage.tokenKey);
                // Limpiar otros items específicos pero preservar configuración del sistema
                // Remover solo items relacionados con sesión/usuario
                const keysToRemove = [];
                Object.keys(localStorage).forEach(key => {
                    // Preservar configuración del sistema
                    if (key === 'crm.config') {
                        return; // No remover
                    }
                    // Remover tokens y datos de sesión
                    if (key === storage.tokenKey || key.startsWith('crm.token') || key.startsWith('crm.user')) {
                        keysToRemove.push(key);
                    }
                });
                keysToRemove.forEach(key => localStorage.removeItem(key));
            }
            
            // Restaurar configuración del sistema si existía
            if (systemConfig) {
                localStorage.setItem('crm.config', systemConfig);
            }
            
            if (storage.clearSessionStorage) {
                sessionStorage.clear();
            }
            
            this.hideConfirmation();
            
            // Redireccionar si está habilitado
            if (redirect.enabled) {
                if (redirect.delay > 0) {
                    setTimeout(() => {
                        window.location.replace(redirect.url);
                    }, redirect.delay);
                } else {
                    window.location.replace(redirect.url);
                }
            }
            
        } catch (error) {
            console.error('Error durante el cierre de sesión:', error);
            // Fallback: redirección forzada
            window.location.replace(this.config.redirect.url);
        }
    },

    // Método para cerrar sesión programáticamente
    forceLogout() {
        this.performLogout();
    },

    // Actualizar configuración en tiempo de ejecución
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.bindEvents();
    },

    // Destruir controlador y limpiar eventos
    destroy() {
        const { logoutButton, confirmButton } = this.config.selectors;
        
        const logoutBtn = document.querySelector(logoutButton);
        const confirmBtn = document.querySelector(confirmButton);
        
        if (logoutBtn) {
            logoutBtn.replaceWith(logoutBtn.cloneNode(true));
        }
        
        if (confirmBtn) {
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        }
        
        if (this._escapeHandler) {
            document.removeEventListener('keydown', this._escapeHandler);
            this._escapeHandler = null;
        }
    }
};

// Versión simplificada para uso inmediato
window.SessionController = SessionController;

// Auto-inicialización cuando el DOM está listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        SessionController.init();
    });
} else {
    SessionController.init();
}

// Exportar para módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionController;
}