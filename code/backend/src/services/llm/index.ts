import { LLMCallOptions, LLMCallResult, LLMConfig, LLMProvider, LLMTaskType } from '../../types';
import { db } from '../../config/database';
import { CloudProvider } from './providers/cloud';
import { LocalProvider } from './providers/local';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.LLM_ENCRYPTION_KEY || 'aitraining-llm-secret-key-2026';
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function isEncrypted(text: string): boolean {
  // Encrypted format: hex_iv:hex_auth_tag:hex_data
  return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/.test(text);
}

function decrypt(encryptedText: string): string {
  if (!isEncrypted(encryptedText)) {
    // Plaintext key stored before encryption was implemented
    return encryptedText;
  }
  try {
    const [ivHex, tagHex, dataHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (e) {
    console.error('[LLMService] API Key 解密失败，将使用原始值:', (e as Error).message);
    return encryptedText;
  }
}

export interface LLMProviderInterface {
  name: LLMProvider;
  call(modelName: string, systemPrompt: string, userPrompt: string, options: LLMCallOptions): Promise<LLMCallResult>;
  healthCheck(apiKey?: string, baseUrl?: string, modelName?: string): Promise<{ ok: boolean; models: string[]; latency: number; error?: string }>;
}

export class LLMService {
  private providers: Map<LLMProvider, LLMProviderInterface> = new Map();
  private configCache: LLMConfig[] = [];
  private configCacheTime: number = 0;
  private static instance: LLMService;

  static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  async initialize(): Promise<void> {
    this.providers.set('openai', new CloudProvider('openai'));
    this.providers.set('anthropic', new CloudProvider('anthropic'));
    this.providers.set('deepseek', new CloudProvider('deepseek'));
    this.providers.set('zhipu', new CloudProvider('zhipu'));
    this.providers.set('ollama', new LocalProvider());

    await this.refreshConfigCache();
    console.log('[LLMService] ✅ LLM服务初始化完成');
  }

  async refreshConfigCache(): Promise<void> {
    const configs = await db.prepare(
      'SELECT * FROM llm_config WHERE is_active = true ORDER BY id'
    ).all();
    this.configCache = configs as LLMConfig[];
    this.configCacheTime = Date.now();
  }

  private async getConfigForTask(taskType: LLMTaskType): Promise<LLMConfig | null> {
    if (Date.now() - this.configCacheTime > 60000) {
      await this.refreshConfigCache();
    }
    const config = this.configCache.find(c =>
      Array.isArray(c.taskRouting) && c.taskRouting.includes(taskType)
    );
    if (!config) {
      const fallback = this.configCache[0];
      if (fallback) {
        console.log(`[LLMService] 任务 "${taskType}" 无专用配置，使用默认模型: ${fallback.modelName}`);
      }
      return fallback || null;
    }
    return config;
  }

  async callLLM(
    systemPrompt: string,
    userPrompt: string,
    options: LLMCallOptions
  ): Promise<LLMCallResult> {
    const config = await this.getConfigForTask(options.taskType);
    if (!config) {
      throw new Error('没有可用的LLM模型配置，请先在设置中配置模型');
    }

    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new Error(`不支持的LLM提供商: ${config.provider}`);
    }

    const startTime = Date.now();
    const apiKey = config.apiKeyEncrypted ? decrypt(config.apiKeyEncrypted) : undefined;

    const result = await provider.call(
      config.modelName,
      systemPrompt,
      userPrompt,
      { ...options, apiKey, baseUrl: config.baseUrl } as any
    );

    return {
      ...result,
      duration: Date.now() - startTime,
    };
  }

  async healthCheck(provider: LLMProvider): Promise<{ ok: boolean; models: string[]; latency: number; error?: string }> {
    const p = this.providers.get(provider);
    if (!p) {
      throw new Error(`未知的提供商: ${provider}`);
    }
    // 从库存配置中查找该 provider 的第一个活跃配置，获取 API Key 和模型名
    await this.refreshConfigCache();
    const config = this.configCache.find(c => c.provider === provider && c.isActive);
    console.log(`[LLMService] healthCheck for ${provider}: config found=${!!config}, hasEncryptedKey=${!!config?.apiKeyEncrypted}`);
    const apiKey = config?.apiKeyEncrypted ? decrypt(config.apiKeyEncrypted) : undefined;
    console.log(`[LLMService] healthCheck for ${provider}: apiKey present=${!!apiKey}, baseUrl=${config?.baseUrl || 'default'}, modelName=${config?.modelName || 'default'}`);
    const baseUrl = config?.baseUrl || undefined;
    const modelName = config?.modelName || undefined;
    return p.healthCheck(apiKey, baseUrl, modelName);
  }

  async listConfigs(): Promise<LLMConfig[]> {
    await this.refreshConfigCache();
    return this.configCache.map(c => ({
      ...c,
      apiKeyEncrypted: c.apiKeyEncrypted ? '***' : undefined,
    }));
  }

  async saveConfig(config: LLMConfig): Promise<LLMConfig> {
    // Encrypt API key if it's plaintext (not masked and not already encrypted)
    let encryptedKey = config.apiKeyEncrypted || null;
    if (encryptedKey && encryptedKey !== '***' && !isEncrypted(encryptedKey)) {
      encryptedKey = encrypt(encryptedKey);
    }

    // If updating and no new key provided, preserve the existing key
    if (config.id && (!encryptedKey || encryptedKey === '***')) {
      const existing = await db.prepare(
        'SELECT api_key_encrypted FROM llm_config WHERE id=$1'
      ).get(config.id);
      if (existing && (existing as any).apiKeyEncrypted) {
        encryptedKey = (existing as any).apiKeyEncrypted;
      }
    }

    if (config.id) {
      await db.prepare(`
        UPDATE llm_config SET provider=$1, model_name=$2, api_key_encrypted=$3,
        base_url=$4, is_active=$5, task_routing=$6, updated_at=CURRENT_TIMESTAMP
        WHERE id=$7
      `).run(
        config.provider, config.modelName,
        encryptedKey,
        config.baseUrl || null,
        config.isActive,
        JSON.stringify(config.taskRouting || []),
        config.id
      );
    } else {
      const result = await db.prepare(`
        INSERT INTO llm_config (provider, model_name, api_key_encrypted, base_url, is_active, task_routing)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `).run(
        config.provider, config.modelName,
        encryptedKey,
        config.baseUrl || null,
        config.isActive,
        JSON.stringify(config.taskRouting || []),
      );
      // Get the inserted id from the returning result
      const inserted = await db.prepare('SELECT id FROM llm_config ORDER BY id DESC LIMIT 1').get();
      config.id = (inserted as any)?.id;
    }

    await this.refreshConfigCache();
    return config;
  }

  async deleteConfig(id: number): Promise<void> {
    await db.prepare('DELETE FROM llm_config WHERE id=$1').run(id);
    await this.refreshConfigCache();
  }
}

export const llmService = LLMService.getInstance();
