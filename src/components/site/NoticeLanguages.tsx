"use client";

import { useState } from "react";
import { NoticeBody } from "@/components/site/NoticeBody";
import type { NoticeTranslation } from "@/lib/content";

/**
 * A notice is published in the languages the branch actually wrote it in. The
 * buttons are built from what came back, so a reader is never offered an empty
 * panel, and the English text stays available whichever language is showing.
 */
export function NoticeLanguages({
  bodyEn,
  translations,
}: {
  bodyEn: string;
  translations: readonly NoticeTranslation[];
}) {
  const [language, setLanguage] = useState("en");
  const shown = translations.find((entry) => entry.language === language);

  if (translations.length === 0) return <NoticeBody body={bodyEn} />;

  const options = [{ language: "en", label: "English" }, ...translations];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Language of this notice">
        {options.map((option) => {
          const active = option.language === language;
          return (
            <button
              key={option.language}
              type="button"
              aria-pressed={active}
              onClick={() => setLanguage(option.language)}
              className={`rounded-[4px] border px-3 py-1.5 text-sm ${
                active
                  ? "border-green-700 bg-green-100 font-medium text-green-900"
                  : "border-line bg-paper text-green-900 hover:bg-green-100"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-3">
        {shown?.title ? (
          <h2 className="text-xl leading-snug text-green-900">{shown.title}</h2>
        ) : null}
        <NoticeBody body={shown?.body ?? bodyEn} />
      </div>
    </div>
  );
}
