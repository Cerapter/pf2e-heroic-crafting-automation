import { MODULE_NAME } from "./constants.js";

export async function beginAProject(crafterActor, itemID) {
    let actorProjects = crafterActor.getFlag(MODULE_NAME, "projects") ?? [];

    const newProjects = [
        {
            ID: randomID(),
            ItemUUID:
                "Compendium.pf2e.equipment-srd.6KWYmeRMxsQfWhhJ",
            progressInCopper: 0,
            batchSize: 1
        }
    ];

    await crafterActor.update({ [`flags.${MODULE_NAME}.projects`]: actorProjects.concat(newProjects) });
};

export async function getProjectsToDisplay(actor) {
    const projects = actor.getFlag(MODULE_NAME, 'projects') ?? [];

    const projectItems = await Promise.all(projects.map(async (project) => {
        const projectItem = await fromUuid(project.ItemUUID);
        const cost = game.pf2e.Coins.fromPrice(projectItem.price, project.batchSize);
        const currentlyDone = new game.pf2e.Coins({ cp: project.progressInCopper });
        const progress = project.progressInCopper / cost.copperValue * 100;

        return {
            uuid: project.ItemUUID,
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