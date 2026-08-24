# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

This is a Visual Studio Code extension called **Translater2077** that provides intelligent translation services for code comments, variables, and text within the editor. The extension supports multiple translation providers including Google Translate, DeepL, Microsoft Translator, OpenAI, Google Gemini, DeepSeek, OpenRouter, and any OpenAI-/Anthropic-compatible endpoint. For LLM providers the model is not hardcoded — it is fetched live from each vendor's models API and picked by the user in the settings panel.

## Development Commands

### Build & Compile
```bash
# Compile TypeScript to JavaScript
npm run compile

# Watch mode for development
npm run watch

# Package extension for distribution
npx vsce package
```

### Package Management
```bash
# Install dependencies
npm install

# The extension uses minimal dependencies:
# - axios (HTTP requests)
# - @types/vscode (VS Code API types)
# - typescript (development)
```

## Project Architecture

### Core Components

**Main Entry Point**: `src/extension.ts`
- Extension activation and command registration
- Selection and click event listeners
- Multi-language UI system with comprehensive i18n support
- Status bar management and auto-hide functionality

**Secret Storage**: `src/secretStore.ts`
- Single read/write entry point for all API keys, backed by `vscode.SecretStorage`
- Migrates (and keeps clearing) plaintext keys left in `settings.json` by older versions
- Keys are NEVER written to configuration - see Configuration Architecture below

**Model Catalog**: `src/modelCatalog.ts`
- Fetches the live model list from each vendor's models API
- Normalizes OpenAI-/Anthropic-compatible base URLs to their `/models` endpoints
- Maps HTTP failures to user-facing messages via `ModelFetchError`

**Translation Engine**: `src/translationManager.ts`
- Provider management and fallback chains
- API coordination across multiple translation services
- Enhanced translation with programming terminology

**Translation Providers**: `src/translator.ts`
- Google Translator (free and API-based)
- Microsoft Translator with region support
- DeepL Translator (free and professional)
- OpenAI integration (model selected from live /v1/models list)
- Google Gemini integration (model selected from live /v1beta/models list)
- CodeTermDictionary for offline programming terms

**Text Processing**: `src/wordHelper.ts`
- Smart word detection at cursor position
- Intelligent text extraction for various naming conventions
- Programming keyword detection and filtering

**Settings UI**: `src/settingsPanel.ts`
- WebView-based settings panel with multi-language support
- Real-time API connection testing
- Configuration management and validation

### Key Architectural Patterns

**Provider Pattern**: Multiple translation providers with unified interface and automatic fallback chain
**Command Pattern**: VS Code command registration with context-aware menu items
**Observer Pattern**: Configuration change listeners with real-time updates
**Strategy Pattern**: Different translation modes (selection, single-click, double-click)

### Translation Flow Architecture

1. **Text Selection/Click Detection** → WordHelper analysis
2. **Provider Selection** → TranslationManager routing
3. **API Call with Fallbacks** → Multiple provider attempts
4. **Enhancement** → Programming terminology enrichment
5. **Display** → Status bar + detailed view options

### Multi-language Support

The extension includes comprehensive internationalization:
- **Supported UI Languages**: 简体中文, 繁體中文, English, 日本語, 한국어, Français, Deutsch
- **Supported Translation Languages**: 11 languages with proper language code mapping
- **Context-aware UI**: Dynamic interface language based on target translation language

### Key Technical Features

- **Smart Word Detection**: Handles camelCase, snake_case, kebab-case, and programming identifiers
- **Fallback Chain**: API providers → free services → local dictionary
- **Rate Limiting**: Configurable delays and debouncing
- **Context Menus**: Dynamic menu items based on target language
- **Panel vs Modal**: Configurable display modes for translation details

## Extension Development Notes

- Built for VS Code API version 1.74.0+
- Uses TypeScript with strict compilation settings
- Output compiled to `out/` directory
- Supports both development and production builds
- Includes comprehensive error handling and offline capabilities

## Configuration Architecture

The extension uses VS Code's configuration system with nested settings under `codeTranslator.*`:
- API provider selection and per-provider model IDs
- Language and behavior settings
- Display and interaction preferences

**API keys are NOT stored in configuration.** They live in `vscode.SecretStorage` (the OS
keychain) and are reached only through `SecretStore`. The `codeTranslator.*ApiKey` settings
remain declared solely so old plaintext values can be detected and migrated away; never read
or write them directly.

**LLM model IDs are never hardcoded.** `codeTranslator.openaiModel`, `geminiModel`,
`deepseekModel`, `openrouterModel`, `customOpenAIModel` and `customAnthropicModel` all default
to an empty string; the user picks a model from the live list in the settings panel. Translation
fails with `MODEL_NOT_SELECTED` rather than silently falling back to a stale default.

Because keys are outside the configuration system, changing only a key does not fire
`onDidChangeConfiguration`. The settings panel therefore invokes the internal command
`codeTranslator.internal.reloadProvider` after saving so the provider is rebuilt immediately.