import { loadHelpArticles } from "@/lib/help-content";
import { HelpSearch } from "@/components/help/HelpSearch";
import { HelpTopicTree } from "@/components/help/HelpTopicTree";

export const dynamic = "force-dynamic";

// Shared Help-centre shell: a search box across the top, a topic tree on
// the left (sticky when wide, an accordion when narrow), the article or
// home view on the right.
export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const articles = loadHelpArticles();

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
      <div className="mb-5">
        <HelpSearch articles={articles} />
      </div>
      <div className="flex flex-col gap-6 min-[1100px]:flex-row min-[1100px]:items-start">
        <HelpTopicTree articles={articles} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
