import { useEffect, useState } from "react";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import { C } from "../../styles/theme";

interface MarkdownPreviewProps {
  content: string;
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    try {
      const rawHtml = md.render(content || "");
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      setHtml(cleanHtml);
    } catch (e) {
      console.error("Markdown rendering error", e);
    }
  }, [content]);

  return (
    <div 
      className="markdown-preview-container"
      style={{
        flex: 1,
        padding: "20px 24px",
        overflowY: "auto",
        background: C.panel,
        color: C.text,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: "14px",
        lineHeight: "1.6",
        boxSizing: "border-box",
        height: "100%",
      }}
    >
      <style>{`
        .markdown-preview-container h1, .markdown-preview-container h2, .markdown-preview-container h3, .markdown-preview-container h4 {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          color: ${C.text};
          margin-top: 24px;
          margin-bottom: 12px;
          border-bottom: 1px solid ${C.line};
          padding-bottom: 6px;
        }
        .markdown-preview-container h1 { font-size: 22px; }
        .markdown-preview-container h2 { font-size: 18px; }
        .markdown-preview-container h3 { font-size: 15px; }
        .markdown-preview-container p {
          margin-top: 0;
          margin-bottom: 16px;
        }
        .markdown-preview-container a {
          color: ${C.sky};
          text-decoration: none;
        }
        .markdown-preview-container a:hover {
          text-decoration: underline;
        }
        .markdown-preview-container code {
          font-family: 'JetBrains Mono', monospace;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid ${C.line};
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 13px;
        }
        .markdown-preview-container pre {
          background: ${C.base};
          border: 1px solid ${C.line};
          border-radius: 6px;
          padding: 12px;
          overflow-x: auto;
          margin-bottom: 16px;
        }
        .markdown-preview-container pre code {
          background: transparent;
          border: none;
          padding: 0;
          border-radius: 0;
          font-size: 13px;
        }
        .markdown-preview-container blockquote {
          margin: 0 0 16px 0;
          padding: 0 16px;
          color: ${C.muted};
          border-left: 4px solid ${C.sienna};
        }
        .markdown-preview-container ul, .markdown-preview-container ol {
          margin-top: 0;
          margin-bottom: 16px;
          padding-left: 20px;
        }
        .markdown-preview-container li {
          margin-bottom: 4px;
        }
        .markdown-preview-container hr {
          height: 1px;
          border: none;
          background: ${C.line};
          margin: 24px 0;
        }
        .markdown-preview-container table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 16px;
        }
        .markdown-preview-container th, .markdown-preview-container td {
          border: 1px solid ${C.line};
          padding: 6px 13px;
        }
        .markdown-preview-container tr:nth-child(2n) {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
