import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export function SafeMarkdown({ source }: { source: string }) {
  return (
    <div className="article-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => {
            const safeHref =
              href?.startsWith("/") && !href.startsWith("//")
                ? href
                : href?.startsWith("https://")
                  ? href
                  : undefined;
            return safeHref ? (
              <a
                href={safeHref}
                rel={
                  safeHref.startsWith("https://")
                    ? "noreferrer noopener"
                    : undefined
                }
              >
                {children}
              </a>
            ) : (
              <span>{children}</span>
            );
          },
          img: ({ alt }) => (
            <span className="media-unavailable">{alt || "Media"}</span>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
