"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * 관리자에는 typography 플러그인이 없으므로 태그별 스타일을 직접 지정한다.
 * 색·간격은 모두 디자인 토큰만 사용한다.
 */
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-6 mb-3 text-[20px] font-bold text-font-0 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 mb-2 border-b border-border-main pb-2 text-[17px] font-semibold text-font-0 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-2 text-[15px] font-semibold text-font-1 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-2 text-font-1">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2 flex list-disc flex-col gap-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 flex list-decimal flex-col gap-1 pl-5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-font-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-font-0">{children}</strong>
  ),
  em: ({ children }) => <em className="text-font-2 italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-brand underline underline-offset-2"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border-strong bg-subtle px-4 py-2 text-font-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-border-main" />,
  code: ({ children }) => (
    <code className="rounded-field bg-subtle px-1.5 py-0.5 text-[13px] text-font-1">
      {children}
    </code>
  ),
  // 표는 좁은 모달에서 넘칠 수 있어 자체 가로 스크롤 영역을 갖는다.
  table: ({ children }) => (
    <div className="my-3 w-full overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-max border-collapse text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-subtle">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border-main px-3 py-2 text-left font-medium text-font-2">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border-main px-3 py-2 text-font-1">
      {children}
    </td>
  ),
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/** 법적 문서 본문(마크다운)을 화면에 렌더링한다. */
const MarkdownContent = ({ content, className }: MarkdownContentProps) => {
  return (
    <div className={cn("text-[14px] leading-relaxed text-font-1", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={MARKDOWN_COMPONENTS}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
