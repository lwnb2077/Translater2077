## Code Translator – Inline Translation for Editors

![Demo](demo.gif)

在 VS Code / Cursor 内，翻译其中单词、句子与段落到各种语言。它只显示结果，不会修改任何代码或文件。

---

### 简体中文
- 用途: 在编辑器中快速理解英文（或其他语言）的术语、注释、文档与文本。
- 安全: 不修改代码；仅处理你选中的文本；结果显示在状态栏和详情弹窗中。
- 来源可见: 详情中会标注使用的提供商（google / microsoft / deepl / openai / gemini / deepseek）或本地词典。

功能
- 划词翻译；单击/双击单词翻译（可在设置中切换）
- 状态栏展示精简结果，点击查看全文并复制原文/译文
- 多提供商与离线词典回退；可选系统弹窗或面板（可滚动、固定宽度）

设置要点
- 目标/源语言（源语言推荐 auto）
- 点击翻译模式（none/single/double）、延迟、最大长度
- 自动隐藏与时长、详情显示方式与宽度
- 各提供商 API Key 本地配置存储

---

### 繁體中文（Traditional Chinese）
- 用途：在編輯器內快速理解單字、句子與段落，適用 VS Code / Cursor。
- 安全：不會修改程式碼或檔案；僅處理你選取的文字；結果顯示於狀態列與詳情視窗。
- 來源可見：詳情會標註使用之提供商（google / microsoft / deepl / openai / gemini / deepseek）或本機詞典。

功能
- 劃詞翻譯、單擊/雙擊單字翻譯（可設定）
- 狀態列顯示精簡結果，點擊可查看全文與複製
- 多提供商與離線詞典回退；可選系統對話框或面板（可滾動、固定寬度）

設定
- 目標/來源語言、點擊翻譯模式、延遲與最大長度
- 自動隱藏與時間、詳情顯示方式與寬度
- API Key 只儲存在本機設定

---

### 日本語（Japanese）
- 目的: エディタ内の単語・文・段落をすばやく理解するための翻訳/解説。VS Code / Cursor 対応。
- 安全: コードやファイルは変更しません。選択したテキストのみを処理し、結果はステータスバーと詳細ビューに表示します。
- 出典の明示: 使用したプロバイダー（google / microsoft / deepl / openai / gemini / deepseek）またはローカル辞書を表示します。

機能
- 選択翻訳、クリック/ダブルクリック単語翻訳（設定可能）
- ステータスバーに要約表示、クリックで全文・コピー
- 複数プロバイダー + オフライン辞書フォールバック、system/panel 表示切替

設定
- 目標/ソース言語（ソースは auto 推奨）
- クリック翻訳モード、ディレイ、最大長
- 自動非表示、詳細表示方式と幅、API キーはローカル保存

---

### 한국어（Korean）
- 목적: VS Code / Cursor 에디터 안의 단어·문장·문단을 빠르게 이해하도록 돕는 번역/해설 도구입니다.
- 안전: 코드/파일을 변경하지 않습니다. 선택한 텍스트만 처리하며 결과는 상태 표시줄과 상세 창에 표시됩니다.
- 출처 표시: 사용한 제공자(google / microsoft / deepl / openai / gemini / deepseek) 또는 로컬 사전 표시.

기능
- 선택 번역, 클릭/더블클릭 단어 번역(설정 가능)
- 상태 표시줄 요약, 클릭 시 전체 보기 및 복사
- 다중 제공자 + 오프라인 사전 폴백, system/panel 전환 및 고정 폭

설정
- 대상/소스 언어(auto 권장), 클릭 번역 모드, 지연/최대 길이
- 자동 숨김/지속 시간, 상세 표시 방식/폭, API 키는 로컬 저장

---

### English
- Purpose: Translate/explain words, sentences and paragraphs inside the editor (VS Code / Cursor).
- Safe: Never modifies code or files. Only processes the text you select; results appear in the status bar and a details view.
- Transparent: Details show which provider was used (google / microsoft / deepl / openai / gemini / deepseek) or local dictionary.

Features
- Selection translation; single/double‑click word translation (configurable)
- Compact status‑bar result → click for full text and copy
- Multiple providers + offline dictionary fallback; system dialog or panel view

Settings
- Target/source language (auto recommended for source)
- Click‑translate mode, delay, maximum length
- Auto‑hide & duration, details display mode & width
- API keys stored locally in VS Code settings

---

## 安装方法 / Installation

### 方法一：下载 .vsix 文件安装
1. 下载仓库中的 `Translator2077-1.1.0.vsix` 文件
2. 打开 VS Code
3. 按下 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
4. 输入 "Extensions: Install from VSIX"
5. 选择下载的 .vsix 文件进行安装

### Method 1: Install from .vsix file
1. Download `Translator2077-1.1.0.vsix` from this repository
2. Open VS Code
3. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
4. Type "Extensions: Install from VSIX"
5. Select the downloaded .vsix file to install

### 方法二：从源码编译
```bash
git clone https://github.com/lwnb2077/code-translator.git
cd code-translator
npm install
npm run compile
```

---

Feedback / Issues: welcome PRs and issues in the repository.
