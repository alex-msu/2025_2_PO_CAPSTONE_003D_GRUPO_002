/**
 * ========================================================
 * PAGINATION UTILITIES - Componente Universal de Paginación
 * ========================================================
 * 
 * Componente reutilizable para renderizar controles de paginación
 * y manejar cambios de página.
 */

(function() {
    'use strict';

    /**
     * Crea y renderiza controles de paginación
     * @param {HTMLElement} container - Contenedor donde se renderizará la paginación
     * @param {Object} pagination - Objeto con información de paginación
     * @param {number} pagination.page - Página actual
     * @param {number} pagination.limit - Elementos por página
     * @param {number} pagination.total - Total de elementos
     * @param {number} pagination.totalPages - Total de páginas
     * @param {Function} onPageChange - Callback cuando cambia la página (page) => void
     */
    function createPagination(container, pagination, onPageChange) {
        if (!container || !pagination || !onPageChange) {
            console.warn('createPagination: parámetros inválidos');
            return;
        }

        const { page, limit, total, totalPages } = pagination;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        // Calcular rango de páginas a mostrar (máximo 7 números)
        const maxVisible = 7;
        let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        // Ajustar inicio si estamos cerca del final
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        // Construir HTML
        let html = '<div class="pagination-container" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; flex-wrap: wrap;">';

        // Botón Anterior
        html += `<button class="pagination-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} style="padding: 8px 12px; border: 1px solid #ddd; background: ${page <= 1 ? '#f5f5f5' : '#fff'}; color: ${page <= 1 ? '#999' : '#333'}; cursor: ${page <= 1 ? 'not-allowed' : 'pointer'}; border-radius: 4px; font-size: 14px;">Anterior</button>`;

        // Primera página si no está visible
        if (startPage > 1) {
            html += `<button class="pagination-btn" data-page="1" style="padding: 8px 12px; border: 1px solid #ddd; background: #fff; color: #333; cursor: pointer; border-radius: 4px; font-size: 14px;">1</button>`;
            if (startPage > 2) {
                html += '<span style="padding: 8px 4px; color: #999;">...</span>';
            }
        }

        // Números de página
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === page;
            html += `<button class="pagination-btn" data-page="${i}" style="padding: 8px 12px; border: 1px solid ${isActive ? '#007bff' : '#ddd'}; background: ${isActive ? '#007bff' : '#fff'}; color: ${isActive ? '#fff' : '#333'}; cursor: pointer; border-radius: 4px; font-size: 14px; font-weight: ${isActive ? 'bold' : 'normal'};">${i}</button>`;
        }

        // Última página si no está visible
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += '<span style="padding: 8px 4px; color: #999;">...</span>';
            }
            html += `<button class="pagination-btn" data-page="${totalPages}" style="padding: 8px 12px; border: 1px solid #ddd; background: #fff; color: #333; cursor: pointer; border-radius: 4px; font-size: 14px;">${totalPages}</button>`;
        }

        // Botón Siguiente
        html += `<button class="pagination-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''} style="padding: 8px 12px; border: 1px solid #ddd; background: ${page >= totalPages ? '#f5f5f5' : '#fff'}; color: ${page >= totalPages ? '#999' : '#333'}; cursor: ${page >= totalPages ? 'not-allowed' : 'pointer'}; border-radius: 4px; font-size: 14px;">Siguiente</button>`;

        // Información de rango
        const startItem = (page - 1) * limit + 1;
        const endItem = Math.min(page * limit, total);
        html += `<span style="margin-left: 16px; color: #666; font-size: 14px;">Mostrando ${startItem}-${endItem} de ${total}</span>`;

        html += '</div>';

        container.innerHTML = html;

        // Agregar event listeners a los botones
        const buttons = container.querySelectorAll('.pagination-btn:not([disabled])');
        buttons.forEach(btn => {
            btn.addEventListener('click', function() {
                const newPage = parseInt(this.getAttribute('data-page'), 10);
                if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
                    onPageChange(newPage);
                }
            });
        });
    }

    // Exportar funciones
    window.PaginationUtils = {
        createPagination: createPagination
    };

})();

