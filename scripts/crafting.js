import { MODULE_NAME, spendingLimit } from "./constants.js";
import { projectBeginDialog, projectCraftDialog } from "./dialog.js";
import { normaliseCoins } from "./coins.js";
import { payWithCoinsAndTrove, getTroves } from "./trove.js";
import { extractDegreeOfSuccessAdjustments, extractRollTwice, extractRollSubstitutions } from "./system.js";

/**
 * Begins a new project for an actor, adding said project to the flags of the actor, 
 * and removing value from the actor's coins / Troves if needed.
 * 
 * When all successful, creates a ChatMessage announcing the beginning of the project,
 * and appends the new project to the actor's projects flag.
 * 
 * @param {ActorPF2e} crafterActor The actor who begins the project. 
 * @param {Object} itemDetails The details of the item to make a project of.
 * @param {string} itemDetails.UUID The UUID of the item.
 * @param {number} itemDetails.batchSize The size of the batch of the item being crafted. 
 * Usually 1, 4 or 10, but feats can change this.
 * @param {number} itemDetails.DC The crafting DC of the item.
 * @param {boolean} skipDialog Defaults to true. 
 * If it is, well, it skips the dialog, setting the startingProgress to 0.
 */
export async function beginAProject(crafterActor, itemDetails, skipDialog = true) {
    if (!itemDetails.UUID || itemDetails.UUID === "") {
        console.error("[HEROIC CRAFTING] Missing UUID when beginning a project!");
        return;
    }

    let dialogResult = {};
    if (!skipDialog) {
        dialogResult = await projectBeginDialog(itemDetails);
    } else {
        dialogResult = { startingProgress: 0 };
    }

    if (typeof dialogResult.startingProgress === "undefined") {
        return;
    }

    const payment = payWithCoinsAndTrove(
        dialogResult.payMethod,
        crafterActor.inventory.coins,
        getTroves(crafterActor),
        new game.pf2e.Coins({ cp: dialogResult.startingProgress }));

    if (!payment.canPay) {
        ui.notifications.warn(`${crafterActor.name} cannot afford to start the project!`);
        return;
    }

    let actorProjects = crafterActor.getFlag(MODULE_NAME, "projects") ?? [];

    const newProjects = [
        {
            ID: randomID(),
            ItemUUID: itemDetails.UUID,
            progressInCopper: dialogResult.startingProgress,
            batchSize: itemDetails.batchSize || 1,
            DC: itemDetails.DC
        }
    ];

    if (payment.removeCopper > 0) {
        await crafterActor.inventory.removeCoins({ cp: payment.removeCopper });
    };

    if (payment.troveUpdates.length > 0) {
        await crafterActor.updateEmbeddedDocuments("Item", payment.troveUpdates);
    }

    ChatMessage.create({
        user: game.user.id,
        content: `<strong>${crafterActor.name}</strong> starts a project of <strong>${(await fromUuid(itemDetails.UUID)).name}</strong> with the Current Value of ${normaliseCoins(dialogResult.startingProgress)}.`,
        speaker: { alias: crafterActor.name },
    });
    await crafterActor.update({ [`flags.${MODULE_NAME}.projects`]: actorProjects.concat(newProjects) });
};

/**
 * Crafts a project -- or rather, handles every related function that is responsible for crafting a project.
 * 
 * @see projectCraftDialog() for the actual adjusting of craft-a-project variables.
 * @see progressProject() for the "skip the check if activity's cost is equal to 
 * or larger than the remainder" logic.
 * @see rollCraftAProject() for the actual crafting-a-project logic.
 * 
 * @param {ActorPF2e} crafterActor The actor who is crafting the project. 
 * @param {Object} itemDetails The details of the item to make a project of.
 * @param {string} itemDetails.UUID The UUID of the item.
 * @param {string} itemDetails.projectUUID The UUID of the project itself.
 * @param {number} itemDetails.batchSize The size of the batch of the item being crafted. 
 * @param {boolean} skipDialog Defaults to true. 
 * Despite that, it's currently unused, and is always called with a false instead.
 */
export async function craftAProject(crafterActor, itemDetails, skipDialog = true) {
    if (!itemDetails.UUID || itemDetails.UUID === "") {
        console.error("[HEROIC CRAFTING] Missing Item UUID when crafting a project!");
        return;
    }
    if (!itemDetails.projectUUID || itemDetails.projectUUID === "") {
        console.error("[HEROIC CRAFTING] Missing Project UUID when crafting a project!");
        return;
    }

    let dialogResult = {};
    if (!skipDialog) {
        dialogResult = await projectCraftDialog(crafterActor, itemDetails);
    } else {
        dialogResult = {};
    }

    if (typeof dialogResult.duration === "undefined") {
        return;
    }

    const payment = payWithCoinsAndTrove(
        dialogResult.payMethod,
        crafterActor.inventory.coins,
        getTroves(crafterActor),
        dialogResult.spendingAmount);

    if (!payment.canPay) {
        ui.notifications.warn(`${crafterActor.name} cannot afford to start the project!`);
        return;
    }

    if (payment.removeCopper > 0) {
        await crafterActor.inventory.removeCoins({ cp: payment.removeCopper });
    };

    if (payment.troveUpdates.length > 0) {
        await crafterActor.updateEmbeddedDocuments("Item", payment.troveUpdates);
    }

    const project = crafterActor.getFlag(MODULE_NAME, "projects").filter(project => project.ID === itemDetails.projectUUID)[0];

    const projectItem = await fromUuid(project.ItemUUID);
    const cost = game.pf2e.Coins.fromPrice(projectItem.price, project.batchSize);

    if (project.progressInCopper + dialogResult.spendingAmount.copperValue >= cost.copperValue) {
        ChatMessage.create({
            user: game.user.id,
            content: `<strong>${crafterActor.name}</strong> skips the Craft check for <strong>${projectItem.name}</strong> as the difference between your project's Current Value and its Price is less than the activity's maximum Cost.`,
            speaker: { alias: crafterActor.name },
        });
        progressProject(crafterActor, project.ID, true, dialogResult.spendingAmount);
    } else {
        rollCraftAProject(crafterActor, project, { duration: dialogResult.duration, overtime: dialogResult.overtime, craftingMaterials: dialogResult.spendingAmount });
    }
};

/**
 * Rolls a check to craft a project.
 * 
 * Creates a ChatMessage with a button to either progress the project or deduct from its progress,
 * based on the result.
 * 
 * Has a few features reimplemented from system, like domains, proficiency, traits, rollTwice,
 * substitutions, and DoSAdjustments, and has the `action:craftproj` RollOption, so it should be
 * able to innately listen to the Heroic Crafting module's stuff.  
 * However, their automation is manually done in here, usually.
 * 
 * @param {ActorPF2e} crafterActor The actor who is crafting the project. 
 * @param {Object} project The project being worked on.
 * @param {string} project.ID The UUID of the project itself.
 * @param {string} project.ItemUUID The UUID of the item specifically. Unused.
 * @param {number} project.progressInCopper The current progress on the project, measured in copper.
 * @param {number} project.batchSize The amount of items being made at once.
 * Usually relevant for consumables more, and is 1 for permanent items. 
 * @param {number} project.DC The Crafting DC of the project. 
 * Used to determine if the roll's a success or not.
 * @param {Object} details Variables that change in some way how the craft roll should go.
 * @param {"hour" | "day" | "week"} details.duration The check gains the "Downtime" trait if 
 * the duration is "day" or "week", and the "Exploration" trait if it's "hour".
 * @param {0 | -5 | -10} details.overtime If not zero, applies an untyped "Overtime" penalty to the check.
 * @param {game.coins.pf2e} details.craftingMaterials The amount of value the actor spent trying to craft. 
 * The progress made is based on this.
 */
function rollCraftAProject(crafterActor, project, details) {
    const actionName = "Craft a Project";
    const skillKey = "cra";
    const skill = crafterActor.system.skills[skillKey];
    const skillName = game.i18n.localize(CONFIG.PF2E.skills[skillKey]);
    const proficiency = ["proficiency:untrained", "proficiency:trained", "proficiency:expert", "proficiency:master", "proficiency:legendary"]; // Reimplementing system functionality be like: 
    const modifiers = [];
    const traits = [];
    const notes = [...skill.notes];
    const domains = ['all', 'skill-check', skillName.toLowerCase(), `${skill.ability}-based`, `${skill.ability}-skill-check`];

    {
        notes.push({
            "outcome": ["success", "criticalSuccess"],
            "text": "<p><strong>Sucess</strong> You work productively during this period. Add double this activity's Cost to the project's Current Value.</p>"
        });
        notes.push({
            "outcome": ["failure"],
            "text": "<p><strong>Failure</strong> You work unproductively during this period. Add half this activity's Cost to the project's Current Value.</p>"
        });
        notes.push({
            "outcome": ["criticalFailure"],
            "text": "<p><strong>Critical Failure</strong> You ruin your materials and suffer a setback while crafting. Deduct this activity's Cost from the project's Current Value. If this reduces the project's Current Value below 0, the project is ruined and must be started again.</p>"
        });
    }
    {
        const actionTraits = CONFIG.PF2E.actionTraits;
        const traitDescriptions = CONFIG.PF2E.traitsDescriptions;

        let tempTraits = ["manipulate"];
        if (details.duration === "hour") {
            tempTraits.push("exploration");
        } else {
            tempTraits.push("downtime");
        };

        tempTraits
            .map((trait) => ({
                description: traitDescriptions[trait],
                name: trait,
                label: actionTraits[trait] ?? trait,
            }))
            .forEach(traitObject => traits.push(traitObject));
    }

    const options = crafterActor.getRollOptions(domains);
    options.push(`action:craft`, `action:craftproj`, `skill:rank:${skill.rank}`, proficiency[skill.rank]);
    const rollTwice = extractRollTwice(crafterActor.synthetics.rollTwice, domains, options);
    const substitutions = extractRollSubstitutions(crafterActor.synthetics.rollSubstitutions, domains, options);
    const dosAdjustments = extractDegreeOfSuccessAdjustments(crafterActor.synthetics, domains);

    if (details.overtime != 0) {
        modifiers.push(new game.pf2e.Modifier({
            label: "Overtime",
            modifier: details.overtime,
            type: "untyped",
        }));
    }

    game.pf2e.Check.roll(
        new game.pf2e.CheckModifier(
            `${actionName}`,
            crafterActor.system.skills[skillKey], modifiers),
        {
            actor: crafterActor,
            type: 'skill-check',
            options,
            domains,
            rollTwice,
            substitutions,
            dosAdjustments,
            createMessage: false,
            notes,
            dc: {
                value: project.DC,
                visible: true
            },
            traits
        },
        event,
        async (roll, outcome, message) => {
            if (message instanceof ChatMessage) {
                let craftDetails = { progress: false, progressCost: "0 gp", projectUuid: project.ID, actor: crafterActor.id };

                if (outcome === "success" || outcome === "criticalSuccess") {
                    craftDetails.progress = true;
                    craftDetails.progressCost = details.craftingMaterials.scale(2).toString();
                } else if (outcome === "failure") {
                    craftDetails.progress = true;
                    craftDetails.progressCost = details.craftingMaterials.scale(0.5).toString();
                } else {
                    craftDetails.progress = false;
                    craftDetails.progressCost = details.craftingMaterials.toString();
                }

                const flavour = await renderTemplate(`modules/${MODULE_NAME}/templates/crafting-result.hbs`, craftDetails);
                message.updateSource({ flavor: message.flavor + flavour });
                ChatMessage.create(message.toObject());
            }
        }
    );
}

/**
 * A convenience function to remove a project from an actor.
 * 
 * @param {ActorPF2e} crafterActor The actor to remove a project from. 
 * @param {string} projectUUID The UUID of the project to remove. 
 */
export async function abandonProject(crafterActor, projectUUID) {
    const actorProjects = crafterActor.getFlag(MODULE_NAME, "projects") ?? [];
    await crafterActor.update({ [`flags.${MODULE_NAME}.projects`]: actorProjects.filter(project => project.ID !== projectUUID) });
}

/**
 * Formats an actor's projects in a display-ready way.
 * 
 * @param {ActorPF2e} crafterActor The actor whose projects to get.
 * @returns {{
 * projectUuid: string,
 * itemUuid: string,
 * img: string,
 * name: string,
 * DC: number,
 * cost: game.pf2e.Coins,
 * currentlyDone: number,
 * progress: number}[]} An array of structs with the following data:  
 * - `projectUuid`: the UUID of the project itself.  
 * - `itemUuid`: the UUID of the item the project is about.
 * - `img`: a relative link to the item's image, starting from the default Foundry asset root directory.
 * - `name`: the display-ready name of the item.
 * - `DC`: the craft DC of the project.
 * - `cost`: the overall cost of the project in a Coins object.
 * - `currentlyDone`: the progress on the project in copper.
 * - `progress`: the percentage (going from 0 to 1) of the project's completion.
 */
export async function getProjectsToDisplay(crafterActor) {
    const projects = crafterActor.getFlag(MODULE_NAME, 'projects') ?? [];

    const projectItems = await Promise.all(projects.map(async (project) => {
        const projectItem = await fromUuid(project.ItemUUID);
        const cost = game.pf2e.Coins.fromPrice(projectItem.price, project.batchSize);
        const currentlyDone = normaliseCoins(project.progressInCopper);
        const progress = project.progressInCopper / cost.copperValue * 100;

        return {
            projectUuid: project.ID,
            itemUuid: project.ItemUUID,
            img: projectItem.img,
            name: projectItem.name,
            batch: project.batchSize,
            DC: project.DC,
            cost,
            currentlyDone,
            progress
        };
    }))

    return projectItems;
}

/**
 * Advances the project's completion either forwards or backwards.
 * 
 * Can remove the project if the project is completed, or if the project experiences a setback so big,
 * the progress reaches 0 or goes below it.
 * 
 * Announces with a ChatMessage the progress, and if said progress ends the project.
 * 
 * @param {ActorPF2e} crafterActor The actor whose project to progress or regress.
 * @param {string} projectUUID The UUID of the project.
 * @param {boolean} hasProgressed If true, `amount` will be added to the project's current progress.
 * If false, it will be subtracted.
 * @param {string} amount A string of the progressed value, formatted like a Coins object 
 * (so for example, "5 gp, 4 sp"). 
 * @returns 
 */
export async function progressProject(crafterActor, projectUUID, hasProgressed, amount) {
    const actorProjects = crafterActor.getFlag(MODULE_NAME, "projects") ?? [];
    const project = actorProjects.filter(project => project.ID === projectUUID)[0];

    if (!project) {
        ui.notifications.error(`${crafterActor.name} does not have project ${projectUUID} to progress!`);
        return;
    }

    const coinAmount = game.pf2e.Coins.fromString(amount);
    const projectItem = await fromUuid(project.ItemUUID);
    const cost = game.pf2e.Coins.fromPrice(projectItem.price, project.batchSize);

    if (hasProgressed) {
        project.progressInCopper += coinAmount.copperValue;

        if (project.progressInCopper >= cost.copperValue) {
            const itemObject = projectItem.toObject();
            itemObject.system.quantity = project.batchSize;

            const result = await crafterActor.addToInventory(itemObject, undefined);

            if (!result) {
                ui.notifications.warn(game.i18n.localize("PF2E.Actions.Craft.Warning.CantAddItem"));
                return;
            }

            ChatMessage.create({
                user: game.user.id,
                content: `<strong>${crafterActor.name}</strong> finishes their <strong>${project.batchSize} x ${projectItem.name}</strong> project, gaining the aforementioned item(s).`,
                speaker: { alias: crafterActor.name },
            });
            await abandonProject(crafterActor, projectUUID);
        } else {
            ChatMessage.create({
                user: game.user.id,
                content: `<strong>${crafterActor.name}</strong> progresses on their <strong>${project.batchSize} x ${projectItem.name}</strong> project, by ${coinAmount.toString()} (current: ${normaliseCoins(project.progressInCopper)} out of ${cost.toString()}).`,
                speaker: { alias: crafterActor.name },
            });
            await crafterActor.update({
                [`flags.${MODULE_NAME}.projects`]: actorProjects.map((currProject => {
                    if (currProject.ID !== projectUUID) {
                        return currProject;
                    } else {
                        return project;
                    }
                }))
            });
        }
    } else {
        project.progressInCopper -= coinAmount.copperValue;

        if (project.progressInCopper <= 0) {
            ChatMessage.create({
                user: game.user.id,
                content: `<strong>${crafterActor.name}</strong> experiences setback on their <strong>${project.batchSize} x ${projectItem.name}</strong> project, completely ruining it.`,
                speaker: { alias: crafterActor.name },
            });
            await abandonProject(crafterActor, projectUUID);
        } else {
            ChatMessage.create({
                user: game.user.id,
                content: `<strong>${crafterActor.name}</strong> experiences setback on their <strong>${project.batchSize} x ${projectItem.name}</strong> project, losing ${coinAmount.toString()} of progress (current: ${normaliseCoins(project.progressInCopper)} out of ${cost.toString()}).`,
                speaker: { alias: crafterActor.name },
            });
            await crafterActor.update({
                [`flags.${MODULE_NAME}.projects`]: actorProjects.map((currProject => {
                    if (currProject.ID !== projectUUID) {
                        return currProject;
                    } else {
                        return project;
                    }
                }))
            });
        }
    }
}