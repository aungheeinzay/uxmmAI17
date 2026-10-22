import { createCn } from "cn/config";

export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display-lg", "heading-1", "heading-2", "heading-3", "body-lg", "body-md", "body-sm", "caption"] },
      ],
    },
  },
});

/** Up to two uppercase initials for an avatar, falling back when the name is missing. */
export function initialsFor(name: string | null | undefined, fallback = "ST") {
  if (!name) return fallback;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return initials || fallback;
}
