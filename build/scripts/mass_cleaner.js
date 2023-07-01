/**
 * What is this?
 * It's a kind-of everything doer? Basically:
 *   1. It takes all the files unpacked by fvtt.
 *   2. It forces a snake-casing to their names.
 *   3. It cleans up the JSONs, getting rid of world-specific info.
 *   4. It updates the source ID to be all nice and tidy, resembling the UUID.
 */

const fs = require('fs');
const path = require('path');

function deepGetDirectories(distPath) {
    return fs.readdirSync(distPath).filter(function (file) {
        return fs.statSync(distPath + '/' + file).isDirectory();
    }).reduce(function (all, subDir) {
        return [...all, ...fs.readdirSync(distPath + '/' + subDir).map(e => subDir + '/' + e)]
    }, []);
}

function camelToSnake(str = '') {
    if (str === '.') return str;
    return str
        .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
        .map(x => x.toLowerCase())
        .join('_');

}

function intoUUID(filename, id) {
    const categoryRaw = filename.split('/')[2];
    let category = categoryRaw.replace("class_features", "class-features");

    return `Compendium.pf2e-heroic-crafting-automation.heroic-crafting-automation-${category}.Item.${id}`
}

function cleanFileName(filename) {
    const extension = filename.split('.').slice(-1)[0];
    const noID = filename.split('_').filter(n => n).slice(0, -1).join('_').split('/').map((x) => { return camelToSnake(x) }).join('/');

    return noID + '.' + extension;
}

function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

const files = deepGetDirectories("./raw").map(x => './raw/' + x);

files.forEach(file => {
    var fileContent = JSON.parse(fs.readFileSync(file).toString());
    const targetFile = cleanFileName(file).replace('/raw/', '/src/');

    fileContent["flags"]["core"]["sourceId"] = intoUUID(file, fileContent["_id"]);
    delete fileContent["folder"];
    delete fileContent["_stats"];
    delete fileContent["ownership"];
    fileContent["ownership"] = { "default": 0 };

    ensureDirectoryExistence(targetFile);
    fs.writeFile(targetFile, JSON.stringify(fileContent, null, "\t"), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!")
    });

});