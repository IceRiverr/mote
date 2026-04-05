/**
 * npc-dialog.ts
 * Handles NPC interaction dialogs in Magic Tower.
 * Maps NPC types to their display names and returns dialog results.
 */

export interface DialogResult {
  message: string;
  npcName: string;
}

/** Map of npcType identifiers to Chinese display names. */
const NPC_NAMES: Record<string, string> = {
  oldman: '老人',
  merchant: '商人',
  thief: '盗贼',
  princess: '公主',
};

/**
 * Handle interaction with an NPC.
 * @param npcType - The type identifier of the NPC (e.g. "oldman", "merchant").
 * @param dialog - The dialog text configured for this NPC instance.
 * @returns A DialogResult with the NPC's display name and message.
 */
export function handleNpcInteraction(npcType: string, dialog: string): DialogResult {
  const npcName = NPC_NAMES[npcType] || npcType;
  const message = dialog || `${npcName}沉默不语...`;

  return {
    message,
    npcName,
  };
}
