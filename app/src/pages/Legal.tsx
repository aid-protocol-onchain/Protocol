import { useEffect } from "react";
import { useTranslation } from "react-i18next";

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

// Renders Privacy or Terms in the active locale. The long legal copy lives in the
// `legal` i18n namespace (locales/legal.{en,es}.ts) so it stays out of the main
// JSON bundle. `doc` selects which document; the title and body switch with the
// active language.
export function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const { t, i18n } = useTranslation("legal");
  const title = t(doc === "privacy" ? "privacyTitle" : "termsTitle");
  const content = t(doc);
  useEffect(() => {
    document.title = `${title} · Aid Protocol`;
  }, [title, i18n.language]);
  return <div className="legal">{render(content)}</div>;
}
