/**
 * Body text arrives as a plain string from an editor's keyboard and is emitted
 * through React, so nothing stored in the database is ever read as HTML. Blank
 * lines start a paragraph; a single newline stays inside it, as it reads on the
 * page.
 */
export function NoticeBody({ body }: { body: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-7">
      {body
        .split(/\n{2,}/)
        .filter((block) => block.trim().length > 0)
        .map((block, index) => (
          <p key={index}>{block}</p>
        ))}
    </div>
  );
}
