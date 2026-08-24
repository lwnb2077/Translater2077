import * as vscode from 'vscode';

/** 需要保密存储的提供商，配置字段名统一为 `${provider}ApiKey` */
export const KEYED_PROVIDERS = [
    'google',
    'deepl',
    'microsoft',
    'openai',
    'gemini',
    'deepseek',
    'openrouter',
    // OpenAI 兼容预设提供商（见 modelCatalog.OPENAI_COMPAT_PRESETS）
    'xai',
    'zhipu',
    'qwen',
    'moonshot',
    'groq',
    'mistral',
    'siliconflow',
    'customOpenAI',
    'customAnthropic',
] as const;

export type KeyedProvider = typeof KEYED_PROVIDERS[number];

/** 旧版本把 Key 写在 settings.json 里，字段名保留用于一次性迁移与清理 */
function settingsField(provider: string): string {
    return `${provider}ApiKey`;
}

/** SecretStorage 中的键名，加前缀避免与其他扩展冲突 */
function secretKey(provider: string): string {
    return `codeTranslator.${provider}ApiKey`;
}

const MIGRATION_FLAG = 'codeTranslator.secretsMigrated';

/**
 * API Key 的唯一读写入口。
 *
 * 早期版本把 Key 存在 settings.json，会随 Settings Sync 同步到云端、可能被误提交进仓库，
 * 且任何扩展都能读取。改用 VS Code 的 SecretStorage（系统钥匙串）后，这些问题都不存在。
 */
export class SecretStore {
    private static instance: SecretStore | undefined;

    private constructor(
        private readonly secrets: vscode.SecretStorage,
        private readonly state: vscode.Memento
    ) {}

    public static init(context: vscode.ExtensionContext): SecretStore {
        SecretStore.instance = new SecretStore(context.secrets, context.globalState);
        return SecretStore.instance;
    }

    /** activate 之后随处可取；未初始化说明调用时机有误 */
    public static get(): SecretStore {
        if (!SecretStore.instance) {
            throw new Error('SecretStore 尚未初始化，请先在 activate 中调用 SecretStore.init');
        }
        return SecretStore.instance;
    }

    public async getKey(provider: string): Promise<string> {
        const stored = await this.secrets.get(secretKey(provider));
        if (stored) {
            return stored;
        }
        // 兜底：迁移失败或用户手动改回 settings.json 时仍能读到
        const legacy = vscode.workspace
            .getConfiguration('codeTranslator')
            .get<string>(settingsField(provider), '');
        return legacy || '';
    }

    public async setKey(provider: string, apiKey: string): Promise<void> {
        const trimmed = (apiKey || '').trim();
        if (trimmed) {
            await this.secrets.store(secretKey(provider), trimmed);
        } else {
            await this.secrets.delete(secretKey(provider));
        }
    }

    /** 一次取齐所有 Key，供设置面板回填 */
    public async getAllKeys(): Promise<Record<string, string>> {
        const entries = await Promise.all(
            KEYED_PROVIDERS.map(async (p) => [p, await this.getKey(p)] as const)
        );
        return Object.fromEntries(entries);
    }

    /**
     * 把 settings.json 里的明文 Key 搬进 SecretStorage 并清除原值，返回本次迁移条数。
     *
     * 每次启动都扫描，而不是只跑一次：开启 Settings Sync 的用户可能从旧版本机器
     * 再同步回明文 Key，一次性迁移会让这些 Key 永远留在 settings.json 里。
     */
    public async migrateFromSettings(): Promise<number> {
        const config = vscode.workspace.getConfiguration('codeTranslator');
        let migrated = 0;

        for (const provider of KEYED_PROVIDERS) {
            const field = settingsField(provider);
            const inspected = config.inspect<string>(field);
            const plaintext = (inspected?.globalValue || inspected?.workspaceValue || '').trim();
            if (!plaintext) {
                continue;
            }

            await this.secrets.store(secretKey(provider), plaintext);

            // 清空两级作用域，确保明文不再留在任何 settings.json 里
            if (inspected?.globalValue !== undefined) {
                await config.update(field, undefined, vscode.ConfigurationTarget.Global);
            }
            if (inspected?.workspaceValue !== undefined) {
                await config.update(field, undefined, vscode.ConfigurationTarget.Workspace);
            }
            migrated++;
        }

        return migrated;
    }

    /** 首次迁移才值得弹窗告知，之后的清理静默进行 */
    public async shouldAnnounceMigration(): Promise<boolean> {
        if (this.state.get<boolean>(MIGRATION_FLAG, false)) {
            return false;
        }
        await this.state.update(MIGRATION_FLAG, true);
        return true;
    }
}
