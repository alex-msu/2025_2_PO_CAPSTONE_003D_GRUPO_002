/**
 * ========================================================
 * MÓDULO DE UTILIDADES DE ARCHIVOS
 * ========================================================
 * 
 * Este módulo proporciona funciones centralizadas para:
 * - Comprimir imágenes antes de convertirlas a base64
 * - Validar archivos
 * - Convertir archivos a base64 (con compresión opcional)
 * 
 * USO:
 *   <script src="assets/js/file-utils.js"></script>
 *   <script>
 *     // Comprimir imagen antes de convertir a base64
 *     FileUtils.compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.8 })
 *       .then(function(base64) {
 *         console.log('Imagen comprimida:', base64);
 *       });
 *   </script>
 */

(function() {
    'use strict';

    // ========= UTILIDADES DE ARCHIVOS =========

    /**
     * Detectar si el navegador es Firefox/LibreWolf
     * Estos navegadores pueden tener problemas con canvas.toDataURL() debido a protecciones de privacidad
     */
    function isFirefoxBased() {
        var userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return /firefox|librewolf/i.test(userAgent) && !/seamonkey/i.test(userAgent);
    }

    /**
     * Utilidades para manejo de archivos
     */
    var FileUtils = {
        /**
         * Comprime una imagen usando Canvas API
         * @param {File} file - Archivo de imagen a comprimir
         * @param {Object} options - Opciones de compresión
         * @param {number} options.maxWidth - Ancho máximo (default: 1920)
         * @param {number} options.maxHeight - Alto máximo (default: 1920)
         * @param {number} options.quality - Calidad JPEG (0-1, default: 0.8)
         * @returns {Promise<string>} Promise que resuelve con base64 comprimido
         */
        compressImage: function(file, options) {
            options = options || {};
            var maxWidth = options.maxWidth || 1920;
            var maxHeight = options.maxHeight || 1920;
            var quality = options.quality !== undefined ? options.quality : 0.8;

            return new Promise(function(resolve, reject) {
                // Detectar tipo MIME del archivo
                var fileMimeType = file.type;
                
                // Si no hay tipo MIME, intentar detectarlo por la extensión del nombre del archivo
                if (!fileMimeType && file.name) {
                    var ext = file.name.split('.').pop().toLowerCase();
                    var mimeMap = {
                        'jpg': 'image/jpeg',
                        'jpeg': 'image/jpeg',
                        'png': 'image/png',
                        'webp': 'image/webp',
                        'gif': 'image/gif'
                    };
                    fileMimeType = mimeMap[ext];
                }
                
                // Si no es una imagen, usar archivo original sin comprimir
                if (!fileMimeType || !fileMimeType.startsWith('image/')) {
                    // Para archivos que no son imágenes, leer sin comprimir
                    return FileUtils.fileToBase64(file, false)
                        .then(resolve)
                        .catch(reject);
                }

                // Crear imagen para cargar el archivo
                var img = new Image();
                img.onload = function() {
                    try {
                        // Calcular dimensiones manteniendo aspecto
                        var width = img.width;
                        var height = img.height;

                        if (width > maxWidth || height > maxHeight) {
                            var ratio = Math.min(maxWidth / width, maxHeight / height);
                            width = width * ratio;
                            height = height * ratio;
                        }

                        // Crear canvas y dibujar imagen redimensionada
                        var canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;

                        var ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Determinar formato de salida preservando el formato original cuando sea posible
                        // Usar el tipo MIME detectado anteriormente o el del archivo
                        var mimeType = fileMimeType || file.type || 'image/jpeg';
                        var outputFormat = 'image/jpeg'; // Por defecto JPEG para mejor compresión
                        
                        // Preservar formato original para formatos compatibles
                        if (mimeType === 'image/png') {
                            // Para PNG, verificar si tiene transparencia
                            // Si tiene transparencia, mantener PNG, sino convertir a JPEG para mejor compresión
                            if (FileUtils.hasTransparency(file)) {
                                outputFormat = 'image/png';
                            } else {
                                // PNG sin transparencia puede convertirse a JPEG con mejor compresión
                                outputFormat = 'image/jpeg';
                            }
                        } else if (mimeType === 'image/webp') {
                            // Preservar WEBP si el navegador lo soporta
                            // Verificar soporte de WEBP antes de usarlo
                            var supportsWebP = false;
                            try {
                                // Crear un canvas pequeño para probar soporte de WEBP
                                var testCanvas = document.createElement('canvas');
                                testCanvas.width = 1;
                                testCanvas.height = 1;
                                var testDataUrl = testCanvas.toDataURL('image/webp');
                                // Si no se lanzó error y el resultado contiene 'webp', está soportado
                                supportsWebP = testDataUrl.indexOf('webp') !== -1;
                            } catch (e) {
                                supportsWebP = false;
                            }
                            
                            if (supportsWebP) {
                                outputFormat = 'image/webp';
                            } else {
                                // Si WEBP no está soportado, usar JPEG
                                console.warn('WEBP no soportado en canvas, usando JPEG');
                                outputFormat = 'image/jpeg';
                            }
                        } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                            // Preservar JPEG
                            outputFormat = 'image/jpeg';
                        }

                        // Convertir a base64 con el formato determinado
                        var base64;
                        try {
                            // Para formatos que no soportan quality (PNG), omitir el parámetro
                            if (outputFormat === 'image/png') {
                                base64 = canvas.toDataURL(outputFormat);
                            } else {
                                base64 = canvas.toDataURL(outputFormat, quality);
                            }
                            resolve(base64);
                        } catch (err) {
                            // Si falla con el formato elegido, intentar con JPEG como fallback
                            console.warn('Error al convertir con formato ' + outputFormat + ', usando JPEG como fallback:', err);
                            try {
                                base64 = canvas.toDataURL('image/jpeg', quality);
                                resolve(base64);
                            } catch (fallbackErr) {
                                // Si también falla JPEG, usar archivo original
                                console.error('Error al convertir imagen, usando archivo original:', fallbackErr);
                                FileUtils.fileToBase64(file, false)
                                    .then(resolve)
                                    .catch(reject);
                            }
                        }
                    } catch (err) {
                        console.warn('Error al comprimir imagen, usando archivo original:', err);
                        // Si falla la compresión, usar archivo original
                        FileUtils.fileToBase64(file, false)
                            .then(resolve)
                            .catch(reject);
                    }
                };

                img.onerror = function(err) {
                    console.warn('Error al cargar imagen en canvas, usando archivo original:', err);
                    // Si falla cargar la imagen, usar archivo original sin comprimir
                    FileUtils.fileToBase64(file, false)
                        .then(resolve)
                        .catch(function(readErr) {
                            reject(new Error('No se pudo procesar la imagen: ' + (readErr.message || readErr)));
                        });
                };

                // Configurar crossOrigin para evitar problemas CORS con imágenes
                // Esto es importante para algunos navegadores
                img.crossOrigin = 'anonymous';

                // Cargar archivo en imagen
                var reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        img.src = e.target.result;
                    } catch (srcErr) {
                        console.warn('Error al establecer src de imagen, usando archivo original:', srcErr);
                        FileUtils.fileToBase64(file, false)
                            .then(resolve)
                            .catch(function(readErr) {
                                reject(new Error('No se pudo establecer fuente de imagen: ' + (readErr.message || readErr)));
                            });
                    }
                };
                reader.onerror = function(err) {
                    console.error('Error al leer archivo:', err);
                    reject(new Error('No se pudo leer el archivo: ' + (err.message || err)));
                };
                reader.readAsDataURL(file);
            });
        },

        /**
         * Convierte un archivo a base64, con compresión opcional para imágenes
         * @param {File} file - Archivo a convertir
         * @param {boolean} compress - Si comprimir imágenes (default: true)
         * @returns {Promise<string>} Promise que resuelve con base64
         */
        fileToBase64: function(file, compress) {
            compress = compress !== false; // Por defecto true

            // Para navegadores basados en Firefox/LibreWolf, evitar compresión con canvas
            // ya que pueden tener problemas con canvas.toDataURL() debido a protecciones de privacidad
            // que pueden causar distorsión o imágenes corruptas
            if (compress && file.type && file.type.startsWith('image/')) {
                if (isFirefoxBased()) {
                    console.info('Navegador basado en Firefox/LibreWolf detectado. Usando archivo original sin compresión para evitar problemas de canvas.');
                    compress = false;
                } else {
                    return FileUtils.compressImage(file);
                }
            }

            // Para Firefox/LibreWolf o si no se debe comprimir, leer directamente sin canvas
            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var result = e.target.result;
                    if (!result) {
                        reject(new Error('No se pudo leer el archivo: resultado vacío'));
                        return;
                    }
                    resolve(result);
                };
                reader.onerror = function(err) {
                    reject(new Error('No se pudo leer el archivo: ' + (err.message || err)));
                };
                reader.readAsDataURL(file);
            });
        },

        /**
         * Valida un archivo según restricciones
         * @param {File} file - Archivo a validar
         * @param {Object} constraints - Restricciones
         * @param {number} constraints.maxSize - Tamaño máximo en bytes
         * @param {Array<string>} constraints.allowedTypes - Tipos MIME permitidos
         * @returns {Object} { valid: boolean, message?: string }
         */
        validateFile: function(file, constraints) {
            constraints = constraints || {};

            // Validar tipo
            if (constraints.allowedTypes && constraints.allowedTypes.length > 0) {
                var allowed = constraints.allowedTypes.some(function(type) {
                    return file.type === type || file.type.startsWith(type + '/');
                });
                if (!allowed) {
                    return {
                        valid: false,
                        message: 'Tipo de archivo no permitido. Tipos permitidos: ' + constraints.allowedTypes.join(', ')
                    };
                }
            }

            // Validar tamaño
            if (constraints.maxSize && file.size > constraints.maxSize) {
                var maxSizeMB = (constraints.maxSize / (1024 * 1024)).toFixed(2);
                return {
                    valid: false,
                    message: 'El archivo excede el tamaño máximo de ' + maxSizeMB + ' MB'
                };
            }

            return { valid: true };
        },

        /**
         * Verifica si una imagen PNG tiene transparencia (simple check)
         * @param {File} file - Archivo PNG
         * @returns {boolean}
         */
        hasTransparency: function(file) {
            // Verificación simple: si es PNG, asumir que puede tener transparencia
            // Para verificación real, se necesitaría cargar la imagen y verificar canal alpha
            return file.type === 'image/png';
        },

        /**
         * Obtiene el tamaño aproximado de un string base64 en bytes
         * @param {string} base64 - String base64
         * @returns {number} Tamaño aproximado en bytes
         */
        getBase64Size: function(base64) {
            if (!base64) return 0;
            // Remover prefijo data:image/...;base64,
            var base64Data = base64.split(',')[1] || base64;
            // Calcular tamaño: cada 4 caracteres base64 = 3 bytes
            return (base64Data.length * 3) / 4;
        }
    };

    // ========= EXPORTAR FUNCIONES PÚBLICAS =========

    // Exportar como objeto global
    window.FileUtils = FileUtils;

    // También exportar funciones individuales para facilidad de uso
    window.compressImage = function(file, options) {
        return FileUtils.compressImage(file, options);
    };

    window.fileToBase64 = function(file, compress) {
        return FileUtils.fileToBase64(file, compress);
    };

    window.validateFile = function(file, constraints) {
        return FileUtils.validateFile(file, constraints);
    };

})();

