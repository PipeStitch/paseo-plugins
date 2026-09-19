import { describe, expect, test } from "vitest";
import {
  aliasChoices,
  commitPickerSelection,
  filterModelChoices,
  formatModelSelector,
  normalizeOmpModels,
  type OmpModelPickerChoice,
  roleCapabilityMatch,
  thinkingSelectorChoice,
  updatePickerValue,
} from "../client/omp-model-picker-state";
import type { OmpModelCandidate } from "../shared/omp-models";

const candidates: OmpModelCandidate[] = [
  {
    selector: "plain/text-model",
    provider: "plain",
    id: "text-model",
    name: "Text Model",
    reasoning: false,
    input: ["text"],
    contextWindow: 32_000,
    thinkingLevels: [],
  },
  {
    selector: "reason/reasoning-model",
    provider: "reason",
    id: "reasoning-model",
    name: "Reasoning Model",
    reasoning: true,
    input: ["text"],
    contextWindow: 200_000,
    thinkingLevels: ["low", "high"],
  },
  {
    selector: "vision/image-model",
    provider: "vision",
    id: "image-model",
    name: "Image Model",
    reasoning: false,
    input: ["text", "image"],
    contextWindow: null,
    thinkingLevels: [],
  },
];

const models = normalizeOmpModels(candidates);

function choiceSelector(choice: OmpModelPickerChoice): string {
  return choice.kind === "alias" ? choice.selector : choice.model.selector;
}

describe("OMP model picker choices", () => {
  test("normalizes metadata and ranks only capability-backed role matches", () => {
    expect(models[2]).toMatchObject({
      selector: "vision/image-model",
      label: "Image Model",
      imageInput: true,
    });
    expect(roleCapabilityMatch("vision", models[2])).toBe(true);
    expect(roleCapabilityMatch("plan", models[1])).toBe(true);
    expect(roleCapabilityMatch("custom-role", models[1])).toBeUndefined();

    expect(filterModelChoices(models, [], "", "reviewer").map(choiceSelector)).toEqual([
      "reason/reasoning-model",
      "vision/image-model",
      "plain/text-model",
    ]);
    expect(
      filterModelChoices(models, [], "", "custom-role").every(
        (choice) => choice.kind === "alias" || !choice.recommended,
      ),
    ).toBe(true);
    expect(
      filterModelChoices(models, [], "", "").every(
        (choice) => choice.kind === "alias" || !choice.recommended,
      ),
    ).toBe(true);
  });

  test("searches provider, label, selector, and thinking level within a bounded list", () => {
    expect(filterModelChoices(models, [], "HIGH", "custom-role").map(choiceSelector)).toEqual([
      "reason/reasoning-model",
    ]);
    expect(filterModelChoices(models, [], "vision", "custom-role").map(choiceSelector)).toEqual([
      "vision/image-model",
    ]);
    expect(filterModelChoices(models, [], "", "custom-role", 2)).toHaveLength(2);
  });

  test("builds sorted sibling role aliases", () => {
    expect(
      aliasChoices({ slow: "reason/x", default: "plain/y", vision: "vision/z" }, "slow"),
    ).toEqual([
      { kind: "alias", selector: "@default", label: "default" },
      { kind: "alias", selector: "@vision", label: "vision" },
    ]);
  });

  test("formats exact selectors with an optional thinking suffix", () => {
    expect(formatModelSelector("reason/reasoning-model")).toBe("reason/reasoning-model");
    expect(formatModelSelector("reason/reasoning-model", "high")).toBe(
      "reason/reasoning-model:high",
    );
  });

  test("marks over-limit thinking suffixes unavailable without changing them", () => {
    expect(thinkingSelectorChoice(`p/${"m".repeat(505)}`, "high")).toEqual({
      selector: `p/${"m".repeat(505)}:high`,
      available: true,
    });
    expect(thinkingSelectorChoice(`p/${"m".repeat(508)}`, "高")).toEqual({
      selector: `p/${"m".repeat(508)}:高`,
      available: false,
    });
  });

  test("replaces role values and appends ordered model choices without duplicates", () => {
    expect(updatePickerValue("plain/old", "reason/new", "replace")).toBe("reason/new");
    expect(updatePickerValue(["plain/first"], "reason/second", "append")).toEqual([
      "plain/first",
      "reason/second",
    ]);
    expect(updatePickerValue(["plain/first"], "plain/first", "append")).toEqual(["plain/first"]);
  });

  test("does not commit picker selections while disabled", () => {
    const selected: string[] = [];
    expect(
      commitPickerSelection(true, "reason/reasoning-model", (value) => selected.push(value)),
    ).toBe(false);
    expect(selected).toEqual([]);
    expect(
      commitPickerSelection(false, "reason/reasoning-model", (value) => selected.push(value)),
    ).toBe(true);
    expect(selected).toEqual(["reason/reasoning-model"]);
  });

  test("leaves an empty suppression chain untouched until a model is selected", () => {
    const suppressed: string[] = [];
    expect(suppressed).toEqual([]);
    expect(updatePickerValue(suppressed, "plain/text-model", "append")).toEqual([
      "plain/text-model",
    ]);
    expect(suppressed).toEqual([]);
  });
});
