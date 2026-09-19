import type { OmpModelCandidate } from "../shared/omp-models";
import { isValidOmpModelSelector } from "../shared/omp-settings";

export const OMP_MODEL_PICKER_RESULT_LIMIT = 8;

export type OmpModelPickerModel = {
  selector: string;
  label: string;
  provider: string;
  reasoning: boolean;
  imageInput: boolean;
  contextWindow?: number;
  thinkingLevels: readonly string[];
};

export type OmpModelPickerChoice =
  | { kind: "alias"; selector: `@${string}`; label: string }
  | { kind: "model"; model: OmpModelPickerModel; recommended: boolean };

const REASONING_ROLES: Readonly<Record<string, true>> = {
  default: true,
  task: true,
  plan: true,
  slow: true,
  advisor: true,
  reviewer: true,
};

export function roleCapabilityMatch(role: string, model: OmpModelPickerModel): boolean | undefined {
  const normalizedRole = role.trim().toLocaleLowerCase();
  if (normalizedRole === "vision") return model.imageInput;
  if (REASONING_ROLES[normalizedRole]) return model.reasoning;
  return undefined;
}

export function normalizeOmpModels(models: readonly OmpModelCandidate[]): OmpModelPickerModel[] {
  return models.map((model) => ({
    selector: model.selector,
    label: model.name || model.id,
    provider: model.provider,
    reasoning: model.reasoning,
    imageInput: model.input.some((input) => input.toLocaleLowerCase() === "image"),
    ...(model.contextWindow === null || model.contextWindow === undefined
      ? {}
      : { contextWindow: model.contextWindow }),
    thinkingLevels: model.thinkingLevels,
  }));
}

export function aliasChoices(
  modelRoles: Readonly<Record<string, unknown>>,
  currentRole?: string,
): OmpModelPickerChoice[] {
  return Object.keys(modelRoles)
    .filter((role) => role.length > 0 && role !== currentRole)
    .sort((left, right) => left.localeCompare(right))
    .map((role) => ({ kind: "alias" as const, selector: `@${role}` as const, label: role }));
}

function choiceSearchText(choice: OmpModelPickerChoice): string {
  if (choice.kind === "alias") return `${choice.label} ${choice.selector}`;
  const model = choice.model;
  return [
    model.label,
    model.selector,
    model.provider,
    model.reasoning ? "reasoning" : "standard",
    model.imageInput ? "image vision" : "text",
    model.contextWindow?.toString() ?? "",
    ...model.thinkingLevels,
  ].join(" ");
}

export function filterModelChoices(
  models: readonly OmpModelPickerModel[],
  aliases: readonly OmpModelPickerChoice[],
  query: string,
  role: string,
  limit = OMP_MODEL_PICKER_RESULT_LIMIT,
): OmpModelPickerChoice[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const choices: OmpModelPickerChoice[] = [
    ...aliases,
    ...models.map((model) => ({
      kind: "model" as const,
      model,
      recommended: roleCapabilityMatch(role, model) === true,
    })),
  ];
  return choices
    .filter(
      (choice) =>
        normalizedQuery.length === 0 ||
        choiceSearchText(choice).toLocaleLowerCase().includes(normalizedQuery),
    )
    .sort((left, right) => {
      const leftRecommended = left.kind === "model" && left.recommended;
      const rightRecommended = right.kind === "model" && right.recommended;
      if (leftRecommended !== rightRecommended) return leftRecommended ? -1 : 1;
      if (left.kind !== right.kind) return left.kind === "alias" ? -1 : 1;
      return choiceSearchText(left).localeCompare(choiceSearchText(right));
    })
    .slice(0, Math.max(0, limit));
}

export function formatModelSelector(selector: string, thinkingLevel?: string): string {
  return thinkingLevel ? `${selector}:${thinkingLevel}` : selector;
}

export type OmpThinkingSelectorChoice = {
  selector: string;
  available: boolean;
};

export function thinkingSelectorChoice(
  selector: string,
  thinkingLevel: string,
): OmpThinkingSelectorChoice {
  const suffixedSelector = formatModelSelector(selector, thinkingLevel);
  return {
    selector: suffixedSelector,
    available: isValidOmpModelSelector(suffixedSelector),
  };
}

export function updatePickerValue(
  currentValue: string | readonly string[],
  selector: string,
  mode: "replace" | "append",
): string | string[] {
  if (mode === "replace") return selector;
  const current = typeof currentValue === "string" ? [currentValue] : [...currentValue];
  if (current.includes(selector)) return current;
  return [...current, selector];
}

export function commitPickerSelection(
  disabled: boolean,
  selector: string,
  onSelect: (selector: string) => void,
): boolean {
  if (disabled) return false;
  onSelect(selector);
  return true;
}
