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
            batchSize: itemDetails.batchSize || 1
        }
    ];

    if (payment.removeCopper > 0) {
        await crafterActor.inventory.removeCoins({ cp: payment.removeCopper });
    };

    if (payment.troveUpdates.length > 0) {
        console.log(payment.troveUpdates);
        await crafterActor.updateEmbeddedDocuments("Item", payment.troveUpdates);
    }

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
        game.pf2e.Coins.fromString(spendingLimit(dialogResult.duration, crafterActor.level)));
    console.log("craftAProject", dialogResult, payment);

    if (!payment.canPay) {
        ui.notifications.warn(`${crafterActor.name} cannot afford to start the project!`);
        return;
    }

    /*game.pf2e.Check.roll(

    )*/
};

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
            cost,
            currentlyDone,
            progress
        };
    }))

    return projectItems;
}