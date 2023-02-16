import { HeroicCraftingHourlySpendingLimit, spendingLimit, MODULE_NAME } from "./constants.js";
import { beginAProject, getProjectsToDisplay } from "./crafting.js";

Hooks.on(
    "init",
    () => {
        game.pf2eHeroicCrafting = {
            HeroicCraftingHourlySpendingLimit,
            spendingLimit,
            beginAProject
        };
    }
);

Hooks.on('renderCharacterSheetPF2e', async (data, html) => {
    {
        // Remove normal crafting buttons
        html.find('.formula-item').find('.item-controls').find('.item-control[data-action=craft-item]').remove();
    }
    {
        // Adding Heroic Crafting projects
        const craftingEntries = html.find('.craftingEntry-list');
        const projects = await getProjectsToDisplay(data.actor);

        const template = await renderTemplate(`modules/${MODULE_NAME}/templates/projects.hbs`, { projects });
        craftingEntries.append(template);
    }
})