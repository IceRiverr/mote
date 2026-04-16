import { describe, it, expect } from "vitest";
import { validateAssetPath, resolveAssetPath } from "../path";

describe("validateAssetPath", () => {
  it("accepts valid paths", () => {
    expect(validateAssetPath("sprites/hero.png")).toBeNull();
    expect(validateAssetPath("prefabs/ground.mote-prefab.json")).toBeNull();
    expect(validateAssetPath("a/b/c.png")).toBeNull();
  });

  it("rejects backslashes", () => {
    expect(validateAssetPath("sprites\\hero.png")).not.toBeNull();
  });

  it("rejects absolute paths", () => {
    expect(validateAssetPath("/sprites/hero.png")).not.toBeNull();
  });

  it("rejects ../", () => {
    expect(validateAssetPath("../other/hero.png")).not.toBeNull();
    expect(validateAssetPath("sprites/../other/hero.png")).not.toBeNull();
  });

  it("rejects assets/ prefix", () => {
    expect(validateAssetPath("assets/sprites/hero.png")).not.toBeNull();
  });

  it("rejects ./ prefix", () => {
    expect(validateAssetPath("./sprites/hero.png")).not.toBeNull();
  });

  it("rejects drive letters", () => {
    expect(validateAssetPath("C:/sprites/hero.png")).not.toBeNull();
  });
});

describe("resolveAssetPath", () => {
  it("joins paths correctly", () => {
    expect(resolveAssetPath("games/aa/assets", "sprites/hero.png")).toBe(
      "games/aa/assets/sprites/hero.png"
    );
  });

  it("handles trailing slash", () => {
    expect(resolveAssetPath("games/aa/assets/", "sprites/hero.png")).toBe(
      "games/aa/assets/sprites/hero.png"
    );
  });

  it("throws on invalid path", () => {
    expect(() => resolveAssetPath("games/aa/assets", "../hero.png")).toThrow();
  });
});
