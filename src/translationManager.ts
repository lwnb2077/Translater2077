import * as vscode from 'vscode';
import { GoogleTranslator, CodeTermDictionary, OpenAITranslator, GeminiTranslator, DeepLTranslator, DeepSeekTranslator } from './translator';
import axios from 'axios';

export interface TranslationProvider {
    name: string;
    translate(text: string, targetLang: string, sourceLang?: string): Promise<string>;
    testConnection?(apiKey?: string): Promise<boolean>;
}


export class MicrosoftTranslator implements TranslationProvider {
    name = 'microsoft';
    private apiKey: string;
    private region: string;

    constructor(apiKey: string, region: string = 'global') {
        this.apiKey = apiKey;
        this.region = region;
    }

    async translate(text: string, targetLang: string, sourceLang: string = 'auto'): Promise<string> {
        if (!this.apiKey) {
            throw new Error('微软翻译需要API密钥');
        }

        try {
            const response = await axios.post(
                'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0',
                [{ Text: text }],
                {
                    params: {
                        to: targetLang,
                        from: sourceLang === 'auto' ? undefined : sourceLang
                    },
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey,
                        'Ocp-Apim-Subscription-Region': this.region,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data && response.data[0] && response.data[0].translations) {
                return response.data[0].translations[0].text;
            }
            
            throw new Error('微软翻译API返回格式错误');
        } catch (error) {
            console.error('Microsoft translation error:', error);
            return `微软翻译失败: ${text}`;
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            if (!this.apiKey) return false;
            const resp = await axios.post(
                'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0',
                [{ Text: 'hello' }],
                {
                    params: { to: 'zh' },
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey,
                        'Ocp-Apim-Subscription-Region': this.region,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return !!(resp.status >= 200 && resp.status < 300);
        } catch {
            return false;
        }
    }
}


export class TranslationManager {
    private currentProvider: TranslationProvider;
    private providers: Map<string, TranslationProvider> = new Map();
    private currentProviderName: string = 'google';
    private currentProviderHasKey: boolean = false;

    constructor() {
        // 默认使用Google翻译
        this.currentProvider = new GoogleTranslator();
        this.providers.set('google', this.currentProvider);
    }

    public updateProvider(providerName: string, config: vscode.WorkspaceConfiguration) {
        const apiKey = config.get<string>(`${providerName}ApiKey`, '')
            || (providerName === 'openai' ? config.get<string>('openaiApiKey','') : '')
            || (providerName === 'gemini' ? config.get<string>('geminiApiKey','') : '')
            || (providerName === 'deepseek' ? config.get<string>('deepseekApiKey','') : '');
        
        let provider: TranslationProvider;
        
        switch (providerName) {
            case 'google':
                provider = new GoogleTranslator(apiKey);
                break;
            case 'deepl':
                provider = new DeepLTranslator(apiKey);
                break;
            case 'microsoft':
                provider = new MicrosoftTranslator(
                    apiKey,
                    config.get<string>('microsoftRegion', 'global')
                );
                break;
            case 'openai':
                provider = new OpenAITranslator(apiKey);
                break;
            case 'gemini':
                provider = new GeminiTranslator(apiKey);
                break;
            case 'deepseek':
                provider = new DeepSeekTranslator(apiKey);
                break;
            default:
                provider = new GoogleTranslator(apiKey);
        }
        
        this.providers.set(providerName, provider);
        this.currentProvider = provider;
        this.currentProviderName = providerName;
        this.currentProviderHasKey = !!apiKey;
    }

    public async translate(text: string, targetLang: string = 'zh-CN', sourceLang: string = 'auto'): Promise<{translation: string, provider: string}> {
        try {
            // 1) 只对单个词且长度较短的文本尝试词典翻译
            const words = text.trim().split(/\s+/);
            const isSingleWord = words.length === 1;
            const isShortText = text.length <= 20;
            
            // 只有单个词且较短时才使用词典
            if (isSingleWord && isShortText) {
                const dictFirst = CodeTermDictionary.translateUsingDictionary(text, targetLang);
                if (dictFirst) {
                    return {translation: dictFirst, provider: 'dictionary'};
                }
            }

            // 2) 多个词或较长文本直接调用API
            let translatedText: string;
            let actualProvider: string;
            
            if (this.currentProviderHasKey) {
                try {
                    translatedText = await this.currentProvider.translate(text, targetLang, sourceLang);
                    // 判断 Google 使用的是 API 还是免费服务
                    if (this.currentProviderName === 'google') {
                        actualProvider = 'google-api';
                    } else {
                        actualProvider = this.currentProviderName;
                    }
                } catch (e) {
                    // 当前提供商失败时，回退到免费 Google
                    const google = new GoogleTranslator();
                    translatedText = await google.translate(text, targetLang, sourceLang);
                    actualProvider = 'google-free';
                }
            } else {
                // 没有API key时使用免费服务
                const google = new GoogleTranslator();
                translatedText = await google.translate(text, targetLang, sourceLang);
                actualProvider = 'google-free';
            }

            // 3) 增加术语解释并返回结构化结果
            const enhanced = CodeTermDictionary.enhanceTranslation(text, translatedText, targetLang);
            return {translation: enhanced, provider: actualProvider};
        } catch (error) {
            console.error('Translation failed:', error);
            throw error;
        }
    }

    public async testConnection(providerName: string): Promise<boolean> {
        const provider = this.providers.get(providerName);
        if (provider && provider.testConnection) {
            return await provider.testConnection();
        }
        return false;
    }

    public getCurrentProviderName(): string {
        return this.currentProvider.name;
    }
}