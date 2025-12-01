import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from './config.service';

@Injectable()
export class DebugLoggerService implements OnModuleInit {
  private debugModeCache: boolean = false;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 30000; // 30 segundos
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Cargar estado inicial
    await this.refreshCache();
    
    // Refrescar caché periódicamente
    this.refreshInterval = setInterval(() => {
      this.refreshCache().catch(() => {
        // Ignorar errores silenciosamente
      });
    }, this.CACHE_TTL);
  }

  /**
   * Refresca el caché del modo debug
   */
  private async refreshCache(): Promise<void> {
    try {
      const enabled = await this.configService.getDebugMode();
      this.debugModeCache = enabled;
      this.cacheTimestamp = Date.now();
    } catch (e) {
      // Si falla, mantener el valor actual
    }
  }

  /**
   * Verifica si el modo debug está activado (síncrono, usa caché)
   */
  private isEnabled(): boolean {
    const now = Date.now();
    
    // Si el caché es válido, retornar valor en caché
    if ((now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.debugModeCache;
    }

    // Si el caché expiró, refrescar en background (no bloqueante)
    this.refreshCache().catch(() => {
      // Ignorar errores
    });

    // Retornar valor actual del caché mientras se refresca
    return this.debugModeCache;
  }

  /**
   * Log condicional (equivalente a console.log)
   */
  log(...args: any[]): void {
    if (this.isEnabled()) {
      console.log(...args);
    }
  }

  /**
   * Log de advertencia condicional (equivalente a console.warn)
   */
  warn(...args: any[]): void {
    if (this.isEnabled()) {
      console.warn(...args);
    }
  }

  /**
   * Log de error condicional (equivalente a console.error)
   */
  error(...args: any[]): void {
    if (this.isEnabled()) {
      console.error(...args);
    }
  }

  /**
   * Log de información condicional (equivalente a console.info)
   */
  info(...args: any[]): void {
    if (this.isEnabled()) {
      console.info(...args);
    }
  }

  /**
   * Limpia el caché (útil cuando se cambia la configuración)
   */
  clearCache(): void {
    this.debugModeCache = false;
    this.cacheTimestamp = 0;
    this.refreshCache().catch(() => {
      // Ignorar errores
    });
  }

  onModuleDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

