"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordHelper = void 0;
class WordHelper {
    /**
     * 获取光标位置的智能单词或短语
     * 支持驼峰命名、下划线命名、中划线命名等
     */
    static getSmartWordAtPosition(document, position) {
        // 首先尝试获取标准单词
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            console.log('No word range at position');
            return undefined;
        }
        const word = document.getText(wordRange);
        console.log(`Base word: "${word}"`);
        // 如果单词太短，直接返回
        if (word.length < 1) {
            return undefined;
        }
        // 尝试扩展为更大的标识符（包括驼峰、下划线等）
        const line = document.lineAt(position.line).text;
        const startChar = Math.max(0, wordRange.start.character - 20);
        const endChar = Math.min(line.length, wordRange.end.character + 20);
        const surroundingText = line.substring(startChar, endChar);
        // 简化的扩展逻辑：查找包含当前单词的更大标识符
        const expandedPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
        const matches = surroundingText.match(expandedPattern) || [];
        // 找到包含当前单词的最长匹配
        let bestMatch = word;
        for (const match of matches) {
            if (match.includes(word) && match.length > bestMatch.length) {
                bestMatch = match;
            }
        }
        console.log(`Expanded word: "${bestMatch}"`);
        return bestMatch;
    }
    /**
     * 智能提取可翻译的文本
     * - 如果是驼峰命名，转换为空格分隔
     * - 如果是下划线或中划线，转换为空格分隔
     * - 但要避免过度分割，保持单词的语义完整性
     */
    static extractTranslatableText(text) {
        if (!text) {
            return '';
        }
        const originalText = text;
        // 特殊情况处理：如果包含n8n、v8等常见缩写，不要分割
        const specialPatterns = [
            /\bn8n\b/i,
            /\bv\d+\b/i,
            /\b[a-z]+\d+[a-z]*\b/i,
            /\b[A-Z]{2,}\d+\b/,
            /\b\w*API\w*\b/i,
            /\b\w*URL\w*\b/i,
            /\b\w*HTTP\w*\b/i, // xxxHTTP
        ];
        // 检查是否包含特殊模式
        const hasSpecialPattern = specialPatterns.some(pattern => pattern.test(text));
        if (hasSpecialPattern) {
            // 对于特殊模式，只做简单的下划线和中划线替换
            let result = text.replace(/[_-]/g, ' ');
            result = result.replace(/\s+/g, ' ').trim();
            return result.toLowerCase();
        }
        // 对于普通单词，进行正常分割
        let result = text;
        // 处理驼峰命名法: getUserName -> get User Name
        // 但要避免过度分割短单词
        if (text.length > 4) {
            result = result.replace(/([a-z])([A-Z])/g, '$1 $2');
        }
        // 处理连续大写: XMLHttpRequest -> XML Http Request
        result = result.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
        // 处理下划线和中划线
        result = result.replace(/[_-]/g, ' ');
        // 只在单词较长时处理数字分割
        if (text.length > 6) {
            result = result.replace(/([a-zA-Z])(\d)/g, '$1 $2');
            result = result.replace(/(\d)([a-zA-Z])/g, '$1 $2');
        }
        // 移除多余空格
        result = result.replace(/\s+/g, ' ').trim();
        // 如果分割后的单词太多，可能过度分割了，返回原文
        const words = result.split(' ');
        if (words.length > 4 && originalText.length < 20) {
            // 对于短单词，如果分割成超过4个部分，可能过度了
            return originalText.toLowerCase();
        }
        // 转换为小写（保留首字母大写的单词）
        if (result.length > 0 && !/^[A-Z\s]+$/.test(result)) {
            result = result.toLowerCase();
        }
        return result;
    }
    /**
     * 判断文本是否为编程关键字或常见符号
     */
    static isProgrammingKeyword(text) {
        const keywords = new Set([
            // JavaScript/TypeScript关键字
            'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
            'function', 'return', 'const', 'let', 'var', 'class', 'extends', 'implements',
            'new', 'this', 'super', 'import', 'export', 'from', 'as', 'async', 'await',
            'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'void', 'null',
            'undefined', 'true', 'false', 'in', 'of', 'delete', 'default',
            // 其他语言通用关键字
            'public', 'private', 'protected', 'static', 'final', 'abstract', 'interface',
            'enum', 'namespace', 'package', 'using', 'include', 'require', 'define',
            // 常见符号和操作符
            '=', '==', '===', '!=', '!==', '>', '<', '>=', '<=', '&&', '||', '!',
            '+', '-', '*', '/', '%', '++', '--', '+=', '-=', '*=', '/=', '=>',
            '{', '}', '[', ']', '(', ')', ';', ':', ',', '.', '?', '&', '|', '^', '~'
        ]);
        return keywords.has(text.toLowerCase()) || keywords.has(text);
    }
    /**
     * 判断是否需要翻译
     */
    static shouldTranslate(text, minLength = 2, isClickMode = false) {
        if (!text || text.length < minLength) {
            return false;
        }
        // 如果是纯数字或纯符号，不翻译
        if (/^\d+$/.test(text) || /^[^\w\s]+$/.test(text)) {
            return false;
        }
        // 如果是单个字符的重复，不翻译
        if (text.length > 1 && new Set(text).size === 1) {
            return false;
        }
        // 在点击模式下，跳过一些无意义的单词，但要保留大部分有意义的单词
        if (isClickMode) {
            // 跳过单字符变量
            if (text.length === 1 && /[a-zA-Z]/.test(text)) {
                return false;
            }
            // 只跳过非常常见且无意义的单词
            const skipInClickMode = new Set([
                'if', 'is', 'in', 'on', 'at', 'to', 'of', 'or', 'as', 'be', 'do', 'go', 'up',
                'id', 'it', 'me', 'we', 'my', 'no'
            ]);
            // 只有当单词非常短且在跳过列表中时才跳过
            if (text.length <= 2 && skipInClickMode.has(text.toLowerCase())) {
                return false;
            }
        }
        return true;
    }
}
exports.WordHelper = WordHelper;
//# sourceMappingURL=wordHelper.js.map