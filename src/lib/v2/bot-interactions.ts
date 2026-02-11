/**
 * Bot Interaction Utilities
 * Transforms SlackBotInteraction data to BotInteraction format for display
 */

export interface BotInteraction {
  id: string;
  title: string;
  contentPreview: string | null;
  stagedAt: Date;
}

/**
 * Transform SlackBotInteraction to BotInteraction for display in BotTabContent
 */
export function transformBotInteractions(
  interactions: Array<{
    id: string;
    question: string;
    answer: string;
    createdAt: Date;
  }>
): BotInteraction[] {
  return interactions.map((interaction) => ({
    id: interaction.id,
    title: `Q: ${interaction.question.substring(0, 60)}${interaction.question.length > 60 ? '...' : ''}`,
    contentPreview: interaction.answer.substring(0, 150),
    stagedAt: interaction.createdAt,
  }));
}
