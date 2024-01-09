import { HeroicCraftingHourlySpendingLimit, HeroicCraftingGatheredIncome, spendingLimit, MODULE_NAME, localise } from "./constants.js";
import { beginAProject, craftAProject, abandonProject, getProjectsToDisplay, progressProject, editProject } from "./crafting.js";
import { normaliseCoins, subtractCoins } from "./coins.js";
import { getTroves, getTroveValue, changeTroveValue, payWithTroves } from "./trove.js";
import { projectToChat } from "./dialog.js";
import { hardcodeRules } from "./hardcoder.js";

/// Exposes the various functions and constants for usage in macros.
Hooks.on(
    "init",
    async () => {
        game.settings.register(MODULE_NAME, "hoursInADay", {
            name: localise("Config.HoursInADay.Name"),
            hint: localise("Config.HoursInADay.Hint"),
            scope: "world",
            config: true,
            default: 4,
            type: Number,
        });

        game.settings.register(MODULE_NAME, "daysInAWeek", {
            name: localise("Config.DaysInAWeek.Name"),
            hint: localise("Config.DaysInAWeek.Hint"),
            scope: "world",
            config: true,
            default: 5,
            type: Number,
        });

        game.settings.register(MODULE_NAME, "scaleWithBatchSize", {
            name: localise("Config.ScaleWithBatchSize.Name"),
            hint: localise("Config.ScaleWithBatchSize.Hint"),
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        });

        game.pf2eHeroicCrafting = {
            HeroicCraftingHourlySpendingLimit,
            HeroicCraftingGatheredIncome,
            spendingLimit,
            beginAProject,
            normaliseCoins,
            subtractCoins,
            getTroves,
            getTroveValue,
            changeTroveValue,
            payWithTroves
        };

        game.pf2e.RuleElements.custom["AddCraftProgress"] = (await import("./rule-elements/add-craft-progress.js")).AddCraftProgressRuleElement;
        CONFIG.PF2E.ruleElement["AddCraftProgress"] = "PF2E.RuleElement.AddCraftProgress";

        game.pf2e.RuleElements.custom["CraftingOption"] = (await import("./rule-elements/craft-option.js")).CraftingOptionRuleElement;
        CONFIG.PF2E.ruleElement["CraftingOption"] = "PF2E.RuleElement.CraftingOption";

        game.pf2e.RuleElements.custom["ModifyCraftAProject"] = (await import("./rule-elements/modify-craft-project.js")).ModifyCraftAProjectRuleElement;
        CONFIG.PF2E.ruleElement["ModifyCraftAProject"] = "PF2E.RuleElement.ModifyCraftAProject";
    }
);

/// "Hardcodes" Heroic Crafting feat rules by sneakily replacing them when they're placed on the actors.
Hooks.on("createItem", async (item) => {
    const sourceID = item.flags.core?.sourceId ?? "";
    if (sourceID in hardcodeRules) {
        if (hardcodeRules[sourceID].check(item)) {
            const keepOldRules = hardcodeRules[sourceID].deleteOldRules ? [] : item.system.rules;
            await item.update({ "system.rules": keepOldRules.concat(hardcodeRules[sourceID].newrules) });
        }
    }
});

/// Extends the crafting tab of the character sheet with Heroic Crafting stuff.
Hooks.on("renderCharacterSheetPF2e", async (data, html) => {
    const craftingTab = html.find(".tab.crafting");
    {
        //! Add Heroic Crafting "Begin a Project" button to each formula
        const formulas = craftingTab.find(".known-formulas");
        const formulaItems = formulas.find(".formula-item");
        const itemControls = formulaItems.find(".item-controls");

        itemControls.prepend(`<a class="item-control" title="${localise("CharSheet.BeginProject")}" data-action="heroic-crafting-begin-project"><i class="fa-solid fa-fw fa-scroll"></i></a>`);

        itemControls.find("a[data-action=heroic-crafting-begin-project]").on("click", async (event) => {
            const UUID = $(event.currentTarget).parent().parent().attr("data-item-uuid") || "";
            const DC =
                Number($(event.currentTarget).parent().siblings(".dc").html()) || 14; // Level 0 DC
            const batchSize =
                Number($(event.currentTarget).parent().siblings(".quantity").children("input").val()) || 1;
            const itemDetails = {
                UUID,
                batchSize,
                DC
            };

            await beginAProject(data.actor, itemDetails, false);
        });
    }
    {
        //! Adding Heroic Crafting projects
        const craftingEntries = craftingTab.find(".crafting-entry-list");
        const projects = await getProjectsToDisplay(data.actor);

        const template = await renderTemplate(`modules/${MODULE_NAME}/templates/projects.hbs`, { projects, editable: data.isEditable });
        craftingEntries.append(template);
    }
    {
        //! Add functionality to Heroic Crafting project buttons
        const projectControls = craftingTab.find(".heroic-crafting-project-controls");

        projectControls.find("a[data-action=project-delete]").on("click", async (event) => {
            const UUID = $(event.currentTarget).parent().parent().attr("data-project-id") || "";

            await abandonProject(data.actor, UUID);
        });

        projectControls.find("a[data-action=project-edit]").on("click", async (event) => {
            const UUID = $(event.currentTarget).parent().parent().attr("data-project-id") || "";

            await editProject(data.actor, UUID);
        });

        projectControls.find("a[data-action=project-craft]").on("click", async (event) => {
            const projectUUID = $(event.currentTarget).parent().parent().attr("data-project-id") || "";
            const itemUUID = $(event.currentTarget).parent().parent().attr("data-item-id") || "";
            const batchSize =
                Number($(event.currentTarget).parent().siblings(".quantity").children("input").val()) || 1;
            const itemDetails = {
                UUID: itemUUID,
                projectUUID,
                batchSize
            };

            await craftAProject(data.actor, itemDetails, false);
        });
    }
    {
        //! Add "rollable" to-chat button
        const projects = craftingTab.find("[data-container-type=heroicCraftingProjects]").find(".formula-item");

        projects.find(".item-image").on("click", async (event) => {
            const projectUUID = $(event.currentTarget).parent().parent().attr("data-project-id") || "";

            await projectToChat(data.actor, projectUUID);
        });
    }
})

/// Used for the crafting message to make the progress / deduction button 
/// add / remove Current Value from a character's project.
Hooks.on("renderChatMessage", async (data, html) => {
    html.find(".card-buttons .heroic-crafting-progress-chat-button").on("click", async (event) => {
        event.preventDefault();

        const button = $(event.currentTarget);
        const [progress, amount, uuid, actorID] = [
            button.attr("data-action") === "progress-heroic-crafting-project",
            button.parent().parent().attr("data-heroic-crafting-progress"),
            button.parent().parent().attr("data-project-uuid"),
            button.parent().parent().attr("data-actor")
        ];
        const actor = game.actors.get(actorID);

        if (!actor) return;
        if (!game.user.isGM && !actor.isOwner) return;

        progressProject(actor, uuid, progress, game.pf2e.Coins.fromString(amount));

        button.attr("disabled", "true");
    });


    html.find(".card-buttons .heroic-crafting-craft-chat-button").on("click", async (event) => {
        event.preventDefault();

        const button = $(event.currentTarget);
        const actorID = button.parent().parent().attr("data-actor-id");

        const itemDetails = {
            UUID: button.attr("data-item-id"),
            projectUUID: button.parent().parent().attr("data-project-id"),
            batchSize: button.attr("data-batch-size"),
        };

        const actor = game.actors.get(actorID);
        if (!actor) return;
        if (!game.user.character) return;

        await craftAProject(game.user.character, itemDetails, false, actor);
    });
})