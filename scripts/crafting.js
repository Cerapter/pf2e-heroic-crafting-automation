import { MODULE_NAME } from "./constants.js";

export async function beginAProject(crafterActor, itemDetails) {
    // TODO: Put a dialog up to ask how much we wanna commit to it
    if (!itemDetails.UUID || itemDetails.UUID === "") {
        console.error("[HEROIC CRAFTING] Missing UUID when beginning a project!");
        return;
    }

    let actorProjects = crafterActor.getFlag(MODULE_NAME, "projects") ?? [];

    const newProjects = [
        {
            ID: randomID(),
            ItemUUID: itemDetails.UUID,
            progressInCopper: 0,
            batchSize: itemDetails.batchSize || 1
        }
    ];

    await crafterActor.update({ [`flags.${MODULE_NAME}.projects`]: actorProjects.concat(newProjects) });
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
        const currentlyDone = new game.pf2e.Coins({ cp: project.progressInCopper });
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