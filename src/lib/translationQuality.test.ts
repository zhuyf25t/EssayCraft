import { describe, expect, it } from "vitest";
import { echoesSourceEnglish, hasBannedTranslationCommentary, hasUsefulChinese } from "./translationQuality";

describe("translation quality checks", () => {
  it("allows English bibliographic details in a translated reference list", () => {
    const source = `Critical thinking matters in AI education.

References
Bessen, J. (2019). AI and jobs: The role of demand. NBER Working Paper No. 24235.
Buolamwini, J., & Gebru, T. (2018). Gender shades. Proceedings of FAT.`;

    const translated = `批判性思维在人工智能教育中很重要。

References
Bessen, J. (2019). AI and jobs: The role of demand. NBER Working Paper No. 24235.
Buolamwini, J., & Gebru, T. (2018). Gender shades. Proceedings of FAT.`;

    expect(hasUsefulChinese(translated)).toBe(true);
    expect(echoesSourceEnglish(source, translated)).toBe(false);
  });

  it("still rejects body text that mostly echoes the English source", () => {
    const source = "Critical thinking helps students evaluate AI outputs and make responsible decisions in a changing technological environment.";
    const translated = "Critical thinking helps students evaluate AI outputs and make responsible decisions in a changing technological environment. 这段内容需要翻译。";

    expect(echoesSourceEnglish(source, translated)).toBe(true);
  });

  it("detects visible translation commentary", () => {
    expect(hasBannedTranslationCommentary("中文参考翻译：这是一段译文。")).toBe(true);
    expect(hasBannedTranslationCommentary("这是正式的中文译文。")).toBe(false);
  });
});
