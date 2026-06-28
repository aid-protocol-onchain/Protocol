import { useEffect } from "react";

// Minimal markdown renderer for the legal docs (headings, lists, paragraphs).
// Kept dependency-free; the legal copy uses only #, ##, "- " bullets and paragraphs.
function render(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${out.length}`}>
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) {
      flush();
      out.push(<h2 key={i}>{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      flush();
      out.push(<h1 key={i}>{line.slice(2)}</h1>);
    } else if (line.startsWith("- ")) {
      list.push(line.slice(2));
    } else if (line.startsWith("Effective date:")) {
      flush();
      out.push(<p className="eff" key={i}>{line}</p>);
    } else if (line.length === 0) {
      flush();
    } else {
      flush();
      out.push(<p key={i}>{line}</p>);
    }
  });
  flush();
  return out;
}

export function Legal({ title, content }: { title: string; content: string }) {
  useEffect(() => {
    document.title = `${title} · Aid Protocol`;
  }, [title]);
  return <div className="legal">{render(content)}</div>;
}
