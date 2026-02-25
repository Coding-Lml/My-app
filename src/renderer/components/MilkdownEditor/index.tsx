import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Editor as TiptapEditorInstance } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Markdown } from '@tiptap/markdown';
import { common, createLowlight } from 'lowlight';
import hljsJava from 'highlight.js/lib/languages/java';
import hljsPython from 'highlight.js/lib/languages/python';
import './MilkdownEditor.css';

interface HeadingItem {
  level: number;
  text: string;
  id: string;
}

interface SearchOptions {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

interface SearchState {
  total: number;
  currentIndex: number;
  error?: string;
}

interface SearchMatch {
  start: number;
  end: number;
  text: string;
}

const lowlight = createLowlight(common);
lowlight.register({
  java: hljsJava,
  python: hljsPython,
});
lowlight.registerAlias({
  javascript: ['js'],
  typescript: ['ts'],
  python: ['py', 'python3'],
  java: ['jdk'],
  bash: ['sh', 'zsh'],
});

interface MilkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
  onActiveHeadingChange?: (id: string | null) => void;
  focusMode?: boolean;
  typewriterMode?: boolean;
  readOnly?: boolean;
  viewMode?: 'wysiwyg' | 'source';
  imageSavePath?: string;
  currentFileDir?: string;
}

export interface MilkdownEditorHandle {
  insertImageFromDialog: () => Promise<void>;
  insertTable: (rows?: number, columns?: number) => void;
  deleteCurrentTable: () => boolean;
  insertCodeBlock: (language?: string) => void;
  scrollToHeading: (id: string) => void;
  getSearchState: (options: SearchOptions) => SearchState;
  findNext: (options: SearchOptions) => SearchState;
  findPrev: (options: SearchOptions) => SearchState;
  replaceCurrent: (options: SearchOptions, replacement: string) => SearchState & { replaced: boolean };
  replaceAll: (options: SearchOptions, replacement: string) => SearchState & { replacedCount: number };
}

const pathUtils = {
  normalize: (input: string): string => input.replace(/\\/g, '/'),
  resolve: (...parts: string[]): string => {
    if (parts.length === 0) return '';

    let result = pathUtils.normalize(parts[0] || '');

    for (let i = 1; i < parts.length; i++) {
      let part = pathUtils.normalize(parts[i] || '');
      if (!part || part === '.') continue;
      if (part.startsWith('./')) {
        part = part.slice(2);
      }

      if (!part) continue;

      if (part.startsWith('/') || /^[A-Za-z]:\//.test(part)) {
        result = part;
        continue;
      }

      while (part.startsWith('../')) {
        const lastSlash = result.lastIndexOf('/');
        if (lastSlash > 0) {
          result = result.substring(0, lastSlash);
        }
        part = part.slice(3);
      }

      if (!part || part === '..') {
        continue;
      }

      result = `${result}${result.endsWith('/') ? '' : '/'}${part}`;
    }

    return result;
  },
};

function isExternalUrl(src: string): boolean {
  return (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('local-file://')
  );
}

function toPathFromFileUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') {
      return null;
    }

    let pathname = decodePathSafe(parsed.pathname || '');
    if (!pathname) {
      return null;
    }

    // Windows file URL: file:///C:/path/to/file -> C:/path/to/file
    if (/^\/[A-Za-z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }

    // UNC path: file://server/share/file -> //server/share/file
    if (parsed.hostname) {
      pathname = `//${parsed.hostname}${pathname}`;
    }

    return pathUtils.normalize(pathname);
  } catch {
    return null;
  }
}

function toLocalFileUrl(filePath: string): string {
  const normalized = pathUtils.normalize(filePath);
  return `local-file://${encodeURI(normalized)}`;
}

function decodePathSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function slugifyHeadingText(input: string): string {
  const normalized = input
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_~]/g, '')
    .trim()
    .toLowerCase();

  const slug = normalized
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  return slug || 'section';
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid image data'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileSearchRegex(options: SearchOptions, global: boolean): { regex?: RegExp; error?: string } {
  const query = options.query || '';
  if (!query) {
    return {};
  }

  let pattern = query;

  if (!options.regex) {
    pattern = escapeRegExp(pattern);
  }

  if (options.wholeWord) {
    pattern = `\\b(?:${pattern})\\b`;
  }

  const flags = `${global ? 'g' : ''}${options.caseSensitive ? '' : 'i'}`;

  try {
    return { regex: new RegExp(pattern, flags) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : '正则表达式无效',
    };
  }
}

function computeMatches(content: string, options: SearchOptions): { matches: SearchMatch[]; error?: string } {
  const query = options.query || '';
  if (!query) {
    return { matches: [] };
  }

  const compiled = compileSearchRegex(options, true);
  if (compiled.error || !compiled.regex) {
    return { matches: [], error: compiled.error || '正则表达式无效' };
  }

  const matches: SearchMatch[] = [];
  let result: RegExpExecArray | null;
  let guard = 0;

  while ((result = compiled.regex.exec(content)) !== null) {
    const text = result[0] || '';
    const start = result.index;
    const end = start + text.length;

    if (text.length === 0) {
      compiled.regex.lastIndex += 1;
      guard += 1;
      if (guard > 100000) break;
      continue;
    }

    matches.push({ start, end, text });

    guard += 1;
    if (guard > 100000) {
      break;
    }
  }

  return { matches };
}

function getDocRangeByTextOffset(
  doc: TiptapEditorInstance['state']['doc'],
  start: number,
  end: number
): { from: number; to: number } | null {
  let cursor = 0;
  let from: number | null = null;
  let to: number | null = null;

  doc.descendants((node, pos) => {
    if (!node.isText) {
      return;
    }

    const text = node.text || '';
    const nodeStart = cursor;
    const nodeEnd = cursor + text.length;

    if (from === null && start >= nodeStart && start <= nodeEnd) {
      from = pos + Math.min(start - nodeStart, text.length);
    }

    if (to === null && end >= nodeStart && end <= nodeEnd) {
      to = pos + Math.min(end - nodeStart, text.length);
    }

    cursor = nodeEnd;
  });

  if (from === null || to === null) {
    return null;
  }

  return { from, to: Math.max(from, to) };
}

function findNearestHeadingIdBeforeOffset(
  headingsWithOffsets: Array<{ id: string; start: number }>,
  offset: number
): string | null {
  let candidate: string | null = null;

  for (const item of headingsWithOffsets) {
    if (item.start <= offset) {
      candidate = item.id;
      continue;
    }
    break;
  }

  return candidate;
}

async function saveImage(imageData: string, targetDir?: string, fileName?: string): Promise<string | null> {
  try {
    const result = await window.electronAPI.image.save(imageData, targetDir, { fileName });
    if (result.success && result.relativePath) {
      return result.relativePath;
    }
    console.error('Failed to save image:', result.error);
    return null;
  } catch (error) {
    console.error('Failed to save image:', error);
    return null;
  }
}

async function saveImageFile(file: File, targetDir?: string): Promise<string | null> {
  try {
    const imageData = await readFileAsDataURL(file);
    return await saveImage(imageData, targetDir, file.name);
  } catch (error) {
    console.error('Failed to process image file:', error);
    return null;
  }
}

const MilkdownEditor = forwardRef<MilkdownEditorHandle, MilkdownEditorProps>(function MilkdownEditor(
  {
    value,
    onChange,
    onSave,
    onHeadingsChange,
    onActiveHeadingChange,
    focusMode = false,
    typewriterMode = false,
    readOnly = false,
    imageSavePath,
    currentFileDir,
  },
  ref
) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousValueRef = useRef(value);
  const isApplyingExternalValueRef = useRef(false);
  const activeHeadingRef = useRef<string | null>(null);
  const headingPosRef = useRef<Map<string, number>>(new Map());
  const headingOffsetsRef = useRef<Array<{ id: string; start: number }>>([]);
  const scrollDetectRafRef = useRef<number | null>(null);
  const displayImageCacheRef = useRef<Map<string, string>>(new Map());
  const searchRuntimeRef = useRef<{
    key: string;
    matches: SearchMatch[];
    currentIndex: number;
    error?: string;
  }>({
    key: '',
    matches: [],
    currentIndex: -1,
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({
        placeholder: '开始编写 Markdown 笔记...',
      }),
      Image.configure({
        allowBase64: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({
        markedOptions: { gfm: true, breaks: false },
      }),
    ],
    content: value || '',
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: 'tiptap tiptap-prosemirror',
      },
    },
  });

  const buildHeadings = useCallback(
    (tiptapEditor: TiptapEditorInstance | null): HeadingItem[] => {
      if (!tiptapEditor) {
        headingPosRef.current = new Map();
        headingOffsetsRef.current = [];
        onHeadingsChange?.([]);
        return [];
      }

      const headings: HeadingItem[] = [];
      const headingPos = new Map<string, number>();
      const headingOffsets: Array<{ id: string; start: number }> = [];
      const slugCount = new Map<string, number>();
      let textCursor = 0;

      tiptapEditor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const text = (node.textContent || '').trim() || 'section';
          const level = Number(node.attrs.level) || 1;
          const base = slugifyHeadingText(text);
          const count = slugCount.get(base) || 0;
          slugCount.set(base, count + 1);
          const id = count === 0 ? base : `${base}-${count + 1}`;

          headings.push({ level, text, id });
          headingPos.set(id, pos);
          headingOffsets.push({ id, start: textCursor });
        }

        if (node.isText) {
          textCursor += (node.text || '').length;
        } else if (node.isBlock) {
          textCursor += 1;
        }
      });

      headingPosRef.current = headingPos;
      headingOffsetsRef.current = headingOffsets;
      onHeadingsChange?.(headings);
      return headings;
    },
    [onHeadingsChange]
  );

  const syncHeadingDom = useCallback((headings: HeadingItem[]) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const headingElements = scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headingElements.forEach((element, index) => {
      const heading = headings[index];
      const htmlEl = element as HTMLElement;
      if (heading) {
        htmlEl.dataset.headingId = heading.id;
        htmlEl.id = heading.id;
      } else {
        delete htmlEl.dataset.headingId;
      }
    });
  }, []);

  const detectActiveHeading = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }

    const headingElements = Array.from(scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];

    if (headingElements.length === 0) {
      if (activeHeadingRef.current !== null) {
        activeHeadingRef.current = null;
        onActiveHeadingChange?.(null);
      }
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetY = containerRect.top + containerRect.height * 0.33;

    let active: HTMLElement | null = null;
    for (const heading of headingElements) {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= targetY + 1) {
        active = heading;
      } else {
        break;
      }
    }

    const nextId = (active || headingElements[0]).dataset.headingId || null;
    if (nextId !== activeHeadingRef.current) {
      activeHeadingRef.current = nextId;
      onActiveHeadingChange?.(nextId);
    }
  }, [onActiveHeadingChange]);

  const resolveDisplayImageSrc = useCallback(
    async (rawSrc: string): Promise<string> => {
      const clean = decodePathSafe(rawSrc.trim());
      if (!clean) return clean;

      if (clean.startsWith('file://')) {
        const filePath = toPathFromFileUrl(clean);
        if (filePath) {
          return toLocalFileUrl(filePath);
        }
      }

      if (isExternalUrl(clean)) return clean;

      const normalized = pathUtils.normalize(clean);
      const noDotPath = normalized.replace(/^\.\//, '');
      const noLeadingSlashPath = noDotPath.replace(/^\/+/, '');
      const cacheKey = `${noLeadingSlashPath}@@${currentFileDir || ''}`;
      const cached = displayImageCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      if (noLeadingSlashPath.startsWith('note-images/')) {
        const result = await window.electronAPI.image.read(noLeadingSlashPath);
        if (result.success && result.data) {
          displayImageCacheRef.current.set(cacheKey, result.data);
          return result.data;
        }
        return noLeadingSlashPath;
      }

      const relative = noDotPath;
      const isAbsolute = relative.startsWith('/') || /^[A-Za-z]:\//.test(relative);
      if (isAbsolute) {
        const url = toLocalFileUrl(relative);
        displayImageCacheRef.current.set(cacheKey, url);
        return url;
      }

      if (!currentFileDir) {
        return relative;
      }

      const absolutePath = pathUtils.resolve(pathUtils.normalize(currentFileDir), relative);
      const url = toLocalFileUrl(absolutePath);
      displayImageCacheRef.current.set(cacheKey, url);
      return url;
    },
    [currentFileDir]
  );

  const refreshDisplayImages = useCallback(async () => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const images = Array.from(scrollContainer.querySelectorAll('img')) as HTMLImageElement[];
    for (const image of images) {
      const originalSrc = image.dataset.originalSrc || image.getAttribute('src') || '';
      if (!originalSrc) continue;

      if (!image.dataset.originalSrc) {
        image.dataset.originalSrc = originalSrc;
      }

      const displaySrc = await resolveDisplayImageSrc(originalSrc);
      if (displaySrc && image.getAttribute('src') !== displaySrc) {
        image.setAttribute('src', displaySrc);
      }
    }
  }, [resolveDisplayImageSrc]);

  const synchronizeFromExternalValue = useCallback(() => {
    if (!editor) return;

    const currentMarkdown = editor.getMarkdown();
    if (currentMarkdown === value) {
      previousValueRef.current = value;
      return;
    }

    isApplyingExternalValueRef.current = true;
    editor.commands.setContent(value || '', { contentType: 'markdown', emitUpdate: false });
    previousValueRef.current = value;

    window.requestAnimationFrame(() => {
      const headings = buildHeadings(editor);
      syncHeadingDom(headings);
      void refreshDisplayImages();
      detectActiveHeading();
      isApplyingExternalValueRef.current = false;
    });
  }, [buildHeadings, detectActiveHeading, editor, refreshDisplayImages, syncHeadingDom, value]);

  const scrollToHeading = useCallback(
    (id: string) => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const target = scrollContainer.querySelector(`[data-heading-id="${id}"]`) as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('heading-jump-highlight');
        window.setTimeout(() => {
          target.classList.remove('heading-jump-highlight');
        }, 1200);
        window.setTimeout(() => {
          detectActiveHeading();
        }, 120);
        return;
      }

      if (!editor) return;
      const pos = headingPosRef.current.get(id);
      if (typeof pos !== 'number') return;

      editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
      window.setTimeout(() => {
        detectActiveHeading();
      }, 120);
    },
    [detectActiveHeading, editor]
  );

  const revealMatch = useCallback(
    (match: SearchMatch) => {
      if (!editor) return;

      const range = getDocRangeByTextOffset(editor.state.doc, match.start, match.end);
      if (range) {
        editor.chain().focus().setTextSelection({ from: range.from, to: range.to }).scrollIntoView().run();
        return;
      }

      const nearestId = findNearestHeadingIdBeforeOffset(headingOffsetsRef.current, match.start);
      if (nearestId) {
        scrollToHeading(nearestId);
      }
    },
    [editor, scrollToHeading]
  );

  const getSearchKey = useCallback((content: string, options: SearchOptions) => {
    return JSON.stringify({
      content,
      query: options.query || '',
      caseSensitive: !!options.caseSensitive,
      wholeWord: !!options.wholeWord,
      regex: !!options.regex,
    });
  }, []);

  const refreshSearchRuntime = useCallback(
    (options: SearchOptions) => {
      const content = previousValueRef.current;
      const key = getSearchKey(content, options);
      const runtime = searchRuntimeRef.current;

      if (runtime.key === key) {
        return runtime;
      }

      const previousMatch = runtime.currentIndex >= 0 ? runtime.matches[runtime.currentIndex] : null;
      const { matches, error } = computeMatches(content, options);

      let currentIndex = -1;
      if (previousMatch && matches.length > 0) {
        const idx = matches.findIndex((item) => item.start === previousMatch.start && item.end === previousMatch.end);
        currentIndex = idx;
      }

      searchRuntimeRef.current = {
        key,
        matches,
        currentIndex,
        error,
      };

      return searchRuntimeRef.current;
    },
    [getSearchKey]
  );

  const getSearchState = useCallback(
    (options: SearchOptions): SearchState => {
      const runtime = refreshSearchRuntime(options);
      return {
        total: runtime.matches.length,
        currentIndex: runtime.currentIndex,
        error: runtime.error,
      };
    },
    [refreshSearchRuntime]
  );

  const findNext = useCallback(
    (options: SearchOptions): SearchState => {
      const runtime = refreshSearchRuntime(options);
      if (runtime.error) {
        return { total: 0, currentIndex: -1, error: runtime.error };
      }
      if (runtime.matches.length === 0) {
        runtime.currentIndex = -1;
        return { total: 0, currentIndex: -1 };
      }

      runtime.currentIndex = runtime.currentIndex < 0 ? 0 : (runtime.currentIndex + 1) % runtime.matches.length;

      const current = runtime.matches[runtime.currentIndex];
      if (current) {
        revealMatch(current);
      }

      return {
        total: runtime.matches.length,
        currentIndex: runtime.currentIndex,
      };
    },
    [refreshSearchRuntime, revealMatch]
  );

  const findPrev = useCallback(
    (options: SearchOptions): SearchState => {
      const runtime = refreshSearchRuntime(options);
      if (runtime.error) {
        return { total: 0, currentIndex: -1, error: runtime.error };
      }
      if (runtime.matches.length === 0) {
        runtime.currentIndex = -1;
        return { total: 0, currentIndex: -1 };
      }

      runtime.currentIndex = runtime.currentIndex < 0
        ? runtime.matches.length - 1
        : (runtime.currentIndex - 1 + runtime.matches.length) % runtime.matches.length;

      const current = runtime.matches[runtime.currentIndex];
      if (current) {
        revealMatch(current);
      }

      return {
        total: runtime.matches.length,
        currentIndex: runtime.currentIndex,
      };
    },
    [refreshSearchRuntime, revealMatch]
  );

  const replaceCurrent = useCallback(
    (options: SearchOptions, replacement: string) => {
      const runtime = refreshSearchRuntime(options);
      if (runtime.error) {
        return { total: 0, currentIndex: -1, error: runtime.error, replaced: false };
      }
      if (runtime.matches.length === 0) {
        runtime.currentIndex = -1;
        return { total: 0, currentIndex: -1, replaced: false };
      }

      if (runtime.currentIndex < 0) {
        runtime.currentIndex = 0;
      }

      const current = runtime.matches[runtime.currentIndex];
      if (!current) {
        return { total: runtime.matches.length, currentIndex: runtime.currentIndex, replaced: false };
      }

      let replacementText = replacement;
      if (options.regex) {
        const compiled = compileSearchRegex(options, false);
        if (compiled.error || !compiled.regex) {
          return {
            total: 0,
            currentIndex: -1,
            error: compiled.error || '正则表达式无效',
            replaced: false,
          };
        }
        replacementText = current.text.replace(compiled.regex, replacement);
      }

      const before = previousValueRef.current.slice(0, current.start);
      const after = previousValueRef.current.slice(current.end);
      const nextContent = `${before}${replacementText}${after}`;

      previousValueRef.current = nextContent;
      onChange(nextContent);

      const refreshed = refreshSearchRuntime(options);
      let nextIndex = refreshed.matches.findIndex((item) => item.start >= current.start + replacementText.length);
      if (nextIndex === -1 && refreshed.matches.length > 0) {
        nextIndex = refreshed.matches.length - 1;
      }
      refreshed.currentIndex = nextIndex;

      if (nextIndex >= 0 && refreshed.matches[nextIndex]) {
        revealMatch(refreshed.matches[nextIndex]);
      }

      return {
        total: refreshed.matches.length,
        currentIndex: refreshed.currentIndex,
        error: refreshed.error,
        replaced: true,
      };
    },
    [onChange, refreshSearchRuntime, revealMatch]
  );

  const replaceAll = useCallback(
    (options: SearchOptions, replacement: string) => {
      const runtime = refreshSearchRuntime(options);
      if (runtime.error) {
        return { total: 0, currentIndex: -1, error: runtime.error, replacedCount: 0 };
      }
      if (runtime.matches.length === 0) {
        return { total: 0, currentIndex: -1, replacedCount: 0 };
      }

      const compiled = compileSearchRegex(options, true);
      if (compiled.error || !compiled.regex) {
        return {
          total: 0,
          currentIndex: -1,
          error: compiled.error || '正则表达式无效',
          replacedCount: 0,
        };
      }

      const replacedCount = runtime.matches.length;
      const nextContent = previousValueRef.current.replace(compiled.regex, replacement);

      previousValueRef.current = nextContent;
      onChange(nextContent);

      const refreshed = refreshSearchRuntime(options);
      refreshed.currentIndex = refreshed.matches.length > 0 ? 0 : -1;

      if (refreshed.currentIndex >= 0 && refreshed.matches[refreshed.currentIndex]) {
        revealMatch(refreshed.matches[refreshed.currentIndex]);
      }

      return {
        total: refreshed.matches.length,
        currentIndex: refreshed.currentIndex,
        error: refreshed.error,
        replacedCount,
      };
    },
    [onChange, refreshSearchRuntime, revealMatch]
  );

  const insertMarkdownAtCursor = useCallback(
    (markdown: string) => {
      if (!editor) {
        const current = previousValueRef.current || '';
        const next = `${current}${current.endsWith('\n') ? '' : '\n'}${markdown}\n`;
        previousValueRef.current = next;
        onChange(next);
        return;
      }
      editor.chain().focus().insertContent(`${markdown}\n`, { contentType: 'markdown' }).run();
    },
    [editor, onChange]
  );

  const insertImageFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      for (const file of imageFiles) {
        const relativePath = await saveImageFile(file, imageSavePath);
        if (!relativePath) {
          continue;
        }

        const safePath = pathUtils.normalize(relativePath);
        if (editor) {
          editor.chain().focus().setImage({ src: safePath, alt: file.name }).run();
          editor.chain().focus().insertContent('\n', { contentType: 'markdown' }).run();
        } else {
          insertMarkdownAtCursor(`![${file.name}](${safePath})`);
        }
      }
    },
    [editor, imageSavePath, insertMarkdownAtCursor]
  );

  const openImageDialog = useCallback(async () => {
    const input = fileInputRef.current;
    if (!input) return;

    input.value = '';
    input.click();
  }, []);

  const insertTable = useCallback(
    (rows = 2, columns = 3) => {
      const safeRows = Math.max(1, Math.min(20, Math.floor(rows)));
      const safeColumns = Math.max(1, Math.min(10, Math.floor(columns)));
      const headers = Array.from({ length: safeColumns }, (_, i) => `列${i + 1}`);
      const headerLine = `| ${headers.join(' | ')} |`;
      const separatorLine = `| ${Array.from({ length: safeColumns }, () => '---').join(' | ')} |`;
      const rowLine = `| ${Array.from({ length: safeColumns }, () => ' ').join(' | ')} |`;
      const body = Array.from({ length: safeRows }, () => rowLine).join('\n');
      insertMarkdownAtCursor(`${headerLine}\n${separatorLine}\n${body}`);
    },
    [insertMarkdownAtCursor]
  );

  const deleteCurrentTable = useCallback((): boolean => {
    if (!editor) return false;
    return editor.commands.deleteTable();
  }, [editor]);

  const insertCodeBlock = useCallback(
    (language = '') => {
      const safeLanguage = language.trim();
      insertMarkdownAtCursor(`\`\`\`${safeLanguage}\n\n\`\`\``);
    },
    [insertMarkdownAtCursor]
  );

  useImperativeHandle(
    ref,
    () => ({
      insertImageFromDialog: openImageDialog,
      insertTable,
      deleteCurrentTable,
      insertCodeBlock,
      scrollToHeading,
      getSearchState,
      findNext,
      findPrev,
      replaceCurrent,
      replaceAll,
    }),
    [openImageDialog, insertTable, deleteCurrentTable, insertCodeBlock, scrollToHeading, getSearchState, findNext, findPrev, replaceCurrent, replaceAll]
  );

  useEffect(() => {
    previousValueRef.current = value;
    synchronizeFromExternalValue();
  }, [synchronizeFromExternalValue, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) {
      onHeadingsChange?.([]);
      return;
    }

    const sync = () => {
      const headings = buildHeadings(editor);
      syncHeadingDom(headings);
      void refreshDisplayImages();
      detectActiveHeading();
    };

    const handleUpdate = () => {
      if (isApplyingExternalValueRef.current) {
        return;
      }
      const markdown = editor.getMarkdown();
      previousValueRef.current = markdown;
      onChange(markdown);
      sync();
    };

    sync();
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [buildHeadings, detectActiveHeading, editor, onChange, onHeadingsChange, refreshDisplayImages, syncHeadingDom]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (scrollDetectRafRef.current) {
        cancelAnimationFrame(scrollDetectRafRef.current);
      }
      scrollDetectRafRef.current = requestAnimationFrame(() => {
        detectActiveHeading();
      });
    };

    container.addEventListener('scroll', handleScroll, true);

    return () => {
      container.removeEventListener('scroll', handleScroll, true);
      if (scrollDetectRafRef.current) {
        cancelAnimationFrame(scrollDetectRafRef.current);
        scrollDetectRafRef.current = null;
      }
    };
  }, [detectActiveHeading]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    const scheduleRefresh = () => {
      if (rafId !== null) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        void refreshDisplayImages();
      });
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'src' &&
          mutation.target instanceof HTMLImageElement
        ) {
          scheduleRefresh();
          return;
        }

        if (mutation.type === 'childList') {
          const hasImageNode = Array.from(mutation.addedNodes).some((node) => {
            if (node instanceof HTMLImageElement) {
              return true;
            }
            return node instanceof HTMLElement && !!node.querySelector('img');
          });

          if (hasImageNode) {
            scheduleRefresh();
            return;
          }
        }
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });

    scheduleRefresh();

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [refreshDisplayImages]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !editor) return;

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items || items.length === 0) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        await insertImageFiles(imageFiles);
      }
    };

    const handleDrop = async (event: DragEvent) => {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;

      event.preventDefault();
      await insertImageFiles(imageFiles);
    };

    const handleDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault();
      }
    };

    const handleTableDelete = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return;
      }

      const { selection } = editor.state;
      const { $from } = selection;
      const parentType = $from.parent.type.name;
      if (parentType !== 'tableCell' && parentType !== 'tableHeader') {
        return;
      }

      const isCellSelection = (selection as any).constructor?.name === 'CellSelection';
      if (isCellSelection) {
        event.preventDefault();
        editor.commands.deleteTable();
        return;
      }

      if (!selection.empty) {
        return;
      }

      const isCurrentCellEmpty = ($from.parent.textContent || '').trim().length === 0;
      if (!isCurrentCellEmpty) {
        return;
      }

      let tableNode: any = null;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === 'table') {
          tableNode = node;
          break;
        }
      }

      if (!tableNode) {
        return;
      }

      const isWholeTableEmpty = (tableNode.textContent || '').trim().length === 0;
      if (isWholeTableEmpty) {
        event.preventDefault();
        editor.commands.deleteTable();
      }
    };

    container.addEventListener('paste', handlePaste);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('keydown', handleTableDelete);

    return () => {
      container.removeEventListener('paste', handlePaste);
      container.removeEventListener('drop', handleDrop);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('keydown', handleTableDelete);
    };
  }, [editor, insertImageFiles]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave?.(previousValueRef.current);
      }
      if (event.key === 'Escape') {
        setPreviewImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleImageClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const image = target as HTMLImageElement;
        setPreviewImage(image.currentSrc || image.src || null);
      }
    };

    container.addEventListener('click', handleImageClick);
    return () => container.removeEventListener('click', handleImageClick);
  }, []);

  useEffect(() => {
    void refreshDisplayImages();
  }, [currentFileDir, refreshDisplayImages]);

  const editorClassName = useMemo(
    () => `milkdown-editor-wrapper ${focusMode ? 'focus-mode' : ''} ${
      typewriterMode ? 'typewriter-mode' : ''
    } ${readOnly ? 'read-only' : ''}`,
    [focusMode, readOnly, typewriterMode]
  );

  return (
    <>
      <div className={editorClassName} ref={wrapperRef}>
        <div className="tiptap-editor-content" ref={scrollContainerRef}>
          <EditorContent editor={editor} />
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          void insertImageFiles(files);
        }}
      />
      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" />
          <span
            className="image-preview-close"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewImage(null);
            }}
          >
            &times;
          </span>
        </div>
      )}
    </>
  );
});

export default MilkdownEditor;

export type { HeadingItem, MilkdownEditorProps, SearchOptions, SearchState };
