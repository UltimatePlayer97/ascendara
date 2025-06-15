/**
 * Service for handling game updates across the application
 * Ensures that when a game's properties are updated, they are updated in all locations
 */

import { updateGameInFolders } from "@/lib/folderManager";

/**
 * Update a game's executable path in both the main library and any folders containing the game
 * @param {string} gameId - ID of the game to update (game.game or game.name)
 * @param {string} executablePath - The new executable path
 */
export const updateGameExecutable = async (gameId, executablePath) => {
  try {
    // First, update the game in the main library via the electron API
    await window.electron.modifyGameExecutable(gameId, executablePath);

    // Then, update the game in any folders it might be in
    updateGameInFolders(gameId, { executable: executablePath });

    console.log(
      `Updated executable for game ${gameId} to ${executablePath} in all locations`
    );
    return true;
  } catch (error) {
    console.error("Error updating game executable:", error);
    return false;
  }
};

export default {
  updateGameExecutable,
};
