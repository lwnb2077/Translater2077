"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationManager = exports.MicrosoftTranslator = void 0;
const translator_1 = require("./translator");
const axios_1 = __importDefault(require("axios"));
class MicrosoftTranslator {
    constructor(apiKey, region = 'global') {
        this.name = 'microsoft';
        this.apiKey = apiKey;
        this.region = region;
    }
    async translate(text, targetLang, sourceLang = 'auto') {
        if (!this.apiKey) {
            throw new Error('微软翻译需要API密钥');
        }
        try {
            const response = await axios_1.default.post('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0', [{ Text: text }], {
                params: {
                    to: targetLang,
                    from: sourceLang === 'auto' ? undefined : sourceLang
                },
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey,
                    'Ocp-Apim-Subscription-Region': this.region,
                    'Content-Type': 'application/json'
                }
            });
            if (response.data && response.data[0] && response.data[0].translations) {
                return response.data[0].translations[0].text;
            }
            throw new Error('微软翻译API返回格式错误');
        }
        catch (error) {
            console.error('Microsoft translation error:', error);
            return `微软翻译失败: ${text}`;
        }
    }
    async testConnection() {
        try {
            if (!this.apiKey)
                return false;
            const resp = await axios_1.default.post('https://api.cognitive.microsofttranslator.com/translate?api-version=3.0', [{ Text: 'hello' }], {
                params: { to: 'zh' },
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey,
                    'Ocp-Apim-Subscription-Region': this.region,
                    'Content-Type': 'application/json'
                }
            });
            return !!(resp.status >= 200 && resp.status < 300);
        }
        catch {
            return false;
        }
    }
}
exports.MicrosoftTranslator = MicrosoftTranslator;
class TranslationManager {
    constructor() {
        this.providers = new Map();
        this.currentProviderName = 'google';
        this.currentProviderHasKey = false;
        // 默认使用Google翻译
        this.currentProvider = new translator_1.GoogleTranslator();
        this.providers.set('google', this.currentProvider);
    }
    updateProvider(providerName, config) {
        const apiKey = config.get(`${providerName}ApiKey`, '')
            || (providerName === 'openai' ? config.get('openaiApiKey', '') : '')
            || (providerName === 'gemini' ? config.get('geminiApiKey', '') : '');
        let provider;
        switch (providerName) {
            case 'google':
                provider = new translator_1.GoogleTranslator(apiKey);
                break;
            case 'deepl':
                provider = new translator_1.DeepLTranslator(apiKey);
                break;
            case 'microsoft':
                provider = new MicrosoftTranslator(apiKey, config.get('microsoftRegion', 'global'));
                break;
            case 'openai':
                provider = new translator_1.OpenAITranslator(apiKey);
                break;
            case 'gemini':
                provider = new translator_1.GeminiTranslator(apiKey);
                break;
            default:
                provider = new translator_1.GoogleTranslator(apiKey);
        }
        this.providers.set(providerName, provider);
        this.currentProvider = provider;
        this.currentProviderName = providerName;
        this.currentProviderHasKey = !!apiKey;
    }
    async translate(text, targetLang = 'zh-CN', sourceLang = 'auto') {
        try {
            // 1) 只对单个词且长度较短的文本尝试词典翻译
            const words = text.trim().split(/\s+/);
            const isSingleWord = words.length === 1;
            const isShortText = text.length <= 20;
            // 只有单个词且较短时才使用词典
            if (isSingleWord && isShortText) {
                const dictFirst = translator_1.CodeTermDictionary.translateUsingDictionary(text, targetLang);
                if (dictFirst) {
                    return `[[PROVIDER:dictionary]] ${dictFirst}`;
                }
            }
            // 2) 多个词或较长文本直接调用API
            let translatedText;
            if (this.currentProviderHasKey) {
                try {
                    translatedText = await this.currentProvider.translate(text, targetLang, sourceLang);
                }
                catch (e) {
                    // 当前提供商失败时，回退到免费 Google
                    const google = new translator_1.GoogleTranslator();
                    translatedText = await google.translate(text, targetLang, sourceLang);
                }
            }
            else {
                const google = new translator_1.GoogleTranslator();
                translatedText = await google.translate(text, targetLang, sourceLang);
            }
            // 3) 统一增加术语解释（按目标语言本地化），并附带提供商标记
            const enhanced = translator_1.CodeTermDictionary.enhanceTranslation(text, translatedText, targetLang);
            return `[[PROVIDER:${this.currentProviderName}]] ${enhanced}`;
        }
        catch (error) {
            console.error('Translation failed:', error);
            throw error;
        }
    }
    async testConnection(providerName) {
        const provider = this.providers.get(providerName);
        if (provider && provider.testConnection) {
            return await provider.testConnection();
        }
        return false;
    }
    getCurrentProviderName() {
        return this.currentProvider.name;
    }
}
exports.TranslationManager = TranslationManager;
//# sourceMappingURL=translationManager.js.map