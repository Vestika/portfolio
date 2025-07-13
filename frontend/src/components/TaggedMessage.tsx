import React from 'react';

interface TaggedMessageProps {
  content: string;
}

const TaggedMessage: React.FC<TaggedMessageProps> = ({ content }) => {
  // Function to parse and highlight tags in the message
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
        return part;
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