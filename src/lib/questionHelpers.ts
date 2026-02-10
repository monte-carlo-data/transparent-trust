import { Skill } from "@/types/skill";

export type ParsedAnswerSections = {
  response: string;
  confidence: string;
  sources: string;
  reasoning: string;
  inference: string;
  remarks: string;
  notes: string; // New: combined "show your work" field for chat
};

/**
 * Parses an LLM answer into structured sections: response, confidence, sources, reasoning, inference, and remarks.
 * Looks for section headers like "Confidence:", "Sources:", "Reasoning:", "Inference:", "Remarks:" and separates content accordingly.
 * Also handles inline format like "Confidence: High Notes: explanation here"
 */
export const parseAnswerSections = (answer: string): ParsedAnswerSections => {
  console.log("[parseAnswerSections] Raw answer:", answer);
  const lines = answer.split("\n");
  const sectionBuckets: Record<string, string[]> = {
    confidence: [],
    sources: [],
    reasoning: [],
    inference: [],
    remarks: [],
    notes: [],
  };

  let currentSection: "answer" | "confidence" | "sources" | "reasoning" | "inference" | "remarks" | "notes" | null = null;
  let responseBody = "";
  const responseLinesBeforeFirstSection: string[] = [];
  const answerLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const lineLower = line.toLowerCase();

    // Check for **Confidence**: High pattern (standalone line)
    const confLineMatch = line.match(/^\*{0,2}confidence\*{0,2}:\s*(\w+)/i);
    if (confLineMatch) {
      console.log("[parseAnswerSections] Found confidence line:", line, confLineMatch[1]);
      sectionBuckets.confidence.push(confLineMatch[1].trim());
      continue;
    }

    // Check for **Notes**: text pattern (standalone line)
    const notesLineMatch = line.match(/^\*{0,2}notes\*{0,2}:\s*(.+)/i);
    if (notesLineMatch) {
      console.log("[parseAnswerSections] Found notes line:", line);
      sectionBuckets.notes.push(notesLineMatch[1].replace(/\*+$/, '').trim());
      continue;
    }

    // Check for inline "Confidence: X Notes: Y" pattern on same line (legacy format)
    if (lineLower.includes("confidence") && lineLower.includes("notes")) {
      const confMatch = line.match(/confidence[*]*:\s*(\w+)/i);
      const notesMatch = line.match(/notes[*]*:\s*(.+)/i);
      if (confMatch && notesMatch) {
        sectionBuckets.confidence.push(confMatch[1].trim());
        sectionBuckets.notes.push(notesMatch[1].replace(/\*+$/, '').trim());
        continue;
      }
    }

    // Check for Answer: or Response: section header (handle both for backwards compatibility)
    // Also handle markdown # and ## headers
    if (
      lineLower.startsWith("answer:") ||
      lineLower.startsWith("**answer:**") ||
      lineLower === "answer" ||
      lineLower === "**answer**" ||
      lineLower.startsWith("response:") ||
      lineLower.startsWith("**response:**") ||
      lineLower === "response" ||
      lineLower === "**response**" ||
      lineLower.startsWith("# answer:") ||
      lineLower.startsWith("# response:") ||
      lineLower.startsWith("## answer:") ||
      lineLower.startsWith("## response:")
    ) {
      currentSection = "answer";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          answerLines.push(rest);
        }
      }
      continue;
    }

    if (
      lineLower.startsWith("confidence:") ||
      lineLower.startsWith("**confidence:**") ||
      lineLower === "confidence" ||
      lineLower === "**confidence**" ||
      lineLower.startsWith("# confidence:") ||
      lineLower.startsWith("## confidence:")
    ) {
      currentSection = "confidence";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.confidence.push(rest);
        }
      }
      continue;
    }

    if (
      lineLower.startsWith("sources:") ||
      lineLower.startsWith("**sources:**") ||
      lineLower === "sources" ||
      lineLower === "**sources**" ||
      lineLower.startsWith("# sources:") ||
      lineLower.startsWith("## sources:")
    ) {
      currentSection = "sources";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.sources.push(rest);
        }
      }
      continue;
    }

    if (
      lineLower.startsWith("reasoning:") ||
      lineLower.startsWith("**reasoning:**") ||
      lineLower === "reasoning" ||
      lineLower === "**reasoning**" ||
      lineLower.startsWith("# reasoning:") ||
      lineLower.startsWith("## reasoning:")
    ) {
      currentSection = "reasoning";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.reasoning.push(rest);
        }
      }
      continue;
    }

    if (
      lineLower.startsWith("inference:") ||
      lineLower.startsWith("**inference:**") ||
      lineLower === "inference" ||
      lineLower === "**inference**" ||
      lineLower.startsWith("# inference:") ||
      lineLower.startsWith("## inference:")
    ) {
      currentSection = "inference";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.inference.push(rest);
        }
      }
      continue;
    }

    if (
      lineLower.startsWith("remarks:") ||
      lineLower.startsWith("**remarks:**") ||
      lineLower === "remarks" ||
      lineLower === "**remarks**" ||
      lineLower.startsWith("# remarks:") ||
      lineLower.startsWith("## remarks:")
    ) {
      currentSection = "remarks";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.remarks.push(rest);
        }
      }
      continue;
    }

    // New: Notes section for "show your work" in chat context
    if (
      lineLower.startsWith("notes:") ||
      lineLower.startsWith("**notes:**") ||
      lineLower === "notes" ||
      lineLower === "**notes**" ||
      lineLower.startsWith("# notes:") ||
      lineLower.startsWith("## notes:")
    ) {
      currentSection = "notes";
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const rest = line.substring(colonIndex + 1).trim();
        if (rest.length > 0) {
          sectionBuckets.notes.push(rest);
        }
      }
      continue;
    }

    if (currentSection === "answer") {
      answerLines.push(rawLine);
    } else if (currentSection) {
      sectionBuckets[currentSection].push(rawLine);
    } else {
      responseLinesBeforeFirstSection.push(rawLine);
    }
  }

  // Use explicit Answer section if found, otherwise fall back to pre-section content
  const answerContent = answerLines.join("\n").trim();
  responseBody = answerContent || responseLinesBeforeFirstSection.join("\n").trim();
  return {
    response: responseBody || answer.trim(),
    confidence: sectionBuckets.confidence.join("\n"),
    sources: sectionBuckets.sources.join("\n"),
    reasoning: sectionBuckets.reasoning.join("\n"),
    inference: sectionBuckets.inference.join("\n"),
    remarks: sectionBuckets.remarks.join("\n"),
    notes: sectionBuckets.notes.join("\n"),
  };
};

/**
 * Selects relevant skills based on question keywords.
 * Scores skills by:
 * - Title matches: 10 points
 * - Category matches: 5 points
 * - Content keyword matches: 1 point each
 * Returns top 5 skills with score > 0
 */
export const selectRelevantSkills = (question: string, allSkills: Skill[]): Skill[] => {
  const questionLower = question.toLowerCase();
  const questionWords = questionLower.split(/\s+/).filter((word) => word.length > 3);

  const activeSkills = allSkills.filter((skill) => skill.status === 'ACTIVE');

  // Score each skill based on keyword matches
  const scoredSkills = activeSkills.map((skill) => {
    let score = 0;
    const skillText = `${skill.title} ${skill.content}`.toLowerCase();

    // Title matches are worth more
    if (skill.title.toLowerCase().split(/\s+/).some((word) => questionWords.includes(word))) {
      score += 10;
    }

    // Category matches
    skill.categories?.forEach((cat) => {
      if (questionLower.includes(cat.toLowerCase())) {
        score += 5;
      }
    });

    // Content keyword matches
    questionWords.forEach((word) => {
      if (skillText.includes(word)) {
        score += 1;
      }
    });

    return { skill, score };
  });

  // Return top 5 skills with score > 0
  return scoredSkills
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.skill);
};

/**
 * Selects relevant skills for a batch of questions.
 * Combines keywords from all questions and returns the top skills
 * that are relevant to the batch as a whole.
 *
 * @param questions Array of question strings
 * @param allSkills All available skills
 * @param maxSkills Maximum number of skills to return (default 10)
 * @returns Skills relevant to the batch, deduplicated and sorted by relevance
 */
export const selectRelevantSkillsForBatch = (
  questions: string[],
  allSkills: Skill[],
  maxSkills: number = 10
): Skill[] => {
  const activeSkills = allSkills.filter((skill) => skill.status === 'ACTIVE');

  // Combine all question keywords
  const allKeywords = new Set<string>();
  const combinedText = questions.join(" ").toLowerCase();

  questions.forEach((question) => {
    const questionLower = question.toLowerCase();
    const words = questionLower.split(/\s+/).filter((word) => word.length > 3);
    words.forEach((word) => allKeywords.add(word));
  });

  const keywordArray = Array.from(allKeywords);

  // Score each skill based on combined keywords from all questions
  const scoredSkills = activeSkills.map((skill) => {
    let score = 0;
    const skillTitle = skill.title.toLowerCase();
    const skillText = `${skill.title} ${skill.content}`.toLowerCase();
    const titleWords = skillTitle.split(/\s+/);

    // Title word matches are worth more
    titleWords.forEach((titleWord) => {
      if (keywordArray.some((kw) => kw.includes(titleWord) || titleWord.includes(kw))) {
        score += 10;
      }
    });

    // Category matches - check if any question mentions the category
    skill.categories?.forEach((cat) => {
      const catLower = cat.toLowerCase();
      if (combinedText.includes(catLower)) {
        score += 8;
      }
      // Also check individual category words
      catLower.split(/\s+/).forEach((catWord) => {
        if (catWord.length > 3 && keywordArray.includes(catWord)) {
          score += 3;
        }
      });
    });

    // Content keyword matches
    keywordArray.forEach((word) => {
      if (skillText.includes(word)) {
        score += 1;
      }
    });

    return { skill, score };
  });

  // Return top N skills with score > 0
  return scoredSkills
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSkills)
    .map((item) => item.skill);
};
