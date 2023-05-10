import { getPreferredPayMethod, localise, MODULE_NAME, ROLLOPTION_ITEM_PREFIX, ROLLOPTION_PREFIX, ROLLOPTION_SETTINGS_PREFIX, setPreferredPayMethod } from "./constants.js";
import { projectBeginDialog, projectCraftDialog, projectEditDialog } from "./dialog.js";
import { normaliseCoins } from "./coins.js";
import { payWithCoinsAndTrove, getTroves } from "./trove.js";

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
        console.error("[HEROIC CRAFTING AUTOMATION] Missing UUID when beginning a project!");
        return;
    }

    let dialogResult = {};
    if (!skipDialog) {
        dialogResult = await projectBeginDialog(itemDetails, getPreferredPayMethod(crafterActor));
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


    await setPreferredPayMethod(crafterActor, dialogResult.payMethod);

    if (!payment.canPay) {
        ui.notifications.warn(localise("ProjectBeginWindow.CannotPay", { name: crafterActor.name }));
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
        content: localise("ProjectBeginWindow.PCStartsAProject", {
            name: crafterActor.name,
            itemName: (await fromUuid(itemDetails.UUID)).name,
            currentValue: normaliseCoins(dialogResult.startingProgress)
        }),
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
 * @param {ActorPF2e} projectOwner Who actually owns the project. Defaults to crafterActor, but can be someone else (with crafting as a group). 
 */
export async function craftAProject(crafterActor, itemDetails, skipDialog = true, projectOwner = crafterActor) {
    if (!itemDetails.UUID || itemDetails.UUID === "") {
        console.error("[HEROIC CRAFTING AUTOMATION] Missing Item UUID when crafting a project!");
        return;
    }
    if (!itemDetails.projectUUID || itemDetails.projectUUID === "") {
        console.error("[HEROIC CRAFTING AUTOMATION] Missing Project UUID when crafting a project!");
        return;
    }

    const actorProjects = projectOwner.getFlag(MODULE_NAME, "projects") ?? [];
    const project = actorProjects.filter(project => project.ID === itemDetails.projectUUID)[0];

    if (!project) {
        ui.notifications.error(localise("CraftWindow.DoesNotHaveProjectToCraft", { name: projectOwner.name, projectUUID: itemDetails.projectUUID }));
        return;
    }

    let dialogResult = {};
    if (!skipDialog) {
        dialogResult = await projectCraftDialog(crafterActor, itemDetails);
    }

    if (typeof dialogResult.duration === "undefined") {
        return;
    }

    if (dialogResult.spendingAmount.copperValue === 0) {
        ui.notifications.info(localise("CraftWindow.InputMeaningfulCost"));
        return;
    }

    let rushCosts = game.pf2e.Coins.fromString("0 gp");

    for (const toggle in dialogResult.toggles) {
        if (dialogResult.toggles.hasOwnProperty(toggle)) {
            rushCosts = rushCosts.add(game.pf2e.Coins.fromString(dialogResult.toggles[toggle].rushCost));
        }
    }

    const payment = payWithCoinsAndTrove(
        dialogResult.payMethod,
        crafterActor.inventory.coins,
        getTroves(crafterActor),
        dialogResult.spendingAmount.add(rushCosts));

    await setPreferredPayMethod(crafterActor, dialogResult.payMethod);

    if (!payment.canPay) {
        ui.notifications.warn(localise("CraftWindow.CannotPay", { name: crafterActor.name }));
        return;
    }

    if (payment.removeCopper > 0) {
        await crafterActor.inventory.removeCoins({ cp: payment.removeCopper });
    };

    if (payment.troveUpdates.length > 0) {
        await crafterActor.updateEmbeddedDocuments("Item", payment.troveUpdates);
    }

    const projectItem = await fromUuid(project.ItemUUID);
    const cost = game.pf2e.Coins.fromPrice(projectItem.price, project.batchSize);

    if (project.progressInCopper + dialogResult.spendingAmount.copperValue >= cost.copperValue) {
        ChatMessage.create({
            user: game.user.id,
            content: localise("CraftWindow.Progress.SkipCheck", { name: crafterActor.name, itemName: projectItem.name }),
            speaker: { alias: crafterActor.name },
        });
        progressProject(projectOwner, project.ID, true, dialogResult.spendingAmount);
    } else {
        await rollCraftAProject(crafterActor, project, { duration: dialogResult.duration, overtime: dialogResult.overtime, craftingMaterials: dialogResult.spendingAmount, rushCosts, modifiers: dialogResult.modifiers, projectOwner });
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
 * @param {string} project.ItemUUID The UUID of the item specifically.
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
 * @param {game.coins.pf2e} details.rushCosts The amount of extra, "useless" value the actor spent trying to craft.
 * @param {{active: boolean, amount: number | string, mode: string, target: string, toggledBy: string}[]} 
 * details.modifiers An array of essentially ModifyCraftAProject rule elements that change the craft check somehow.
 * @param {ActorPF2e} details.projectOwner The actor who owns the project. Usually the same as the crafterActor, but not always! 
 */
async function rollCraftAProject(crafterActor, project, details) {
    const actionName = localise("CraftWindow.Title");
    let skillName = "crafting";
    const settingsRollOptions = [];

    for (const rollMod of details.modifiers) {
        if (rollMod.active) {
            if (rollMod.mode === "override" && rollMod.target === "skill") {
                skillName = rollMod.amount;
            }

            if (rollMod.toggledBy) {
                settingsRollOptions.push(`${ROLLOPTION_SETTINGS_PREFIX}:${rollMod.toggledBy}`);
            }
        }
    }

    const projectItem = await fromUuid(project.ItemUUID);
    const itemRollOptions = projectItem.getRollOptions(ROLLOPTION_ITEM_PREFIX);
    const craftSkillCheck = crafterActor.skills[skillName].extend({
        check: {
            label: `${actionName}`
        },
        rollOptions: [`action:craft`, `action:craftproj`, `${ROLLOPTION_PREFIX}:duration:${details.duration}`, ...settingsRollOptions, ...itemRollOptions],
        slug: "action-craft-a-project"
    });

    const modifiers = [];
    const traits = [];
    const extraRollNotes = [];
    {
        extraRollNotes.push({
            "outcome": ["success", "criticalSuccess"],
            "text": localise("CraftWindow.Roll.Success")
        });
        extraRollNotes.push({
            "outcome": ["failure"],
            "text": localise("CraftWindow.Roll.Failure")
        });
        extraRollNotes.push({
            "outcome": ["criticalFailure"],
            "text": localise("CraftWindow.Roll.CriticalFailure")
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

    if (details.overtime != 0) {
        modifiers.push(new game.pf2e.Modifier({
            label: localise("CraftWindow.Roll.Overtime"),
            modifier: details.overtime,
            type: "untyped",
        }));
    }

    craftSkillCheck.roll({
        dc: {
            value: project.DC,
            visible: true
        },
        extraRollNotes,
        createMessage: false,
        traits,
        [`callback`]: async (roll, outcome, message, event) => {
            if (message instanceof ChatMessage) {
                let craftDetails = {
                    progress: false,
                    progressMade: new game.pf2e.Coins(),
                    progressCost: details.craftingMaterials,
                    rushCost: details.rushCosts,
                    overallCost: details.craftingMaterials.add(details.rushCosts),
                    projectUuid: project.ID,
                    actor: details.projectOwner.id
                };

                if (outcome === "success" || outcome === "criticalSuccess") {
                    craftDetails.progress = true;
                    craftDetails.progressMade = details.craftingMaterials.scale(2);
                } else if (outcome === "failure") {
                    craftDetails.progress = true;
                    craftDetails.progressMade = details.craftingMaterials.scale(0.5);
                } else {
                    craftDetails.progress = false;
                    craftDetails.progressMade = details.craftingMaterials;
                };

                if ("AddCraftProgress" in crafterActor.synthetics) {
                    crafterActor.synthetics["AddCraftProgress"].forEach(synthetic => {
                        if (typeof synthetic.outcome === "undefined" ||
                            synthetic.outcome.length === 0 ||
                            synthetic.outcome.includes(outcome)) {
                            if (synthetic.coins) {
                                craftDetails.progressMade = craftDetails.progressMade.add(synthetic.coins);
                            } else {
                                switch (synthetic.mode) {
                                    case "multiply":
                                        craftDetails.progressMade = craftDetails.progressMade.scale(synthetic.amount);
                                        break;
                                }
                            }
                        }
                    });

                    crafterActor.synthetics["AddCraftProgress"] = [];
                }

                const flavour = await renderTemplate(`modules/${MODULE_NAME}/templates/crafting-result.hbs`, craftDetails);
                message.updateSource({ flavor: message.flavor + flavour });
                ChatMessage.create(message.toObject());
            }
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
 * Edits an actor's project.
 * 
 * @param {ActorPF2e} crafterActor The actor whose project to edit. 
 * @param {string} projectUUID The UUID of the project to edit. 
 */
export async function editProject(crafterActor, projectUUID) {
    if (!projectUUID || projectUUID === "") {
        console.error("[HEROIC CRAFTING AUTOMATION] Missing Project UUID when editing a project!");
        return;
    }

    const actorProjects = crafterActor.getFlag(MODULE_NAME, "projects") ?? [];
    const project = actorProjects.filter(project => project.ID === projectUUID)[0];

    if (!project) {
        ui.notifications.error(localise("CharSheet.CannotEditProject", { name: crafterActor.name, projectUUID }));
        return;
    }

    const dialogResult = await projectEditDialog(project);

    if (!dialogResult || dialogResult === "cancel") {
        return;
    }

    project.progressInCopper = dialogResult.progressInCopper < 0 ? project.progressInCopper : dialogResult.progressInCopper;
    project.DC = dialogResult.DC < 0 ? project.DC : dialogResult.DC;
    project.batchSize = dialogResult.batchSize <= 0 ? project.batchSize : dialogResult.batchSize;

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
        ui.notifications.error(localise("CraftWindow.DoesNotHaveProjectToProgress", { name: projectOwner.name, projectUUID: itemDetails.projectUUID }));
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

            const result = crafterActor.isOwner ? await crafterActor.addToInventory(itemObject, undefined) : "permissionLacking";

            if (!result) {
                ui.notifications.warn(game.i18n.localize("PF2E.Actions.Craft.Warning.CantAddItem"));
                return;
            }

            if (result === "permissionLacking") {
                ChatMessage.create({
                    user: game.user.id,
                    content: localise("CraftWindow.Progress.Finish", { name: crafterActor.name, batchSize: project.batchSize, itemName: projectItem.name }).concat(localise("CraftWindow.Progress.LacksPermissionToFinish", { name: crafterActor.name, playerName: game.user.name })),
                    speaker: { alias: crafterActor.name },
                });
            } else {
                ChatMessage.create({
                    user: game.user.id,
                    content: localise("CraftWindow.Progress.Finish", { name: crafterActor.name, batchSize: project.batchSize, itemName: projectItem.name }),
                    speaker: { alias: crafterActor.name },
                });
                await abandonProject(crafterActor, projectUUID);
            }
        } else {
            ChatMessage.create({
                user: game.user.id,
                content: localise("CraftWindow.Progress.Progress", {
                    name: crafterActor.name,
                    batchSize: project.batchSize,
                    itemName: projectItem.name,
                    progressAmount: coinAmount.toString(),
                    currentProgress: normaliseCoins(project.progressInCopper),
                    goal: cost.toString()
                }),
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
                content: localise("CraftWindow.Progress.FatalSetback", { name: crafterActor.name, batchSize: project.batchSize, itemName: projectItem.name }),
                speaker: { alias: crafterActor.name },
            });
            await abandonProject(crafterActor, projectUUID);
        } else {
            ChatMessage.create({
                user: game.user.id,
                content: localise("CraftWindow.Progress.Progress", {
                    name: crafterActor.name,
                    batchSize: project.batchSize,
                    itemName: projectItem.name,
                    progressAmount: coinAmount.toString(),
                    currentProgress: normaliseCoins(project.progressInCopper),
                    goal: cost.toString()
                }),
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