/**
 * ========================================================
 * MÓDULO DE VALIDACIONES CENTRALIZADO
 * ========================================================
 * 
 * Este módulo proporciona funciones centralizadas para validaciones
 * del frontend, mejorando mantenibilidad y consistencia.
 * 
 * USO:
 *   <script src="assets/js/validations.js"></script>
 *   <script>
 *     // Validar campo requerido
 *     const result = ValidationUtils.validateRequired(input.value, 'Diagnóstico');
 *     if (!result.valid) {
 *       flashMessage(msgEl, 'bad', result.message);
 *       return;
 *     }
 *   </script>
 */

(function() {
    'use strict';

    // ========= VALIDACIONES GENÉRICAS =========

    /**
     * Utilidades de validación genéricas
     */
    var ValidationUtils = {
        /**
         * Valida que un campo sea requerido (no vacío)
         * @param {*} value - Valor a validar
         * @param {string} fieldName - Nombre del campo (para mensaje de error)
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateRequired: function(value, fieldName) {
            fieldName = fieldName || 'Campo';
            if (value === null || value === undefined || value === '') {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' es requerido.'
                };
            }
            if (typeof value === 'string' && value.trim() === '') {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' es requerido.'
                };
            }
            return { valid: true };
        },

        /**
         * Valida que un valor sea un número válido
         * @param {*} value - Valor a validar
         * @param {Object} options - Opciones de validación
         * @param {string} options.fieldName - Nombre del campo
         * @param {number} options.min - Valor mínimo
         * @param {number} options.max - Valor máximo
         * @param {boolean} options.required - Si es requerido
         * @returns {Object} { valid: boolean, message?: string, value?: number }
         */
        validateNumber: function(value, options) {
            options = options || {};
            var fieldName = options.fieldName || 'Campo numérico';
            var min = options.min;
            var max = options.max;
            var required = options.required !== false; // Por defecto requerido

            // Validar requerido
            if (required) {
                var requiredResult = this.validateRequired(value, fieldName);
                if (!requiredResult.valid) {
                    return requiredResult;
                }
            } else if (value === null || value === undefined || value === '') {
                return { valid: true, value: null };
            }

            // Convertir a número
            var numValue = Number(value);
            if (isNaN(numValue)) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' debe ser un número válido.'
                };
            }

            // Validar mínimo
            if (min !== undefined && numValue < min) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' debe ser mayor o igual a ' + min + '.'
                };
            }

            // Validar máximo
            if (max !== undefined && numValue > max) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' debe ser menor o igual a ' + max + '.'
                };
            }

            return { valid: true, value: numValue };
        },

        /**
         * Valida que un valor sea una fecha válida
         * @param {*} value - Valor a validar (string o Date)
         * @param {Object} options - Opciones de validación
         * @param {string} options.fieldName - Nombre del campo
         * @param {Date} options.minDate - Fecha mínima permitida
         * @param {Date} options.maxDate - Fecha máxima permitida
         * @param {boolean} options.required - Si es requerido
         * @returns {Object} { valid: boolean, message?: string, value?: Date }
         */
        validateDate: function(value, options) {
            options = options || {};
            var fieldName = options.fieldName || 'Fecha';
            var minDate = options.minDate;
            var maxDate = options.maxDate;
            var required = options.required !== false; // Por defecto requerido

            // Validar requerido
            if (required) {
                var requiredResult = this.validateRequired(value, fieldName);
                if (!requiredResult.valid) {
                    return requiredResult;
                }
            } else if (value === null || value === undefined || value === '') {
                return { valid: true, value: null };
            }

            // Convertir a Date
            var dateValue = new Date(value);
            if (isNaN(dateValue.getTime())) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' es inválida.'
                };
            }

            // Validar fecha mínima
            if (minDate && dateValue < minDate) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' debe ser posterior a ' + minDate.toLocaleDateString('es-CL') + '.'
                };
            }

            // Validar fecha máxima
            if (maxDate && dateValue > maxDate) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' debe ser anterior a ' + maxDate.toLocaleDateString('es-CL') + '.'
                };
            }

            return { valid: true, value: dateValue };
        },

        /**
         * Valida longitud mínima de un string
         * @param {string} value - Valor a validar
         * @param {number} min - Longitud mínima
         * @param {string} fieldName - Nombre del campo
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateMinLength: function(value, min, fieldName) {
            fieldName = fieldName || 'Campo';
            if (!value || typeof value !== 'string') {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' debe ser un texto válido.'
                };
            }
            if (value.trim().length < min) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' debe tener al menos ' + min + ' caracteres.'
                };
            }
            return { valid: true };
        },

        /**
         * Valida longitud máxima de un string
         * @param {string} value - Valor a validar
         * @param {number} max - Longitud máxima
         * @param {string} fieldName - Nombre del campo
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateMaxLength: function(value, max, fieldName) {
            fieldName = fieldName || 'Campo';
            if (!value || typeof value !== 'string') {
                return { valid: true }; // No validamos si está vacío (eso es validateRequired)
            }
            if (value.length > max) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ' no puede exceder ' + max + ' caracteres.'
                };
            }
            return { valid: true };
        },

        /**
         * Valida que un valor esté dentro de un rango numérico
         * @param {number} value - Valor a validar
         * @param {number} min - Valor mínimo
         * @param {number} max - Valor máximo
         * @param {string} fieldName - Nombre del campo
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateRange: function(value, min, max, fieldName) {
            return this.validateNumber(value, {
                fieldName: fieldName,
                min: min,
                max: max
            });
        },

        /**
         * Formatos de archivo permitidos para evidencias y documentos
         */
        ALLOWED_FILE_TYPES: {
            mimeTypes: [
                'image/jpeg',      // JPG, JPEG
                'image/png',       // PNG
                'image/webp',      // WEBP
                'application/pdf', // PDF
                'text/plain',      // TXT
                'application/msword', // DOC
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
            ],
            extensions: [
                'jpg',
                'jpeg',
                'png',
                'webp',
                'pdf',
                'txt',
                'doc',
                'docx'
            ]
        },

        /**
         * Valida que un archivo tenga un tipo permitido
         * @param {File|string} file - Archivo (File object) o MIME type (string)
         * @param {Object} options - Opciones de validación
         * @param {string} options.fieldName - Nombre del campo (para mensaje de error)
         * @param {Array<string>} options.allowedTypes - Tipos MIME permitidos (opcional, usa los por defecto si no se especifica)
         * @returns {Object} { valid: boolean, message?: string, mimeType?: string, extension?: string }
         */
        validateFileType: function(file, options) {
            options = options || {};
            var fieldName = options.fieldName || 'Archivo';
            var allowedMimeTypes = options.allowedTypes || this.ALLOWED_FILE_TYPES.mimeTypes;
            var allowedExtensions = options.allowedExtensions || this.ALLOWED_FILE_TYPES.extensions;

            var mimeType = null;
            var fileName = null;
            var extension = null;

            // Si es un File object
            if (file && typeof file === 'object' && file instanceof File) {
                mimeType = file.type || '';
                fileName = file.name || '';
                
                // Obtener extensión del nombre del archivo
                if (fileName) {
                    var parts = fileName.split('.');
                    if (parts.length > 1) {
                        extension = parts[parts.length - 1].toLowerCase();
                    }
                }
            } 
            // Si es un string (MIME type directo)
            else if (typeof file === 'string') {
                mimeType = file;
            }
            // Si no es válido
            else {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ': Tipo de archivo inválido.'
                };
            }

            // Normalizar MIME type (remover parámetros como charset)
            if (mimeType) {
                mimeType = mimeType.toLowerCase().split(';')[0].trim();
            }

            // Validar MIME type
            var isValidMimeType = false;
            if (mimeType && allowedMimeTypes.includes(mimeType)) {
                isValidMimeType = true;
            }

            // Validar extensión si está disponible
            var isValidExtension = false;
            if (extension && allowedExtensions.includes(extension)) {
                isValidExtension = true;
            }

            // Si tenemos MIME type, validar por MIME type
            if (mimeType) {
                if (!isValidMimeType) {
                    var allowedFormats = allowedExtensions.map(function(ext) { return ext.toUpperCase(); }).join(', ');
                    return {
                        valid: false,
                        message: '❌ ' + fieldName + ': Tipo de archivo no permitido. Formatos permitidos: ' + allowedFormats + '. Tipo recibido: ' + mimeType,
                        mimeType: mimeType,
                        extension: extension
                    };
                }
            }
            // Si no tenemos MIME type pero tenemos extensión, validar por extensión
            else if (extension) {
                if (!isValidExtension) {
                    var allowedFormats = allowedExtensions.map(function(ext) { return ext.toUpperCase(); }).join(', ');
                    return {
                        valid: false,
                        message: '❌ ' + fieldName + ': Tipo de archivo no permitido. Formatos permitidos: ' + allowedFormats + '. Extensión recibida: .' + extension,
                        mimeType: mimeType,
                        extension: extension
                    };
                }
            }
            // Si no tenemos ni MIME type ni extensión
            else {
                var allowedFormats = allowedExtensions.map(function(ext) { return ext.toUpperCase(); }).join(', ');
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ': No se pudo determinar el tipo de archivo. Formatos permitidos: ' + allowedFormats,
                    mimeType: mimeType,
                    extension: extension
                };
            }

            return {
                valid: true,
                mimeType: mimeType,
                extension: extension
            };
        },

        /**
         * Valida múltiples archivos
         * @param {FileList|Array<File>} files - Lista de archivos a validar
         * @param {Object} options - Opciones de validación
         * @param {string} options.fieldName - Nombre del campo
         * @param {number} options.maxFiles - Número máximo de archivos (opcional)
         * @param {Array<string>} options.allowedTypes - Tipos MIME permitidos (opcional)
         * @returns {Object} { valid: boolean, message?: string, errors?: Array }
         */
        validateFileList: function(files, options) {
            options = options || {};
            var fieldName = options.fieldName || 'Archivos';
            var maxFiles = options.maxFiles;
            var errors = [];

            if (!files || files.length === 0) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ': Debes seleccionar al menos un archivo.'
                };
            }

            // Convertir FileList a Array si es necesario
            var fileArray = Array.isArray(files) ? files : Array.from(files);

            // Validar número máximo de archivos
            if (maxFiles && fileArray.length > maxFiles) {
                return {
                    valid: false,
                    message: '❌ ' + fieldName + ': No se pueden seleccionar más de ' + maxFiles + ' archivo' + (maxFiles > 1 ? 's' : '') + '.'
                };
            }

            // Validar cada archivo
            for (var i = 0; i < fileArray.length; i++) {
                var file = fileArray[i];
                var result = this.validateFileType(file, {
                    fieldName: fieldName + ' #' + (i + 1),
                    allowedTypes: options.allowedTypes,
                    allowedExtensions: options.allowedExtensions
                });
                
                if (!result.valid) {
                    errors.push({
                        index: i,
                        fileName: file.name || 'Archivo sin nombre',
                        message: result.message
                    });
                }
            }

            if (errors.length > 0) {
                return {
                    valid: false,
                    message: errors[0].message,
                    errors: errors
                };
            }

            return { valid: true };
        },

        /**
         * Helper para manejar el cambio de archivos en un input file
         * Valida los archivos, muestra errores si es necesario, y retorna los archivos válidos o null
         * @param {Event} ev - Evento de change del input file
         * @param {Object} options - Opciones de configuración
         * @param {string} options.fieldName - Nombre del campo (para mensajes)
         * @param {number} options.maxFiles - Número máximo de archivos permitidos
         * @param {Function} options.onEmpty - Callback cuando no hay archivos (opcional)
         * @param {Function} options.onError - Callback cuando hay error (opcional, recibe el mensaje)
         * @param {Function} options.onClear - Callback para limpiar estado cuando hay error (opcional)
         * @returns {Array<File>|null} - Array de archivos válidos o null si hay error
         */
        /**
         * Helper universal para manejar el evento 'change' de inputs de archivo
         * Centraliza toda la lógica de validación, limpieza y callbacks
         * @param {Event} ev - Evento de change del input file
         * @param {Object} options - Opciones de configuración
         * @param {string} options.fieldName - Nombre del campo (para mensajes de error)
         * @param {number} options.maxFiles - Número máximo de archivos permitidos (opcional)
         * @param {Function} options.onEmpty - Callback cuando no hay archivos: function() {}
         * @param {Function} options.onError - Callback cuando hay error: function(errorMessage) {}
         * @param {Function} options.onClear - Callback para limpiar estado cuando hay error: function() {}
         * @param {Function} options.onSuccess - Callback cuando los archivos son válidos: function(validFiles) {}
         * @param {boolean} options.allowEmpty - Si true, permite array vacío sin error (default: false)
         * @returns {Array<File>|null} - Array de archivos válidos, array vacío si no hay archivos, o null si hay error
         */
        handleFileInputChange: function(ev, options) {
            options = options || {};
            var input = ev && ev.target ? ev.target : null;
            if (!input) {
                console.error('[ValidationUtils.handleFileInputChange] Evento o input no válido');
                return null;
            }

            var files = Array.from(input.files || []);
            var fieldName = options.fieldName || 'Archivos';
            var maxFiles = options.maxFiles;
            var allowEmpty = options.allowEmpty === true;

            // Si no hay archivos
            if (!files.length) {
                if (typeof options.onEmpty === 'function') {
                    options.onEmpty();
                }
                return allowEmpty ? [] : null;
            }

            // Validar tipos de archivo permitidos
            var validationResult = this.validateFileList(files, {
                fieldName: fieldName,
                maxFiles: maxFiles
            });

            // Si hay error de validación
            if (!validationResult.valid) {
                // Mostrar error
                var errorMessage = validationResult.message || 'Error al validar archivos';
                if (typeof options.onError === 'function') {
                    options.onError(errorMessage);
                } else {
                    alert(errorMessage);
                }
                
                // Limpiar input
                input.value = '';
                
                // Limpiar estado si hay callback
                if (typeof options.onClear === 'function') {
                    options.onClear();
                }
                
                return null;
            }

            // Limitar a maxFiles si se especificó y hay más archivos
            if (maxFiles && files.length > maxFiles) {
                var warningMsg = 'Solo se procesarán los primeros ' + maxFiles + ' archivo' + (maxFiles > 1 ? 's' : '') + '.';
                if (typeof options.onError === 'function') {
                    options.onError(warningMsg);
                }
                files = files.slice(0, maxFiles);
            }

            // Archivos válidos - llamar callback de éxito si existe
            if (typeof options.onSuccess === 'function') {
                options.onSuccess(files);
            }

            return files;
        }
    };

    // ========= VALIDACIONES ESPECÍFICAS DEL DOMINIO =========

    /**
     * Validaciones específicas para el dominio del CRM
     */
    var DomainValidations = {
        /**
         * Valida un checklist de diagnóstico
         * @param {Object} checklist - Datos del checklist
         * @param {boolean} checklist.inspeccionVisual - Inspección visual realizada
         * @param {boolean} checklist.escanerElectronico - Escáner electrónico realizado
         * @param {boolean} checklist.pruebaRuta - Prueba en ruta realizada
         * @param {boolean} checklist.seguridadOperativa - Sistemas de seguridad verificados
         * @param {boolean} checklist.checklistCompleto - Checklist marcado como completo
         * @param {string} fieldName - Nombre del campo (para mensajes de error)
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateDiagnosticChecklist: function(checklist, fieldName) {
            fieldName = fieldName || 'Checklist de diagnóstico';
            checklist = checklist || {};
            
            var hasAnyItem = !!(checklist.inspeccionVisual || 
                                checklist.escanerElectronico || 
                                checklist.pruebaRuta || 
                                checklist.seguridadOperativa);
            var isComplete = !!checklist.checklistCompleto;
            
            // El checklist es obligatorio: debe estar marcado "Checklist completo" o al menos un item
            if (!isComplete && !hasAnyItem) {
                return {
                    valid: false,
                    message: '❌ Debes marcar al menos un item del ' + fieldName.toLowerCase() + ' o marcar "Checklist completo" para continuar.'
                };
            }
            
            return { valid: true };
        },

        /**
         * Valida un diagnóstico inicial completo
         * @param {Object} data - Datos del diagnóstico
         * @param {string} data.fechaInicio - Fecha y hora de inicio
         * @param {string} data.diagnosticoInicial - Diagnóstico inicial
         * @param {boolean} data.discrepanciaDiagnostico - Si hay discrepancia
         * @param {string} data.discrepanciaDiagnosticoDetalle - Detalle de discrepancia
         * @param {string} data.prioridadDiagnosticada - Prioridad diagnosticada
         * @param {number} data.taskId - ID de la OT
         * @param {Object} data.checklist - Checklist de diagnóstico (opcional)
         * @param {boolean} data.checklistCompleto - Si el checklist está completo (opcional)
         * @returns {Object} { valid: boolean, message?: string, errors?: Array }
         */
        validateDiagnostico: function(data) {
            var errors = [];

            // Validar checklist PRIMERO si está presente (es obligatorio)
            if (data.checklist !== undefined || data.checklistCompleto !== undefined) {
                var checklistData = {
                    inspeccionVisual: !!(data.checklist && data.checklist.inspeccionVisual),
                    escanerElectronico: !!(data.checklist && data.checklist.escanerElectronico),
                    pruebaRuta: !!(data.checklist && data.checklist.pruebaRuta),
                    seguridadOperativa: !!(data.checklist && data.checklist.seguridadOperativa),
                    checklistCompleto: !!data.checklistCompleto
                };
                var checklistResult = this.validateDiagnosticChecklist(checklistData, 'Checklist de diagnóstico');
                if (!checklistResult.valid) {
                    errors.push(checklistResult.message);
                }
            }

            // Validar taskId
            var taskIdResult = ValidationUtils.validateRequired(data.taskId, 'OT');
            if (!taskIdResult.valid) {
                errors.push(taskIdResult.message);
            }

            // Validar fecha de inicio
            var fechaResult = ValidationUtils.validateDate(data.fechaInicio, {
                fieldName: 'Fecha y hora de inicio',
                required: true
            });
            if (!fechaResult.valid) {
                errors.push(fechaResult.message);
            }

            // Validar diagnóstico inicial
            var diagResult = ValidationUtils.validateRequired(data.diagnosticoInicial, 'Diagnóstico inicial');
            if (!diagResult.valid) {
                errors.push(diagResult.message);
            }

            // Validar que se haya indicado discrepancia
            if (data.discrepanciaDiagnostico === null || data.discrepanciaDiagnostico === undefined) {
                errors.push('❌ Debes indicar si hay discrepancia.');
            }

            // Validar detalle de discrepancia si hay discrepancia
            if (data.discrepanciaDiagnostico === true) {
                var detalleResult = ValidationUtils.validateRequired(
                    data.discrepanciaDiagnosticoDetalle,
                    'Detalle de discrepancia'
                );
                if (!detalleResult.valid) {
                    errors.push(detalleResult.message);
                }

                // Validar prioridad diagnosticada si hay discrepancia
                var prioridadResult = ValidationUtils.validateRequired(
                    data.prioridadDiagnosticada,
                    'Prioridad diagnosticada'
                );
                if (!prioridadResult.valid) {
                    errors.push('❌ Debes seleccionar una prioridad diagnosticada cuando hay discrepancia.');
                }
            }

            if (errors.length > 0) {
                return {
                    valid: false,
                    message: errors[0], // Primera validación que falla
                    errors: errors
                };
            }

            return { valid: true };
        },

        /**
         * Valida una solicitud de repuestos
         * @param {Object} data - Datos de la solicitud
         * @param {number} data.orden_trabajo_id - ID de la OT
         * @param {number} data.repuesto_id - ID del repuesto
         * @param {number} data.cantidad_solicitada - Cantidad solicitada
         * @param {string} data.urgencia - Urgencia (NORMAL o URGENTE)
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateSolicitudRepuesto: function(data) {
            // Validar OT
            var otResult = ValidationUtils.validateRequired(data.orden_trabajo_id, 'OT');
            if (!otResult.valid) {
                return otResult;
            }

            // Validar repuesto
            var repuestoResult = ValidationUtils.validateRequired(data.repuesto_id, 'Repuesto');
            if (!repuestoResult.valid) {
                return repuestoResult;
            }

            // Validar cantidad
            var cantidadResult = ValidationUtils.validateNumber(data.cantidad_solicitada, {
                fieldName: 'Cantidad',
                min: 1,
                required: true
            });
            if (!cantidadResult.valid) {
                return cantidadResult;
            }

            // Validar urgencia (opcional, por defecto NORMAL)
            if (data.urgencia && !['NORMAL', 'URGENTE'].includes(data.urgencia)) {
                return {
                    valid: false,
                    message: '❌ Urgencia debe ser NORMAL o URGENTE.'
                };
            }

            return { valid: true };
        },

        /**
         * Valida datos de inventario
         * @param {Object} data - Datos del inventario
         * @param {number} data.cantidad_disponible - Cantidad disponible
         * @param {number} data.nivel_minimo_stock - Nivel mínimo de stock
         * @param {number} data.nivel_maximo_stock - Nivel máximo de stock
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateInventario: function(data) {
            var errors = [];

            // Validar cantidad disponible
            var cantidadResult = ValidationUtils.validateNumber(data.cantidad_disponible, {
                fieldName: 'Cantidad disponible',
                min: 0,
                required: true
            });
            if (!cantidadResult.valid) {
                errors.push(cantidadResult.message);
            }

            // Validar nivel mínimo
            var minResult = ValidationUtils.validateNumber(data.nivel_minimo_stock, {
                fieldName: 'Nivel mínimo',
                min: 0,
                required: true
            });
            if (!minResult.valid) {
                errors.push(minResult.message);
            }

            // Validar nivel máximo
            var maxResult = ValidationUtils.validateNumber(data.nivel_maximo_stock, {
                fieldName: 'Nivel máximo',
                min: 0,
                required: true
            });
            if (!maxResult.valid) {
                errors.push(maxResult.message);
            }

            // Validar que máximo >= mínimo
            if (minResult.valid && maxResult.valid) {
                if (maxResult.value < minResult.value) {
                    errors.push('❌ El nivel máximo debe ser mayor o igual al nivel mínimo.');
                }
            }

            // Validar que cantidad disponible <= nivel máximo
            if (cantidadResult.valid && maxResult.valid) {
                if (cantidadResult.value > maxResult.value) {
                    errors.push('❌ La cantidad disponible no puede superar el nivel máximo permitido.');
                }
            }

            if (errors.length > 0) {
                return {
                    valid: false,
                    message: errors[0],
                    errors: errors
                };
            }

            return { valid: true };
        },

        /**
         * Valida un movimiento de inventario
         * @param {Object} data - Datos del movimiento
         * @param {number} data.repuesto_id - ID del repuesto
         * @param {string} data.tipo_movimiento - Tipo (ENTRADA, SALIDA, AJUSTE)
         * @param {number} data.cantidad - Cantidad
         * @param {Object} data.inventario_actual - Información del inventario actual (opcional)
         * @param {number} data.inventario_actual.cantidad_disponible - Cantidad disponible actual
         * @param {number} data.inventario_actual.nivel_maximo_stock - Nivel máximo de stock
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateMovimiento: function(data) {
            var errors = [];

            // Validar repuesto
            var repuestoResult = ValidationUtils.validateRequired(data.repuesto_id, 'Repuesto');
            if (!repuestoResult.valid) {
                errors.push(repuestoResult.message);
            }

            // Validar tipo de movimiento
            if (!data.tipo_movimiento || !['ENTRADA', 'SALIDA', 'AJUSTE'].includes(data.tipo_movimiento)) {
                errors.push('❌ Debes seleccionar un tipo de movimiento válido.');
            }

            // Validar cantidad
            var cantidadResult = ValidationUtils.validateNumber(data.cantidad, {
                fieldName: 'Cantidad',
                min: 1,
                required: true
            });
            if (!cantidadResult.valid) {
                errors.push(cantidadResult.message);
                // Si no hay cantidad válida, no continuar con otras validaciones
                if (errors.length > 0) {
                    return {
                        valid: false,
                        message: errors[0],
                        errors: errors
                    };
                }
            }

            // Si tenemos información del inventario actual, validar límites de stock
            if (data.inventario_actual && cantidadResult.valid) {
                var inventarioActual = data.inventario_actual;
                var cantidadDisponible = inventarioActual.cantidad_disponible || 0;
                var nivelMaximo = inventarioActual.nivel_maximo_stock;
                var cantidadMovimiento = cantidadResult.value;
                var tipoMovimiento = data.tipo_movimiento;

                // Validar que el inventario actual tenga nivel máximo definido
                if (nivelMaximo === undefined || nivelMaximo === null) {
                    // Si no hay nivel máximo, no validar límites (puede ser un repuesto nuevo)
                    // Esto permite continuar sin error
                } else {
                    // Calcular el stock resultante después del movimiento
                    var stockResultante = cantidadDisponible;
                    
                    if (tipoMovimiento === 'ENTRADA') {
                        // ENTRADA: suma la cantidad
                        stockResultante = cantidadDisponible + cantidadMovimiento;
                        // Validar que no exceda el máximo
                        if (stockResultante > nivelMaximo) {
                            errors.push('❌ El movimiento excedería el nivel máximo de stock (' + nivelMaximo + '). Stock actual: ' + cantidadDisponible + ', resultado: ' + stockResultante + '.');
                        }
                    } else if (tipoMovimiento === 'AJUSTE') {
                        // Si el ajuste aumenta el stock (es positivo), validar que no exceda el máximo
                        stockResultante = cantidadDisponible + cantidadMovimiento;
                        if (cantidadMovimiento > 0) {
                            // Ajuste positivo (aumenta stock) - validar máximo
                            if (stockResultante > nivelMaximo) {
                                errors.push('❌ El movimiento excedería el nivel máximo de stock (' + nivelMaximo + '). Stock actual: ' + cantidadDisponible + ', resultado: ' + stockResultante + '.');
                            }
                        } else if (cantidadMovimiento < 0) {
                            // Ajuste negativo (reduce stock) - validar que no resulte en stock negativo
                            if (stockResultante < 0) {
                                errors.push('❌ El movimiento resultaría en stock negativo. Stock actual: ' + cantidadDisponible + ', cantidad a ajustar: ' + cantidadMovimiento + '.');
                            }
                        }
                    } else if (tipoMovimiento === 'SALIDA') {
                        // SALIDA: no puede resultar en stock negativo
                        stockResultante = cantidadDisponible - cantidadMovimiento;
                        if (stockResultante < 0) {
                            errors.push('❌ El movimiento resultaría en stock negativo. Stock actual: ' + cantidadDisponible + ', cantidad a salir: ' + cantidadMovimiento + '.');
                        }
                    }
                }
            }

            if (errors.length > 0) {
                return {
                    valid: false,
                    message: errors[0],
                    errors: errors
                };
            }

            return { valid: true };
        },

        /**
         * Valida múltiples solicitudes de repuestos (para formulario con filas)
         * @param {Array} solicitudes - Array de solicitudes
         * @returns {Object} { valid: boolean, message?: string, errors?: Array }
         */
        validateSolicitudesRepuestos: function(solicitudes) {
            if (!solicitudes || solicitudes.length === 0) {
                return {
                    valid: false,
                    message: 'Debes agregar al menos un repuesto'
                };
            }

            var errors = [];
            for (var i = 0; i < solicitudes.length; i++) {
                var solicitud = solicitudes[i];
                var result = this.validateSolicitudRepuesto(solicitud);
                if (!result.valid) {
                    errors.push({
                        index: i,
                        message: result.message
                    });
                }
            }

            if (errors.length > 0) {
                return {
                    valid: false,
                    message: errors[0].message,
                    errors: errors
                };
            }

            return { valid: true };
        }
    };

    // ========= EXPORTAR FUNCIONES PÚBLICAS =========

    // Exportar como objetos globales
    window.ValidationUtils = ValidationUtils;
    window.DomainValidations = DomainValidations;

    // También exportar funciones individuales para facilidad de uso
    window.validateRequired = function(value, fieldName) {
        return ValidationUtils.validateRequired(value, fieldName);
    };

    window.validateNumber = function(value, options) {
        return ValidationUtils.validateNumber(value, options);
    };

    window.validateDate = function(value, options) {
        return ValidationUtils.validateDate(value, options);
    };

    window.validateDiagnostico = function(data) {
        return DomainValidations.validateDiagnostico(data);
    };

    window.validateDiagnosticChecklist = function(checklist, fieldName) {
        return DomainValidations.validateDiagnosticChecklist(checklist, fieldName);
    };

    window.validateSolicitudRepuesto = function(data) {
        return DomainValidations.validateSolicitudRepuesto(data);
    };

    window.validateInventario = function(data) {
        return DomainValidations.validateInventario(data);
    };

    window.validateMovimiento = function(data) {
        return DomainValidations.validateMovimiento(data);
    };

    window.validateFileType = function(file, options) {
        return ValidationUtils.validateFileType(file, options);
    };

    window.validateFileList = function(files, options) {
        return ValidationUtils.validateFileList(files, options);
    };

    window.handleFileInputChange = function(ev, options) {
        return ValidationUtils.handleFileInputChange(ev, options);
    };

})();

