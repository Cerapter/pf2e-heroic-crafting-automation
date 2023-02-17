import { HeroicCraftingHourlySpendingLimit, spendingLimit, MODULE_NAME } from "./constants.js";
import { beginAProject, abandonProject, getProjectsToDisplay } from "./crafting.js";

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

Hooks.on("renderCharacterSheetPF2e", async (data, html) => {
    const craftingTab = html.find(".tab.crafting");
    {
        // Add Heroic Crafting "Begin a Project" button to each formula
        const formulas = craftingTab.find(".known-formulas");
        const formulaItems = formulas.find(".formula-item");
        const itemControls = formulaItems.find(".item-controls");

        itemControls.prepend(`<a class="item-control" title="Begin Project" data-action="heroic-crafting-begin-project"><i class="fa-solid fa-fw fa-scroll"></i></a>`);

        itemControls.find("a[data-action=heroic-crafting-begin-project]").on("click", async (event) => {
            const UUID = $(event.currentTarget).parent().parent().attr("data-item-id") || "";
            const batchSize =
                Number($(event.currentTarget).parent().siblings(".formula-quantity").children("input").val()) || 1;
            const itemDetails = {
                UUID,
                batchSize
            };

            await beginAProject(data.actor, itemDetails);
        });
    }
    {
        // Adding Heroic Crafting projects
        const craftingEntries = craftingTab.find(".craftingEntry-list");
        const projects = await getProjectsToDisplay(data.actor);

        const template = await renderTemplate(`modules/${MODULE_NAME}/templates/projects.hbs`, { projects, editable: data.isEditable });
        craftingEntries.append(template);
    }
    {
        // Add functionality to Heroic Crafting project buttons
        const projectControls = craftingTab.find(".heroic-crafting-project-controls");

        projectControls.find(".project-delete").on("click", async (event) => {
            const UUID = $(event.currentTarget).parent().parent().attr("data-project-id") || "";

            await abandonProject(data.actor, UUID);
        });
    }
})