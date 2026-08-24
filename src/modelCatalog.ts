import axios from 'axios';

/** 单个可选模型 */
export interface ModelInfo {
    /** 调用 API 时使用的模型 ID */
    id: string;
    /** 下拉列表中展示的名称 */
    label: string;
    /** 次要信息：上下文长度、价格等，展示在名称下方 */
    detail?: string;
    /** 用于排序的创建时间（秒级时间戳），越大越新 */
    created?: number;
}

/** 拉取模型列表失败时抛出，message 已是可直接展示给用户的文案 */
export class ModelFetchError extends Error {}

const REQUEST_TIMEOUT = 20000;

/** 把 axios 异常翻译成用户能看懂的原因 */
function describeError(error: any, provider: string): never {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
        throw new ModelFetchError(`${provider} API Key 无效或权限不足`);
    }
    if (status === 404) {
        throw new ModelFetchError(`${provider} 接口地址不存在，请检查 Base URL`);
    }
    if (status === 429) {
        throw new ModelFetchError(`${provider} 请求过于频繁，请稍后重试`);
    }
    if (status) {
        throw new ModelFetchError(`${provider} 返回 HTTP ${status}`);
    }
    if (error?.code === 'ECONNABORTED') {
        throw new ModelFetchError(`${provider} 请求超时`);
    }
    throw new ModelFetchError(`${provider} 无法连接：${error?.message || '未知错误'}`);
}

/** OpenAI 的 /models 会混入语音、图像、向量等非对话模型，这里过滤掉 */
const NON_CHAT_PATTERN = /(whisper|tts|dall-e|embedding|moderation|audio|image|realtime|transcribe|search|similarity|edit|babbage|davinci|curie|ada)/i;

function isChatModel(id: string): boolean {
    return !NON_CHAT_PATTERN.test(id);
}

/** 新模型排前面，无时间戳的按 ID 字典序 */
function sortModels(models: ModelInfo[]): ModelInfo[] {
    return models.sort((a, b) => {
        if (a.created && b.created && a.created !== b.created) {
            return b.created - a.created;
        }
        if (a.created && !b.created) { return -1; }
        if (!a.created && b.created) { return 1; }
        return a.id.localeCompare(b.id);
    });
}

/** OpenAI 兼容的 /v1/models：接受 …/v1、…/v1/chat/completions 或 …/v1/models */
export function normalizeOpenAiModelsUrl(input: string): string {
    const raw = (input || '').trim().replace(/\/+$/, '');
    if (!raw) {
        return 'https://api.openai.com/v1/models';
    }
    if (/\/models$/i.test(raw)) {
        return raw;
    }
    return `${raw.replace(/\/chat\/completions$/i, '')}/models`;
}

/** Anthropic 的 /v1/models：接受 …/v1、…/v1/messages 或 …/v1/models */
export function normalizeAnthropicModelsUrl(input: string): string {
    const raw = (input || '').trim().replace(/\/+$/, '');
    if (!raw) {
        return 'https://api.anthropic.com/v1/models';
    }
    if (/\/models$/i.test(raw)) {
        return raw;
    }
    return `${raw.replace(/\/messages$/i, '')}/models`;
}

/** 解析 OpenAI 风格响应：{ data: [{ id, created }] } */
function parseOpenAiStyle(data: any, filterChat: boolean): ModelInfo[] {
    const rows = Array.isArray(data?.data) ? data.data : [];
    const models: ModelInfo[] = [];
    for (const row of rows) {
        const id = typeof row?.id === 'string' ? row.id : '';
        if (!id) { continue; }
        if (filterChat && !isChatModel(id)) { continue; }
        models.push({
            id,
            label: id,
            detail: typeof row?.owned_by === 'string' ? row.owned_by : undefined,
            created: typeof row?.created === 'number' ? row.created : undefined,
        });
    }
    return sortModels(models);
}

async function listOpenAiModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey) { throw new ModelFetchError('请先填写 OpenAI API Key'); }
    try {
        const resp = await axios.get('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: REQUEST_TIMEOUT,
        });
        return parseOpenAiStyle(resp.data, true);
    } catch (error) {
        describeError(error, 'OpenAI');
    }
}

async function listGeminiModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey) { throw new ModelFetchError('请先填写 Gemini API Key'); }
    try {
        const resp = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
            params: { key: apiKey, pageSize: 200 },
            timeout: REQUEST_TIMEOUT,
        });
        const rows = Array.isArray(resp.data?.models) ? resp.data.models : [];
        const models: ModelInfo[] = [];
        for (const row of rows) {
            const methods = Array.isArray(row?.supportedGenerationMethods) ? row.supportedGenerationMethods : [];
            if (!methods.includes('generateContent')) { continue; }
            const raw = typeof row?.name === 'string' ? row.name : '';
            const id = raw.replace(/^models\//, '');
            if (!id) { continue; }
            models.push({
                id,
                label: typeof row?.displayName === 'string' && row.displayName ? row.displayName : id,
                detail: id,
            });
        }
        return models.sort((a, b) => a.id.localeCompare(b.id));
    } catch (error: any) {
        // Google 对无效 Key 返回 400 INVALID_ARGUMENT，而非其他家常用的 401
        if (error?.response?.status === 400) {
            throw new ModelFetchError('Gemini API Key 无效或权限不足');
        }
        describeError(error, 'Gemini');
    }
}

async function listDeepSeekModels(apiKey: string): Promise<ModelInfo[]> {
    if (!apiKey) { throw new ModelFetchError('请先填写 DeepSeek API Key'); }
    try {
        const resp = await axios.get('https://api.deepseek.com/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: REQUEST_TIMEOUT,
        });
        return parseOpenAiStyle(resp.data, false);
    } catch (error) {
        describeError(error, 'DeepSeek');
    }
}

/** OpenRouter 的模型目录是公开的，不需要 Key 也能列出 */
async function listOpenRouterModels(): Promise<ModelInfo[]> {
    try {
        const resp = await axios.get('https://openrouter.ai/api/v1/models', { timeout: REQUEST_TIMEOUT });
        const rows = Array.isArray(resp.data?.data) ? resp.data.data : [];
        const models: ModelInfo[] = [];
        for (const row of rows) {
            const id = typeof row?.id === 'string' ? row.id : '';
            if (!id) { continue; }
            const ctx = typeof row?.context_length === 'number' ? row.context_length : 0;
            const prompt = Number(row?.pricing?.prompt);
            const bits: string[] = [id];
            if (ctx) { bits.push(`${Math.round(ctx / 1000)}K 上下文`); }
            if (Number.isFinite(prompt)) {
                bits.push(prompt === 0 ? '免费' : `$${(prompt * 1000000).toFixed(2)}/M tokens`);
            }
            models.push({
                id,
                label: typeof row?.name === 'string' && row.name ? row.name : id,
                detail: bits.join(' · '),
                created: typeof row?.created === 'number' ? row.created : undefined,
            });
        }
        return sortModels(models);
    } catch (error) {
        describeError(error, 'OpenRouter');
    }
}

async function listCustomOpenAiModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
    const url = normalizeOpenAiModelsUrl(baseUrl);
    try {
        const headers: Record<string, string> = {};
        if (apiKey) { headers.Authorization = `Bearer ${apiKey}`; }
        const resp = await axios.get(url, { headers, timeout: REQUEST_TIMEOUT });
        return parseOpenAiStyle(resp.data, false);
    } catch (error) {
        describeError(error, '自定义 OpenAI 兼容接口');
    }
}

async function listCustomAnthropicModels(apiKey: string, baseUrl: string, version: string): Promise<ModelInfo[]> {
    const url = normalizeAnthropicModelsUrl(baseUrl);
    try {
        const headers: Record<string, string> = {
            'anthropic-version': version || '2023-06-01',
        };
        if (apiKey) { headers['x-api-key'] = apiKey; }
        const resp = await axios.get(url, { headers, params: { limit: 100 }, timeout: REQUEST_TIMEOUT });
        const rows = Array.isArray(resp.data?.data) ? resp.data.data : [];
        const models: ModelInfo[] = [];
        for (const row of rows) {
            const id = typeof row?.id === 'string' ? row.id : '';
            if (!id) { continue; }
            models.push({
                id,
                label: typeof row?.display_name === 'string' && row.display_name ? row.display_name : id,
                detail: id,
                created: row?.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : undefined,
            });
        }
        return sortModels(models);
    } catch (error) {
        describeError(error, '自定义 Anthropic 兼容接口');
    }
}

/**
 * OpenAI 兼容的预设提供商：一行配置即可接入一家。
 * 全部走 Chat Completions + /models，翻译与模型拉取逻辑完全复用。
 */
export interface OpenAiCompatPreset {
    /** 下拉框中的显示名 */
    label: string;
    /** OpenAI 兼容基址（…/v1 风格） */
    baseUrl: string;
    /** 申请 Key 的入口，展示在设置面板说明里 */
    keysUrl: string;
}

export const OPENAI_COMPAT_PRESETS: Record<string, OpenAiCompatPreset> = {
    xai: {
        label: 'xAI (Grok)',
        baseUrl: 'https://api.x.ai/v1',
        keysUrl: 'https://console.x.ai',
    },
    zhipu: {
        label: 'Z.AI (智谱 GLM)',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        keysUrl: 'https://open.bigmodel.cn',
    },
    qwen: {
        label: '通义千问 Qwen',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        keysUrl: 'https://bailian.console.aliyun.com',
    },
    moonshot: {
        label: 'Moonshot (Kimi)',
        baseUrl: 'https://api.moonshot.cn/v1',
        keysUrl: 'https://platform.moonshot.cn',
    },
    groq: {
        label: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        keysUrl: 'https://console.groq.com/keys',
    },
    mistral: {
        label: 'Mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        keysUrl: 'https://console.mistral.ai',
    },
    siliconflow: {
        label: '硅基流动 SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        keysUrl: 'https://cloud.siliconflow.cn',
    },
};

/** 这些提供商是固定翻译服务，没有模型可选 */
export function providerHasModelChoice(provider: string): boolean {
    return ['openai', 'gemini', 'deepseek', 'openrouter', 'customOpenAI', 'customAnthropic'].includes(provider)
        || provider in OPENAI_COMPAT_PRESETS;
}

/**
 * 拉取指定提供商当前可用的模型列表。
 * extras 用于传入自定义接口的 Base URL 与 anthropic-version。
 */
export async function listModels(
    provider: string,
    apiKey: string,
    extras: Record<string, string> = {}
): Promise<ModelInfo[]> {
    const preset = OPENAI_COMPAT_PRESETS[provider];
    if (preset) {
        if (!apiKey) { throw new ModelFetchError(`请先填写 ${preset.label} API Key`); }
        return listCustomOpenAiModels(apiKey, preset.baseUrl);
    }
    switch (provider) {
        case 'openai':
            return listOpenAiModels(apiKey);
        case 'gemini':
            return listGeminiModels(apiKey);
        case 'deepseek':
            return listDeepSeekModels(apiKey);
        case 'openrouter':
            return listOpenRouterModels();
        case 'customOpenAI':
            return listCustomOpenAiModels(apiKey, extras.customOpenAIBaseUrl || '');
        case 'customAnthropic':
            return listCustomAnthropicModels(
                apiKey,
                extras.customAnthropicBaseUrl || '',
                extras.customAnthropicVersion || '2023-06-01'
            );
        default:
            return [];
    }
}
