/**
 * NotificationsManager - Módulo universal para gestionar notificaciones persistentes
 * 
 * Funcionalidades:
 * - Cargar notificaciones no leídas desde la API
 * - Mostrar panel de notificaciones
 * - Marcar notificaciones como leídas
 * - Actualizar contador de no leídas
 * - Integrar con Socket.IO para notificaciones en tiempo real
 */

(function() {
    'use strict';

    const NotificationsManager = {
        unreadCount: 0,
        notifications: [],
        isPanelOpen: false,

        /**
         * Inicializar el gestor de notificaciones
         * @param {number} userId - ID del usuario actual
         * @param {Function} onNotificationClick - Callback cuando se hace clic en una notificación
         */
        init: function(userId, onNotificationClick) {
            this.userId = userId;
            this.onNotificationClick = onNotificationClick || function() {};
            this.setupUI();
            this.loadUnreadNotifications();
            this.setupSocketListeners();
        },

        /**
         * Configurar la UI (botón y panel)
         */
        setupUI: function() {
            // El botón y panel deben estar en el HTML
            const btn = document.getElementById('notificationsBtn');
            const panel = document.getElementById('notificationsPanel');
            
            if (!btn || !panel) {
                console.warn('NotificationsManager: Botón o panel no encontrado en HTML');
                return;
            }

            btn.addEventListener('click', () => this.togglePanel());
            
            // Cerrar panel al hacer clic fuera
            document.addEventListener('click', (e) => {
                if (!panel.contains(e.target) && !btn.contains(e.target)) {
                    this.closePanel();
                }
            });
        },

        /**
         * Cargar notificaciones no leídas desde la API
         */
        loadUnreadNotifications: async function() {
            try {
                const token = localStorage.getItem('crm.token');
                if (!token) {
                    console.warn('NotificationsManager: No hay token de autenticación');
                    return;
                }

                const response = await fetch('/api/notifications/unread', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }

                const notifications = await response.json();
                this.notifications = notifications || [];
                this.unreadCount = this.notifications.length;
                this.updateBadge();
                this.renderNotifications();
            } catch (error) {
                console.error('Error al cargar notificaciones:', error);
            }
        },

        /**
         * Cargar contador de notificaciones no leídas
         */
        loadUnreadCount: async function() {
            try {
                const token = localStorage.getItem('crm.token');
                if (!token) return;

                const response = await fetch('/api/notifications/unread/count', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                this.unreadCount = data.count || 0;
                this.updateBadge();
            } catch (error) {
                console.error('Error al cargar contador de notificaciones:', error);
            }
        },

        /**
         * Marcar una notificación como leída
         */
        markAsRead: async function(notificationId) {
            try {
                const token = localStorage.getItem('crm.token');
                if (!token) return;

                const response = await fetch(`/api/notifications/${notificationId}/read`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }

                // Remover de la lista local
                this.notifications = this.notifications.filter(n => n.id !== notificationId);
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateBadge();
                this.renderNotifications();
            } catch (error) {
                console.error('Error al marcar notificación como leída:', error);
            }
        },

        /**
         * Marcar todas las notificaciones como leídas
         */
        markAllAsRead: async function() {
            try {
                const token = localStorage.getItem('crm.token');
                if (!token) return;

                const response = await fetch('/api/notifications/read-all', {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }

                this.notifications = [];
                this.unreadCount = 0;
                this.updateBadge();
                this.renderNotifications();
            } catch (error) {
                console.error('Error al marcar todas como leídas:', error);
            }
        },

        /**
         * Renderizar notificaciones en el panel
         */
        renderNotifications: function() {
            const panel = document.getElementById('notificationsPanel');
            if (!panel) return;

            const content = panel.querySelector('.notifications-content');
            if (!content) return;

            if (this.notifications.length === 0) {
                content.innerHTML = '<div class="notification-empty">No hay notificaciones nuevas</div>';
                return;
            }

            content.innerHTML = this.notifications.map(notif => {
                const tipoClass = this.getTipoClass(notif.tipoNotificacion);
                const fecha = new Date(notif.fechaCreacion).toLocaleString('es-CL', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return `
                    <div class="notification-item ${tipoClass}" data-id="${notif.id}">
                        <div class="notification-header">
                            <strong>${this.escapeHtml(notif.titulo)}</strong>
                            <button class="notification-close" onclick="NotificationsManager.markAsRead(${notif.id})" title="Marcar como leída">×</button>
                        </div>
                        <div class="notification-body">
                            <p>${this.escapeHtml(notif.mensaje)}</p>
                            <small class="notification-date">${fecha}</small>
                        </div>
                    </div>
                `;
            }).join('');
        },

        /**
         * Obtener clase CSS según tipo de notificación
         */
        getTipoClass: function(tipo) {
            const tipoMap = {
                'success': 'notification-success',
                'error': 'notification-error',
                'DISCREPANCIA_RESUELTA': 'notification-info',
                'info': 'notification-info'
            };
            return tipoMap[tipo] || 'notification-info';
        },

        /**
         * Escapar HTML para prevenir XSS
         */
        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * Manejar clic en notificación
         */
        handleNotificationClick: function(notificationId, entityId, entityType) {
            this.markAsRead(notificationId);
            if (this.onNotificationClick) {
                this.onNotificationClick(entityId, entityType);
            }
        },

        /**
         * Actualizar badge del contador
         */
        updateBadge: function() {
            const badge = document.getElementById('notificationsBadge');
            if (badge) {
                if (this.unreadCount > 0) {
                    badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        },

        /**
         * Abrir panel de notificaciones
         */
        togglePanel: function() {
            const panel = document.getElementById('notificationsPanel');
            if (!panel) return;

            if (this.isPanelOpen) {
                this.closePanel();
            } else {
                this.openPanel();
            }
        },

        /**
         * Abrir panel
         */
        openPanel: function() {
            const panel = document.getElementById('notificationsPanel');
            if (panel) {
                panel.style.display = 'block';
                this.isPanelOpen = true;
                // Recargar notificaciones al abrir
                this.loadUnreadNotifications();
            }
        },

        /**
         * Cerrar panel
         */
        closePanel: function() {
            const panel = document.getElementById('notificationsPanel');
            if (panel) {
                panel.style.display = 'none';
                this.isPanelOpen = false;
            }
        },

        /**
         * Agregar notificación nueva (desde Socket.IO)
         */
        addNotification: function(notification) {
            // Agregar al inicio de la lista
            this.notifications.unshift(notification);
            this.unreadCount++;
            this.updateBadge();
            
            // Si el panel está abierto, actualizar render
            if (this.isPanelOpen) {
                this.renderNotifications();
            }
        },

        /**
         * Configurar listeners de Socket.IO
         */
        setupSocketListeners: function() {
            if (typeof window.io === 'undefined' || !window.io) {
                return;
            }

            // El socket debe estar creado en el dashboard principal
            // Aquí solo nos suscribimos a eventos si el socket ya existe
            // Los dashboards deben pasar el socket o llamar a este método con el socket
        },

        /**
         * Suscribirse a eventos de Socket.IO
         * @param {Socket} socket - Instancia de Socket.IO
         * @param {string} eventName - Nombre del evento (ej: 'mechanic:notification')
         * @param {Function} filterFn - Función para filtrar notificaciones (ej: (data) => data.mechanicId === userId)
         */
        subscribeToSocket: function(socket, eventName, filterFn) {
            if (!socket || !eventName) return;

            socket.on(eventName, (data) => {
                if (filterFn && !filterFn(data)) {
                    return; // No es para este usuario
                }

                // Crear objeto de notificación compatible
                const notification = {
                    id: Date.now(), // Temporal, se actualizará cuando se cargue desde BD
                    titulo: data.titulo,
                    mensaje: data.mensaje,
                    tipoNotificacion: data.tipo,
                    tipoEntidadRelacionada: data.otId ? 'ORDEN_TRABAJO' : null,
                    entidadRelacionadaId: data.otId || null,
                    leida: false,
                    fechaCreacion: new Date().toISOString()
                };

                // Agregar a la lista y actualizar contador
                this.addNotification(notification);
                
                // Recargar desde BD para obtener el ID real
                setTimeout(() => {
                    this.loadUnreadNotifications();
                }, 500);
            });
        }
    };

    // Exportar al scope global
    window.NotificationsManager = NotificationsManager;
})();

