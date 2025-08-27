"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsPanel = void 0;
const vscode = __importStar(require("vscode"));
class SettingsPanel {
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('codeTranslatorSettings', '代码翻译器设置', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'media'),
                vscode.Uri.joinPath(extensionUri, 'out', 'compiled')
            ]
        });
        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }
    static revive(panel, extensionUri) {
        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }
    constructor(panel, extensionUri) {
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'saveSettings':
                    await this._saveSettings(message.settings);
                    break;
                case 'loadSettings':
                    await this._loadSettings();
                    break;
                case 'testConnection':
                    await this._testConnection(message.provider, message.apiKey, message.extras);
                    break;
                case 'openVSCodeSettings':
                    await this._openVSCodeSettings(message.setting);
                    break;
            }
        }, null, this._disposables);
    }
    dispose() {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    async _saveSettings(settings) {
        const config = vscode.workspace.getConfiguration('codeTranslator');
        try {
            // 保存所有设置
            await config.update('apiProvider', settings.apiProvider, vscode.ConfigurationTarget.Global);
            await config.update('sourceLanguage', settings.sourceLanguage, vscode.ConfigurationTarget.Global);
            await config.update('targetLanguage', settings.targetLanguage, vscode.ConfigurationTarget.Global);
            await config.update('autoTranslate', settings.autoTranslate, vscode.ConfigurationTarget.Global);
            await config.update('selectionTranslate', settings.selectionTranslate, vscode.ConfigurationTarget.Global);
            await config.update('clickTranslateMode', settings.clickTranslateMode, vscode.ConfigurationTarget.Global);
            await config.update('translationDelay', settings.translationDelay, vscode.ConfigurationTarget.Global);
            await config.update('minWordLength', settings.minWordLength, vscode.ConfigurationTarget.Global);
            await config.update('maxTextLength', settings.maxTextLength, vscode.ConfigurationTarget.Global);
            // showInOutput 已移除
            await config.update('autoHideTranslation', settings.autoHideTranslation, vscode.ConfigurationTarget.Global);
            await config.update('autoHideDelay', settings.autoHideDelay, vscode.ConfigurationTarget.Global);
            await config.update('showInContextMenu', settings.showInContextMenu, vscode.ConfigurationTarget.Global);
            await config.update('detailsDisplayMode', settings.detailsDisplayMode, vscode.ConfigurationTarget.Global);
            await config.update('detailsPanelWidth', settings.detailsPanelWidth, vscode.ConfigurationTarget.Global);
            // 保存API密钥（敏感信息）
            if (settings.apiKeys) {
                for (const [provider, apiKey] of Object.entries(settings.apiKeys)) {
                    await config.update(`${provider}ApiKey`, apiKey, vscode.ConfigurationTarget.Global);
                }
            }
            // 保存扩展提供商参数
            if (typeof settings.microsoftRegion === 'string') {
                await config.update('microsoftRegion', settings.microsoftRegion, vscode.ConfigurationTarget.Global);
            }
            this._panel.webview.postMessage({
                type: 'settingsSaved',
                success: true,
                message: 'settingsSavedSuccess'
            });
            vscode.window.showInformationMessage('代码翻译器设置已保存！');
        }
        catch (error) {
            this._panel.webview.postMessage({
                type: 'settingsSaved',
                success: false,
                message: 'settingsSavedFailed' + ': ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }
    async _loadSettings() {
        const config = vscode.workspace.getConfiguration('codeTranslator');
        const settings = {
            apiProvider: config.get('apiProvider', 'google'),
            sourceLanguage: config.get('sourceLanguage', 'auto'),
            targetLanguage: config.get('targetLanguage', 'zh-CN'),
            autoTranslate: config.get('autoTranslate', true),
            selectionTranslate: config.get('selectionTranslate', true),
            clickTranslateMode: config.get('clickTranslateMode', 'single'),
            singleClickTranslate: config.get('singleClickTranslate', true),
            doubleClickTranslate: config.get('doubleClickTranslate', false),
            translationDelay: config.get('translationDelay', 7),
            minWordLength: config.get('minWordLength', 2),
            maxTextLength: config.get('maxTextLength', 2000),
            // showInOutput 已移除
            autoHideTranslation: config.get('autoHideTranslation', true),
            autoHideDelay: config.get('autoHideDelay', 10),
            showInContextMenu: config.get('showInContextMenu', true),
            detailsDisplayMode: config.get('detailsDisplayMode', 'system'),
            detailsPanelWidth: config.get('detailsPanelWidth', 800),
            apiKeys: {
                google: config.get('googleApiKey', ''),
                deepl: config.get('deeplApiKey', ''),
                microsoft: config.get('microsoftApiKey', ''),
                openai: config.get('openaiApiKey', ''),
                gemini: config.get('geminiApiKey', '')
            },
            // 扩展提供商参数
            microsoftRegion: config.get('microsoftRegion', 'global')
        };
        this._panel.webview.postMessage({
            type: 'settingsLoaded',
            settings: settings
        });
    }
    async _testConnection(provider, apiKey, extras) {
        // 实际调用对应提供商进行连接测试
        try {
            const config = vscode.workspace.getConfiguration('codeTranslator');
            const { TranslationManager } = await Promise.resolve().then(() => __importStar(require('./translationManager')));
            const tm = new TranslationManager();
            // 仅实现 get(section, default) 即可满足 updateProvider 的读取
            const tempConfig = {
                get: (section, defaultValue) => {
                    if (section === `${provider}ApiKey` ||
                        (provider === 'openai' && section === 'openaiApiKey') ||
                        (provider === 'gemini' && section === 'geminiApiKey')) {
                        return apiKey;
                    }
                    // 扩展提供商附加参数
                    if (section === 'deeplApiKey') {
                        return ((extras && extras.deeplApiKey) || apiKey || config.get(section, defaultValue));
                    }
                    if (section === 'microsoftRegion') {
                        return ((extras && extras.microsoftRegion) || config.get(section, defaultValue));
                    }
                    return config.get(section, defaultValue);
                }
            };
            tm.updateProvider(provider, tempConfig);
            // 对必须密钥的提供商进行空值拦截
            const providersRequireKey = new Set(['deepl', 'openai', 'gemini', 'microsoft']);
            if (providersRequireKey.has(provider) && (!apiKey || apiKey.trim().length === 0)) {
                this._panel.webview.postMessage({
                    type: 'connectionTested',
                    success: false,
                    provider: provider,
                    message: 'API连接失败：未提供有效的 API Key'
                });
                return;
            }
            const ok = await tm.testConnection(provider);
            this._panel.webview.postMessage({
                type: 'connectionTested',
                success: ok,
                provider: provider,
                message: ok ? 'API连接成功' : 'API连接失败，请检查密钥/网络/区域访问'
            });
        }
        catch (error) {
            this._panel.webview.postMessage({
                type: 'connectionTested',
                success: false,
                provider: provider,
                message: 'API测试失败: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }
    async _openVSCodeSettings(setting) {
        try {
            await vscode.commands.executeCommand('workbench.action.openSettings', setting);
            this._panel.webview.postMessage({
                type: 'vscodeSettingsOpened',
                success: true,
                message: 'VSCode设置已打开'
            });
        }
        catch (error) {
            this._panel.webview.postMessage({
                type: 'vscodeSettingsOpened',
                success: false,
                message: 'VSCode设置打开失败: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }
    _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }
    _getHtmlForWebview() {
        const webview = this._panel.webview;
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>代码翻译器设置</title>
    <style>
        /* 语言切换按钮样式 */
        .language-switcher {
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            z-index: 1000;
        }

        .language-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        .language-toggle:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .language-icon {
            font-size: 16px;
            color: var(--vscode-textLink-foreground);
        }

        .language-text {
            font-size: 12px;
            color: var(--vscode-foreground);
            font-weight: 500;
        }

        /* 统一顶部两个悬浮按钮的尺寸与布局 */
        .language-toggle,
        .language-actions .save-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 120px;
            height: 36px;
            padding: 0 12px;
            border-radius: 6px;
            font-size: 12px;
            box-sizing: border-box;
        }
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            border: 1px solid var(--vscode-widget-border);
        }
        
        .section h2 {
            margin-top: 0;
            color: var(--vscode-textPreformat-foreground);
            border-bottom: 2px solid var(--vscode-textLink-foreground);
            padding-bottom: 10px;
        }
        /* two-column grid for screens >= 600px, single column otherwise */
        .section-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 600px) { .section-grid { grid-template-columns: 1fr 1fr; } }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: var(--vscode-input-foreground);
        }
        
        select, input[type="text"], input[type="number"] {
            width: 100%;
            padding: 8px 12px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        
        select:focus, input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .checkbox-group {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .checkbox-group input[type="checkbox"] {
            margin-right: 10px;
            width: auto;
        }
        
        .radio-group {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        
        .radio-group input[type="radio"] {
            margin-right: 10px;
            width: auto;
        }
        
        .api-key-group {
            display: flex;
            gap: 10px;
            align-items: end;
        }
        
        .api-key-group input {
            flex: 1;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .save-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 8px 16px;
            font-weight: 600;
        }
        
        .message {
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            position: fixed;
            right: 20px;
            bottom: 20px;
            min-width: 260px;
            max-width: 60vw;
            z-index: 1001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
        
        .message.success {
            background-color: var(--vscode-testing-iconPassed);
            color: white;
        }
        
        .message.error {
            background-color: var(--vscode-testing-iconFailed);
            color: white;
        }
        
        .provider-info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <!-- 语言切换器 + 顶部操作 -->
    <div class="language-switcher">
        <button class="language-toggle" id="languageToggle">
            <span class="language-text" id="languageText">中文</span>
        </button>
        <div class="language-actions">
            <button type="button" class="save-button" id="saveBtn" data-i18n="saveSettings">保存设置</button>
        </div>
    </div>

    <div class="container">
        <h1 data-i18n="title">代码翻译器设置</h1>
        
        <div id="messages"></div>
        
        <!-- API设置 -->
        <div class="section">
            <h2 data-i18n="apiSettings">翻译API设置</h2>
            
            <div class="form-group">
                <label for="apiProvider" data-i18n="providerLabel">翻译服务提供商：</label>
                <select id="apiProvider">
                    <option value="google" data-i18n="provider.google">Google Translate</option>
                    <option value="microsoft" data-i18n="provider.microsoft">微软翻译</option>
                    
                    <option value="openai" data-i18n="provider.openai">OpenAI (GPT‑4o mini)</option>
                    <option value="gemini" data-i18n="provider.gemini">Google Gemini (2.5 Flash)</option>
                </select>
                <div class="provider-info" id="providerInfo"></div>
            </div>
            
            <!-- Google API Key -->
            <div class="form-group api-key-section" id="googleSection">
                <label for="googleApiKey" data-i18n="googleApiKey">Google Translate API Key：</label>
                <div class="api-key-group">
                    <input type="text" id="googleApiKey" data-placeholder-i18n="googleApiKeyPlaceholder">
                    <button type="button" class="secondary test-btn" data-provider="google" data-i18n="testConnection">测试连接</button>
                </div>
            </div>
            
            <!-- Microsoft API Key -->
            <div class="form-group api-key-section hidden" id="microsoftSection">
                <label for="microsoftApiKey" data-i18n="microsoftApiKey">微软翻译API密钥：</label>
                <div class="api-key-group">
                    <input type="text" id="microsoftApiKey" data-placeholder-i18n="microsoftApiKeyPlaceholder">
                    <button type="button" class="secondary test-btn" data-provider="microsoft" data-i18n="testConnection">测试连接</button>
                </div>
            </div>
            
            <!-- OpenAI API Key -->
            <div class="form-group api-key-section hidden" id="openaiSection">
                <label for="openaiApiKey" data-i18n="openaiApiKey">OpenAI API Key：</label>
                <div class="api-key-group">
                    <input type="text" id="openaiApiKey" data-placeholder-i18n="openaiApiKeyPlaceholder">
                    <button type="button" class="secondary test-btn" data-provider="openai" data-i18n="testConnection">测试连接</button>
                </div>
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="openaiNotes">需要有效的 OpenAI 账号与 API Key，计费按使用量收取；部分地区可能无法直连，需配置代理。</p>
            </div>
            
            <!-- Gemini API Key -->
            <div class="form-group api-key-section hidden" id="geminiSection">
                <label for="geminiApiKey" data-i18n="geminiApiKey">Google AI Studio API Key：</label>
                <div class="api-key-group">
                    <input type="text" id="geminiApiKey" data-placeholder-i18n="geminiApiKeyPlaceholder">
                    <button type="button" class="secondary test-btn" data-provider="gemini" data-i18n="testConnection">测试连接</button>
                </div>
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="geminiNotes">需要在 Google AI Studio 申请 API Key；部分地区不可用或需代理，计费与配额以官方为准。</p>
            </div>
            
            </div>
        
        <!-- 语言与行为设置（并排） -->
        <div class="section section-grid">
            <div>
                <h2 data-i18n="languageSettings">语言设置</h2>
                
                <div class="form-group">
                    <label for="sourceLanguage" data-i18n="sourceLanguageLabel">源语言（自动检测推荐）：</label>
                    <select id="sourceLanguage">
                        <option value="auto">自动检测</option>
                        <option value="en">英语</option>
                        <option value="zh">中文</option>
                        <option value="ja">日语</option>
                        <option value="ko">韩语</option>
                        <option value="fr">法语</option>
                        <option value="de">德语</option>
                        <option value="es">西班牙语</option>
                        <option value="it">意大利语</option>
                        <option value="ru">俄语</option>
                        <option value="pt">葡萄牙语</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="targetLanguage" data-i18n="targetLanguageLabel">目标语言：</label>
                    <select id="targetLanguage">
                        <option value="zh-CN">简体中文</option>
                        <option value="zh-TW">繁体中文</option>
                        <option value="en">英语</option>
                        <option value="ja">日语</option>
                        <option value="ko">韩语</option>
                        <option value="fr">法语</option>
                        <option value="de">德语</option>
                        <option value="es">西班牙语</option>
                        <option value="it">意大利语</option>
                        <option value="ru">俄语</option>
                        <option value="pt">葡萄牙语</option>
                    </select>
                </div>
            </div>
            <div>
                <h2 data-i18n="behaviorSettings">翻译行为设置</h2>
                
                <div class="form-group">
                    <label data-i18n="translateModeLabel">翻译模式：</label>
                    
                    <div class="checkbox-group">
                        <input type="checkbox" id="selectionTranslate">
                        <label for="selectionTranslate" data-i18n="selectionTranslateLabel">划词选中文本翻译</label>
                    </div>
                    
                    <div class="form-group">
                        <label data-i18n="clickTranslateModeLabel">点击翻译模式：</label>
                        
                        <div class="radio-group">
                            <input type="radio" id="clickModeNone" name="clickTranslateMode" value="none">
                            <label for="clickModeNone" data-i18n="clickModeNoneLabel">禁用点击翻译</label>
                        </div>
                        
                        <div class="radio-group">
                            <input type="radio" id="clickModeSingle" name="clickTranslateMode" value="single">
                            <label for="clickModeSingle" data-i18n="clickModeSingleLabel">单击单词翻译</label>
                        </div>
                        
                        <div class="radio-group">
                            <input type="radio" id="clickModeDouble" name="clickTranslateMode" value="double">
                            <label for="clickModeDouble" data-i18n="clickModeDoubleLabel">双击单词翻译</label>
                        </div>
                    </div>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="autoTranslate">
                    <label for="autoTranslate" data-i18n="autoTranslateLabel">启用自动翻译</label>
                </div>
                
                <div class="form-group">
                    <label for="translationDelay" data-i18n="translationDelayLabel">翻译延迟时间（毫秒）：</label>
                    <input type="number" id="translationDelay" min="1" max="5000" step="1">
                </div>
                
                <div class="form-group">
                    <label for="minWordLength" data-i18n="minWordLengthLabel">最小翻译单词长度（字符数）：</label>
                    <input type="number" id="minWordLength" min="1" max="10">
                </div>
                
                <div class="form-group">
                    <label for="maxTextLength" data-i18n="maxTextLengthLabel">最大翻译字符数：</label>
                    <input type="number" id="maxTextLength" min="100" max="10000" step="50">
                </div>
            </div>
        </div>
        
        <!-- 显示与 VSCode 设置（并排） -->
        <div class="section section-grid">
            <div>
                <h2 data-i18n="displaySettings">显示设置</h2>
                
                <!-- showInOutput 设置已移除 -->
                
                <div class="checkbox-group">
                    <input type="checkbox" id="showInContextMenu">
                    <label for="showInContextMenu" data-i18n="showInContextMenuLabel">在右键菜单显示翻译选项</label>
                </div>
                
                <div class="checkbox-group">
                    <input type="checkbox" id="autoHideTranslation">
                    <label for="autoHideTranslation" data-i18n="autoHideTranslationLabel">翻译结果自动消失</label>
                </div>
                
                <div class="form-group">
                    <label for="autoHideDelay" data-i18n="autoHideDelayLabel">翻译结果自动消失延迟时间（秒）：</label>
                    <input type="number" id="autoHideDelay" min="3" max="120" step="1">
                </div>
                <div class="form-group">
                    <label data-i18n="detailsModeLabel">详情展示方式：</label>
                    <div class="radio-group">
                        <input type="radio" id="detailsModeSystem" name="detailsMode" value="system">
                        <label for="detailsModeSystem" data-i18n="detailsModeSystem">系统弹窗</label>
                    </div>
                    <div class="radio-group">
                        <input type="radio" id="detailsModePanel" name="detailsMode" value="panel">
                        <label for="detailsModePanel" data-i18n="detailsModePanel">面板（可滚动，固定宽度）</label>
                    </div>
                </div>
                <div class="form-group" id="panelWidthGroup">
                    <label for="detailsPanelWidth" data-i18n="detailsPanelWidthLabel">面板宽度（px，480-1600）：</label>
                    <input type="number" id="detailsPanelWidth" min="480" max="1600" step="10">
                </div>
            </div>
            <div>
                <h2 data-i18n="vscodeSettings">VSCode全局设置优化</h2>
                
                <div class="form-group">
                    <label data-i18n="tooltipOptimizationLabel">Tooltip显示延迟优化：</label>
                    <p style="color: var(--vscode-descriptionForeground); font-size: 14px; margin-bottom: 10px;" data-i18n="tooltipOptimizationDesc">
                        VSCode默认tooltip延迟约1000毫秒，建议设置为100-200毫秒以获得更好的使用体验。
                    </p>
                    <button type="button" class="secondary" id="openTooltipBtn" style="margin-bottom: 10px;" data-i18n="openTooltipSettings">
                        打开VSCode Tooltip延迟设置
                    </button>
                    <p style="color: var(--vscode-descriptionForeground); font-size: 12px;" data-i18n="tooltipRecommendation">
                        建议设置值：workbench.hover.delay: 150
                    </p>
                </div>
            </div>
        </div>
        
        
    </div>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        // 多语言资源
        const i18nResources = {
            zh: {
                title: "🌐 代码翻译器设置",
                apiSettings: "🔑 翻译API设置",
                providerLabel: "翻译服务提供商：",
                "provider.google": "Google Translate",
                "provider.microsoft": "微软翻译",
                "provider.openai": "OpenAI (GPT‑4o mini)",
                "provider.gemini": "Google Gemini (2.5 Flash)",
                googleApiKey: "Google Translate API Key：",
                googleApiKeyPlaceholder: "输入您的Google API密钥（可选，不填使用免费服务）",
                microsoftApiKey: "微软翻译API密钥：",
                microsoftApiKeyPlaceholder: "输入您的微软翻译API密钥",
                testConnection: "测试连接",
                openaiApiKey: "OpenAI API Key：",
                openaiApiKeyPlaceholder: "输入 OpenAI API Key（用于 GPT‑4o mini）",
                geminiApiKey: "Google AI Studio API Key：",
                geminiApiKeyPlaceholder: "输入 Google AI Studio API Key（用于 Gemini 2.5 Flash）",
                openaiNotes: "需要有效的 OpenAI 账号与 API Key，计费按使用量收取；部分地区可能无法直连，需配置代理。",
                geminiNotes: "需要在 Google AI Studio 申请 API Key；部分地区不可用或需代理，计费与配额以官方为准。",
                languageSettings: "🌍 语言设置",
                sourceLanguageLabel: "源语言（自动检测推荐）：",
                targetLanguageLabel: "目标语言：",
                behaviorSettings: "⚙️ 翻译行为设置",
                translateModeLabel: "翻译模式：",
                selectionTranslateLabel: "划词选中文本翻译",
                clickTranslateModeLabel: "点击翻译模式：",
                clickModeNoneLabel: "禁用点击翻译",
                clickModeSingleLabel: "单击单词翻译",
                clickModeDoubleLabel: "双击单词翻译",
                singleClickTranslateLabel: "单击单词翻译",
                doubleClickTranslateLabel: "双击单词翻译",
                autoTranslateLabel: "启用自动翻译",
                clickTranslateLabel: "启用点击单词翻译",
                translationDelayLabel: "翻译延迟时间（毫秒）：",
                minWordLengthLabel: "最小翻译单词长度（字符数）：",
                maxTextLengthLabel: "最大翻译字符数：",
                displaySettings: "📺 显示设置",
                // showInOutputLabel 已移除
                showInContextMenuLabel: "在右键菜单显示翻译选项",
                autoHideTranslationLabel: "翻译结果自动消失",
                autoHideDelayLabel: "翻译结果自动消失延迟时间（秒）：",
                vscodeSettings: "🔧 VSCode全局设置优化",
                tooltipOptimizationLabel: "Tooltip显示延迟优化：",
                tooltipOptimizationDesc: "VSCode默认tooltip延迟约1000毫秒，建议设置为100-200毫秒以获得更好的使用体验。",
                openTooltipSettings: "🚀 打开VSCode Tooltip延迟设置",
                tooltipRecommendation: "建议设置值：workbench.hover.delay: 150",
                saveSettings: "保存设置",
                settingsSavedSuccess: "设置已保存",
                settingsSavedFailed: "设置保存失败",
                savingSettings: "正在保存设置…",
                detailsModeLabel: "详情展示方式：",
                detailsModeSystem: "系统弹窗",
                detailsModePanel: "面板（可滚动，固定宽度）",
                detailsPanelWidthLabel: "面板宽度（px，480-1600）：",
                // 语言选项
                languageOptions: {
                    auto: "自动检测",
                    en: "英语",
                    zh: "中文", 
                    "zh-CN": "简体中文",
                    "zh-TW": "繁体中文",
                    ja: "日语",
                    ko: "韩语",
                    fr: "法语",
                    de: "德语",
                    es: "西班牙语",
                    it: "意大利语",
                    ru: "俄语",
                    pt: "葡萄牙语"
                },
                openaiNotes: "需要有效的 OpenAI 账号与 API Key，计费按使用量收取；部分地区可能无法直连，需配置代理。",
                geminiNotes: "需要在 Google AI Studio 申请 API Key；部分地区不可用或需代理，计费与配额以官方为准。"
            },
            en: {
                title: "🌐 Code Translator Settings",
                apiSettings: "🔑 Translation API Settings",
                providerLabel: "Translation Service Provider:",
                "provider.google": "Google Translate",
                "provider.microsoft": "Microsoft Translator",
                "provider.openai": "OpenAI (GPT‑4o mini)",
                "provider.gemini": "Google Gemini (2.5 Flash)",
                googleApiKey: "Google Translate API Key:",
                googleApiKeyPlaceholder: "Enter your Google API key (optional, uses free service if empty)",
                microsoftApiKey: "Microsoft Translator API Key:",
                microsoftApiKeyPlaceholder: "Enter your Microsoft Translator API key",
                testConnection: "Test Connection",
                openaiApiKey: "OpenAI API Key:",
                openaiApiKeyPlaceholder: "Enter OpenAI API Key (for GPT‑4o mini)",
                geminiApiKey: "Google AI Studio API Key:",
                geminiApiKeyPlaceholder: "Enter Google AI Studio API Key (for Gemini 2.5 Flash)",
                openaiNotes: "OpenAI account and API key required; usage-based billing; proxy may be required in some regions.",
                geminiNotes: "API key from Google AI Studio required; availability and quotas vary by region; proxy may be needed.",
                languageSettings: "🌍 Language Settings",
                sourceLanguageLabel: "Source Language (Auto-detect recommended):",
                targetLanguageLabel: "Target Language:",
                behaviorSettings: "⚙️ Translation Behavior Settings",
                translateModeLabel: "Translation Mode:",
                selectionTranslateLabel: "Selection text translation",
                clickTranslateModeLabel: "Click Translation Mode:",
                clickModeNoneLabel: "Disable click translation",
                clickModeSingleLabel: "Single click word translation",
                clickModeDoubleLabel: "Double click word translation",
                singleClickTranslateLabel: "Single click word translation", 
                doubleClickTranslateLabel: "Double click word translation",
                autoTranslateLabel: "Enable automatic translation",
                clickTranslateLabel: "Enable click word translation",
                translationDelayLabel: "Translation delay time (milliseconds):",
                minWordLengthLabel: "Minimum word length for translation (characters):",
                maxTextLengthLabel: "Maximum text length for translation:",
                displaySettings: "📺 Display Settings",
                // showInOutputLabel removed
                showInContextMenuLabel: "Show translation option in context menu",
                autoHideTranslationLabel: "Auto-hide translation results",
                autoHideDelayLabel: "Auto-hide delay time (seconds):",
                vscodeSettings: "🔧 VSCode Global Settings Optimization",
                tooltipOptimizationLabel: "Tooltip Display Delay Optimization:",
                tooltipOptimizationDesc: "VSCode default tooltip delay is about 1000ms, recommend setting to 100-200ms for better user experience.",
                openTooltipSettings: "🚀 Open VSCode Tooltip Delay Settings",
                tooltipRecommendation: "Recommended setting: workbench.hover.delay: 150",
                saveSettings: "Save Settings",
                settingsSavedSuccess: "Settings saved",
                settingsSavedFailed: "Failed to save settings",
                savingSettings: "Saving settings…",
                detailsModeLabel: "Details display mode:",
                detailsModeSystem: "System dialog",
                detailsModePanel: "Panel (scrollable, fixed width)",
                detailsPanelWidthLabel: "Panel width (px, 480-1600):",
                // Language options
                languageOptions: {
                    auto: "Auto-detect",
                    en: "English",
                    zh: "Chinese",
                    "zh-CN": "Simplified Chinese",
                    "zh-TW": "Traditional Chinese", 
                    ja: "Japanese",
                    ko: "Korean",
                    fr: "French",
                    de: "German",
                    es: "Spanish",
                    it: "Italian",
                    ru: "Russian",
                    pt: "Portuguese"
                },
                openaiNotes: "Requires a valid OpenAI account and API key, billed based on usage; some regions may not be directly accessible, requiring proxy configuration.",
                geminiNotes: "Requires API key from Google AI Studio; some regions may be unavailable or require proxy, with fees and quotas subject to official documentation."
            },
            ja: {
                title: "🌐 コード翻訳器設定",
                apiSettings: "🔑 翻訳API設定",
                providerLabel: "翻訳サービスプロバイダー：",
                "provider.google": "Google翻訳",
                "provider.microsoft": "Microsoft翻訳",
                "provider.openai": "OpenAI (GPT‑4o mini)",
                "provider.gemini": "Google Gemini (2.5 Flash)",
                googleApiKey: "Google翻訳APIキー：",
                googleApiKeyPlaceholder: "GoogleのAPIキーを入力（オプション、空の場合無料サービスを使用）",
                microsoftApiKey: "Microsoft翻訳APIキー：",
                microsoftApiKeyPlaceholder: "Microsoft翻訳のAPIキーを入力",
                testConnection: "接続テスト",
                openaiApiKey: "OpenAI APIキー：",
                openaiApiKeyPlaceholder: "OpenAIのAPIキーを入力（GPT‑4o mini 用）",
                geminiApiKey: "Google AI Studio APIキー：",
                geminiApiKeyPlaceholder: "Google AI Studio の APIキーを入力（Gemini 2.5 Flash 用）",
                openaiNotes: "OpenAIのアカウントとAPIキーが必要です。従量課金。地域によりプロキシが必要な場合があります。",
                geminiNotes: "Google AI Studio でAPIキーが必要です。地域により利用不可/プロキシが必要な場合があります。",
                languageSettings: "🌍 言語設定",
                sourceLanguageLabel: "ソース言語（自動検出推奨）：",
                targetLanguageLabel: "ターゲット言語：",
                behaviorSettings: "⚙️ 翻訳動作設定",
                translateModeLabel: "翻訳モード：",
                selectionTranslateLabel: "選択テキスト翻訳",
                clickTranslateModeLabel: "クリック翻訳モード：",
                clickModeNoneLabel: "クリック翻訳を無効にする",
                clickModeSingleLabel: "シングルクリック単語翻訳",
                clickModeDoubleLabel: "ダブルクリック単語翻訳",
                singleClickTranslateLabel: "単語シングルクリック翻訳",
                doubleClickTranslateLabel: "単語ダブルクリック翻訳",
                autoTranslateLabel: "自動翻訳を有効にする",
                clickTranslateLabel: "クリック単語翻訳を有効にする",
                translationDelayLabel: "翻訳遅延時間（ミリ秒）：",
                minWordLengthLabel: "翻訳する最小単語長（文字数）：",
                maxTextLengthLabel: "翻訳する最大文字数：",
                displaySettings: "📺 表示設定",
                // showInOutputLabel removed
                showInContextMenuLabel: "右クリックメニューに翻訳オプションを表示",
                autoHideTranslationLabel: "翻訳結果を自動で隠す",
                autoHideDelayLabel: "自動非表示遅延時間（秒）：",
                vscodeSettings: "🔧 VSCodeグローバル設定最適化",
                tooltipOptimizationLabel: "ツールチップ表示遅延最適化：",
                tooltipOptimizationDesc: "VSCodeのデフォルトツールチップ遅延は約1000msです。より良いユーザー体験のために100-200msに設定することをお勧めします。",
                openTooltipSettings: "🚀 VSCodeツールチップ遅延設定を開く",
                tooltipRecommendation: "推奨設定：workbench.hover.delay: 150",
                saveSettings: "設定を保存",
                settingsSavedSuccess: "設定を保存しました",
                settingsSavedFailed: "設定の保存に失敗しました",
                savingSettings: "設定を保存しています…",
                detailsModeLabel: "詳細の表示方法：",
                detailsModeSystem: "システムダイアログ",
                detailsModePanel: "パネル（スクロール可、固定幅）",
                detailsPanelWidthLabel: "パネル幅（px、480-1600）：",
                // 言語オプション
                languageOptions: {
                    auto: "自動検出",
                    en: "英語",
                    zh: "中国語",
                    "zh-CN": "簡体字中国語",
                    "zh-TW": "繁体字中国語",
                    ja: "日本語",
                    ko: "韓国語",
                    fr: "フランス語",
                    de: "ドイツ語",
                    es: "スペイン語",
                    it: "イタリア語",
                    ru: "ロシア語",
                    pt: "ポルトガル語"
                },
                // 翻訳モードオプション
                translateModeOptions: {
                    all: "選択、クリック、ダブルクリック翻訳をサポート",
                    selection: "選択テキスト翻訳のみ",
                    click: "単語クリック翻訳のみ",
                    doubleClick: "単語ダブルクリック翻訳のみ"
                },
                openaiNotes: "有効な OpenAI アカウントと API キーが必要です。使用量に応じて課金されます。一部の地域では直接接続できない場合があり、プロキシ設定が必要です。",
                geminiNotes: "Google AI Studio から API キーを申請する必要があります。一部の地域では利用できない場合やプロキシが必要な場合があります。",
                geminiNotes: "Google AI Studio から API キーを申請する必要があります。一部の地域では利用できない場合やプロキシが必要な場合があります。"
            }
        };
        
        // 当前语言
        let currentLanguage = 'zh';
        const supportedLanguages = ['zh', 'en', 'ja'];
        const languageNames = {
            zh: '中文',
            en: 'English', 
            ja: '日本語'
        };
        
        // 语言切换功能
        function toggleLanguage() {
            const currentIndex = supportedLanguages.indexOf(currentLanguage);
            const nextIndex = (currentIndex + 1) % supportedLanguages.length;
            currentLanguage = supportedLanguages[nextIndex];
            updateLanguageDisplay();
            updatePageLanguage();
        }
        
        function updateLanguageDisplay() {
            document.getElementById('languageText').textContent = languageNames[currentLanguage];
        }
        
        function updatePageLanguage() {
            const resources = i18nResources[currentLanguage];
            
            // 更新所有带有data-i18n属性的元素
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                if (resources[key]) {
                    element.textContent = resources[key];
                }
            });
            
            // 更新所有带有data-placeholder-i18n属性的输入框
            document.querySelectorAll('[data-placeholder-i18n]').forEach(element => {
                const key = element.getAttribute('data-placeholder-i18n');
                if (resources[key]) {
                    element.placeholder = resources[key];
                }
            });
            
            // 更新语言选择下拉菜单选项
            updateLanguageSelectOptions();
            
            // 更新提供商信息
            updateProviderInfo();
        }
        
        function updateLanguageSelectOptions() {
            const resources = i18nResources[currentLanguage];
            const languageOptions = resources.languageOptions;
            
            // 更新源语言选项
            const sourceSelect = document.getElementById('sourceLanguage');
            if (sourceSelect && languageOptions) {
                Array.from(sourceSelect.options).forEach(option => {
                    if (languageOptions[option.value]) {
                        option.textContent = languageOptions[option.value];
                    }
                });
            }
            
            // 更新目标语言选项
            const targetSelect = document.getElementById('targetLanguage');
            if (targetSelect && languageOptions) {
                Array.from(targetSelect.options).forEach(option => {
                    if (languageOptions[option.value]) {
                        option.textContent = languageOptions[option.value];
                    }
                });
            }
        }
        
        
        // 提供商信息（多语言）
        const providerInfoData = {
            zh: {
                google: "支持100多种语言，免费版有配额限制",
                microsoft: "微软翻译，支持60多种语言，需要Azure订阅",
                openai: "OpenAI (GPT‑4o mini)，需要有效的 OpenAI 账号与 API Key，计费按使用量收取；部分地区可能无法直连，需配置代理。",
                gemini: "Google Gemini (2.5 Flash)，需要在 Google AI Studio 申请 API Key；部分地区不可用或需代理，计费与配额以官方为准。"
            },
            en: {
                google: "Supports 100+ languages, free version has quota limits",
                microsoft: "Microsoft Translator, supports 60+ languages, requires Azure subscription",
                openai: "OpenAI (GPT‑4o mini), requires a valid OpenAI account and API key, billed based on usage; some regions may not be directly accessible, requiring proxy configuration.",
                gemini: "Google Gemini (2.5 Flash), requires API key from Google AI Studio; some regions may be unavailable or require proxy, with fees and quotas subject to official documentation."
            },
            ja: {
                google: "100以上の言語をサポート、無料版には制限あり",
                microsoft: "Microsoft翻訳、60以上の言語をサポート、Azureサブスクリプションが必要",
                openai: "OpenAI (GPT‑4o mini)，OpenAIのアカウントとAPIキーが必要です。従量課金。地域によりプロキシが必要な場合があります。",
                gemini: "Google Gemini (2.5 Flash)，Google AI Studio でAPIキーが必要です。地域により利用不可/プロキシが必要な場合があります。"
            }
        };
        
        function updateProviderInfo() {
            const provider = document.getElementById('apiProvider').value;
            const infoElement = document.getElementById('providerInfo');
            const providerInfo = providerInfoData[currentLanguage];
            if (providerInfo && providerInfo[provider]) {
                infoElement.textContent = providerInfo[provider];
            }
        }
        
        // 监听来自扩展的消息
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'settingsLoaded':
                    loadSettingsToForm(message.settings);
                    break;
                case 'settingsSaved':
                    {
                        const resources = i18nResources[currentLanguage] || i18nResources.zh;
                        const display = resources[message.message] || message.message;
                        showMessage(message.success ? 'success' : 'error', display);
                    }
                    break;
                case 'connectionTested':
                    showMessage(message.success ? 'success' : 'error', 
                               message.provider.toUpperCase() + ': ' + message.message);
                    break;
            }
        });
        
        // API提供商切换
        document.getElementById('apiProvider').addEventListener('change', function() {
            const provider = this.value;
            
            // 隐藏所有API密钥输入框
            document.querySelectorAll('.api-key-section').forEach(section => {
                section.classList.add('hidden');
            });
            
            // 显示当前选中的API密钥输入框
            const currentSection = document.getElementById(provider + 'Section');
            if (currentSection) {
                currentSection.classList.remove('hidden');
            }
            
            // 更新提供商信息
            updateProviderInfo();
        });
        
        // 详情显示方式切换处理
        function updatePanelWidthVisibility() {
            const panelWidthGroup = document.getElementById('panelWidthGroup');
            const panelModeRadio = document.getElementById('detailsModePanel');
            if (panelWidthGroup && panelModeRadio) {
                if (panelModeRadio.checked) {
                    panelWidthGroup.style.display = 'block';
                } else {
                    panelWidthGroup.style.display = 'none';
                }
            }
        }
        
        // 监听详情显示方式变化
        document.querySelectorAll('input[name="detailsMode"]').forEach(radio => {
            radio.addEventListener('change', updatePanelWidthVisibility);
        });
        
        // 加载设置到表单
        function loadSettingsToForm(settings) {
            document.getElementById('apiProvider').value = settings.apiProvider;
            document.getElementById('sourceLanguage').value = settings.sourceLanguage;
            document.getElementById('targetLanguage').value = settings.targetLanguage;
            document.getElementById('autoTranslate').checked = settings.autoTranslate;
            document.getElementById('selectionTranslate').checked = settings.selectionTranslate;
            
            // 设置单选按钮
            const clickMode = settings.clickTranslateMode || 'single';
            document.getElementById('clickModeNone').checked = (clickMode === 'none');
            document.getElementById('clickModeSingle').checked = (clickMode === 'single');
            document.getElementById('clickModeDouble').checked = (clickMode === 'double');
            
            // 兼容旧配置：移除对已废弃复选框的引用，避免空引用错误
            document.getElementById('translationDelay').value = settings.translationDelay;
            document.getElementById('minWordLength').value = settings.minWordLength;
            document.getElementById('maxTextLength').value = settings.maxTextLength;
            // showInOutput 已移除
            document.getElementById('showInContextMenu').checked = settings.showInContextMenu;
            document.getElementById('autoHideTranslation').checked = settings.autoHideTranslation;
            document.getElementById('autoHideDelay').value = settings.autoHideDelay;
            // 详情显示方式
            (settings.detailsDisplayMode === 'panel' ? document.getElementById('detailsModePanel') : document.getElementById('detailsModeSystem')).checked = true;
            document.getElementById('detailsPanelWidth').value = settings.detailsPanelWidth || 800;
            
            // 加载API密钥
            if (settings.apiKeys) {
                Object.entries(settings.apiKeys).forEach(([provider, apiKey]) => {
                    const input = document.getElementById(provider + 'ApiKey');
                    if (input) {
                        input.value = apiKey;
                    }
                });
            }
            
            // 触发提供商切换事件
            document.getElementById('apiProvider').dispatchEvent(new Event('change'));
            
            // 更新面板宽度显示状态
            updatePanelWidthVisibility();
            
            // 更新当前语言显示
            updatePageLanguage();
        }
        
        // 工具：数值解析和范围校验
        function getNumberValue(id, def, min, max) {
            const el = document.getElementById(id);
            let v = parseInt(el && el.value);
            if (isNaN(v)) v = def;
            if (typeof min === 'number' && v < min) v = min;
            if (typeof max === 'number' && v > max) v = max;
            return v;
        }

        // 保存设置
        function saveSettings() {
            // 以单选为准，派生兼容字段
            const clickModeValue = (() => {
                const checkedElement = document.querySelector('input[name="clickTranslateMode"]:checked');
                return checkedElement ? checkedElement.value : 'single';
            })();

            const settings = {
                apiProvider: document.getElementById('apiProvider').value,
                sourceLanguage: document.getElementById('sourceLanguage').value,
                targetLanguage: document.getElementById('targetLanguage').value,
                autoTranslate: document.getElementById('autoTranslate').checked,
                selectionTranslate: document.getElementById('selectionTranslate').checked,
                clickTranslateMode: clickModeValue,
                // 兼容旧版本字段，但不再写入 VSCode 配置
                singleClickTranslate: clickModeValue === 'single',
                doubleClickTranslate: clickModeValue === 'double',
                translationDelay: getNumberValue('translationDelay', 7, 1, 5000),
                minWordLength: getNumberValue('minWordLength', 2, 1, 10),
                maxTextLength: getNumberValue('maxTextLength', 2000, 100, 10000),
                // showInOutput 已移除
                showInContextMenu: document.getElementById('showInContextMenu').checked,
                autoHideTranslation: document.getElementById('autoHideTranslation').checked,
                autoHideDelay: getNumberValue('autoHideDelay', 10, 3, 120),
                detailsDisplayMode: (document.querySelector('input[name="detailsMode"]:checked')?.value) || 'system',
                detailsPanelWidth: getNumberValue('detailsPanelWidth', 800, 480, 1600),
                apiKeys: {
                    google: document.getElementById('googleApiKey').value,
                    deepl: document.getElementById('deeplApiKey')?.value || '',
                    microsoft: document.getElementById('microsoftApiKey').value,
                    openai: document.getElementById('openaiApiKey').value,
                    gemini: document.getElementById('geminiApiKey').value
                },
                // 扩展的提供商参数
                microsoftRegion: document.getElementById('microsoftRegion')?.value || ''
            };
            
            // 立即在页面提示保存中，避免“无反应”的体验
            const resources = i18nResources[currentLanguage] || i18nResources.zh;
            showMessage('success', resources.savingSettings || '正在保存设置…');

            vscode.postMessage({
                type: 'saveSettings',
                settings: settings
            });
        }
        
        // 测试API连接
        function testConnection(provider) {
            const apiKeyInput = document.getElementById(provider + 'ApiKey');
            const apiKey = apiKeyInput ? apiKeyInput.value : '';
            
            if (!apiKey && provider !== 'google') {
                showMessage('error', '请先输入API密钥');
                return;
            }
            
            vscode.postMessage({
                type: 'testConnection',
                provider: provider,
                apiKey: apiKey
            });
        }
        
        // 显示消息
        function showMessage(type, message) {
            const existing = document.querySelector('.message');
            if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
            const container = document.body;
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type;
            messageDiv.textContent = message;
            container.appendChild(messageDiv);
            setTimeout(() => {
                if (messageDiv.parentNode) messageDiv.parentNode.removeChild(messageDiv);
            }, 5000);
        }
        
        // 打开VSCode Tooltip设置
        function openVSCodeTooltipSettings() {
            vscode.postMessage({
                type: 'openVSCodeSettings',
                setting: 'workbench.hover.delay'
            });
        }
        
        // 页面加载时初始化和事件绑定
        document.addEventListener('DOMContentLoaded', function() {
            updateLanguageDisplay();
            
            // 绑定保存按钮
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => saveSettings());
            }
            // 绑定语言切换
            const langToggle = document.getElementById('languageToggle');
            if (langToggle) {
                langToggle.addEventListener('click', () => toggleLanguage());
            }
            // 绑定测试连接按钮
            document.querySelectorAll('.test-btn').forEach((btn) => {
                const provider = btn.getAttribute('data-provider');
                btn.addEventListener('click', () => provider && testConnection(provider));
            });
            // 绑定打开VSCode设置
            const openTooltipBtn = document.getElementById('openTooltipBtn');
            if (openTooltipBtn) {
                openTooltipBtn.addEventListener('click', () => openVSCodeTooltipSettings());
            }
            
            // 页面加载时请求设置
            vscode.postMessage({ type: 'loadSettings' });
        });
    </script>
</body>
</html>`;
    }
}
exports.SettingsPanel = SettingsPanel;
// 生成 CSP nonce
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=settingsPanel.js.map