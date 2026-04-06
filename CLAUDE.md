# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Visual Studio Code extension called **Translator2077** that provides intelligent translation services for code comments, variables, and text within the editor. The extension supports multiple translation providers including Google Translate, DeepL, Microsoft Translator, OpenAI GPT-4o mini, and Google Gemini 2.5 Flash.

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

**Translation Engine**: `src/translationManager.ts`
- Provider management and fallback chains
- API coordination across multiple translation services
- Enhanced translation with programming terminology

**Translation Providers**: `src/translator.ts`
- Google Translator (free and API-based)
- Microsoft Translator with region support
- DeepL Translator (free and professional)
- OpenAI GPT-4o mini integration
- Google Gemini 2.5 Flash integration
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
- API provider configuration and keys
- Language and behavior settings
- Display and interaction preferences
- Multi-provider authentication management