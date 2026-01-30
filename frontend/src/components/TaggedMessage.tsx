import React, { useState } from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { Copy, Check } from 'lucide-react';

interface TaggedMessageProps {
  content: string;
}

const TaggedMessage: React.FC<TaggedMessageProps> = ({ content }) => {
  const [copiedCode, setCopiedCode] = useState<number | null>(null);

  const handleCopyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(index);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };
  // Function to parse and highlight tags in the message
  const renderInline = (text: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    // Links: [text](url)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(text)) !== null) {
      const [full, label, url] = match;
      if (match.index > lastIndex) {
        elements.push(...renderInlineFormats(text.slice(lastIndex, match.index)));
      }
      elements.push(
        <a key={`${match.index}-${url}`}
           href={url}
           target="_blank"
           rel="noreferrer"
           className="text-blue-400 underline">
          {label}
        </a>
      );
      lastIndex = match.index + full.length;
    }
    if (lastIndex < text.length) {
      elements.push(...renderInlineFormats(text.slice(lastIndex)));
    }
    return elements;
  };

  const renderInlineFormats = (text: string): React.ReactNode[] => {
    // Inline code: `code`
    const parts = text.split(/`([^`]+)`/);
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      if (i % 2 === 1) {
        nodes.push(
          <code key={`code-${i}`} className="bg-gray-800 text-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">
            {segment}
          </code>
        );
      } else {
        // Strikethrough: ~~text~~
        const strikeParts = segment.split(/~~([^~]+)~~/);
        for (let j = 0; j < strikeParts.length; j++) {
          const strikeSeg = strikeParts[j];
          if (j % 2 === 1) {
            nodes.push(<del key={`s-${i}-${j}`} className="line-through text-gray-500">{strikeSeg}</del>);
          } else {
            // Bold: **text**
            const boldParts = strikeSeg.split(/\*\*([^*]+)\*\*/);
            for (let k = 0; k < boldParts.length; k++) {
              const boldSeg = boldParts[k];
              if (k % 2 === 1) {
                nodes.push(<strong key={`b-${i}-${j}-${k}`}>{boldSeg}</strong>);
              } else {
                // Italic: _text_ or *text*
                const italicParts = boldSeg.split(/[_*]([^_*]+)[_*]/);
                for (let l = 0; l < italicParts.length; l++) {
                  const itSeg = italicParts[l];
                  if (l % 2 === 1) {
                    nodes.push(<em key={`i-${i}-${j}-${k}-${l}`}>{itSeg}</em>);
                  } else if (itSeg) {
                    nodes.push(<span key={`t-${i}-${j}-${k}-${l}`}>{itSeg}</span>);
                  }
                }
              }
            }
          }
        }
      }
    }
    return nodes;
  };

  const renderMarkdown = (text: string): React.ReactNode => {
    const lines = text.split(/\r?\n/);
    const nodes: React.ReactNode[] = [];
    let i = 0;
    let inCode = false;
    let codeBuffer: string[] = [];
    let codeLanguage = '';
    let codeBlockIndex = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith('```')) {
        if (inCode) {
          const code = codeBuffer.join('\n');
          let highlighted = code;

          try {
            if (codeLanguage && hljs.getLanguage(codeLanguage)) {
              highlighted = hljs.highlight(code, { language: codeLanguage }).value;
            } else {
              highlighted = hljs.highlightAuto(code).value;
            }
          } catch (e) {
            console.warn('Syntax highlighting failed:', e);
            highlighted = code;
          }

          const currentIndex = codeBlockIndex;
          nodes.push(
            <div key={`code-${i}`} className="my-4 rounded-lg overflow-hidden group">
              {codeLanguage && (
                <div className="bg-gray-800 px-4 py-2 text-xs text-gray-400 border-b border-gray-700 flex items-center justify-between">
                  <span>{codeLanguage}</span>
                  <button
                    onClick={() => handleCopyCode(code, currentIndex)}
                    className="p-1.5 hover:bg-gray-700 rounded transition-colors flex items-center gap-1.5"
                    aria-label="Copy code"
                    title="Copy code"
                  >
                    {copiedCode === currentIndex ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-green-400" />
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
              <pre className="bg-gray-900/80 p-4 overflow-x-auto">
                <code
                  className={`text-sm ${codeLanguage ? `language-${codeLanguage}` : ''}`}
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              </pre>
            </div>
          );
          codeBuffer = [];
          codeLanguage = '';
          inCode = false;
          codeBlockIndex++;
        } else {
          // Extract language from opening fence
          const langMatch = line.trim().match(/^```(\w+)?/);
          codeLanguage = langMatch?.[1] || '';
          inCode = true;
        }
        i++;
        continue;
      }
      if (inCode) {
        codeBuffer.push(line);
        i++;
        continue;
      }

      // Unordered list
      if (/^\s*[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
          i++;
        }
        nodes.push(
          <ul key={`ul-${i}`} className="list-disc ml-5 mb-2">
            {items.map((it, idx) => (
              <li key={`li-${i}-${idx}`}>{renderInline(it)}</li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (/^\s*\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
          i++;
        }
        nodes.push(
          <ol key={`ol-${i}`} className="list-decimal ml-5 mb-2">
            {items.map((it, idx) => (
              <li key={`oli-${i}-${idx}`}>{renderInline(it)}</li>
            ))}
          </ol>
        );
        continue;
      }

      // Blockquote
      if (line.trim().startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        nodes.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-blue-500 pl-4 italic text-gray-400 my-3">
            {quoteLines.map((ql, idx) => (
              <p key={idx} className="mb-1">{renderInline(ql)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
        nodes.push(<hr key={`hr-${i}`} className="border-t border-gray-600 my-4" />);
        i++;
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const textContent = headingMatch[2];
        const Tag = (`h${Math.min(level, 6)}`) as keyof JSX.IntrinsicElements;
        const headingClass = level === 1 ? 'text-xl font-bold mb-2' :
                             level === 2 ? 'text-lg font-semibold mb-2' :
                             'text-base font-semibold mb-1';
        nodes.push(
          <Tag key={`h-${i}`} className={headingClass}>{renderInline(textContent)}</Tag>
        );
        i++;
        continue;
      }

      // Paragraphs
      if (line.trim() === '') {
        i++;
        continue;
      }
      const paraLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        paraLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <p key={`p-${i}`} className="mb-2">{renderInline(paraLines.join(' '))}</p>
      );
    }
    return <>{nodes}</>;
  };

  const parseMessage = (text: string) => {
    // Split the text by tag patterns and preserve the tags
    const parts = text.split(/(@[a-zA-Z0-9_\s]+|\$[A-Z]{1,5})/);
    
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            className="inline-block bg-blue-900 text-blue-100 px-1 rounded text-sm font-medium"
          >
            {part}
          </span>
        );
      } else if (part.startsWith('$')) {
        return (
          <span
            key={index}
            className="inline-block bg-green-900 text-green-100 px-1 rounded text-sm font-medium"
          >
            {part}
          </span>
        );
      } else {
        return (
          <span key={index}>{renderMarkdown(part)}</span>
        );
      }
    });
  };

  return (
    <div className="whitespace-pre-wrap">
      {parseMessage(content)}
    </div>
  );
};

export default TaggedMessage; 