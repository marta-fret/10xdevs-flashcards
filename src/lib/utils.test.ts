import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    const result = cn("px-2", "py-1", "text-sm");
    expect(result).toContain("px-2");
    expect(result).toContain("py-1");
    expect(result).toContain("text-sm");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const result = cn("base", isActive && "active");
    expect(result).toContain("base");
    expect(result).toContain("active");
  });

  it("deduplicates conflicting Tailwind classes", () => {
    const result = cn("p-2", "p-4");
    // twMerge keeps the last conflicting class
    expect(result.split(" ")).not.toContain("p-2");
    expect(result.split(" ")).toContain("p-4");
  });
});
