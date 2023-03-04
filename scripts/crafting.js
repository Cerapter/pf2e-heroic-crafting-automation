import { MODULE_NAME, spendingLimit } from "./constants.js";
import { projectBeginDialog, projectCraftDialog } from "./dialog.js";
import { normaliseCoins } from "./coins.js";
import { payWithCoinsAndTrove, getTroves } from "./trove.js";

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
        rollCraftAProject(crafterActor, project, { duration: dialogResult.duration, overtime: dialogResult.overtime, progress: dialogResult.spendingAmount });
    }
};

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
    options.push(`action:craft`, `action:craft-heroic-project`, `skill:rank:${skill.rank}`, proficiency[skill.rank]);

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
                    craftDetails.progressCost = details.progress.scale(2).toString();
                } else if (outcome === "failure") {
                    craftDetails.progress = true;
                    craftDetails.progressCost = details.progress.scale(0.5).toString();
                } else {
                    craftDetails.progress = false;
                    craftDetails.progressCost = details.progress.toString();
                }

                const flavour = await renderTemplate(`modules/${MODULE_NAME}/templates/crafting-result.hbs`, craftDetails);
                message.updateSource({ flavor: message.flavor + flavour });
                ChatMessage.create(message.toObject());
            }
        }
    );
}

export async function abandonProject(crafterActor, projectUUID) {
    const actorProjects = crafterActor.getFlag(MODULE_NAME, "projects") ?? [];
    await crafterActor.update({ [`flags.${MODULE_NAME}.projects`]: actorProjects.filter(project => project.ID !== projectUUID) });
}

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