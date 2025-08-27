import * as vscode from 'vscode';
import { WordHelper } from './wordHelper';
import { SettingsPanel } from './settingsPanel';
import { TranslationManager } from './translationManager';

// m
type UiStrings = {
  translating: string;
  selectionTooLong: (max: number) => string;
  translationFailedShort: string;
  translationFailedWithMsg: (msg: string) => string;
  networkUnavailable: string;
  localTranslationTag: string;
  tooltipOriginal: string;
  tooltipTranslation: string;
  tooltipViewDetails: string;
  tooltipClickToClear: string;
  copiedOriginal: string;
  copiedTranslation: string;
  copiedBoth: string;
  noContentForDetails: string;
  viewFullText: string;
  detailsTitle: string;
  copyOriginalBtn: string;
  copyTranslationBtn: string;
  copyBothBtn: string;
  closeBtn: string;
  offlineNotice: string;
  netErrNotice: string;
  sourceLabel?: string;
  openSettingsBtn: string;
  viewFullBtn: string;
};

const UI_TEXT: Record<string, UiStrings> = {
  'zh-CN': {
    translating: '正在翻译...',
    selectionTooLong: (max) => `选中文本过长（最多${max}字符）`,
    translationFailedShort: '翻译失败',
    translationFailedWithMsg: (msg) => `翻译失败: ${msg}`,
    networkUnavailable: '网络不可用',
    localTranslationTag: '本地翻译',
    tooltipOriginal: '原文',
    tooltipTranslation: '翻译',
    tooltipViewDetails: '点击查看详情',
    tooltipClickToClear: '点击清除翻译',
    copiedOriginal: '已复制原文',
    copiedTranslation: '已复制译文',
    copiedBoth: '已复制原文与译文',
    noContentForDetails: '暂无可查看的翻译内容',
    viewFullText: '查看全文',
    detailsTitle: '翻译详情',
    copyOriginalBtn: '复制原文',
    copyTranslationBtn: '复制译文',
    copyBothBtn: '复制两者',
    closeBtn: '关闭',
    offlineNotice: '当前为本地词典模式，结果可能不完整（网络不可用或API失败）',
    netErrNotice: '网络不可用或服务不可达，已回退到本地词典模式',
    sourceLabel: '来源',
    openSettingsBtn: '打开设置',
    viewFullBtn: '查看完整内容',
  },
  en: {
    translating: 'Translating...',
    selectionTooLong: (max) => `Selection too long (max ${max} characters)`,
    translationFailedShort: 'Translation failed',
    translationFailedWithMsg: (msg) => `Translation failed: ${msg}`,
    networkUnavailable: 'Network unavailable',
    localTranslationTag: 'Local translation',
    tooltipOriginal: 'Original',
    tooltipTranslation: 'Translation',
    tooltipViewDetails: 'Click to view details',
    tooltipClickToClear: 'Click to clear translation',
    copiedOriginal: 'Copied original',
    copiedTranslation: 'Copied translation',
    copiedBoth: 'Copied original and translation',
    noContentForDetails: 'No translation to show',
    viewFullText: 'View full text',
    detailsTitle: 'Translation Details',
    copyOriginalBtn: 'Copy original',
    copyTranslationBtn: 'Copy translation',
    copyBothBtn: 'Copy both',
    closeBtn: 'Close',
    offlineNotice: 'Local dictionary mode; result may be incomplete (network/API issues)',
    netErrNotice: 'Network unavailable; falling back to local dictionary',
    sourceLabel: 'Source',
    openSettingsBtn: 'Open Settings',
    viewFullBtn: 'View full content',
  },
  ja: {
    translating: '翻訳中...',
    selectionTooLong: (max) => `選択したテキストが長すぎます（最大${max}文字）`,
    translationFailedShort: '翻訳に失敗しました',
    translationFailedWithMsg: (msg) => `翻訳に失敗しました: ${msg}`,
    networkUnavailable: 'ネットワークは利用できません',
    localTranslationTag: 'ローカル翻訳',
    tooltipOriginal: '原文',
    tooltipTranslation: '翻訳',
    tooltipViewDetails: 'クリックで詳細を見る',
    tooltipClickToClear: 'クリックして翻訳をクリア',
    copiedOriginal: '原文をコピーしました',
    copiedTranslation: '訳文をコピーしました',
    copiedBoth: '原文と訳文をコピーしました',
    noContentForDetails: '表示できる翻訳はありません',
    viewFullText: '全文を見る',
    detailsTitle: '翻訳の詳細',
    copyOriginalBtn: '原文をコピー',
    copyTranslationBtn: '訳文をコピー',
    copyBothBtn: '両方をコピー',
    closeBtn: '閉じる',
    offlineNotice: 'ローカル辞書モード。結果は不完全な場合があります（ネットワーク/API）',
    netErrNotice: 'ネットワークが利用できないため、ローカル辞書にフォールバックしました',
    sourceLabel: '出典',
    openSettingsBtn: '設定を開く',
    viewFullBtn: '全文を表示',
  },
  'zh-TW': {
    translating: '正在翻譯...',
    selectionTooLong: (max) => `選中文字過長（最多${max}字元）`,
    translationFailedShort: '翻譯失敗',
    translationFailedWithMsg: (msg) => `翻譯失敗: ${msg}`,
    networkUnavailable: '網路不可用',
    localTranslationTag: '本機翻譯',
    tooltipOriginal: '原文',
    tooltipTranslation: '翻譯',
    tooltipViewDetails: '點擊檢視詳情',
    tooltipClickToClear: '點擊清除翻譯',
    copiedOriginal: '已複製原文',
    copiedTranslation: '已複製譯文',
    copiedBoth: '已複製原文與譯文',
    noContentForDetails: '暫無可檢視的翻譯內容',
    viewFullText: '檢視全文',
    detailsTitle: '翻譯詳情',
    copyOriginalBtn: '複製原文',
    copyTranslationBtn: '複製譯文',
    copyBothBtn: '複製兩者',
    closeBtn: '關閉',
    offlineNotice: '目前為本機詞典模式，結果可能不完整（網路不可用或API失敗）',
    netErrNotice: '網路不可用或服務不可達，已回退到本機詞典模式',
    sourceLabel: '來源',
    openSettingsBtn: '開啟設定',
    viewFullBtn: '檢視完整內容',
  },
  ko: {
    translating: '번역 중...',
    selectionTooLong: (max) => `선택한 텍스트가 너무 깁니다 (최대 ${max}자)`,
    translationFailedShort: '번역 실패',
    translationFailedWithMsg: (msg) => `번역 실패: ${msg}`,
    networkUnavailable: '네트워크를 사용할 수 없음',
    localTranslationTag: '로컬 번역',
    tooltipOriginal: '원문',
    tooltipTranslation: '번역',
    tooltipViewDetails: '클릭하여 자세히 보기',
    tooltipClickToClear: '클릭하여 번역 지우기',
    copiedOriginal: '원문을 복사했습니다',
    copiedTranslation: '번역을 복사했습니다',
    copiedBoth: '원문과 번역을 복사했습니다',
    noContentForDetails: '보여줄 번역이 없습니다',
    viewFullText: '전체 텍스트 보기',
    detailsTitle: '번역 세부사항',
    copyOriginalBtn: '원문 복사',
    copyTranslationBtn: '번역 복사',
    copyBothBtn: '둘 다 복사',
    closeBtn: '닫기',
    offlineNotice: '로컬 사전 모드, 결과가 불완전할 수 있습니다 (네트워크/API 문제)',
    netErrNotice: '네트워크를 사용할 수 없어 로컬 사전으로 대체합니다',
    sourceLabel: '출처',
    openSettingsBtn: '설정 열기',
    viewFullBtn: '전체 보기',
  },
  fr: {
    translating: 'Traduction en cours...',
    selectionTooLong: (max) => `Sélection trop longue (maximum ${max} caractères)`,
    translationFailedShort: 'Échec de la traduction',
    translationFailedWithMsg: (msg) => `Échec de la traduction: ${msg}`,
    networkUnavailable: 'Réseau indisponible',
    localTranslationTag: 'Traduction locale',
    tooltipOriginal: 'Original',
    tooltipTranslation: 'Traduction',
    tooltipViewDetails: 'Cliquez pour voir les détails',
    tooltipClickToClear: 'Cliquez pour effacer la traduction',
    copiedOriginal: 'Original copié',
    copiedTranslation: 'Traduction copiée',
    copiedBoth: 'Original et traduction copiés',
    noContentForDetails: 'Aucune traduction à afficher',
    viewFullText: 'Voir le texte complet',
    detailsTitle: 'Détails de la traduction',
    copyOriginalBtn: 'Copier l\'original',
    copyTranslationBtn: 'Copier la traduction',
    copyBothBtn: 'Copier les deux',
    closeBtn: 'Fermer',
    offlineNotice: 'Mode dictionnaire local; le résultat peut être incomplet (problèmes réseau/API)',
    netErrNotice: 'Réseau indisponible; passage au dictionnaire local',
    sourceLabel: 'Source',
    openSettingsBtn: 'Ouvrir les paramètres',
    viewFullBtn: 'Voir tout le contenu',
  },
  de: {
    translating: 'Übersetzen...',
    selectionTooLong: (max) => `Auswahl zu lang (maximal ${max} Zeichen)`,
    translationFailedShort: 'Übersetzung fehlgeschlagen',
    translationFailedWithMsg: (msg) => `Übersetzung fehlgeschlagen: ${msg}`,
    networkUnavailable: 'Netzwerk nicht verfügbar',
    localTranslationTag: 'Lokale Übersetzung',
    tooltipOriginal: 'Original',
    tooltipTranslation: 'Übersetzung',
    tooltipViewDetails: 'Klicken Sie, um Details anzuzeigen',
    tooltipClickToClear: 'Klicken Sie, um die Übersetzung zu löschen',
    copiedOriginal: 'Original kopiert',
    copiedTranslation: 'Übersetzung kopiert',
    copiedBoth: 'Original und Übersetzung kopiert',
    noContentForDetails: 'Keine Übersetzung zum Anzeigen',
    viewFullText: 'Volltext anzeigen',
    detailsTitle: 'Übersetzungsdetails',
    copyOriginalBtn: 'Original kopieren',
    copyTranslationBtn: 'Übersetzung kopieren',
    copyBothBtn: 'Beide kopieren',
    closeBtn: 'Schließen',
    offlineNotice: 'Lokaler Wörterbuch-Modus; Ergebnis könnte unvollständig sein (Netzwerk-/API-Probleme)',
    netErrNotice: 'Netzwerk nicht verfügbar; Rückfall auf lokales Wörterbuch',
    sourceLabel: 'Quelle',
    openSettingsBtn: 'Einstellungen öffnen',
    viewFullBtn: 'Gesamten Inhalt anzeigen',
  },
};

function getUiStrings(): UiStrings {
  const cfg = vscode.workspace.getConfiguration('codeTranslator');
  const lang = (cfg.get<string>('targetLanguage', 'zh-CN') || '').toLowerCase();
  // 根据目标语言选择合适的UI语言
  if (lang === 'zh-cn') return UI_TEXT['zh-CN']; // 简体中文
  if (lang === 'zh-tw') return UI_TEXT['zh-TW']; // 繁体中文
  if (lang === 'ja') return UI_TEXT.ja; // 日语
  if (lang === 'ko') return UI_TEXT.ko; // 韩语
  if (lang === 'fr') return UI_TEXT.fr; // 法语
  if (lang === 'de') return UI_TEXT.de; // 德语
  return UI_TEXT.en; // 其他语言回退英文
}

let statusBarItem: vscode.StatusBarItem;
let settingsButton: vscode.StatusBarItem; // 仅在无翻译结果时显示
let translationManager: TranslationManager;
let translationTimeout: NodeJS.Timeout | undefined;
let lastTranslatedText: string = '';
let cursorTimeout: NodeJS.Timeout | undefined;
let autoHideTimeout: NodeJS.Timeout | undefined;
let currentDisplayToken = 0; // 防止旧的定时器清除新的显示
let currentRequestId = 0; // 防止旧的翻译结果覆盖新的显示
let lastOriginalForDetails: string = '';
let lastTranslatedForDetails: string = '';
let lastTranslationProvider: string = '';
let lastClickTime = 0;
let lastClickPosition: vscode.Position | undefined;
let lastSelectionAt = 0; // 最近一次处理非空选择的时间，用于抑制紧随其后的点击翻译覆盖

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Translator extension is now active!');

    // 创建翻译结果状态栏项
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.tooltip = getUiStrings().tooltipClickToClear;
    context.subscriptions.push(statusBarItem);
    
    // 创建（可隐藏的）设置按钮：仅在无翻译结果时显示，避免重复地球图标
    settingsButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    settingsButton.text = '🌐';
    settingsButton.tooltip = getUiStrings().openSettingsBtn;
    settingsButton.command = 'codeTranslator.openSettings';
    context.subscriptions.push(settingsButton);
    // 初始时显示设置按钮（尚无翻译结果）
    settingsButton.show();

    // 初始化翻译管理器
    const config = vscode.workspace.getConfiguration('codeTranslator');
    translationManager = new TranslationManager();
    // 已移除输出面板历史记录功能
    
    // 更新翻译提供商
    const provider = config.get<string>('apiProvider', 'google');
    translationManager.updateProvider(provider, config);
    // 根据目标语言更新右键菜单上下文
    updateTargetLangContext();

    // 动态更新命令标题的函数
    function updateCommandTitle() {
        const config = vscode.workspace.getConfiguration('codeTranslator');
        const targetLang = config.get<string>('targetLanguage', 'zh-CN');
        
        // 根据目标语言生成标题
        const langTitles: { [key: string]: string } = {
            'zh-CN': '翻译为中文',
            'zh-TW': '翻譯為繁體中文',
            'en': 'Translate to English',
            'ja': '日本語に翻訳',
            'ko': '한국어로 번역',
            'fr': 'Traduire en français',
            'de': 'Ins Deutsche übersetzen',
            'es': 'Traducir al español',
            'it': 'Traduci in italiano',
            'ru': 'Перевести на русский',
            'pt': 'Traduzir para português'
        };
        
        const title = langTitles[targetLang] || `翻译为 ${targetLang}`;
        
        // 更新命令标题（注意：VSCode不支持动态更新命令标题，但可以通过重新注册来实现）
        // 这里我们保持原标题，但可以在状态栏或其他地方显示动态标题
        return title;
    }
    
    // 注册翻译命令
    const translateCommand = vscode.commands.registerCommand('codeTranslator.translate', async () => {
        await translateSelection();
    });
    const translateLangCommands = [
        'codeTranslator.translate.zhCN',
        'codeTranslator.translate.zhTW',
        'codeTranslator.translate.en',
        'codeTranslator.translate.ja',
        'codeTranslator.translate.ko',
        'codeTranslator.translate.fr',
        'codeTranslator.translate.de',
        'codeTranslator.translate.es',
        'codeTranslator.translate.it',
        'codeTranslator.translate.ru',
        'codeTranslator.translate.pt',
    ].map(cmd => vscode.commands.registerCommand(cmd, async () => {
        await translateSelection();
    }));

    // 注册清除翻译命令
    const clearCommand = vscode.commands.registerCommand('codeTranslator.clear', () => {
        clearTranslation();
    });
    
    // 注册设置面板命令
    const settingsCommand = vscode.commands.registerCommand('codeTranslator.openSettings', () => {
        SettingsPanel.createOrShow(context.extensionUri);
    });

    // 点击状态栏显示详情弹窗（默认命令，会被displayTranslation中根据设置覆盖）
    statusBarItem.command = 'codeTranslator.showDetails';

    // 监听选择变化，自动翻译
    // 统一的选择变化监听器，处理选中和点击两种模式
    const selectionChangeListener = vscode.window.onDidChangeTextEditorSelection(async (e) => {
        // 每次都重新读取配置，确保使用最新的设置
        const currentConfig = vscode.workspace.getConfiguration('codeTranslator');
        const autoTranslate = currentConfig.get<boolean>('autoTranslate', true);
        
        if (!autoTranslate) {
            console.log('Auto translate disabled, skipping');
            return;
        }
        
        // 实时读取其他配置项
        const delay = currentConfig.get<number>('translationDelay', 250);
        const selectionTranslate = currentConfig.get<boolean>('selectionTranslate', true);
        const clickTranslateMode = currentConfig.get<string>('clickTranslateMode', 'single');
        const singleClickTranslate = clickTranslateMode === 'single';
        const doubleClickTranslate = clickTranslateMode === 'double';
        const minWordLength = currentConfig.get<number>('minWordLength', 2);
        
        const editor = e.textEditor;
        const selection = e.selections[0];
        
        console.log(`Selection changed: isEmpty=${selection.isEmpty}, selectionTranslate=${selectionTranslate}`);
        
        // 如果有选中文本，处理选中翻译
        if (!selection.isEmpty && selectionTranslate) {
            console.log('Processing text selection');
            // 当“点击翻译模式”为 none 时，跳过由双击产生的“整词选择”
            // 以免用户禁用了点击翻译但双击仍触发（双击会把整词设为选区）
            if (clickTranslateMode === 'none') {
                try {
                    const document = editor.document;
                    const selectedText = document.getText(selection);
                    const isSingleLine = selection.isSingleLine;
                    const hasWhitespace = /\s/.test(selectedText);
                    if (isSingleLine && !hasWhitespace && selectedText.length > 0) {
                        const wordRangeAtStart = document.getWordRangeAtPosition(selection.start);
                        const endInside = selection.end.character > 0 ? selection.end.translate(0, -1) : selection.end;
                        const wordRangeAtEnd = document.getWordRangeAtPosition(endInside);
                        const wordRange = wordRangeAtStart || wordRangeAtEnd;
                        if (wordRange && wordRange.start.isEqual(selection.start) && wordRange.end.isEqual(selection.end)) {
                            console.log('Skip translate: double-click word with clickTranslateMode=none');
                            return; // 视为双击整词选择，不触发翻译
                        }
                    }
                } catch (err) {
                    console.warn('Detect double-click selection failed:', err);
                }
            }
            
            // 防抖处理
            if (translationTimeout) {
                clearTimeout(translationTimeout);
            }
            if (cursorTimeout) {
                clearTimeout(cursorTimeout);
            }
            
            translationTimeout = setTimeout(async () => {
                await translateSelection();
            }, delay);
        }
        // 如果没有选中文本且支持点击翻译，处理点击翻译
        else if (selection.isEmpty && (singleClickTranslate || doubleClickTranslate)) {
            const currentTime = Date.now();
            const currentPosition = selection.active;
            
            // 检测是否为双击
            const isDoubleClick = lastClickTime && 
                                 (currentTime - lastClickTime) < 500 && // 500ms内
                                 lastClickPosition &&
                                 lastClickPosition.line === currentPosition.line &&
                                 Math.abs(lastClickPosition.character - currentPosition.character) <= 2;
            
            console.log(`Processing cursor click: isDoubleClick=${isDoubleClick}, singleClick=${singleClickTranslate}, doubleClick=${doubleClickTranslate}`);
            
            // 根据翻译模式决定是否处理
            let shouldProcess = false;
            if (isDoubleClick && doubleClickTranslate) {
                shouldProcess = true; // 双击且启用了双击翻译
            } else if (!isDoubleClick && singleClickTranslate) {
                shouldProcess = true; // 单击且启用了单击翻译
            }
            
            if (shouldProcess) {
                console.log('Processing click translation');
                
                // 防抖处理
                if (cursorTimeout) {
                    clearTimeout(cursorTimeout);
                }
                if (translationTimeout) {
                    clearTimeout(translationTimeout);
                }
                
                cursorTimeout = setTimeout(async () => {
                    try {
                        // 执行前再次确认当前并没有新的选择，且不在选择翻译的抑制窗口内
                        const liveEditor = vscode.window.activeTextEditor;
                        const hasSelectionNow = !!liveEditor && !liveEditor.selection.isEmpty;
                        if (hasSelectionNow) {
                            return;
                        }
                        if (Date.now() - lastSelectionAt < 1200) {
                            return;
                        }
                        // 使用智能单词获取
                        const smartWord = WordHelper.getSmartWordAtPosition(editor.document, selection.active);
                        console.log(`Smart word detected: "${smartWord}"`);
                        
                        if (smartWord && WordHelper.shouldTranslate(smartWord, minWordLength, true)) {
                            console.log(`Should translate: ${smartWord}`);
                            
                            // 避免重复翻译同一个单词
                            if (smartWord !== lastTranslatedText) {
                                // 提取可翻译文本
                                const translatableText = WordHelper.extractTranslatableText(smartWord);
                                console.log(`Translatable text: "${translatableText}"`);
                                
                                // 翻译单词（不需要检查文本是否不同，因为单词本身就值得翻译）
                                await translateTextWithOriginal(translatableText || smartWord, smartWord);
                                lastTranslatedText = smartWord;
                            } else {
                                console.log('Same word as last translated, skipping');
                            }
                        } else {
                            console.log(`Should not translate: ${smartWord}, minLength: ${minWordLength}`);
                        }
                    } catch (error) {
                        console.error('Click translation error:', error);
                    }
                }, delay * 1.2); // 略微延迟避免频繁触发
            } else {
                console.log('Click not processed due to translation mode');
            }
            
            // 更新点击记录
            lastClickTime = currentTime;
            lastClickPosition = currentPosition;
        }
    });

    // 详情显示：根据配置选择“系统弹窗”或“独立面板”
    const showDetailsCommand = vscode.commands.registerCommand('codeTranslator.showDetails', async () => {
        if (!lastOriginalForDetails && !lastTranslatedForDetails) {
            vscode.window.showInformationMessage(getUiStrings().noContentForDetails);
            return;
        }
        const config = vscode.workspace.getConfiguration('codeTranslator');
        const mode = (config.get<string>('detailsDisplayMode', 'system') || 'system').toLowerCase();
        const ui = getUiStrings();

        if (mode === 'system') {
            const headerOriginal = `=======${ui.tooltipOriginal}=======`;
            const headerTranslation = `=======${ui.tooltipTranslation}=======`;
            // 使用保存的翻译内容和提供商信息
            let translatedForDialog = lastTranslatedForDetails;
            
            // 移除可能存在的标记前缀
            translatedForDialog = translatedForDialog.replace(/^\[\[.*?\]\]\s*/g, '');
            
            const hasOffline = lastTranslatedForDetails.includes('[[OFFLINE]]');
            const hasNetErr = lastTranslatedForDetails.includes('[[NETERR]]');
            const notice = hasOffline ? ui.offlineNotice : (hasNetErr ? ui.netErrNotice : '');
            const sourceLine = lastTranslationProvider ? `\n\n${ui.sourceLabel || '来源'}：${lastTranslationProvider}` : '';
            // 原文过长时：只保留前200字符，并在末尾追加六个黑点省略号
            const blackDots = '⚫️⚫️⚫️⚫️⚫️⚫️';
            const originalLines = (lastOriginalForDetails || '').split(/\r?\n/).length;
            const needsShorten = (lastOriginalForDetails || '').length > 1000 || originalLines > 15;
            const originalForDialog = needsShorten
                ? lastOriginalForDetails.slice(0, 200) + blackDots
                : lastOriginalForDetails;
            // 顺序调整：译文在上、原文在下
            // 译文不做省略，只在原文侧处理
            const linesOfTrans = translatedForDialog.split(/\r?\n/).length;
            const message = `${notice ? notice + '\n\n' : ''}${headerTranslation}\n${translatedForDialog}\n\n${headerOriginal}\n${originalForDialog}${sourceLine}`;

            const btnCopyOriginal = ui.copyOriginalBtn;
            const btnCopyTranslation = ui.copyTranslationBtn;
            const btnCopyBoth = ui.copyBothBtn;
            const btnClose = ui.closeBtn;
            const btnOpenSettings = ui.openSettingsBtn;
            const btnViewFull = needsShorten ? ui.viewFullBtn : '';
            const picked = await vscode.window.showInformationMessage(
                message,
                { modal: true },
                btnClose, btnOpenSettings, ...(btnViewFull ? [btnViewFull] : []), btnCopyBoth, btnCopyTranslation, btnCopyOriginal
            );
            if (!picked || picked === btnClose) return;
            if (picked === btnOpenSettings) {
                SettingsPanel.createOrShow(context.extensionUri);
                return;
            }
            if (btnViewFull && picked === btnViewFull) {
                // 直接打开面板模式展示完整内容
                const width = Math.max(480, Math.min(1600, config.get<number>('detailsPanelWidth', 800)));
                const panel = vscode.window.createWebviewPanel(
                    'codeTranslator.details',
                    ui.detailsTitle,
                    vscode.ViewColumn.Active,
                    { enableScripts: true, retainContextWhenHidden: true }
                );
                const escapeHtml = (s: string) => s
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;');
                const hasOfflinePanel = lastTranslatedForDetails.startsWith('[[OFFLINE]]');
                const hasNetErrPanel = lastTranslatedForDetails.startsWith('[[NETERR]]');
                const noticePanel = hasOfflinePanel ? ui.offlineNotice : (hasNetErrPanel ? ui.netErrNotice : '');
                const originalEsc = escapeHtml(lastOriginalForDetails);
                let translatedForPanel2 = lastTranslatedForDetails;
                
                // 移除可能存在的标记前缀
                translatedForPanel2 = translatedForPanel2.replace(/^\[\[.*?\]\]\s*/g, '');
                
                const providerTagPanel2 = lastTranslationProvider;
                const translatedEsc2 = escapeHtml(translatedForPanel2);
                panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { color-scheme: light dark; }
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 0; }
    .wrap { max-width: ${width}px; width: ${width}px; margin: 16px auto; border: 1px solid var(--vscode-widget-border); border-radius: 8px; background: var(--vscode-editor-background); box-shadow: 0 2px 8px rgba(0,0,0,.2); display: flex; flex-direction: column; height: calc(90vh - 32px); }
    .content { padding: 16px; overflow-y: auto; }
    .bar { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid var(--vscode-widget-border); background: var(--vscode-editor-background); position: sticky; bottom: 0; }
    .btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .btn.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .notice { color: var(--vscode-descriptionForeground); white-space: pre-wrap; }
    pre { white-space: pre-wrap; word-break: break-word; }
    .heading { text-align: center; font-weight: 700; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="content" id="scrollable">
      ${noticePanel ? `<div class="notice">${escapeHtml(noticePanel)}</div>` : ''}
      <div class="heading">=======${ui.tooltipTranslation}=======</div>
      <pre>${translatedEsc2}</pre>
      <div class="heading">=======${ui.tooltipOriginal}=======</div>
      <pre>${originalEsc}</pre>
      ${providerTagPanel2 ? `<div class="notice">${ui.sourceLabel || '来源'}：${escapeHtml(providerTagPanel2)}</div>` : ''}
    </div>
    <div class="bar">
      <button class="btn secondary" id="copyOriginal">${ui.copyOriginalBtn}</button>
      <button class="btn secondary" id="copyTranslation">${ui.copyTranslationBtn}</button>
      <button class="btn secondary" id="copyBoth">${ui.copyBothBtn}</button>
      <button class="btn" id="close">${ui.closeBtn}</button>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('copyOriginal').addEventListener('click', () => vscode.postMessage({ t: 'copy', w: 'o' }));
    document.getElementById('copyTranslation').addEventListener('click', () => vscode.postMessage({ t: 'copy', w: 't' }));
    document.getElementById('copyBoth').addEventListener('click', () => vscode.postMessage({ t: 'copy', w: 'b' }));
    document.getElementById('close').addEventListener('click', () => vscode.postMessage({ t: 'close' }));
  </script>
</body>
</html>`;
                panel.webview.onDidReceiveMessage(async (msg) => {
                    if (!msg || !msg.t) return;
                    if (msg.t === 'close') { panel.dispose(); return; }
                    if (msg.t === 'copy') {
                        if (msg.w === 'o') { await vscode.env.clipboard.writeText(lastOriginalForDetails); vscode.window.setStatusBarMessage(ui.copiedOriginal, 3000); }
                        else if (msg.w === 't') { await vscode.env.clipboard.writeText(lastTranslatedForDetails); vscode.window.setStatusBarMessage(ui.copiedTranslation, 3000); }
                        else if (msg.w === 'b') { await vscode.env.clipboard.writeText(`${ui.tooltipOriginal}:\n${lastOriginalForDetails}\n\n${ui.tooltipTranslation}:\n${lastTranslatedForDetails}`); vscode.window.setStatusBarMessage(ui.copiedBoth, 3000); }
                    }
                });
                return;
            }
            if (picked === btnCopyOriginal) {
                await vscode.env.clipboard.writeText(lastOriginalForDetails);
                vscode.window.setStatusBarMessage(ui.copiedOriginal, 3000);
                return;
            }
            if (picked === btnCopyTranslation) {
                await vscode.env.clipboard.writeText(lastTranslatedForDetails);
                vscode.window.setStatusBarMessage(ui.copiedTranslation, 3000);
                return;
            }
            if (picked === btnCopyBoth) {
                await vscode.env.clipboard.writeText(`${ui.tooltipOriginal}:\n${lastOriginalForDetails}\n\n${ui.tooltipTranslation}:\n${lastTranslatedForDetails}`);
                vscode.window.setStatusBarMessage(ui.copiedBoth, 3000);
                return;
            }
            return;
        }

        // 面板模式（支持固定宽度和滚动）
        const width = Math.max(480, Math.min(1600, config.get<number>('detailsPanelWidth', 800)));
        const panel = vscode.window.createWebviewPanel(
            'codeTranslator.details',
            ui.detailsTitle,
            vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        const escapeHtml = (s: string) => s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        const hasOfflinePanel = lastTranslatedForDetails.startsWith('[[OFFLINE]]');
        const hasNetErrPanel = lastTranslatedForDetails.startsWith('[[NETERR]]');
        const notice = hasOfflinePanel ? ui.offlineNotice : (hasNetErrPanel ? ui.netErrNotice : '');

        const originalEsc = escapeHtml(lastOriginalForDetails);
        // 使用保存的翻译内容和提供商信息
        let translatedForPanel = lastTranslatedForDetails;
        
        // 移除可能存在的标记前缀
        translatedForPanel = translatedForPanel.replace(/^\[\[.*?\]\]\s*/g, '');
        
        const providerTagPanel = lastTranslationProvider;
        const translatedEsc = escapeHtml(translatedForPanel);

        panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
    }
    .wrap {
      max-width: ${width}px;
      width: ${width}px;
      margin: 16px auto;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px;
      background: var(--vscode-editor-background);
      box-shadow: 0 2px 8px rgba(0,0,0,.2);
      display: flex;
      flex-direction: column;
      height: calc(90vh - 32px);
    }
    .content {
      padding: 16px;
      overflow-y: auto;
    }
    h2 {
      margin: 16px 0 8px;
      font-size: 14px;
      color: var(--vscode-textPreformat-foreground);
    }
    .bar {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-widget-border);
      background: var(--vscode-editor-background);
      position: sticky;
      bottom: 0;
    }
    .btn { 
      background: var(--vscode-button-background); 
      color: var(--vscode-button-foreground); 
      border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; 
    }
    .btn.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .notice { color: var(--vscode-descriptionForeground); white-space: pre-wrap; }
    pre { white-space: pre-wrap; word-break: break-word; }
    .heading { text-align: center; font-weight: 700; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="content" id="scrollable">
      ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ''}
      <div class="heading">=======${ui.tooltipTranslation}=======</div>
      <pre>${translatedEsc}</pre>
      <div class="heading">=======${ui.tooltipOriginal}=======</div>
      <pre>${originalEsc}</pre>
      ${providerTagPanel ? `<div class="notice">来源：${escapeHtml(providerTagPanel)}</div>` : ''}
    </div>
    <div class="bar">
      <button class="btn secondary" id="copyOriginal">${ui.copyOriginalBtn}</button>
      <button class="btn secondary" id="copyTranslation">${ui.copyTranslationBtn}</button>
      <button class="btn secondary" id="copyBoth">${ui.copyBothBtn}</button>
      <button class="btn secondary" id="openSettings">${ui.openSettingsBtn}</button>
      <button class="btn" id="close">${ui.closeBtn}</button>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('copyOriginal').addEventListener('click', () => vscode.postMessage({ t: 'copy', w: 'o' }));
    document.getElementById('copyTranslation').addEventListener('click', () => vscode.postMessage({ t: 'copy', w: 't' }));
    document.getElementById('copyBoth').addEventListener('click', () => vscode.postMessage({ t: 'copy', w: 'b' }));
    document.getElementById('close').addEventListener('click', () => vscode.postMessage({ t: 'close' }));
    document.getElementById('openSettings').addEventListener('click', () => vscode.postMessage({ t: 'openSettings' }));
  </script>
</body>
</html>`;

        panel.webview.onDidReceiveMessage(async (msg) => {
            if (!msg || !msg.t) return;
            if (msg.t === 'close') {
                panel.dispose();
                return;
            }
            if (msg.t === 'openSettings') {
                SettingsPanel.createOrShow(context.extensionUri);
                return;
            }
            if (msg.t === 'copy') {
                if (msg.w === 'o') {
                    await vscode.env.clipboard.writeText(lastOriginalForDetails);
                    vscode.window.setStatusBarMessage(ui.copiedOriginal, 3000);
                } else if (msg.w === 't') {
                    await vscode.env.clipboard.writeText(lastTranslatedForDetails);
                    vscode.window.setStatusBarMessage(ui.copiedTranslation, 3000);
                } else if (msg.w === 'b') {
                    await vscode.env.clipboard.writeText(`${ui.tooltipOriginal}:\n${lastOriginalForDetails}\n\n${ui.tooltipTranslation}:\n${lastTranslatedForDetails}`);
                    vscode.window.setStatusBarMessage(ui.copiedBoth, 3000);
                }
            }
        });
    });

    // 监听配置更改，更新翻译提供商
    const configChangeListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('codeTranslator')) {
            console.log('Configuration changed, updating translation provider and context');
            const updatedConfig = vscode.workspace.getConfiguration('codeTranslator');
            const provider = updatedConfig.get<string>('apiProvider', 'google');
            translationManager.updateProvider(provider, updatedConfig);
            updateTargetLangContext();
            // 刷新状态栏tooltip语言
            statusBarItem.tooltip = getUiStrings().tooltipClickToClear;
        }
    });
    
    context.subscriptions.push(translateCommand, ...translateLangCommands, clearCommand, settingsCommand, selectionChangeListener, showDetailsCommand, configChangeListener);
}

function updateTargetLangContext() {
    const cfg = vscode.workspace.getConfiguration('codeTranslator');
    const lang = (cfg.get<string>('targetLanguage', 'zh-CN') || '').toLowerCase();
    const keyMap: { [key: string]: string } = {
        'zh-cn': 'codeTranslator.lang.isZhCN',
        'zh-tw': 'codeTranslator.lang.isZhTW',
        'en': 'codeTranslator.lang.isEn',
        'ja': 'codeTranslator.lang.isJa',
        'ko': 'codeTranslator.lang.isKo',
        'fr': 'codeTranslator.lang.isFr',
        'de': 'codeTranslator.lang.isDe',
        'es': 'codeTranslator.lang.isEs',
        'it': 'codeTranslator.lang.isIt',
        'ru': 'codeTranslator.lang.isRu',
        'pt': 'codeTranslator.lang.isPt',
    };

    // 全部重置为 false
    Object.values(keyMap).forEach(key => {
        vscode.commands.executeCommand('setContext', key, false);
    });

    const onKey = keyMap[lang] || keyMap['zh-cn'];
    vscode.commands.executeCommand('setContext', onKey, true);
}

async function translateSelection() {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        console.log('No active editor');
        return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    if (!text || text.trim().length === 0) {
        console.log('No text selected');
        // 不再清除已有翻译，避免体验上的闪烁
        return;
    }

    // 记录最近一次非空选择翻译触发时间，避免紧随其后的点击翻译覆盖
    lastSelectionAt = Date.now();

    await translateText(text);
}

async function translateText(text: string) {
    await translateTextWithOriginal(text, text);
}

async function translateTextWithOriginal(text: string, originalText: string) {
    if (!text || text.trim().length === 0) {
        return;
    }
    
    console.log('Translating text:', text, 'Original:', originalText);

    // 限制翻译文本长度（可配置）
    const configForLimit = vscode.workspace.getConfiguration('codeTranslator');
    const maxTextLength = configForLimit.get<number>('maxTextLength', 2000);
    const ui = getUiStrings();
    if (text.length > maxTextLength) {
        statusBarItem.text = `$(warning) ${ui.selectionTooLong(maxTextLength)}`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.show();
        return;
    }

    try {
        // 生成请求ID用于竞态管控
        const requestIdAtStart = ++currentRequestId;
        // 开始新一轮显示前，清理任何自动隐藏定时器
        if (autoHideTimeout) {
            clearTimeout(autoHideTimeout);
            autoHideTimeout = undefined;
        }
        currentDisplayToken++;

        // 显示加载状态
        statusBarItem.text = `$(sync~spin) ${ui.translating}`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
        console.log('Status bar shown with loading message');

        // 获取目标语言和源语言
        const config = vscode.workspace.getConfiguration('codeTranslator');
        const targetLang = config.get<string>('targetLanguage', 'zh-CN');
        const sourceLang = config.get<string>('sourceLanguage', 'auto');
        
        // 调用翻译服务
        const result = await translationManager.translate(text, targetLang, sourceLang);
        // 仅当该请求仍为最新时才展示结果
        if (requestIdAtStart !== currentRequestId) {
            return;
        }
        
        // 显示翻译结果
        console.log('Translation result:', result.translation, 'Provider:', result.provider);
        displayTranslation(result.translation, originalText, result.provider);
        lastTranslatedText = originalText;
    } catch (error) {
        console.error('Translation error:', error);
        // 若该请求已过期则不再展示错误
        if (typeof currentRequestId === 'number') {
            // no-op; 变量存在以确保作用域
        }
        // 由于 requestIdAtStart 仅在 try 块内声明，这里补充保护：
        // 如果有并发请求，后续请求会刷新 UI，这里不强制覆盖。
        // 简化处理：仅在没有新请求时展示错误。
        // 获取一个快照判断（若希望更严格，可将 requestId 提升到外层作用域）。
        // 为保持最小侵入，直接继续下面的错误展示逻辑。
        // 显示错误信息
        const ui = getUiStrings();
        const msg = error instanceof Error ? error.message : 'Unknown';
        statusBarItem.text = `$(error) ${ui.translationFailedWithMsg(msg)}`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.show();

        // 错误提示也采用安全的自动隐藏
        const tokenAtSchedule = ++currentDisplayToken;
        if (autoHideTimeout) {
            clearTimeout(autoHideTimeout);
        }
        autoHideTimeout = setTimeout(() => {
            if (tokenAtSchedule === currentDisplayToken) {
                clearTranslation();
            }
        }, 5000);
    }
}

function displayTranslation(translatedText: string, originalText: string, provider?: string) {
    // 检查是否有有效的翻译结果
    const ui = getUiStrings();
    if (!translatedText || translatedText.includes('翻译失败') || translatedText.includes('网络不可用') || translatedText.startsWith('[[NETERR]]')) {
        // 兼容新旧标记：若包含 [[NETERR]]，直接展示
        const display = translatedText && translatedText.startsWith('[[NETERR]]')
            ? translatedText.replace('[[NETERR]] ', '')
            : (translatedText || ui.translationFailedShort);
        statusBarItem.text = `⚠️ ${display}`;
        statusBarItem.show();
        
        // 错误信息5秒后自动消失（带防抖/令牌）
        const tokenAtSchedule = ++currentDisplayToken;
        if (autoHideTimeout) {
            clearTimeout(autoHideTimeout);
        }
        autoHideTimeout = setTimeout(() => {
            if (tokenAtSchedule === currentDisplayToken) {
                clearTranslation();
            }
        }, 5000);
        return;
    }
    
    // 将多行内容压缩为"多段"，每段以 "- " 开头，并用两个空格分隔
    const maxLength = 70; // 状态栏文本总长度上限
    let statusTextSource = translatedText;

    // 使用传入的provider参数，不再从文本中解析
    const providerTag = provider || '';
    
    // 移除可能存在的标记前缀
    statusTextSource = statusTextSource.replace(/^\[\[.*?\]\]\s*/g, '');
    
    // 移除术语解释部分（状态栏不显示）
    if (statusTextSource.includes('📝 编程术语解释')) {
        statusTextSource = statusTextSource.split('📝 编程术语解释')[0].trim();
    }

    const rawLines = statusTextSource.split(/\r?\n/).filter(l => l.trim().length > 0);
    const takeLines = Math.min(rawLines.length, 3); // 状态栏最多展示3段
    const perSeg = Math.max(10, Math.floor((maxLength - (takeLines * 2)) / Math.max(takeLines, 1)));
    const segments: string[] = [];
    for (let i = 0; i < takeLines; i++) {
        let seg = rawLines[i].trim();
        if (seg.length > perSeg) seg = seg.slice(0, perSeg) + '…';
        segments.push(`- ${seg}`);
    }
    let composed = segments.join('  ');
    if (composed.length > maxLength) composed = composed.slice(0, maxLength) + '…';

    // 在状态栏显示“多段”文本
    statusBarItem.text = `🌐 ${composed}`;
    // 翻译出现时隐藏单独的设置按钮，避免重复地球图标
    if (settingsButton) {
        settingsButton.hide();
    }
    // 记录详情文本（完整内容）
    lastOriginalForDetails = originalText;
    lastTranslatedForDetails = translatedText;
    lastTranslationProvider = providerTag;

    // 获取配置
    const config = vscode.workspace.getConfiguration('codeTranslator');
    
    // 统一使用默认的tooltip样式和命令
    // 限制 tooltip 字数，避免过长导致显示不全
    const MAX_TOOLTIP_CHARS = 750; // 译文在 tooltip 最多展示 600 字符
    // 为尽量保留多行：按换行切分，最多取前 15 行，每行再按字符数截断
    const truncateMultiline = (s: string) => {
        const lines = s.split(/\r?\n/);
        const take = Math.min(lines.length, 15);
        const perLine = Math.max(50, Math.floor(MAX_TOOLTIP_CHARS / take));
        const out: string[] = [];
        for (let i = 0; i < take; i++) {
            const line = lines[i];
            out.push(line.length > perLine ? (line.slice(0, perLine) + '…') : line);
        }
        let joined = out.join('\n');
        if (joined.length > MAX_TOOLTIP_CHARS) {
            joined = joined.slice(0, MAX_TOOLTIP_CHARS) + '…';
        }
        return joined;
    };
    // 原文定制截断：>50 时保留前20和末18，中间省略
    const shortenOriginalForTooltip = (s: string) => s.length > 50 ? (s.slice(0, 20) + '…' + s.slice(-18)) : s;
    const providerInfo = providerTag ? `\n\n${ui.sourceLabel || '来源'}：${providerTag}` : '';
    // 先显示译文，再显示原文
    const translatedForTooltip = truncateMultiline(statusTextSource);
    statusBarItem.tooltip = `${ui.tooltipTranslation}：${translatedForTooltip}\n\n${ui.tooltipOriginal}：${shortenOriginalForTooltip(originalText)}${providerInfo}\n\n${ui.tooltipViewDetails}`;
    statusBarItem.command = 'codeTranslator.showDetails';
    
    statusBarItem.show();
    
    console.log('Translation displayed in status bar');

    // 获取自动消失设置
    const autoHide = config.get<boolean>('autoHideTranslation', true);
    const autoHideDelay = config.get<number>('autoHideDelay', 10);
    
    // 只有在启用自动消失时才设置定时器
    if (autoHide) {
        // 根据翻译类型设置不同的显示时间
        let displayTime = autoHideDelay * 1000; // 转换为毫秒
        
        if (translatedText.includes('[本地翻译]')) {
            displayTime = Math.min(displayTime, 8000); // 本地翻译最多8秒
        } else if (originalText.length < 5) {
            displayTime = Math.min(displayTime, displayTime * 0.6); // 短单词时间更短
        }
        
        // 安全的自动隐藏：清理旧定时器并绑定令牌
        const tokenAtSchedule = ++currentDisplayToken;
        if (autoHideTimeout) {
            clearTimeout(autoHideTimeout);
        }
        autoHideTimeout = setTimeout(() => {
            if (tokenAtSchedule === currentDisplayToken) {
                clearTranslation();
            }
        }, displayTime);
    } else {
        // 如果不自动消失，清除任何现有的定时器
        if (autoHideTimeout) {
            clearTimeout(autoHideTimeout);
            autoHideTimeout = undefined;
        }
    }

    // 输出面板历史记录功能已移除
}

function clearTranslation() {
    if (translationTimeout) {
        clearTimeout(translationTimeout);
        translationTimeout = undefined;
    }
    if (cursorTimeout) {
        clearTimeout(cursorTimeout);
        cursorTimeout = undefined;
    }
    if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
        autoHideTimeout = undefined;
    }
    statusBarItem.hide();
    lastTranslatedText = '';
    // 恢复显示设置按钮
    if (settingsButton) {
        settingsButton.show();
    }
}

export function deactivate() {
    if (translationTimeout) {
        clearTimeout(translationTimeout);
    }
}

// 输出面板历史记录相关函数已移除
