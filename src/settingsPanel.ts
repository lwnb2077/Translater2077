import * as vscode from 'vscode';
import { SecretStore } from './secretStore';
import { listModels, OPENAI_COMPAT_PRESETS } from './modelCatalog';

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'codeTranslatorSettings',
            'Translater2077设置',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out', 'compiled')
                ]
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'saveSettings':
                        await this._saveSettings(message.settings);
                        break;
                    case 'loadSettings':
                        await this._loadSettings();
                        break;
                    case 'testConnection':
                        await this._testConnection(message.provider, message.apiKey, message.extras || {});
                        break;
                    case 'fetchModels':
                        await this._fetchModels(message.provider, message.apiKey, message.extras || {});
                        break;
                    case 'openVSCodeSettings':
                        await this._openVSCodeSettings(message.setting);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private async _saveSettings(settings: any) {
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
            
            // API 密钥写入系统密钥存储，绝不落进 settings.json
            if (settings.apiKeys) {
                const store = SecretStore.get();
                for (const [provider, apiKey] of Object.entries(settings.apiKeys)) {
                    await store.setKey(provider, typeof apiKey === 'string' ? apiKey : '');
                }
            }

            // 保存扩展提供商参数
            if (typeof settings.microsoftRegion === 'string') {
                await config.update('microsoftRegion', settings.microsoftRegion, vscode.ConfigurationTarget.Global);
            }
            const modelFields = [
                'openaiModel', 'geminiModel', 'deepseekModel', 'openrouterModel',
                ...Object.keys(OPENAI_COMPAT_PRESETS).map((p) => `${p}Model`),
            ];
            for (const field of modelFields) {
                if (typeof settings[field] === 'string') {
                    await config.update(field, settings[field], vscode.ConfigurationTarget.Global);
                }
            }
            if (typeof settings.customOpenAIBaseUrl === 'string') {
                await config.update('customOpenAIBaseUrl', settings.customOpenAIBaseUrl, vscode.ConfigurationTarget.Global);
            }
            if (typeof settings.customOpenAIModel === 'string') {
                await config.update('customOpenAIModel', settings.customOpenAIModel, vscode.ConfigurationTarget.Global);
            }
            if (typeof settings.customAnthropicBaseUrl === 'string') {
                await config.update('customAnthropicBaseUrl', settings.customAnthropicBaseUrl, vscode.ConfigurationTarget.Global);
            }
            if (typeof settings.customAnthropicModel === 'string') {
                await config.update('customAnthropicModel', settings.customAnthropicModel, vscode.ConfigurationTarget.Global);
            }
            if (typeof settings.customAnthropicVersion === 'string') {
                await config.update('customAnthropicVersion', settings.customAnthropicVersion, vscode.ConfigurationTarget.Global);
            }

            // Key 存在 SecretStorage 而非配置里，改 Key 不会触发 onDidChangeConfiguration，
            // 因此保存后必须主动通知扩展重建提供商，否则旧 Key 会一直用到下次重启。
            await vscode.commands.executeCommand('codeTranslator.internal.reloadProvider');

            this._panel.webview.postMessage({
                type: 'settingsSaved',
                success: true,
                message: 'settingsSavedSuccess'
            });

            vscode.window.showInformationMessage('Translater2077设置已保存！');
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'settingsSaved',
                success: false,
                message: 'settingsSavedFailed' + ': ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }

    private async _loadSettings() {
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
            // Key 来自系统密钥存储
            apiKeys: await SecretStore.get().getAllKeys(),
            // 扩展提供商参数；模型一律不预设默认值，由用户从远程列表中选取
            microsoftRegion: config.get('microsoftRegion', 'global'),
            openaiModel: config.get('openaiModel', ''),
            geminiModel: config.get('geminiModel', ''),
            deepseekModel: config.get('deepseekModel', ''),
            openrouterModel: config.get('openrouterModel', ''),
            ...Object.fromEntries(Object.keys(OPENAI_COMPAT_PRESETS).map(
                (p) => [`${p}Model`, config.get(`${p}Model`, '')]
            )),
            customOpenAIBaseUrl: config.get('customOpenAIBaseUrl', 'https://api.openai.com/v1'),
            customOpenAIModel: config.get('customOpenAIModel', ''),
            customAnthropicBaseUrl: config.get('customAnthropicBaseUrl', 'https://api.anthropic.com/v1/messages'),
            customAnthropicModel: config.get('customAnthropicModel', ''),
            customAnthropicVersion: config.get('customAnthropicVersion', '2023-06-01')
        };

        this._panel.webview.postMessage({
            type: 'settingsLoaded',
            settings: settings
        });
    }

    private async _testConnection(provider: string, apiKey: string, extras: Record<string, string> = {}) {
        // 实际调用对应提供商进行连接测试
        try {
            const config = vscode.workspace.getConfiguration('codeTranslator');

            const { TranslationManager } = await import('./translationManager');
            const tm = new TranslationManager();

            const extraKeys = new Set([
                'openaiModel',
                'geminiModel',
                'deepseekModel',
                'openrouterModel',
                ...Object.keys(OPENAI_COMPAT_PRESETS).map((p) => `${p}Model`),
                'customOpenAIBaseUrl',
                'customOpenAIModel',
                'customAnthropicBaseUrl',
                'customAnthropicModel',
                'customAnthropicVersion',
                'microsoftRegion',
            ]);

            // 仅实现 get(section, default) 即可满足 updateProvider 的读取
            const tempConfig = {
                get: <T>(section: string, defaultValue?: T): T => {
                    if (
                        section === `${provider}ApiKey` ||
                        (provider === 'openai' && section === 'openaiApiKey') ||
                        (provider === 'gemini' && section === 'geminiApiKey')
                    ) {
                        return (apiKey as unknown) as T;
                    }
                    // 扩展提供商附加参数（表单优先）
                    if (extraKeys.has(section) && extras[section] !== undefined && extras[section] !== '') {
                        return extras[section] as unknown as T;
                    }
                    if (section === 'deeplApiKey') {
                        return ((extras && extras.deeplApiKey) || apiKey || config.get(section as any, defaultValue as any)) as T;
                    }
                    if (section === 'microsoftRegion') {
                        return ((extras && extras.microsoftRegion) || config.get(section as any, defaultValue as any)) as T;
                    }
                    return config.get(section as any, defaultValue as any) as T;
                }
            } as unknown as vscode.WorkspaceConfiguration;

            // 第三参必须传表单里的 Key：updateProvider 已不再从配置读取密钥
            tm.updateProvider(provider, tempConfig, apiKey || '');

            // 对必须密钥的提供商进行空值拦截
            const providersRequireKey = new Set([
                'deepl',
                'openai',
                'gemini',
                'microsoft',
                'openrouter',
                ...Object.keys(OPENAI_COMPAT_PRESETS),
                'customOpenAI',
                'customAnthropic',
            ]);
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
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'connectionTested',
                success: false,
                provider: provider,
                message: 'API测试失败: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }

    /** 按当前表单里的 Key / Base URL 拉取该提供商可用的模型，供下拉列表使用 */
    private async _fetchModels(provider: string, apiKey: string, extras: Record<string, string> = {}) {
        try {
            // 表单里没填 Key 时回落到已保存的，避免用户重开面板后还要重新粘贴
            const key = (apiKey || '').trim() || (await SecretStore.get().getKey(provider));
            const models = await listModels(provider, key, extras);
            this._panel.webview.postMessage({
                type: 'modelsFetched',
                provider,
                success: true,
                models,
            });
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'modelsFetched',
                provider,
                success: false,
                models: [],
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async _openVSCodeSettings(setting: string) {
        try {
            await vscode.commands.executeCommand('workbench.action.openSettings', setting);
            this._panel.webview.postMessage({
                type: 'vscodeSettingsOpened',
                success: true,
                message: 'VSCode设置已打开'
            });
        } catch (error) {
            this._panel.webview.postMessage({
                type: 'vscodeSettingsOpened',
                success: false,
                message: 'VSCode设置打开失败: ' + (error instanceof Error ? error.message : String(error))
            });
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    /**
     * 模型选择器：搜索框 + 远程拉取的下拉列表。
     * 真实值存在隐藏 input（id=field）里，搜索框只负责显示与过滤。
     */
    private _renderModelPicker(provider: string, field: string): string {
        return `
                <div class="form-group model-picker" data-provider="${provider}" data-field="${field}">
                    <label for="${field}_search" data-i18n="modelLabel">模型：</label>
                    <div class="model-picker-control">
                        <input type="text" id="${field}_search" class="model-search" autocomplete="off"
                               data-placeholder-i18n="modelSearchPlaceholder" placeholder="点击选择，或输入关键字搜索">
                        <button type="button" class="secondary model-refresh" data-i18n="modelRefresh">刷新列表</button>
                    </div>
                    <input type="hidden" id="${field}">
                    <div class="model-dropdown hidden"></div>
                    <p class="model-status"></p>
                </div>`;
    }

    /** OpenAI 兼容预设提供商的配置区块：Key 输入 + 测试 + 模型选择器 */
    private _renderPresetSection(id: string, preset: { label: string; keysUrl: string }): string {
        return `
            <div class="form-group api-key-section hidden" id="${id}Section">
                <label for="${id}ApiKey">${preset.label} API Key：</label>
                <div class="api-key-group">
                    <input type="password" id="${id}ApiKey" autocomplete="off">
                    <button type="button" class="secondary test-btn" data-provider="${id}" data-i18n="testConnection">测试连接</button>
                </div>
                ${this._renderModelPicker(id, `${id}Model`)}
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;">
                    OpenAI 兼容接口 · <a href="${preset.keysUrl}">${preset.keysUrl.replace('https://', '')}</a> 申请 Key
                </p>
            </div>`;
    }

    private _getHtmlForWebview() {
        const webview = this._panel.webview;
        const nonce = getNonce();
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Translater2077设置</title>
    <style>
        /* ===== 吸顶工具栏：标题 + 界面语言 + 保存 ===== */
        .topbar {
            position: sticky;
            top: 0;
            z-index: 1000;
            /* 抵消 body 内边距，让工具栏横贯整个面板宽度 */
            margin: -20px -20px 20px;
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .topbar-inner {
            max-width: 800px;
            margin: 0 auto;
            padding: 10px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }

        .topbar-title {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            border: none;
            padding: 0;
            white-space: nowrap;
        }

        .topbar-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* 界面语言下拉：紧凑尺寸，覆盖全局 select 的 100% 宽度 */
        .lang-select {
            width: auto !important;
            min-width: 96px;
            height: 28px;
            padding: 2px 8px;
            font-size: 12px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border, var(--vscode-widget-border));
            border-radius: 4px;
            cursor: pointer;
        }

        .topbar .save-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            height: 28px;
            padding: 0 16px;
            font-size: 12px;
            border-radius: 4px;
            box-sizing: border-box;
            white-space: nowrap;
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

        /* ===== 模型选择器（可搜索下拉） ===== */
        .model-picker {
            position: relative;
            margin-top: 10px;
        }

        .model-picker-control {
            display: flex;
            gap: 8px;
            align-items: stretch;
        }

        .model-picker-control input {
            flex: 1;
            min-width: 0;
        }

        .model-picker-control button {
            white-space: nowrap;
            flex-shrink: 0;
        }

        .model-dropdown {
            position: absolute;
            left: 0;
            right: 0;
            top: 100%;
            margin-top: 2px;
            max-height: 300px;
            overflow-y: auto;
            background: var(--vscode-dropdown-background, var(--vscode-editor-background));
            border: 1px solid var(--vscode-dropdown-border, var(--vscode-widget-border));
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
            z-index: 900;
        }

        .model-option {
            padding: 7px 10px;
            cursor: pointer;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .model-option:last-child {
            border-bottom: none;
        }

        .model-option:hover,
        .model-option.active {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .model-option.selected .model-option-name::after {
            content: ' ✓';
            color: var(--vscode-charts-green, #89d185);
        }

        .model-option-name {
            font-size: 13px;
            word-break: break-all;
        }

        .model-option-detail {
            font-size: 11px;
            opacity: 0.75;
            margin-top: 2px;
            word-break: break-all;
        }

        .model-status {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 6px;
            min-height: 16px;
        }

        .model-status.error {
            color: var(--vscode-errorForeground, #f48771);
        }
    </style>
</head>
<body>
    <!-- 吸顶工具栏：标题在左，界面语言与保存在右，滚动时保持可见 -->
    <header class="topbar">
        <div class="topbar-inner">
            <h1 class="topbar-title"><span data-i18n="title">🌐 Translator2077 设置</span></h1>
            <div class="topbar-actions">
                <select id="uiLanguage" class="lang-select" title="界面语言 / UI Language">
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                </select>
                <button type="button" class="save-button" id="saveBtn" data-i18n="saveSettings">保存设置</button>
            </div>
        </div>
    </header>

    <div class="container">
        <div id="messages"></div>
        
        <!-- API设置 -->
        <div class="section">
            <h2 data-i18n="apiSettings">翻译API设置</h2>
            
            <div class="form-group">
                <label for="apiProvider" data-i18n="providerLabel">翻译服务提供商：</label>
                <select id="apiProvider">
                    <option value="google" data-i18n="provider.google">Google Translate</option>
                    <option value="deepl" data-i18n="provider.deepl">DeepL</option>
                    <option value="microsoft" data-i18n="provider.microsoft">微软翻译</option>
                    <option value="openai" data-i18n="provider.openai">OpenAI</option>
                    <option value="gemini" data-i18n="provider.gemini">Google Gemini</option>
                    <option value="deepseek" data-i18n="provider.deepseek">DeepSeek</option>
                    <option value="openrouter" data-i18n="provider.openrouter">OpenRouter</option>
                    ${Object.entries(OPENAI_COMPAT_PRESETS).map(([id, p]) =>
                        `<option value="${id}">${p.label}</option>`).join('\n                    ')}
                    <option value="customOpenAI" data-i18n="provider.customOpenAI">自定义 OpenAI 兼容</option>
                    <option value="customAnthropic" data-i18n="provider.customAnthropic">自定义 Anthropic 兼容</option>
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
            
            <!-- DeepL API Key -->
            <div class="form-group api-key-section hidden" id="deeplSection">
                <label for="deeplApiKey" data-i18n="deeplApiKey">DeepL API Key：</label>
                <div class="api-key-group">
                    <input type="text" id="deeplApiKey" data-placeholder-i18n="deeplApiKeyPlaceholder">
                    <button type="button" class="secondary test-btn" data-provider="deepl" data-i18n="testConnection">测试连接</button>
                </div>
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="deeplNotes">支持免费版（API Key以':fx'结尾）和专业版，高质量翻译服务。</p>
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
                ${this._renderModelPicker('openai', 'openaiModel')}
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="openaiNotes">需要有效的 OpenAI 账号与 API Key，计费按使用量收取；部分地区可能无法直连，需配置代理。</p>
            </div>
            
            <!-- Gemini API Key -->
            <div class="form-group api-key-section hidden" id="geminiSection">
                <label for="geminiApiKey" data-i18n="geminiApiKey">Google AI Studio API Key：</label>
                <div class="api-key-group">
                    <input type="text" id="geminiApiKey" data-placeholder-i18n="geminiApiKeyPlaceholder">
                    <button type="button" class="secondary test-btn" data-provider="gemini" data-i18n="testConnection">测试连接</button>
                </div>
                ${this._renderModelPicker('gemini', 'geminiModel')}
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="geminiNotes">需要在 Google AI Studio 申请 API Key；部分地区不可用或需代理，计费与配额以官方为准。</p>
            </div>
            
            <!-- DeepSeek API Key -->
            <div class="form-group api-key-section hidden" id="deepseekSection">
                <label for="deepseekApiKey" data-i18n="deepseekApiKey">DeepSeek API Key：</label>
                <div class="api-key-group">
                    <input type="text" id="deepseekApiKey" data-placeholder-i18n="deepseekApiKeyPlaceholder">
                    <button type="button" class="secondary test-btn" data-provider="deepseek" data-i18n="testConnection">测试连接</button>
                </div>
                ${this._renderModelPicker('deepseek', 'deepseekModel')}
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="deepseekNotes">强大的语言模型翻译服务，模型列表从 DeepSeek 接口实时获取。</p>
            </div>
            
            <!-- OpenRouter -->
            <div class="form-group api-key-section hidden" id="openrouterSection">
                <label for="openrouterApiKey" data-i18n="openrouterApiKeyLabel">OpenRouter API Key：</label>
                <div class="api-key-group">
                    <input type="password" id="openrouterApiKey" autocomplete="off">
                    <button type="button" class="secondary test-btn" data-provider="openrouter" data-i18n="testConnection">测试连接</button>
                </div>
                ${this._renderModelPicker('openrouter', 'openrouterModel')}
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="openrouterNotes">OpenAI 兼容 Chat Completions；鉴权 Bearer。模型目录公开，无需 Key 即可浏览。</p>
            </div>
            
            <!-- OpenAI 兼容预设提供商（xAI / 智谱 / Qwen / Kimi / Groq / Mistral / SiliconFlow）-->
            ${Object.entries(OPENAI_COMPAT_PRESETS).map(([id, p]) => this._renderPresetSection(id, p)).join('\n')}

            <!-- 自定义 OpenAI 兼容 -->
            <div class="form-group api-key-section hidden" id="customOpenAISection">
                <label for="customOpenAIApiKey" data-i18n="customOpenAIApiKeyLabel">API Key（Bearer）：</label>
                <div class="api-key-group">
                    <input type="password" id="customOpenAIApiKey" autocomplete="off">
                    <button type="button" class="secondary test-btn" data-provider="customOpenAI" data-i18n="testConnection">测试连接</button>
                </div>
                <div class="form-group" style="margin-top:10px;">
                    <label for="customOpenAIBaseUrl" data-i18n="customOpenAIBaseUrlLabel">基址 URL：</label>
                    <input type="text" id="customOpenAIBaseUrl" style="width:100%;box-sizing:border-box;" placeholder="https://api.openai.com/v1">
                </div>
                ${this._renderModelPicker('customOpenAI', 'customOpenAIModel')}
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="customOpenAINotes">任意 OpenAI Chat Completions 兼容端点；可填 …/v1 或完整 …/chat/completions。</p>
            </div>
            
            <!-- 自定义 Anthropic 兼容 -->
            <div class="form-group api-key-section hidden" id="customAnthropicSection">
                <label for="customAnthropicApiKey" data-i18n="customAnthropicApiKeyLabel">API Key（x-api-key）：</label>
                <div class="api-key-group">
                    <input type="password" id="customAnthropicApiKey" autocomplete="off">
                    <button type="button" class="secondary test-btn" data-provider="customAnthropic" data-i18n="testConnection">测试连接</button>
                </div>
                <div class="form-group" style="margin-top:10px;">
                    <label for="customAnthropicBaseUrl" data-i18n="customAnthropicBaseUrlLabel">Messages URL：</label>
                    <input type="text" id="customAnthropicBaseUrl" style="width:100%;box-sizing:border-box;" placeholder="https://api.anthropic.com/v1/messages">
                </div>
                ${this._renderModelPicker('customAnthropic', 'customAnthropicModel')}
                <div class="form-group">
                    <label for="customAnthropicVersion" data-i18n="customAnthropicVersionLabel">anthropic-version：</label>
                    <input type="text" id="customAnthropicVersion" style="width:100%;box-sizing:border-box;" placeholder="2023-06-01">
                </div>
                <p style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-top: 8px;" data-i18n="customAnthropicNotes">Anthropic Messages API；第三方代理请按其文档填写版本头与 URL。</p>
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
                        VSCode默认tooltip延迟约1000毫秒，建议设置为50-200毫秒以获得更好的使用体验。
                    </p>
                    <button type="button" class="secondary" id="openTooltipBtn" style="margin-bottom: 10px;" data-i18n="openTooltipSettings">
                        打开VSCode Tooltip延迟设置
                    </button>
                    <p style="color: var(--vscode-descriptionForeground); font-size: 12px;" data-i18n="tooltipRecommendation">
                        建议设置值：workbench.hover.delay: 100
                    </p>
                </div>
            </div>
        </div>
        
        
    </div>
    
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        // OpenAI 兼容预设提供商 ID 列表，由扩展端注入
        const PRESET_PROVIDERS = ${JSON.stringify(Object.keys(OPENAI_COMPAT_PRESETS))};
        
        // 多语言资源
        const i18nResources = {
            zh: {
                title: "🌐 Translator2077 设置",
                apiSettings: "🔑 翻译API设置",
                providerLabel: "翻译服务提供商：",
                "provider.google": "Google Translate",
                "provider.deepl": "DeepL",
                "provider.microsoft": "微软翻译",
                "provider.openai": "OpenAI",
                "provider.gemini": "Google Gemini",
                "provider.deepseek": "DeepSeek",
                "provider.openrouter": "OpenRouter",
                "provider.customOpenAI": "自定义 OpenAI 兼容",
                "provider.customAnthropic": "自定义 Anthropic 兼容",
                openrouterApiKeyLabel: "OpenRouter API Key：",
                openrouterNotes: "OpenAI 兼容 Chat Completions；Bearer 鉴权。模型目录公开，无需 Key 即可浏览。",
                customOpenAIApiKeyLabel: "API Key（Bearer）：",
                customOpenAIBaseUrlLabel: "基址 URL：",
                customOpenAINotes: "任意 OpenAI Chat Completions 兼容端点；可填 …/v1 或完整 …/chat/completions。",
                customAnthropicApiKeyLabel: "API Key（x-api-key）：",
                customAnthropicBaseUrlLabel: "Messages URL：",
                customAnthropicVersionLabel: "anthropic-version：",
                modelLabel: "模型：",
                modelSearchPlaceholder: "点击选择，或输入关键字搜索",
                modelRefresh: "刷新列表",
                modelLoading: "正在获取模型列表…",
                modelCount: "共 {n} 个模型，可输入关键字筛选",
                modelEmpty: "该接口未返回任何模型",
                modelNoMatch: "没有匹配的模型",
                modelSelected: "已选择：",
                modelFetchFailed: "获取模型列表失败",
                presetProviderInfo: "OpenAI 兼容接口；模型列表从官方实时获取并自选；需要 API Key。",
                customAnthropicNotes: "Anthropic Messages API；第三方网关请按其文档填写 URL 与版本头。",
                googleApiKey: "Google Translate API Key：",
                googleApiKeyPlaceholder: "输入您的Google API密钥（可选，不填使用免费服务）",
                microsoftApiKey: "微软翻译API密钥：",
                microsoftApiKeyPlaceholder: "输入您的微软翻译API密钥",
                testConnection: "测试连接",
                openaiApiKey: "OpenAI API Key：",
                openaiApiKeyPlaceholder: "输入 OpenAI API Key",
                deeplApiKey: "DeepL API Key：",
                deeplApiKeyPlaceholder: "输入DeepL API Key（免费版以':fx'结尾）",
                geminiApiKey: "Google AI Studio API Key：",
                geminiApiKeyPlaceholder: "输入 Google AI Studio API Key",
                deepseekApiKey: "DeepSeek API Key：",
                deepseekApiKeyPlaceholder: "输入DeepSeek API Key",
                deeplNotes: "支持免费版（API Key以':fx'结尾）和专业版，高质量翻译服务。",
                openaiNotes: "需要有效的 OpenAI 账号与 API Key，计费按使用量收取；部分地区可能无法直连，需配置代理。",
                geminiNotes: "需要在 Google AI Studio 申请 API Key；部分地区不可用或需代理，计费与配额以官方为准。",
                deepseekNotes: "强大的语言模型翻译服务，模型列表从 DeepSeek 接口实时获取。",
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
                tooltipOptimizationDesc: "VSCode默认tooltip延迟约1000毫秒，建议设置为50-200毫秒以获得更好的使用体验。",
                openTooltipSettings: "🚀 打开VSCode Tooltip延迟设置",
                tooltipRecommendation: "建议设置值：workbench.hover.delay: 100",
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
                title: "🌐 Translator2077 Settings",
                apiSettings: "🔑 Translation API Settings",
                providerLabel: "Translation Service Provider:",
                "provider.google": "Google Translate",
                "provider.deepl": "DeepL",
                "provider.microsoft": "Microsoft Translator",
                "provider.openai": "OpenAI",
                "provider.gemini": "Google Gemini",
                "provider.deepseek": "DeepSeek",
                "provider.openrouter": "OpenRouter",
                "provider.customOpenAI": "Custom OpenAI-compatible",
                "provider.customAnthropic": "Custom Anthropic-compatible",
                openrouterApiKeyLabel: "OpenRouter API Key:",
                openrouterNotes: "OpenAI-compatible Chat Completions; Bearer auth. The model catalog is public and browsable without a key.",
                customOpenAIApiKeyLabel: "API Key (Bearer):",
                customOpenAIBaseUrlLabel: "Base URL:",
                customOpenAINotes: "Any OpenAI Chat Completions-compatible endpoint; use …/v1 or full …/chat/completions.",
                customAnthropicApiKeyLabel: "API Key (x-api-key):",
                customAnthropicBaseUrlLabel: "Messages URL:",
                customAnthropicVersionLabel: "anthropic-version:",
                modelLabel: "Model:",
                modelSearchPlaceholder: "Click to choose, or type to search",
                modelRefresh: "Refresh",
                modelLoading: "Fetching model list…",
                modelCount: "{n} models available — type to filter",
                modelEmpty: "This endpoint returned no models",
                modelNoMatch: "No matching model",
                modelSelected: "Selected: ",
                modelFetchFailed: "Failed to fetch model list",
                presetProviderInfo: "OpenAI-compatible API; the model list is fetched live and picked by you; API key required.",
                customAnthropicNotes: "Anthropic Messages API; for third-party proxies follow their URL and version header docs.",
                googleApiKey: "Google Translate API Key:",
                googleApiKeyPlaceholder: "Enter your Google API key (optional, uses free service if empty)",
                microsoftApiKey: "Microsoft Translator API Key:",
                microsoftApiKeyPlaceholder: "Enter your Microsoft Translator API key",
                testConnection: "Test Connection",
                openaiApiKey: "OpenAI API Key:",
                openaiApiKeyPlaceholder: "Enter OpenAI API Key",
                deeplApiKey: "DeepL API Key:",
                deeplApiKeyPlaceholder: "Enter DeepL API Key (free version ends with ':fx')",
                geminiApiKey: "Google AI Studio API Key:",
                geminiApiKeyPlaceholder: "Enter Google AI Studio API Key",
                deepseekApiKey: "DeepSeek API Key:",
                deepseekApiKeyPlaceholder: "Enter DeepSeek API Key",
                deeplNotes: "Supports both free version (API key ends with ':fx') and professional version, high-quality translation service.",
                openaiNotes: "OpenAI account and API key required; usage-based billing; proxy may be required in some regions.",
                geminiNotes: "API key from Google AI Studio required; availability and quotas vary by region; proxy may be needed.",
                deepseekNotes: "Powerful language model translation; the model list is fetched live from the DeepSeek API.",
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
                tooltipOptimizationDesc: "VSCode default tooltip delay is about 1000ms, recommend setting to 50-200ms for better user experience.",
                openTooltipSettings: "🚀 Open VSCode Tooltip Delay Settings",
                tooltipRecommendation: "Recommended setting: workbench.hover.delay: 100",
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
                title: "🌐 Translator2077 設定",
                apiSettings: "🔑 翻訳API設定",
                providerLabel: "翻訳サービスプロバイダー：",
                "provider.google": "Google翻訳",
                "provider.deepl": "DeepL",
                "provider.microsoft": "Microsoft翻訳",
                "provider.openai": "OpenAI",
                "provider.gemini": "Google Gemini",
                "provider.deepseek": "DeepSeek",
                "provider.openrouter": "OpenRouter",
                "provider.customOpenAI": "カスタム OpenAI 互換",
                "provider.customAnthropic": "カスタム Anthropic 互換",
                openrouterApiKeyLabel: "OpenRouter APIキー：",
                openrouterNotes: "OpenAI 互換 Chat Completions。Bearer 認証。モデル一覧は公開され、キーなしで閲覧できます。",
                customOpenAIApiKeyLabel: "APIキー（Bearer）：",
                customOpenAIBaseUrlLabel: "ベース URL：",
                customOpenAINotes: "OpenAI Chat Completions 互換の任意エンドポイント。…/v1 または完全な …/chat/completions。",
                customAnthropicApiKeyLabel: "APIキー（x-api-key）：",
                customAnthropicBaseUrlLabel: "Messages URL：",
                customAnthropicVersionLabel: "anthropic-version：",
                modelLabel: "モデル：",
                modelSearchPlaceholder: "クリックして選択、または入力して検索",
                modelRefresh: "更新",
                modelLoading: "モデル一覧を取得中…",
                modelCount: "{n} 件のモデル — 入力で絞り込み",
                modelEmpty: "このエンドポイントはモデルを返しませんでした",
                modelNoMatch: "一致するモデルがありません",
                modelSelected: "選択済み：",
                modelFetchFailed: "モデル一覧の取得に失敗しました",
                presetProviderInfo: "OpenAI 互換 API。モデル一覧はリアルタイム取得して選択。APIキー必要。",
                customAnthropicNotes: "Anthropic Messages API。サードパーティは各ドキュメントに従ってください。",
                googleApiKey: "Google翻訳APIキー：",
                googleApiKeyPlaceholder: "GoogleのAPIキーを入力（オプション、空の場合無料サービスを使用）",
                microsoftApiKey: "Microsoft翻訳APIキー：",
                microsoftApiKeyPlaceholder: "Microsoft翻訳のAPIキーを入力",
                testConnection: "接続テスト",
                deeplApiKey: "DeepL APIキー：",
                deeplApiKeyPlaceholder: "DeepL APIキーを入力（無料版は':fx'で終了）",
                openaiApiKey: "OpenAI APIキー：",
                openaiApiKeyPlaceholder: "OpenAIのAPIキーを入力",
                geminiApiKey: "Google AI Studio APIキー：",
                geminiApiKeyPlaceholder: "Google AI Studio の APIキーを入力",
                deepseekApiKey: "DeepSeek APIキー：",
                deepseekApiKeyPlaceholder: "DeepSeek APIキーを入力",
                deeplNotes: "無料版（APIキーが':fx'で終わる）とプロ版をサポート、高品質翻訳サービス。",
                openaiNotes: "OpenAIのアカウントとAPIキーが必要です。従量課金。地域によりプロキシが必要な場合があります。",
                geminiNotes: "Google AI Studio でAPIキーが必要です。地域により利用不可/プロキシが必要な場合があります。",
                deepseekNotes: "強力な言語モデル翻訳。モデル一覧は DeepSeek API からリアルタイム取得。",
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
                tooltipOptimizationDesc: "VSCodeのデフォルトツールチップ遅延は約1000msです。より良いユーザー体験のために50-200msに設定することをお勧めします。",
                openTooltipSettings: "🚀 VSCodeツールチップ遅延設定を開く",
                tooltipRecommendation: "推奨設定：workbench.hover.delay: 100",
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
        
        // 当前界面语言：优先恢复上次的选择（webview state 随面板持久化）
        const supportedLanguages = ['zh', 'en', 'ja'];
        const savedState = vscode.getState() || {};
        let currentLanguage = supportedLanguages.includes(savedState.uiLang) ? savedState.uiLang : 'zh';
        let userPickedLanguage = !!savedState.uiLang; // 用户显式选过语言后，不再跟随目标语言自动推断

        function setUiLanguage(lang, explicit) {
            if (!supportedLanguages.includes(lang) || lang === currentLanguage && !explicit) {
                if (!supportedLanguages.includes(lang)) { return; }
            }
            currentLanguage = lang;
            if (explicit) {
                userPickedLanguage = true;
                vscode.setState(Object.assign({}, vscode.getState() || {}, { uiLang: lang }));
            }
            updateLanguageDisplay();
            updatePageLanguage();
        }

        function updateLanguageDisplay() {
            const sel = document.getElementById('uiLanguage');
            if (sel) { sel.value = currentLanguage; }
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
                deepl: "DeepL高质量翻译，支持免费版和专业版",
                microsoft: "微软翻译，支持60多种语言，需要Azure订阅",
                openai: "OpenAI，需要有效的 OpenAI 账号与 API Key，计费按使用量收取；部分地区可能无法直连，需配置代理。",
                gemini: "Google Gemini，需要在 Google AI Studio 申请 API Key；部分地区不可用或需代理，计费与配额以官方为准。",
                deepseek: "DeepSeek 官方接口，模型从官方实时获取并自选；需要 API Key。",
                openrouter: "OpenRouter 统一网关，OpenAI 兼容 API；模型目录公开，实时拉取自选。",
                customOpenAI: "任意 OpenAI Chat Completions 兼容 URL + 模型 + Key（自建/Groq/Together 等）。",
                customAnthropic: "任意 Anthropic Messages 兼容端点 + 模型 + Key（含第三方 Claude 代理）。"
            },
            en: {
                google: "Supports 100+ languages, free version has quota limits",
                deepl: "DeepL high-quality translation, supports free and professional versions",
                microsoft: "Microsoft Translator, supports 60+ languages, requires Azure subscription",
                openai: "OpenAI, requires a valid OpenAI account and API key, billed based on usage; some regions may not be directly accessible, requiring proxy configuration.",
                gemini: "Google Gemini, requires API key from Google AI Studio; some regions may be unavailable or require proxy, with fees and quotas subject to official documentation.",
                deepseek: "DeepSeek official API; the model list is fetched live and picked by you. API key required.",
                openrouter: "OpenRouter unified gateway; OpenAI-compatible API; public model catalog fetched live.",
                customOpenAI: "Any OpenAI Chat Completions-compatible URL + model + key (Groq, Together, self-hosted, etc.).",
                customAnthropic: "Any Anthropic Messages-compatible endpoint + model + key (incl. third-party Claude proxies)."
            },
            ja: {
                google: "100以上の言語をサポート、無料版には制限あり",
                deepl: "DeepL高品質翻訳、無料版とプロ版をサポート",
                microsoft: "Microsoft翻訳、60以上の言語をサポート、Azureサブスクリプションが必要",
                openai: "OpenAI，OpenAIのアカウントとAPIキーが必要です。従量課金。地域によりプロキシが必要な場合があります。",
                gemini: "Google Gemini，Google AI Studio でAPIキーが必要です。地域により利用不可/プロキシが必要な場合があります。",
                deepseek: "DeepSeek 公式 API。モデル一覧はリアルタイム取得して選択。APIキー必要。",
                openrouter: "OpenRouter 統合ゲートウェイ。OpenAI 互換 API。公開モデル一覧をリアルタイム取得。",
                customOpenAI: "任意の OpenAI Chat Completions 互換 URL + モデル + キー。",
                customAnthropic: "任意の Anthropic Messages 互換エンドポイント + モデル + キー。"
            }
        };
        
        function updateProviderInfo() {
            const provider = document.getElementById('apiProvider').value;
            const infoElement = document.getElementById('providerInfo');
            const providerInfo = providerInfoData[currentLanguage];
            if (providerInfo && providerInfo[provider]) {
                infoElement.textContent = providerInfo[provider];
            } else if (PRESET_PROVIDERS.includes(provider)) {
                // 预设提供商共用一条通用说明
                infoElement.textContent = t('presetProviderInfo',
                    'OpenAI 兼容接口；模型列表从官方实时获取并自选；需要 API Key。');
            } else {
                infoElement.textContent = '';
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
                case 'modelsFetched':
                    onModelsFetched(message);
                    break;
            }
        });

        // ===================== 模型选择器 =====================
        // 每个提供商缓存一份模型列表，避免每次展开都打一次网络请求
        const modelCache = {};
        const modelLoading = {};

        function pickerOf(field) {
            return document.querySelector('.model-picker[data-field="' + field + '"]');
        }

        function pickerParts(picker) {
            return {
                field: picker.dataset.field,
                provider: picker.dataset.provider,
                search: picker.querySelector('.model-search'),
                hidden: picker.querySelector('input[type="hidden"]'),
                dropdown: picker.querySelector('.model-dropdown'),
                status: picker.querySelector('.model-status'),
            };
        }

        function t(key, fallback) {
            const resources = i18nResources[currentLanguage] || i18nResources.zh;
            return resources[key] || fallback;
        }

        /** 回填已保存的模型：隐藏域存真值，搜索框显示同样的文本 */
        function setPickerValue(field, value) {
            const picker = pickerOf(field);
            if (!picker) { return; }
            const p = pickerParts(picker);
            p.hidden.value = value || '';
            p.search.value = value || '';
        }

        /** 收集自定义端点的 Base URL 等参数，拉取模型时需要 */
        function pickerExtras(provider) {
            if (provider === 'customOpenAI') {
                return { customOpenAIBaseUrl: document.getElementById('customOpenAIBaseUrl')?.value || '' };
            }
            if (provider === 'customAnthropic') {
                return {
                    customAnthropicBaseUrl: document.getElementById('customAnthropicBaseUrl')?.value || '',
                    customAnthropicVersion: document.getElementById('customAnthropicVersion')?.value || ''
                };
            }
            return {};
        }

        function requestModels(provider, field) {
            if (modelLoading[field]) { return; }
            modelLoading[field] = true;

            const picker = pickerOf(field);
            const p = pickerParts(picker);
            p.status.classList.remove('error');
            p.status.textContent = t('modelLoading', '正在获取模型列表…');

            vscode.postMessage({
                type: 'fetchModels',
                provider: provider,
                apiKey: document.getElementById(provider + 'ApiKey')?.value || '',
                extras: pickerExtras(provider)
            });
        }

        function onModelsFetched(message) {
            // 一个提供商对应一个选择器，按 provider 反查 field
            const picker = document.querySelector('.model-picker[data-provider="' + message.provider + '"]');
            if (!picker) { return; }
            const p = pickerParts(picker);
            modelLoading[p.field] = false;

            if (!message.success) {
                p.status.classList.add('error');
                p.status.textContent = message.message || t('modelFetchFailed', '获取模型列表失败');
                return;
            }

            modelCache[p.field] = message.models || [];
            p.status.classList.remove('error');
            if (!modelCache[p.field].length) {
                p.status.textContent = t('modelEmpty', '该接口未返回任何模型');
            } else {
                p.status.textContent = t('modelCount', '共 {n} 个模型').replace('{n}', modelCache[p.field].length);
            }
            renderOptions(p, p.search.value === p.hidden.value ? '' : p.search.value);
        }

        function renderOptions(p, filter) {
            const all = modelCache[p.field] || [];
            const q = (filter || '').trim().toLowerCase();
            const matched = q
                ? all.filter(m => m.id.toLowerCase().includes(q) || (m.label || '').toLowerCase().includes(q))
                : all;

            if (!matched.length) {
                p.dropdown.innerHTML = '<div class="model-option">' + t('modelNoMatch', '没有匹配的模型') + '</div>';
                p.dropdown.classList.remove('hidden');
                return;
            }

            // 长列表只渲染前 300 条，输入关键字可继续收窄
            const shown = matched.slice(0, 300);
            p.dropdown.innerHTML = shown.map((m, i) => {
                const selected = m.id === p.hidden.value ? ' selected' : '';
                return '<div class="model-option' + selected + '" data-id="' + escapeAttr(m.id) + '" data-index="' + i + '">'
                    + '<div class="model-option-name">' + escapeHtml(m.label || m.id) + '</div>'
                    + (m.detail ? '<div class="model-option-detail">' + escapeHtml(m.detail) + '</div>' : '')
                    + '</div>';
            }).join('');
            p.dropdown.classList.remove('hidden');
        }

        function escapeHtml(s) {
            return String(s).replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[c]);
        }

        function escapeAttr(s) {
            return escapeHtml(s);
        }

        function closeDropdown(p) {
            p.dropdown.classList.add('hidden');
            // 未选中任何项时，把搜索框恢复成已保存的值，避免留下半截关键字
            p.search.value = p.hidden.value;
        }

        function selectModel(p, id) {
            p.hidden.value = id;
            p.search.value = id;
            p.dropdown.classList.add('hidden');
            p.status.classList.remove('error');
            p.status.textContent = t('modelSelected', '已选择：') + id;
        }

        function moveActive(p, delta) {
            const options = Array.from(p.dropdown.querySelectorAll('.model-option[data-id]'));
            if (!options.length) { return; }
            const current = options.findIndex(o => o.classList.contains('active'));
            const next = Math.max(0, Math.min(options.length - 1, current < 0 ? 0 : current + delta));
            options.forEach(o => o.classList.remove('active'));
            options[next].classList.add('active');
            options[next].scrollIntoView({ block: 'nearest' });
        }

        document.querySelectorAll('.model-picker').forEach(picker => {
            const p = pickerParts(picker);

            // 聚焦即展开；首次展开时自动拉取
            p.search.addEventListener('focus', () => {
                if (!modelCache[p.field]) {
                    requestModels(p.provider, p.field);
                } else {
                    renderOptions(p, '');
                }
            });

            p.search.addEventListener('input', () => {
                if (modelCache[p.field]) {
                    renderOptions(p, p.search.value);
                }
            });

            p.search.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(p, 1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(p, -1); }
                else if (e.key === 'Enter') {
                    const active = p.dropdown.querySelector('.model-option.active[data-id]');
                    if (active) { e.preventDefault(); selectModel(p, active.dataset.id); }
                } else if (e.key === 'Escape') {
                    closeDropdown(p);
                }
            });

            p.dropdown.addEventListener('mousedown', (e) => {
                // 用 mousedown 而非 click：blur 会先触发并关掉列表
                const option = e.target.closest('.model-option[data-id]');
                if (option) { e.preventDefault(); selectModel(p, option.dataset.id); }
            });

            picker.querySelector('.model-refresh').addEventListener('click', () => {
                delete modelCache[p.field];
                requestModels(p.provider, p.field);
                p.search.focus();
            });

            p.search.addEventListener('blur', () => {
                // 延迟关闭，让 mousedown 选中先生效
                setTimeout(() => closeDropdown(p), 150);
            });
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
            // 模型字段走选择器，需要同步隐藏值与搜索框显示值
            ['openaiModel', 'geminiModel', 'deepseekModel', 'openrouterModel',
             'customOpenAIModel', 'customAnthropicModel',
             ...PRESET_PROVIDERS.map(p => p + 'Model')].forEach((field) => {
                if (settings[field] !== undefined) {
                    setPickerValue(field, settings[field]);
                }
            });
            if (settings.customOpenAIBaseUrl !== undefined) {
                const el = document.getElementById('customOpenAIBaseUrl');
                if (el) el.value = settings.customOpenAIBaseUrl;
            }
            if (settings.customAnthropicBaseUrl !== undefined) {
                const el = document.getElementById('customAnthropicBaseUrl');
                if (el) el.value = settings.customAnthropicBaseUrl;
            }
            if (settings.customAnthropicVersion !== undefined) {
                const el = document.getElementById('customAnthropicVersion');
                if (el) el.value = settings.customAnthropicVersion;
            }
            
            // 用户未显式选过界面语言时，跟随目标翻译语言推断一次
            if (!userPickedLanguage && settings.targetLanguage) {
                const tl = String(settings.targetLanguage).toLowerCase();
                const derived = tl.startsWith('zh') ? 'zh' : (tl === 'ja' ? 'ja' : 'en');
                if (derived !== currentLanguage) { setUiLanguage(derived, false); }
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
                apiKeys: Object.fromEntries(
                    ['google', 'deepl', 'microsoft', 'openai', 'gemini', 'deepseek', 'openrouter',
                     ...PRESET_PROVIDERS, 'customOpenAI', 'customAnthropic']
                    .map(p => [p, document.getElementById(p + 'ApiKey')?.value || ''])
                ),
                // 扩展的提供商参数
                microsoftRegion: document.getElementById('microsoftRegion')?.value || '',
                openaiModel: document.getElementById('openaiModel')?.value || '',
                geminiModel: document.getElementById('geminiModel')?.value || '',
                deepseekModel: document.getElementById('deepseekModel')?.value || '',
                openrouterModel: document.getElementById('openrouterModel')?.value || '',
                ...Object.fromEntries(PRESET_PROVIDERS.map(p => [p + 'Model', document.getElementById(p + 'Model')?.value || ''])),
                customOpenAIBaseUrl: document.getElementById('customOpenAIBaseUrl')?.value || '',
                customOpenAIModel: document.getElementById('customOpenAIModel')?.value || '',
                customAnthropicBaseUrl: document.getElementById('customAnthropicBaseUrl')?.value || '',
                customAnthropicModel: document.getElementById('customAnthropicModel')?.value || '',
                customAnthropicVersion: document.getElementById('customAnthropicVersion')?.value || ''
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
            
            let extras = {};
            if (provider === 'openai' || provider === 'gemini' || provider === 'deepseek') {
                // 带上表单里当前选中的模型，测试结果才与实际翻译一致
                extras[provider + 'Model'] = document.getElementById(provider + 'Model')?.value || '';
            } else if (provider === 'openrouter') {
                extras = {
                    openrouterModel: document.getElementById('openrouterModel')?.value || ''
                };
            } else if (provider === 'customOpenAI') {
                extras = {
                    customOpenAIBaseUrl: document.getElementById('customOpenAIBaseUrl')?.value || '',
                    customOpenAIModel: document.getElementById('customOpenAIModel')?.value || ''
                };
            } else if (provider === 'customAnthropic') {
                extras = {
                    customAnthropicBaseUrl: document.getElementById('customAnthropicBaseUrl')?.value || '',
                    customAnthropicModel: document.getElementById('customAnthropicModel')?.value || '',
                    customAnthropicVersion: document.getElementById('customAnthropicVersion')?.value || ''
                };
            }
            
            vscode.postMessage({
                type: 'testConnection',
                provider: provider,
                apiKey: apiKey,
                extras: extras
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
            // Ctrl+S / Cmd+S 快捷保存
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    saveSettings();
                }
            });
            // 绑定界面语言下拉
            const uiLangSel = document.getElementById('uiLanguage');
            if (uiLangSel) {
                uiLangSel.addEventListener('change', () => setUiLanguage(uiLangSel.value, true));
            }
            // 恢复上次的界面语言
            updatePageLanguage();
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

// 生成 CSP nonce
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
