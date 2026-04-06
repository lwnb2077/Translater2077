import axios from 'axios';

export class GoogleTranslator {
    name = 'google';
    private apiKey: string = ''; // 用户需要在设置中配置API密钥
    private apiUrl = 'https://translation.googleapis.com/language/translate/v2';

    constructor(apiKey?: string) {
        if (apiKey) {
            this.apiKey = apiKey;
        }
    }

    async translate(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'auto'): Promise<string> {
        // 如果没有API密钥，使用免费翻译服务
        if (!this.apiKey) {
            return this.translateFallback(text, targetLang, sourceLang);
        }

        try {
            const response = await axios.post(
                this.apiUrl,
                {
                    q: text,
                    target: targetLang,
                    source: sourceLang === 'auto' ? undefined : sourceLang,
                    format: 'text'
                },
                {
                    params: {
                        key: this.apiKey
                    }
                }
            );

            if (response.data && response.data.data && response.data.data.translations) {
                return response.data.data.translations[0].translatedText;
            }
            throw new Error('Invalid response from Google Translate API');
        } catch (error) {
            console.error('Google API translation error:', error);
            // API失败时使用备用方案
            return this.translateFallback(text, targetLang, sourceLang);
        }
    }

    // 备用翻译方案，使用多个免费翻译服务
    private async translateFallback(text: string, targetLang: string, sourceLang: string = 'auto'): Promise<string> {
        // 尝试多个翻译服务
        const services = [
            () => this.translateWithGoogleWeb(text, targetLang, sourceLang),
            () => this.translateWithMyMemory(text, targetLang, sourceLang),
            () => this.translateOffline(text, targetLang)
        ];

        for (let i = 0; i < services.length; i++) {
            try {
                const result = await services[i]();
                if (result && result !== text && !result.includes('翻译失败')) {
                    return result;
                }
            } catch (error) {
                console.log(`Translation service ${i + 1} failed, trying next...`, error);
                continue;
            }
        }
        
        // 所有服务都失败时，返回本地翻译
        return this.translateOffline(text, targetLang);
    }

    private async translateWithGoogleWeb(text: string, targetLang: string, sourceLang: string): Promise<string> {
        // 保留地区码，确保繁体 zh-TW 不被截断为 zh
        const normalize = (lang: string) => {
            if (!lang) return '';
            const lower = lang.toLowerCase();
            if (lower === 'zh-cn' || lower === 'zh_cn') return 'zh-CN';
            if (lower === 'zh-tw' || lower === 'zh_tw') return 'zh-TW';
            return lang.split('-')[0];
        };
        const sourceCode = sourceLang === 'auto' ? 'auto' : normalize(sourceLang);
        const targetCode = normalize(targetLang);
        
        // 使用更稳定的端点
        const endpoints = [
            `https://translate.google.com/translate_a/single?client=gtx&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`,
            // 备用端点
            `https://translate.googleapis.com/translate_a/single?client=at&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await axios.get(endpoint, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                        'Referer': 'https://translate.google.com/',
                        'Accept': '*/*'
                    },
                    timeout: 8000
                });

                if (response.data && response.data[0]) {
                    let translatedText = '';
                    for (const item of response.data[0]) {
                        if (item[0]) {
                            translatedText += item[0];
                        }
                    }
                    if (translatedText && translatedText.trim() !== text.trim()) {
                        return translatedText;
                    }
                }
            } catch (error) {
                console.log(`Google endpoint failed:`, error);
                continue;
            }
        }
        throw new Error('All Google endpoints failed');
    }

    private async translateWithMyMemory(text: string, targetLang: string, sourceLang: string): Promise<string> {
        // MyMemory 支持 zh-CN / zh-TW，保留地区码
        const normalizeForMyMemory = (lang: string, isSource: boolean) => {
            if (!lang) return '';
            if (lang === 'auto') return isSource ? 'en' : 'zh-CN';
            const lower = lang.toLowerCase();
            if (lower === 'zh-cn' || lower === 'zh_cn') return 'zh-CN';
            if (lower === 'zh-tw' || lower === 'zh_tw') return 'zh-TW';
            return lang.split('-')[0];
        };
        const sourceLangCode = normalizeForMyMemory(sourceLang, true);
        const targetLangCode = normalizeForMyMemory(targetLang, false);
        
        const response = await axios.get('https://api.mymemory.translated.net/get', {
            params: {
                q: text,
                langpair: `${sourceLangCode}|${targetLangCode}`
            },
            timeout: 6000
        });

        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            const translated = response.data.responseData.translatedText;
            if (translated !== text && translated !== text.toUpperCase()) {
                return translated;
            }
        }
        throw new Error('MyMemory response invalid');
    }

    private translateOffline(text: string, targetLang: string): string {
        // 本地翻译，使用编程术语词典（带多语言前缀）
        const normalize = (lang: string) => {
            if (!lang) return 'en';
            const lower = lang.toLowerCase();
            if (lower === 'zh-cn' || lower === 'zh_cn') return 'zh-CN';
            if (lower === 'zh-tw' || lower === 'zh_tw') return 'zh-TW';
            return lang.split('-')[0];
        };
        const lang = normalize(targetLang);

        const OFFLINE_LABEL: Record<string, string> = {
            'zh-CN': '[本地翻译]',
            'zh-TW': '[本機翻譯]',
            'ja': '[ローカル翻訳]',
            'ko': '[로컬 번역]',
            'fr': '[Traduction locale]',
            'de': '[Lokale Übersetzung]',
            'es': '[Traducción local]',
            'it': '[Traduzione locale]',
            'ru': '[Локальный перевод]',
            'pt': '[Tradução local]',
            'en': '[Local translation]',
        };

        const NETERR_LABEL: Record<string, string> = {
            'zh-CN': '[网络不可用]',
            'zh-TW': '[網路不可用]',
            'ja': '[ネットワークは利用できません]',
            'ko': '[네트워크를 사용할 수 없음]',
            'fr': '[Réseau indisponible]',
            'de': '[Netzwerk nicht verfügbar]',
            'es': '[Red no disponible]',
            'it': '[Rete non disponibile]',
            'ru': '[Сеть недоступна]',
            'pt': '[Rede indisponível]',
            'en': '[Network unavailable]',
        };

        const words = text.toLowerCase().split(/\s+/);
        const translatedWords = words.map(word => 
            CodeTermDictionary.translateTerm(word.replace(/[^a-zA-Z]/g, ''))
        );
        
        const hasTranslation = translatedWords.some((word, index) => 
            word !== words[index].replace(/[^a-zA-Z]/g, '')
        );
        
        if (hasTranslation) {
            const label = OFFLINE_LABEL[lang] || OFFLINE_LABEL['en'];
            return `[[OFFLINE]] ${label} ${translatedWords.join(' ')}`;
        }
        
        const netLabel = NETERR_LABEL[lang] || NETERR_LABEL['en'];
        return `[[NETERR]] ${netLabel} ${text}`;
    }

    async testConnection(): Promise<boolean> {
        try {
            if (this.apiKey) {
                // 使用不计费的语言列表端点校验密钥有效性
                const resp = await axios.get('https://translation.googleapis.com/language/translate/v2/languages', {
                    params: { key: this.apiKey }
                });
                return !!(resp.status >= 200 && resp.status < 300);
            }
            // 无密钥则校验免费网页端点可用性（不回退到付费端点）
            await this.translateWithGoogleWeb('test', 'zh-CN', 'auto');
            return true;
        } catch {
            return false;
        }
    }
}

// OpenAI GPT-4o mini（简化实现：Chat Completions）
export class OpenAITranslator {
    name = 'openai';
    private apiKey: string;
    private baseUrl = 'https://api.openai.com/v1/chat/completions';
    private model = 'gpt-4o-mini';
    constructor(apiKey?: string) {
        this.apiKey = apiKey || '';
    }
    async translate(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'auto'): Promise<string> {
        if (!this.apiKey) throw new Error('OpenAI 需要 API Key');
        const system = `You are a professional translator. Translate the user's text into ${targetLang}. Keep meaning accurate; keep code blocks unchanged.`;
        const resp = await axios.post(this.baseUrl, {
            model: this.model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: text }
            ],
            temperature: 0.2,
        }, {
            headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });
        const out = resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message && resp.data.choices[0].message.content;
        if (!out) throw new Error('OpenAI 返回为空');
        return out;
    }
    async testConnection(): Promise<boolean> {
        try {
            if (!this.apiKey) return false;
            // 仅请求模型元数据，零成本校验权限
            const resp = await axios.get(`https://api.openai.com/v1/models/${this.model}` as string, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            return !!(resp.status >= 200 && resp.status < 300);
        } catch {
            return false;
        }
    }
}

// Google Gemini 2.5 Flash（简化实现：Generative Language API）
export class GeminiTranslator {
    name = 'gemini';
    private apiKey: string;
    // Text-only generateContent endpoint
    private model = 'gemini-2.5-flash';
    constructor(apiKey?: string) { this.apiKey = apiKey || ''; }
    async translate(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'auto'): Promise<string> {
        if (!this.apiKey) throw new Error('Gemini 需要 API Key');
        const prompt = `Translate the following text into ${targetLang}. Keep code blocks unchanged.\n\n${text}`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const resp = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });
        const out = resp.data && resp.data.candidates && resp.data.candidates[0] && resp.data.candidates[0].content && resp.data.candidates[0].content.parts && resp.data.candidates[0].content.parts[0] && resp.data.candidates[0].content.parts[0].text;
        if (!out) throw new Error('Gemini 返回为空');
        return out;
    }
    async testConnection(): Promise<boolean> {
        try {
            if (!this.apiKey) return false;
            // 查询模型描述以验证 key 可用性
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}?key=${this.apiKey}`;
            const resp = await axios.get(url);
            return !!(resp.status >= 200 && resp.status < 300);
        } catch {
            return false;
        }
    }
}

// DeepL 翻译器
export class DeepLTranslator {
    name = 'deepl';
    private apiKey: string;
    private apiUrl: string;
    
    constructor(apiKey?: string) {
        this.apiKey = apiKey || '';
        // DeepL API 有两种端点：免费版和专业版
        // 免费版: https://api-free.deepl.com/v2/translate
        // 专业版: https://api.deepl.com/v2/translate
        // 根据 API key 格式自动选择
        this.apiUrl = this.apiKey.endsWith(':fx') 
            ? 'https://api-free.deepl.com/v2/translate'
            : 'https://api.deepl.com/v2/translate';
    }
    
    async translate(text: string, targetLang: string = 'zh', sourceLang: string = 'auto'): Promise<string> {
        if (!this.apiKey) throw new Error('DeepL 需要 API Key');
        
        // DeepL 语言代码映射
        const mapLang = (lang: string, isTarget: boolean = false) => {
            const lower = lang.toLowerCase();
            // 源语言 auto 对应 DeepL 的空值（自动检测）
            if (!isTarget && (lang === 'auto' || lang === '')) return undefined;
            // 中文简体/繁体
            if (lower === 'zh-cn' || lower === 'zh_cn' || lower === 'zh') return 'ZH';
            if (lower === 'zh-tw' || lower === 'zh_tw') return 'ZH';
            // 英语变体
            if (lower === 'en' || lower === 'en-us') return isTarget ? 'EN-US' : 'EN';
            if (lower === 'en-gb') return 'EN-GB';
            // 葡萄牙语变体  
            if (lower === 'pt' || lower === 'pt-br') return isTarget ? 'PT-BR' : 'PT';
            if (lower === 'pt-pt') return 'PT-PT';
            // 其他语言
            const langMap: Record<string, string> = {
                'ja': 'JA', 'ko': 'KO', 'es': 'ES', 'fr': 'FR',
                'de': 'DE', 'it': 'IT', 'nl': 'NL', 'pl': 'PL',
                'ru': 'RU', 'ar': 'AR', 'bg': 'BG', 'cs': 'CS',
                'da': 'DA', 'el': 'EL', 'et': 'ET', 'fi': 'FI',
                'hu': 'HU', 'id': 'ID', 'lv': 'LV', 'lt': 'LT',
                'no': 'NB', 'nb': 'NB', 'ro': 'RO', 'sk': 'SK',
                'sl': 'SL', 'sv': 'SV', 'tr': 'TR', 'uk': 'UK'
            };
            return langMap[lower] || lang.toUpperCase();
        };
        
        try {
            const params: any = {
                text: text,
                target_lang: mapLang(targetLang, true)
            };
            
            const sourceMapped = mapLang(sourceLang, false);
            if (sourceMapped) {
                params.source_lang = sourceMapped;
            }
            
            const response = await axios.post(
                this.apiUrl,
                params,
                {
                    headers: {
                        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 10000
                }
            );
            
            if (response.data && response.data.translations && response.data.translations[0]) {
                return response.data.translations[0].text;
            }
            throw new Error('DeepL 返回格式错误');
        } catch (error: any) {
            if (error.response && error.response.status === 403) {
                throw new Error('DeepL API Key 无效或额度已用尽');
            }
            if (error.response && error.response.status === 456) {
                throw new Error('DeepL 额度已用尽');
            }
            throw new Error(`DeepL 翻译失败: ${error.message}`);
        }
    }
    
    async testConnection(): Promise<boolean> {
        try {
            if (!this.apiKey) return false;
            // 使用 usage 端点测试连接（不消耗额度）
            const usageUrl = this.apiUrl.replace('/translate', '/usage');
            const resp = await axios.get(usageUrl, {
                headers: {
                    'Authorization': `DeepL-Auth-Key ${this.apiKey}`
                }
            });
            return !!(resp.status >= 200 && resp.status < 300);
        } catch {
            return false;
        }
    }
}
// DeepSeek 翻译器
export class DeepSeekTranslator {
    name = 'deepseek';
    private apiKey: string;
    private baseUrl = 'https://api.deepseek.com/v1/chat/completions';
    private model = 'deepseek-chat';
    
    constructor(apiKey?: string) {
        this.apiKey = apiKey || '';
    }
    
    async translate(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'auto'): Promise<string> {
        if (!this.apiKey) throw new Error('DeepSeek 需要 API Key');
        
        const system = `You are a professional translator. Translate the user's text into ${targetLang}. Keep meaning accurate; keep code blocks unchanged. Only return the translated text without any explanation.`;
        
        try {
            const response = await axios.post(this.baseUrl, {
                model: this.model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: text }
                ],
                temperature: 0.2,
                max_tokens: 2048
            }, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            
            const result = response.data?.choices?.[0]?.message?.content;
            if (!result) throw new Error('DeepSeek 返回为空');
            return result;
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('DeepSeek API Key 无效');
            }
            if (error.response?.status === 429) {
                throw new Error('DeepSeek API 请求频率限制');
            }
            throw new Error(`DeepSeek 翻译失败: ${error.message}`);
        }
    }
    
    async testConnection(): Promise<boolean> {
        try {
            if (!this.apiKey) return false;
            
            const response = await axios.post(this.baseUrl, {
                model: this.model,
                messages: [
                    { role: 'user', content: 'test' }
                ],
                max_tokens: 10
            }, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            
            return !!(response.status >= 200 && response.status < 300);
        } catch {
            return false;
        }
    }
}

/** OpenAI Chat Completions 兼容端点：支持 `…/v1` 或完整 `…/v1/chat/completions`（与 OpenRouter / 多数聚合商一致） */
export function normalizeOpenAiChatCompletionsUrl(input: string): string {
    const raw = input.trim().replace(/\/+$/, '');
    if (!raw) {
        return 'https://api.openai.com/v1/chat/completions';
    }
    if (/\/chat\/completions$/i.test(raw)) {
        return raw;
    }
    return `${raw}/chat/completions`;
}

/** Anthropic Messages API：支持 `…/v1/messages` 或 `…/v1` 基址 */
export function normalizeAnthropicMessagesUrl(input: string): string {
    const raw = input.trim().replace(/\/+$/, '');
    if (!raw) {
        return 'https://api.anthropic.com/v1/messages';
    }
    if (/\/messages$/i.test(raw)) {
        return raw;
    }
    return `${raw}/messages`;
}

function buildTranslationSystemPrompt(targetLang: string, sourceLang: string): string {
    const src = sourceLang === 'auto' ? 'the detected source language' : sourceLang;
    return `You are a professional translator for software developers. Translate the user's text into ${targetLang}. Source context: ${src}. Preserve code blocks, identifiers, and markup; keep meaning accurate. Output only the translated text, no explanations.`;
}

function extractOpenAiStyleContent(data: any): string | null {
    const c = data?.choices?.[0]?.message?.content;
    if (typeof c === 'string' && c.length > 0) {
        return c;
    }
    return null;
}

function extractAnthropicMessageText(data: any): string | null {
    const blocks = data?.content;
    if (!Array.isArray(blocks)) {
        return null;
    }
    const parts: string[] = [];
    for (const b of blocks) {
        if (b?.type === 'text' && typeof b.text === 'string') {
            parts.push(b.text);
        }
    }
    return parts.length ? parts.join('') : null;
}

/** OpenRouter：OpenAI 兼容 Chat Completions，鉴权为 Bearer；可选 HTTP-Referer、X-OpenRouter-Title（官方推荐用于排行与统计） */
export class OpenRouterTranslator {
    name = 'openrouter';
    private readonly endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    private apiKey: string;
    private model: string;
    private siteUrl: string;
    private siteTitle: string;

    constructor(apiKey?: string, model?: string, siteUrl?: string, siteTitle?: string) {
        this.apiKey = apiKey || '';
        this.model = (model || 'openai/gpt-4o-mini').trim();
        this.siteUrl = (siteUrl || '').trim();
        this.siteTitle = (siteTitle || 'Translator2077').trim() || 'Translator2077';
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
        if (this.siteUrl) {
            h['HTTP-Referer'] = this.siteUrl;
        }
        h['X-OpenRouter-Title'] = this.siteTitle;
        return h;
    }

    async translate(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'auto'): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenRouter 需要 API Key');
        }
        const system = buildTranslationSystemPrompt(targetLang, sourceLang);
        const resp = await axios.post(
            this.endpoint,
            {
                model: this.model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: text },
                ],
                temperature: 0.2,
                max_tokens: 4096,
            },
            { headers: this.headers(), timeout: 120000 }
        );
        const out = extractOpenAiStyleContent(resp.data);
        if (!out) {
            throw new Error('OpenRouter 返回为空或格式异常');
        }
        return out;
    }

    async testConnection(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                return false;
            }
            const resp = await axios.post(
                this.endpoint,
                {
                    model: this.model,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 8,
                },
                { headers: this.headers(), timeout: 30000 }
            );
            return resp.status >= 200 && resp.status < 300;
        } catch {
            return false;
        }
    }
}

/** 任意 OpenAI 兼容 Chat Completions（含自建代理、Groq、Together 等，仅需 base URL + Key + 模型名） */
export class OpenAICompatibleTranslator {
    name = 'customOpenAI';
    private apiKey: string;
    private chatUrl: string;
    private model: string;

    constructor(apiKey?: string, baseUrl?: string, model?: string) {
        this.apiKey = apiKey || '';
        this.chatUrl = normalizeOpenAiChatCompletionsUrl(baseUrl || 'https://api.openai.com/v1');
        this.model = (model || 'gpt-4o-mini').trim();
    }

    async translate(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'auto'): Promise<string> {
        if (!this.apiKey) {
            throw new Error('自定义 OpenAI 兼容接口需要 API Key');
        }
        const system = buildTranslationSystemPrompt(targetLang, sourceLang);
        const resp = await axios.post(
            this.chatUrl,
            {
                model: this.model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: text },
                ],
                temperature: 0.2,
                max_tokens: 4096,
            },
            {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 120000,
            }
        );
        const out = extractOpenAiStyleContent(resp.data);
        if (!out) {
            throw new Error('OpenAI 兼容接口返回为空或格式异常');
        }
        return out;
    }

    async testConnection(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                return false;
            }
            const resp = await axios.post(
                this.chatUrl,
                {
                    model: this.model,
                    messages: [{ role: 'user', content: 'ok' }],
                    max_tokens: 5,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                }
            );
            return resp.status >= 200 && resp.status < 300;
        } catch {
            return false;
        }
    }
}

/** 任意 Anthropic Messages 兼容端点（官方 Claude、AWS Bedrock 代理、第三方 Claude 网关等） */
export class AnthropicCompatibleTranslator {
    name = 'customAnthropic';
    private apiKey: string;
    private messagesUrl: string;
    private model: string;
    private anthropicVersion: string;

    constructor(apiKey?: string, baseUrl?: string, model?: string, anthropicVersion?: string) {
        this.apiKey = apiKey || '';
        this.messagesUrl = normalizeAnthropicMessagesUrl(baseUrl || 'https://api.anthropic.com/v1/messages');
        this.model = (model || 'claude-3-5-haiku-20241022').trim();
        this.anthropicVersion = (anthropicVersion || '2023-06-01').trim();
    }

    async translate(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'auto'): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Anthropic 兼容接口需要 API Key');
        }
        const system = buildTranslationSystemPrompt(targetLang, sourceLang);
        const resp = await axios.post(
            this.messagesUrl,
            {
                model: this.model,
                max_tokens: 4096,
                system,
                messages: [{ role: 'user', content: text }],
            },
            {
                headers: {
                    'x-api-key': this.apiKey,
                    'anthropic-version': this.anthropicVersion,
                    'Content-Type': 'application/json',
                },
                timeout: 120000,
            }
        );
        const out = extractAnthropicMessageText(resp.data);
        if (!out) {
            throw new Error('Anthropic 兼容接口返回为空或格式异常');
        }
        return out;
    }

    async testConnection(): Promise<boolean> {
        try {
            if (!this.apiKey) {
                return false;
            }
            const resp = await axios.post(
                this.messagesUrl,
                {
                    model: this.model,
                    max_tokens: 12,
                    messages: [{ role: 'user', content: 'hi' }],
                },
                {
                    headers: {
                        'x-api-key': this.apiKey,
                        'anthropic-version': this.anthropicVersion,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                }
            );
            return resp.status >= 200 && resp.status < 300;
        } catch {
            return false;
        }
    }
}

// 编程术语词典
export class CodeTermDictionary {
    // multi-language glossary; default zh-CN
    private static termsByLang: { [lang: string]: { [term: string]: string } } = {
        'zh-CN': {
            'function': '函数',
            'variable': '变量',
            'constant': '常量',
            'class': '类',
            'interface': '接口',
            'module': '模块',
            'import': '导入',
            'export': '导出',
            'return': '返回',
            'if': '如果',
            'else': '否则',
            'for': '循环',
            'while': '当...时',
            'switch': '开关',
            'case': '情况',
            'break': '中断',
            'continue': '继续',
            'try': '尝试',
            'catch': '捕获',
            'finally': '最终',
            'throw': '抛出',
            'async': '异步',
            'await': '等待',
            'promise': '承诺',
            'callback': '回调',
            'array': '数组',
            'object': '对象',
            'string': '字符串',
            'number': '数字',
            'boolean': '布尔值',
            'null': '空值',
            'undefined': '未定义',
            'true': '真',
            'false': '假',
            'new': '新建',
            'delete': '删除',
            'typeof': '类型',
            'instanceof': '实例',
            'constructor': '构造函数',
            'prototype': '原型',
            'extends': '扩展',
            'implements': '实现',
            'static': '静态',
            'public': '公共',
            'private': '私有',
            'protected': '受保护',
            'abstract': '抽象',
            'enum': '枚举',
            'namespace': '命名空间',
            'type': '类型',
            'generic': '泛型',
            'decorator': '装饰器',
            'mixin': '混入',
            'agile': '敏捷',
            'api': '应用程序编程接口',
            'algorithm': '算法',
            'api gateway': 'API 网关',
            'application server': '应用服务器',
            'arp': '地址解析协议',
            'arrow functions': '箭头函数',
            'artificial intelligence': '人工智能',
            'assembly': '汇编',
            'async/await': '异步/等待',
            'authentication': '认证',
            'authorization': '授权',
            'babel': '巴别塔',
            'backend': '后端',
            'backlog': '待办事项',
            'binary search': '二分查找',
            'blockchain': '区块链',
            'bluetooth': '蓝牙',
            'branch': '分支',
            'browser': '浏览器',
            'b-tree': 'B树',
            'bug': '漏洞',
            'build': '构建',
            'bus': '总线',
            'cache': '缓存',
            'cdn': '内容分发网络',
            'chaos engineering': '混沌工程',
            'ci/cd': '持续集成/持续部署',
            'circuit breaker': '熔断器',
            'cli': '命令行界面',
            'client': '客户端',
            'cloud computing': '云计算',
            'code review': '代码审查',
            'compiler': '编译器',
            'component': '组件',
            'concurrency': '并发',
            'containerization': '容器化',
            'cors': '跨源资源共享',
            'cpu': '中央处理器',
            'crud': '增删改查',
            'cryptography': '密码学',
            'css': '层叠样式表',
            'csrf': '跨站请求伪造',
            'data structure': '数据结构',
            'database': '数据库',
            'ddos': '分布式拒绝服务',
            'deadlock': '死锁',
            'debugger': '调试器',
            'deployment': '部署',
            'devops': '研发运营一体化',
            'dhcp': '动态主机配置协议',
            'di': '依赖注入',
            'distributed system': '分布式系统',
            'dkim': '域名密钥识别邮件',
            'dma': '直接内存存取',
            'dmarc': '域名报文认证协议',
            'dns': '域名系统',
            'docker': 'Docker',
            'dom': '文件物件模型',
            'domain': '领域',
            'dry': '不要重复你自己',
            'dsl': '领域特定语言',
            'dto': '数据传输对象',
            'e2e testing': '端到端测试',
            'ecmascript': 'ECMAScript',
            'eda': '事件驱动架构',
            'encapsulation': '封装',
            'encryption': '加密',
            'endpoint': '端点',
            'entanglement': '纠缠',
            'epoch': '纪元',
            'etl': '提取、转换、加载',
            'event-driven': '事件驱动',
            'exception': '异常',
            'faas': '函数即服务',
            'failover': '故障转移',
            'feature flag': '功能旗标',
            'fibonacci': '斐波那契',
            'garbage collection': '垃圾回收',
            'graph database': '图数据库',
            'graphql': 'GraphQL',
            'grid computing': '网格计算',
            'hash function': '哈希函数',
            'hash table': '哈希表',
            'heap memory': '堆内存',
            'hexadecimal': '十六进制',
            'horizontal scaling': '水平扩展',
            'http protocol': 'HTTP协议',
            'https': 'HTTPS',
            'hybrid cloud': '混合云',
            'hypervisor': '虚拟机监控程序',
            'idempotent': '幂等',
            'immutable': '不可变的',
            'infrastructure as code': '基础设施即代码',
            'inheritance': '继承',
            'injection': '注入',
            'interpreter': '解释器',
            'ipv4': 'IPv4',
            'ipv6': 'IPv6',
            'json': 'JSON',
            'jwt': 'JSON Web Token',
            'kafka': 'Kafka',
            'kubernetes': 'Kubernetes',
            'lambda function': 'Lambda函数',
            'latency': '延迟',
            'lazy loading': '懒加载',
            'load balancer': '负载均衡器',
            'localhost': '本地主机',
            'logging': '日志记录',
            'machine learning': '机器学习',
            'malloc': '内存分配',
            'memory leak': '内存泄漏',
            'message queue': '消息队列',
            'metadata': '元数据',
            'microservices': '微服务',
            'middleware': '中间件',
            'migration': '迁移',
            'minification': '压缩',
            'mvc pattern': 'MVC模式',
            'nosql': 'NoSQL',
            'oauth': 'OAuth',
            'object oriented': '面向对象',
            'optimization': '优化',
            'orm': '对象关系映射',
            'package manager': '包管理器',
            'parallel processing': '并行处理',
            'parser': '解析器',
            'polymorphism': '多态性',
            'primary key': '主键',
            'private cloud': '私有云',
            'profiling': '性能分析',
            'proxy server': '代理服务器',
            'public cloud': '公有云',
            'query optimization': '查询优化',
            'race condition': '竞态条件',
            'recursive': '递归',
            'redis': 'Redis',
            'refactoring': '重构',
            'regression testing': '回归测试',
            'relational database': '关系数据库',
            'repository': '仓库',
            'rest api': 'REST API',
            'reverse proxy': '反向代理',
            'rollback': '回滚',
            'saas': '软件即服务',
            'sandbox': '沙盒',
            'scalability': '可扩展性',
            'schema': '模式',
            'sdk': '软件开发工具包',
            'serialization': '序列化',
            'session management': '会话管理',
            'shell script': 'Shell脚本',
            'single point failure': '单点故障',
            'socket': '套接字',
            'solid principles': 'SOLID原则',
            'sql injection': 'SQL注入',
            'stack overflow': '栈溢出',
            'stored procedure': '存储过程',
            'thread pool': '线程池',
            'throughput': '吞吐量',
            'timeout': '超时',
            'timestamp': '时间戳',
            'transaction': '事务',
            'two factor auth': '双因素认证',
            'unit testing': '单元测试',
            'uptime': '运行时间',
            'user agent': '用户代理',
            'uuid': '通用唯一标识符',
            'version control': '版本控制',
            'vertical scaling': '垂直扩展',
            'virtual machine': '虚拟机',
            'vpc': '虚拟私有云',
            'webhook': 'Webhook',
            'websocket': 'WebSocket',
            'xml': 'XML',
            'yaml': 'YAML',
            'zip compression': 'ZIP压缩',
            'zero downtime': '零停机时间',
            'cipher': '密码',
            'compilation': '编译',
            'concurrency control': '并发控制',
            'data mining': '数据挖掘',
            'deep learning': '深度学习',
            'dependency injection': '依赖注入',
            'dns resolution': 'DNS解析',
            'edge computing': '边缘计算',
            'encryption key': '加密密钥'
        },
        'zh-TW': {
            'agile': '敏捷',
            'api': '應用程式設計介面',
            'algorithm': '演算法',
            'api gateway': 'API 閘道',
            'application server': '應用程式伺服器',
            'arp': '位址解析協定',
            'arrow functions': '箭頭函式',
            'artificial intelligence': '人工智慧',
            'assembly': '組合語言',
            'async/await': '非同步/等待',
            'authentication': '認證',
            'authorization': '授權',
            'babel': '巴別塔',
            'backend': '後端',
            'backlog': '待辦事項',
            'binary search': '二分搜尋',
            'blockchain': '區塊鏈',
            'bluetooth': '藍牙',
            'branch': '分支',
            'browser': '瀏覽器',
            'b-tree': 'B樹',
            'bug': '漏洞',
            'build': '建構',
            'bus': '匯流排',
            'cache': '快取',
            'cdn': '內容分發網路',
            'chaos engineering': '混沌工程',
            'ci/cd': '持續整合/持續部署',
            'circuit breaker': '熔斷器',
            'cli': '命令列介面',
            'client': '用戶端',
            'cloud computing': '雲端運算',
            'code review': '程式碼審查',
            'compiler': '編譯器',
            'component': '元件',
            'concurrency': '並行',
            'constructor': '建構函式',
            'containerization': '容器化',
            'cors': '跨來源資源共用',
            'cpu': '中央處理器',
            'crud': '增刪改查',
            'cryptography': '密碼學',
            'css': '層疊樣式表',
            'csrf': '跨站請求偽造',
            'data structure': '資料結構',
            'database': '資料庫',
            'ddos': '分散式阻斷服務',
            'deadlock': '死結',
            'debugger': '偵錯器',
            'deployment': '部署',
            'devops': '研發營運一體化',
            'dhcp': '動態主機設定協定',
            'di': '依賴注入',
            'distributed system': '分散式系統',
            'dkim': '網域金鑰識別郵件',
            'dma': '直接記憶體存取',
            'dmarc': '網域報文認證協定',
            'dns': '網域名稱系統',
            'docker': 'Docker',
            'dom': '文件物件模型',
            'domain': '領域',
            'dry': '不要重複你自己',
            'dsl': '領域特定語言',
            'dto': '資料傳輸物件',
            'e2e testing': '端對端測試',
            'ecmascript': 'ECMAScript',
            'eda': '事件驅動架構',
            'encapsulation': '封裝',
            'encryption': '加密',
            'endpoint': '端點',
            'entanglement': '糾纏',
            'epoch': '紀元',
            'etl': '提取、轉換、載入',
            'event-driven': '事件驅動',
            'exception': '異常',
            'faas': '函數即服務',
            'failover': '容錯移轉',
            'feature flag': '功能旗標',
            'fibonacci': '費波那契'
        },
        'en': {
            'agile': 'Agile',
            'api': 'API',
            'algorithm': 'Algorithm',
            'api gateway': 'API Gateway',
            'application server': 'Application Server',
            'arp': 'ARP',
            'arrow functions': 'Arrow functions',
            'artificial intelligence': 'Artificial Intelligence',
            'assembly': 'Assembly',
            'async/await': 'Async/Await',
            'authentication': 'Authentication',
            'authorization': 'Authorization',
            'babel': 'Babel',
            'backend': 'Backend',
            'backlog': 'Backlog',
            'binary search': 'Binary Search',
            'blockchain': 'Blockchain',
            'bluetooth': 'Bluetooth',
            'branch': 'Branch',
            'browser': 'Browser',
            'b-tree': 'B-tree',
            'bug': 'Bug',
            'build': 'Build',
            'bus': 'Bus',
            'cache': 'Cache',
            'cdn': 'CDN',
            'chaos engineering': 'Chaos Engineering',
            'ci/cd': 'CI/CD',
            'circuit breaker': 'Circuit breaker',
            'cli': 'CLI',
            'client': 'Client',
            'cloud computing': 'Cloud computing',
            'code review': 'Code review',
            'compiler': 'Compiler',
            'component': 'Component',
            'concurrency': 'Concurrency',
            'constructor': 'Constructor',
            'containerization': 'Containerization',
            'cors': 'CORS',
            'cpu': 'CPU',
            'crud': 'CRUD',
            'cryptography': 'Cryptography',
            'css': 'CSS',
            'csrf': 'CSRF',
            'data structure': 'Data structure',
            'database': 'Database',
            'ddos': 'DDoS',
            'deadlock': 'Deadlock',
            'debugger': 'Debugger',
            'deployment': 'Deployment',
            'devops': 'DevOps',
            'dhcp': 'DHCP',
            'di': 'DI',
            'distributed system': 'Distributed System',
            'dkim': 'DKIM',
            'dma': 'DMA',
            'dmarc': 'DMARC',
            'dns': 'DNS',
            'docker': 'Docker',
            'dom': 'DOM',
            'domain': 'Domain',
            'dry': 'DRY',
            'dsl': 'DSL',
            'dto': 'DTO',
            'e2e testing': 'E2E Testing',
            'ecmascript': 'ECMAScript',
            'eda': 'EDA',
            'encapsulation': 'Encapsulation',
            'encryption': 'Encryption',
            'endpoint': 'Endpoint',
            'entanglement': 'Entanglement',
            'epoch': 'Epoch',
            'etl': 'ETL',
            'event-driven': 'Event-driven',
            'exception': 'Exception',
            'faas': 'FaaS',
            'failover': 'Failover',
            'feature flag': 'Feature flag',
            'fibonacci': 'Fibonacci'
        },
        'ja': {
            'agile': 'アジャイル',
            'api': 'API',
            'algorithm': 'アルゴリズム',
            'api gateway': 'APIゲートウェイ',
            'application server': 'アプリケーションサーバー',
            'arp': 'アープ',
            'arrow functions': 'アロー関数',
            'artificial intelligence': '人工知能',
            'assembly': 'アセンブリ',
            'async/await': '非同期/待機',
            'authentication': '認証',
            'authorization': '認可',
            'babel': 'バベル',
            'backend': 'バックエンド',
            'backlog': 'バックログ',
            'binary search': '二分探索',
            'blockchain': 'ブロックチェーン',
            'bluetooth': 'ブルートゥース',
            'branch': 'ブランチ',
            'browser': 'ブラウザ',
            'b-tree': 'B木',
            'bug': 'バグ',
            'build': 'ビルド',
            'bus': 'バス',
            'cache': 'キャッシュ',
            'cdn': 'CDN',
            'chaos engineering': 'カオスエンジニアリング',
            'ci/cd': 'CI/CD',
            'circuit breaker': 'サーキットブレーカー',
            'cli': 'コマンドラインインターフェース',
            'client': 'クライアント',
            'cloud computing': 'クラウドコンピューティング',
            'code review': 'コードレビュー',
            'compiler': 'コンパイラ',
            'component': 'コンポーネント',
            'concurrency': '並行性',
            'constructor': 'コンストラクタ',
            'containerization': 'コンテナ化',
            'cors': 'CORS',
            'cpu': '中央演算処理装置',
            'crud': 'CRUD',
            'cryptography': '暗号学',
            'css': 'CSS',
            'csrf': 'クロスサイトリクエストフォージェリ',
            'data structure': 'データ構造',
            'database': 'データベース',
            'ddos': 'DDoS攻撃',
            'deadlock': 'デッドロック',
            'debugger': 'デバッガ',
            'deployment': 'デプロイメント',
            'devops': 'DevOps',
            'dhcp': 'DHCP',
            'di': '依存性の注入',
            'distributed system': '分散システム',
            'dkim': 'DKIM',
            'dma': 'DMA',
            'dmarc': 'DMARC',
            'dns': 'DNS',
            'docker': 'Docker',
            'dom': 'ドキュメントオブジェクトモデル',
            'domain': 'ドメイン',
            'dry': 'DRY原則',
            'dsl': 'ドメイン固有言語',
            'dto': 'データ転送オブジェクト',
            'e2e testing': 'エンドツーエンドテスト',
            'ecmascript': 'ECMAScript',
            'eda': 'イベント駆動型アーキテクチャ',
            'encapsulation': 'カプセル化',
            'encryption': '暗号化',
            'endpoint': 'エンドポイント',
            'entanglement': 'エンタングルメント',
            'epoch': 'エポック',
            'etl': 'ETL',
            'event-driven': 'イベント駆動',
            'exception': '例外',
            'faas': 'FaaS',
            'failover': 'フェイルオーバー',
            'feature flag': '機能フラグ',
            'fibonacci': 'フィボナッチ'
        },
        'ko': {
            'agile': '애자일',
            'api': 'API',
            'algorithm': '알고리즘',
            'api gateway': 'API 게이트웨이',
            'application server': '애플리케이션 서버',
            'arp': '주소 결정 프로토콜',
            'arrow functions': '화살표 함수',
            'artificial intelligence': '인공지능',
            'assembly': '어셈블리',
            'async/await': '비동기/대기',
            'authentication': '인증',
            'authorization': '인가',
            'babel': '바벨',
            'backend': '백엔드',
            'backlog': '백로그',
            'binary search': '이진 탐색',
            'blockchain': '블록체인',
            'bluetooth': '블루투스',
            'branch': '브랜치',
            'browser': '브라우저',
            'b-tree': 'B-트리',
            'bug': '버그',
            'build': '빌드',
            'bus': '버스',
            'cache': '캐시',
            'cdn': 'CDN',
            'chaos engineering': '카오스 엔지니어링',
            'ci/cd': 'CI/CD',
            'circuit breaker': '서킷 브레이커',
            'cli': '명령줄 인터페이스',
            'client': '클라이언트',
            'cloud computing': '클라우드 컴퓨팅',
            'code review': '코드 리뷰',
            'compiler': '컴파일러',
            'component': '구성 요소',
            'concurrency': '동시성',
            'constructor': '생성자',
            'containerization': '컨테이너화',
            'cors': '교차 출처 리소스 공유',
            'cpu': '중앙 처리 장치',
            'crud': '생성, 읽기, 갱신, 삭제',
            'cryptography': '암호 기술',
            'css': 'CSS',
            'csrf': '사이트 간 요청 위조',
            'data structure': '데이터 구조',
            'database': '데이터베이스',
            'ddos': '디도스',
            'deadlock': '교착 상태',
            'debugger': '디버거',
            'deployment': '배포',
            'devops': '데브옵스',
            'dhcp': 'DHCP',
            'di': '의존성 주입',
            'distributed system': '분산 시스템',
            'dkim': 'DKIM',
            'dma': 'DMA',
            'dmarc': 'DMARC',
            'dns': 'DNS',
            'docker': '도커',
            'dom': '문서 객체 모델',
            'domain': '도메인',
            'dry': '반복하지 마세요',
            'dsl': '도메인 특화 언어',
            'dto': '데이터 전송 객체',
            'e2e testing': '종단 간 테스트',
            'ecmascript': 'ECMAScript',
            'eda': '이벤트 기반 아키텍처',
            'encapsulation': '캡슐화',
            'encryption': '암호화',
            'endpoint': '엔드포인트',
            'entanglement': '얽힘',
            'epoch': '에포크',
            'etl': 'ETL',
            'event-driven': '이벤트 기반',
            'exception': '예외',
            'faas': 'FaaS',
            'failover': '장애 조치',
            'feature flag': '기능 플래그',
            'fibonacci': '피보나치'
        }
    };

    static translateTerm(term: string, targetLang: string = 'zh-CN'): string {
        const lowerTerm = term.toLowerCase();
        const langMap = this.termsByLang[targetLang] || this.termsByLang['zh-CN'];
        return (langMap && langMap[lowerTerm]) || term;
    }

    static enhanceTranslation(text: string, translation: string, targetLang: string = 'zh-CN'): string {
        // 应用户要求：不再在结果末尾附加“编程术语解释”段落。
        // 直接返回原始翻译。
        return translation;
    }

    static translateUsingDictionary(text: string, targetLang: string = 'zh-CN'): string | undefined {
        if (!text) return undefined;
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 0) return undefined;
        const mapped = words.map(w => this.translateTerm(w.replace(/[^a-zA-Z]/g, ''), targetLang));
        const anyChanged = mapped.some((w, i) => w && w !== words[i]);
        return anyChanged ? mapped.join(' ') : undefined;
    }
}