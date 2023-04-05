import { HeroicCraftingHourlySpendingLimit, HeroicCraftingGatheredIncome, spendingLimit, MODULE_NAME } from "./constants.js";
import { beginAProject, craftAProject, abandonProject, getProjectsToDisplay, progressProject, editProject } from "./crafting.js";
import { normaliseCoins, subtractCoins } from "./coins.js";
import { getTroves, getTroveValue, changeTroveValue, payWithTroves } from "./trove.js";
import { projectToChat } from "./dialog.js";

/// Exposes the various functions and constants for usage in macros.
Hooks.on(
    "init",
    () => {
        game.settings.register(MODULE_NAME, "hoursInADay", {
            name: "Hours in a Day",
            hint: "The amount of hours you can spend crafting in a day before incurring penalties due to Working Overtime.",
            scope: "world",
            config: true,
            default: 4,
            type: Number,
        });

        game.settings.register(MODULE_NAME, "daysInAWeek", {
            name: "Days in a Week",
            hint: "The amount of days a week is used as a shorthand for for spending limit purposes, and implicitly also the amount of days in a week you can craft without Working Overtime.",
            scope: "world",
            config: true,
            default: 5,
            type: Number,
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
    }
);

/// Extends the crafting tab of the character sheet with Heroic Crafting stuff.
Hooks.on("renderCharacterSheetPF2e", async (data, html) => {
    const craftingTab = html.find(".tab.crafting");
    {
        //! Add Heroic Crafting "Begin a Project" button to each formula
        const formulas = craftingTab.find(".known-formulas");
        const formulaItems = formulas.find(".formula-item");
        const itemControls = formulaItems.find(".item-controls");

        itemControls.prepend(`<a class="item-control" title="Begin Project" data-action="heroic-crafting-begin-project"><i class="fa-solid fa-fw fa-scroll"></i></a>`);

        itemControls.find("a[data-action=heroic-crafting-begin-project]").on("click", async (event) => {
            const UUID = $(event.currentTarget).parent().parent().attr("data-item-id") || "";
            const DC =
                Number($(event.currentTarget).parent().siblings(".formula-dc").html()) || 14; // Level 0 DC
            const batchSize =
                Number($(event.currentTarget).parent().siblings(".formula-quantity").children("input").val()) || 1;
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
        const craftingEntries = craftingTab.find(".craftingEntry-list");
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
                Number($(event.currentTarget).parent().siblings(".formula-quantity").children("input").val()) || 1;
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

        projects.find(".rollable").on("click", async (event) => {
            const projectUUID = $(event.currentTarget).parent().attr("data-project-id") || "";

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