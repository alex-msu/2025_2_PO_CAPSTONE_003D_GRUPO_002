import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Config } from './entities/config.entity';
import { DebugLoggerService } from './debug-logger.service';

@Injectable()
export class ConfigService {
  private debugModeCache: boolean | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minuto

  constructor(
    @InjectRepository(Config)
    private readonly configRepo: Repository<Config>,
    @Inject(forwardRef(() => DebugLoggerService))
    private readonly debugLogger?: DebugLoggerService,
  ) {}

  /**
   * Obtiene el estado del modo debug
   * Usa caché para evitar consultas excesivas a la BD
   */
  async getDebugMode(): Promise<boolean> {
    const now = Date.now();
    
    // Si el caché es válido, retornar valor en caché
    if (this.debugModeCache !== null && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.debugModeCache;
    }

    // Buscar en la BD
    let config = await this.configRepo.findOne({ where: { key: 'debugMode' } });
    
    if (!config) {
      // Si no existe, crear con valor por defecto (false)
      config = this.configRepo.create({
        key: 'debugMode',
        value: 'false',
      });
      await this.configRepo.save(config);
      this.debugModeCache = false;
      this.cacheTimestamp = now;
      return false;
    }

    const enabled = config.value === 'true';
    this.debugModeCache = enabled;
    this.cacheTimestamp = now;
    return enabled;
  }

  /**
   * Establece el estado del modo debug
   */
  async setDebugMode(enabled: boolean): Promise<void> {
    let config = await this.configRepo.findOne({ where: { key: 'debugMode' } });
    
    if (!config) {
      config = this.configRepo.create({
        key: 'debugMode',
        value: enabled ? 'true' : 'false',
      });
    } else {
      config.value = enabled ? 'true' : 'false';
    }
    
    await this.configRepo.save(config);
    
    // Actualizar caché
    this.debugModeCache = enabled;
    this.cacheTimestamp = Date.now();
    
    // Limpiar caché del logger para que se actualice inmediatamente
    if (this.debugLogger) {
      this.debugLogger.clearCache();
    }
  }
}

