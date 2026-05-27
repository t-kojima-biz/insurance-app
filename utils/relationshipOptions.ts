export const DEFAULT_RELATIONSHIP_SUGGESTIONS = [
  '本人',
  '配偶者',
  '妻',
  '夫',
  '子',
  '長男',
  '長女',
  '次男',
  '次女',
  '父',
  '母',
  '兄',
  '姉',
  '弟',
  '妹',
  '孫',
  'その他',
];

export function mergeRelationshipSuggestions(values: Array<string | null | undefined>): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  for (const value of [...DEFAULT_RELATIONSHIP_SUGGESTIONS, ...values]) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    suggestions.push(normalized);
  }

  return suggestions;
}
