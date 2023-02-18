import { MODULE_NAME } from "./constants.js";
import { projectBeginDialog } from "./dialog.js";

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

    if (!dialogResult.startingProgress) {
        return;
    }

    if (crafterActor.inventory.coins.copperValue < dialogResult.startingProgress) {
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

    await crafterActor.inventory.removeCoins({ cp: dialogResult.startingProgress });
    await crafterActor.update({ [`flags.${MODULE_NAME}.projects`]: actorProjects.concat(newProjects) });
};

export async function abandonProject(crafterActor, projectUUID) {
    const actorProjects = crafterActor.getFlag(MODULE_NAME, "projects") ?? [];
    await crafterActor.update({ [`flags.${MODULE_NAME}.projects`]: actorProjects.filter(project => project.ID !== projectUUID) });
}

function normaliseCoins(copperValue) {
    const pp = Math.floor(copperValue / 1000);
    const gp = Math.floor(copperValue / 100) - pp * 10;
    const sp = Math.floor(copperValue / 10) - pp * 100 - gp * 10;
    const cp = copperValue - pp * 1000 - gp * 100 - sp * 10;

    return new game.pf2e.Coins({
        pp,
        gp,
        sp,
        cp
    });
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