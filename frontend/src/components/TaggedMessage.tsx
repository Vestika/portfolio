import React from 'react';

interface TaggedMessageProps {
  content: string;
}

const TaggedMessage: React.FC<TaggedMessageProps> = ({ content }) => {
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
          <code key={`code-${i}`} className="bg-gray-900/80 text-gray-100 px-1.5 py-0.5 rounded">
            {segment}
          </code>
        );
      } else {
        // Bold: **text**
        const boldParts = segment.split(/\*\*([^*]+)\*\*/);
        for (let j = 0; j < boldParts.length; j++) {
          const boldSeg = boldParts[j];
          if (j % 2 === 1) {
            nodes.push(<strong key={`b-${i}-${j}`}>{boldSeg}</strong>);
          } else {
            // Italic: _text_
            const italicParts = boldSeg.split(/_([^_]+)_/);
            for (let k = 0; k < italicParts.length; k++) {
              const itSeg = italicParts[k];
              if (k % 2 === 1) {
                nodes.push(<em key={`i-${i}-${j}-${k}`}>{itSeg}</em>);
              } else if (itSeg) {
                nodes.push(<span key={`t-${i}-${j}-${k}`}>{itSeg}</span>);
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
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith('```')) {
        if (inCode) {
          nodes.push(
            <pre key={`pre-${i}`} className="bg-gray-900/80 text-gray-100 p-3 rounded mb-2 overflow-x-auto"><code>{codeBuffer.join('\n')}</code></pre>
          );
          codeBuffer = [];
          inCode = false;
        } else {
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

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const textContent = headingMatch[2];
        const Tag = (`h${Math.min(level, 6)}`) as keyof JSX.IntrinsicElements;
        nodes.push(
          <Tag key={`h-${i}`} className="font-semibold mb-1">{renderInline(textContent)}</Tag>
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