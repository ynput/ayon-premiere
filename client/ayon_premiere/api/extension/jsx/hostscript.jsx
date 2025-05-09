/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true,
indent: 4, maxerr: 50 */
/*global $, Folder*/
//@include "../js/libs/json.js"

/* All public API function should return JSON! */

//app.preferences.savePrefAsBool("General Section", "Show Welcome Screen", false) ;  // ntwrk in PPRO

if (typeof $ == "undefined") $ = {};

if(!Array.prototype.indexOf) {
    Array.prototype.indexOf = function ( item ) {
        var index = 0, length = this.length;
        for ( ; index < length; index++ ) {
                  if ( this[index] === item )
                        return index;
        }
        return -1;
        };
}

function sayHello(){
    alert("hello from ExtendScript");
}

function getEnv(variable){
    return $.getenv(variable);
}


var kPProPrivateProjectMetadataURI	= "http://ns.adobe.com/premierePrivateProjectMetaData/1.0/";
// Define a name for your new sequence
var sequenceName = "AYON Metadata - DO NOT DELETE";
//var ayonMetadataId = "ayon.premiere.metadata";

var ayonMetadataId = "Column.PropertyText.Description"; //this is visible under Clip.Description

function getMetadata(){
    /**
     *  Returns payload in 'Label' field of project's metadata
     *
     **/
    if (app.isDocumentOpen()) {
        var ayon_metadata_seq = getMetadataSeq();

        if (!ayon_metadata_seq){
            ayon_metadata_seq = createMetadataSeq(sequenceName)
        }
        if (ayon_metadata_seq) {
            if (ExternalObject.AdobeXMPScript === undefined) {
                ExternalObject.AdobeXMPScript = new ExternalObject('lib:AdobeXMPScript');
            }
            if (ExternalObject.AdobeXMPScript !== undefined) { // safety-conscious!
                var projectMetadata	= ayon_metadata_seq.projectItem.getProjectMetadata();
                var xmp	= new XMPMeta(projectMetadata);

                var existing_metadata = xmp.doesPropertyExist(kPProPrivateProjectMetadataURI, ayonMetadataId);
                if (!existing_metadata){
                    existing_metadata = "[]";
                    app.project.addPropertyToProjectMetadataSchema(ayonMetadataId, ayonMetadataId, 2);
                    xmp.setProperty(kPProPrivateProjectMetadataURI, ayonMetadataId, existing_metadata);
                    var str = xmp.serialize();
                    ayon_metadata_seq.projectItem.setProjectMetadata(str, [ayonMetadataId]);
                }
                return xmp.getProperty(kPProPrivateProjectMetadataURI, ayonMetadataId);

            }
        } else {
            return _prepareError("No file open currently");
        }
    }
    return _prepareSingleValue("");
}

function imprint(payload){
    /**
     * Stores payload in 'Label' field of project's metadata
     *
     * Args:
     *     payload (string): json content
     */
    if (app.isDocumentOpen()) {
        var ayon_metadata_seq = getMetadataSeq();
        var projectMetadata	= ayon_metadata_seq.projectItem.getProjectMetadata();
        var xmp	= new XMPMeta(projectMetadata);

        if (ExternalObject.AdobeXMPScript === undefined){
            ExternalObject.AdobeXMPScript =
                new ExternalObject('lib:AdobeXMPScript');
        }
        xmp.setProperty(kPProPrivateProjectMetadataURI, ayonMetadataId, payload);
        var str = xmp.serialize();
        ayon_metadata_seq.projectItem.setProjectMetadata(str, [ayonMetadataId]);
    }
}


function fileOpen(path){
    /**
     * Opens (project) file on 'path'
     */
    var file_opened = app.openDocument(path, true, true, true);
}

function getActiveDocumentName(){
    /**
     *   Returns file name of active document
     * */
    var name = app.project.name;

    if (name){
        return _prepareSingleValue(name)
    }

    return _prepareError("No file open currently");
}

function getActiveDocumentFullName(){
    /**
     *   Returns absolute path to current project
     * */
    var path = app.project.path;

    if (path){
        return _prepareSingleValue(path)
    }

    return _prepareError("No file open currently");
}

function getItems(bins, sequences, footages){
    /**
     * Returns JSON representation of Bins, Sequences and Footages.
     *
     * Args:
     *     bins (bool): return Bins
     *     sequences (bool): return sequences from timeline
     *     footages (bool): return FootageItem
     * Returns:
     *     (list) of JSON items in format:
             {
                "name": item.name,
                "id": item.nodeId,
                "type": item_type,
                "path": path,
             }
     */
    var projectItems = [];

    var rootFolder = app.project.rootItem;
    // walk through root folder of project to differentiate between bins, sequences and clips
    for (var i = 0; i < rootFolder.children.numItems; i++) {
        var item = rootFolder.children[i];

        if (item.type === ProjectItemType.BIN) {
            if (bins){
                projectItems.push(prepareItemMetadata(item));
            }
            projectItems = walkBins(
                item, bins, sequences, footages, projectItems
            );
        } else if (
            item.type === ProjectItemType.CLIP
            && footages && item.getMediaPath()
        ) {
            projectItems.push(prepareItemMetadata(item));
        }
    }

    function prepareItemMetadata(item){
        var item_type = '';
        var path = '';
        if (item.type == ProjectItemType.CLIP){
            item_type = "footage";
            path = item.getMediaPath();
        }else if (item.type === ProjectItemType.BIN){
            item_type = "bin";
        }
        var item = {
            "name": item.name,
            "id": item.nodeId,
            "type": item_type,
            "path": path,
        };
        return JSON.stringify(item);
    }

    function walkBins (bin, bins, sequences, footages, projectItems) { // eslint-disable-line no-unused-vars
        /** Walks through Bins recursively */
        for (var i = 0; i < bin.children.numItems; i++) {
            var object = bin.children[i];
            if (object.type === ProjectItemType.BIN) { // bin
              if (bins){
                  projectItems.push(prepareItemMetadata(object));
              }
              for (var j = 0; j < object.children.numItems; j++) {
                var item = object.children[j];
                if (
                    footages && item.type === ProjectItemType.CLIP
                    && item.getMediaPath()
                ) {
                    projectItems.push(prepareItemMetadata(item));
                } else if (item.type === ProjectItemType.BIN) {
                    projectItems.push(prepareItemMetadata(item));
                    projectItems = walkBins(
                        item, bins, sequences, footages, projectItems
                    );
                }
              }
            } else if (
                footages && object.type === ProjectItemType.CLIP
                && object.getMediaPath()
            ) {
                projectItems.push(prepareItemMetadata(object));
            }
        }
        return projectItems;
    }

    $.writeln('\nprojectItems:' + projectItems.length + ' ' + projectItems);

    return '[' + projectItems.join() + ']';

}

function _getItem(item, bins, sequences, footages){
    /**
     * Auxiliary function as project items and selections
     * are indexed in different way :/
     * Refactor
     */
    var item_type = '';
    var path = '';
    var containing_comps = [];
    if (item instanceof FolderItem){
        item_type = 'folder';
        if (!folders){
            return "{}";
        }
    }
    if (item instanceof FootageItem){
        if (!footages){
            return "{}";
        }
        item_type = 'footage';
        if (item.file){
            path = item.file.fsName;
        }
        if (item.usedIn){
            for (j = 0; j < item.usedIn.length; ++j){
                containing_comps.push(item.usedIn[j].id);
            }
        }
    }
    if (item instanceof CompItem){
        item_type = 'comp';
        if (!comps){
            return "{}";
        }
    }

    var item = {"name": item.name,
                "id": item.noteId,
                "type": item_type,
                "path": path,
                "containing_comps": containing_comps};
    return JSON.stringify(item);
}

function selectItems(items){
    /**
     * Select all items from `items`, deselect other.
     *
     * Args:
     *      items (list)
     */
    for (i = 1; i <= app.project.items.length; ++i){
        item = app.project.items[i];
        if (items.indexOf(item.id) > -1){
            item.selected = true;
        }else{
            item.selected = false;
        }
    }

}

function getSelectedItems(comps, folders, footages){
    /**
     * Returns list of selected items from Project menu
     *
     * Args:
     *     comps (bool): return selected compositions
     *     folders (bool): return folders
     *     footages (bool): return FootageItem
     * Returns:
     *     (list) of JSON items
     */
    var items = []
    for (i = 0; i < app.project.selection.length; ++i){
        var item = app.project.selection[i];
        if (!item){
            continue;
        }
        var ret = _getItem(item, comps, folders, footages);
        if (ret){
            items.push(ret);
        }
    }
    return '[' + items.join() + ']';
}

function getLastSelectedBin(){
    /**
     * Get last selected item if it is bin.
     *
     * Should find lowest selected bin in hierarchy.
     */
    var selectedItems = app.getCurrentProjectViewSelection();
    if (selectedItems){
        var lastItem = selectedItems[selectedItems.length - 1];
        if (lastItem.type === ProjectItemType.BIN){
            return lastItem;
        }
    }
}

function _createNewBin(binName, useSelection){
    /**
     * Helper to create new bin
     */
    var parentBin = app.project.rootItem;
    if (useSelection){
        var lastSelectedBin = getLastSelectedBin();
        if (lastSelectedBin){
            parentBin = lastSelectedBin;
        }
    }
    return parentBin.createBin(binName);
}

function importFiles(paths, item_name, isImageSequence, throwError, useSelection){
    /**
     * Imports file(s) into bin.
     *
     * Args:
     *    paths (list[str]): json list with absolute paths to source files
     *    item_name (string): label for bin
     *    isImageSequence (bool): files loaded are numbered
     *       file sequence
     *    throwError (bool): reraise error (when function is called from
     *       another)
     *    useSelection (bool): if bin should be created in selected bin
     *         set to false in bin replacement, that should be in original place
     * Returns:
     *    JSON {name, id}
     */
    //paths = JSON.parse(paths);
    var ret = {};
    var suppressUI = true;
    var importAsNumberedStills = isImageSequence;

    var targetBin = _createNewBin(item_name, useSelection);

    fp = new File(paths[0]);
    if (fp.exists){
        try {
            var useSelection = true;
            ret = app.project.importFiles(
                paths,
                suppressUI,
                targetBin,
                importAsNumberedStills,
                useSelection
            );
        } catch (error) {
            if (throwError){
                throw error;
            }
            return _prepareError(error.toString() + path);
        } finally {
            fp.close();
        }
    }else{
        var errMesage = "File " + path + " not found.";
        if (throwError){
            throw new Error(errMesage);
        }
	    return _prepareError(errMesage);
    }

    ret = {"name": item_name, "id": targetBin.nodeId}

    return JSON.stringify(ret);
}

function importAEComp(path, binName, compNames, throwError){
    /**
     * Imports file(s) into bin.
     *
     * Args:
     *    path (str): json list with absolute path to source file
     *    binName (str): label for bin
     *    compNames (list[str]): import only selected composition
     *    throwError (bool): reraise error (when function is called from
     *       another)
     * Returns:
     *    JSON {name, id}
     */
    var ret = {};
    var suppressUI = true;

    fp = new File(path);
    if (fp.exists){
        var targetBin = _createNewBin(binName, true);
        try {
            if (compNames.length > 0){
                ret = app.project.importAEComps(fp.fsName, compNames, targetBin);
            }else{
                ret = app.project.importAllAEComps(fp.fsName, targetBin);
            }
        } catch (error) {
            if (throwError){
                throw error;
            }
            return _prepareError(error.toString() + path);
        } finally {
            fp.close();
        }
    }else{
        var errMesage = "File " + path + " not found.";
        if (throwError){
            throw new Error(errMesage);
        }
	    return _prepareError(errMesage);
    }

    ret = {"name": binName, "id": targetBin.nodeId}

    return JSON.stringify(ret);
}

function replaceAEComp(bin_id, path, binName, compNames, throwError) {
    /**
     * Replace imported After Effects compositions
     * Args: see original docstring
     */
    const targetBinInfo = getBinAndParentById(bin_id);
    if (!targetBinInfo) {
        return _prepareError("There is no item with " + bin_id);
    }
    return _replaceBinContent(
        importAEComp,
        [path, binName, compNames],
        targetBinInfo,
        binName,
        [path]
    );
}

function replaceItem(bin_id, paths, itemName, isImageSequence) {
    /**
     * Replaces bin content with new files
     * Args: see original docstring
     */
    const targetBinInfo = getBinAndParentById(bin_id);

    if (!targetBinInfo) {
        return _prepareError("There is no item with " + bin_id);
    }

    if (!isImageSequence){
        return _replaceMovieContent(
            targetBinInfo, paths[0], itemName
        )
    }

    return _replaceBinContent(
        importFiles,
        [paths, itemName, isImageSequence, true, false],
        targetBinInfo,
        itemName,
        paths
    );
}

function _replaceBinContent(importFunc, importArgs, targetBinInfo, itemName, paths) {
    var parentTargetBin = targetBinInfo["parent"];
    var targetBin = targetBinInfo["item"];

    try {
        const newBinJson = importFunc.apply(null, importArgs);
        const newBinId = JSON.parse(newBinJson).id;
        const newBinInfo = getBinAndParentById(newBinId);
        const newBin = newBinInfo.item;
        // Repoint media for all items in bin
        for (var j = 0; j < targetBin.children.numItems; j++) {
            var oldProjectItem = targetBin.children[j];
            var newProjectItem = newBin.children[j];
            var fullReplace = true;
            repointMediaInSequences(oldProjectItem, newProjectItem, fullReplace);
        }

        // Replace old bin
        targetBin.deleteBin();
        newBin.moveBin(parentTargetBin);

        return JSON.stringify({
            name: itemName,
            id: newBin.nodeId
        });

    } catch (error) {
        return _prepareError(error.toString() + paths[0]);
    } finally {
        fp.close();
    }
}

function repointMediaInSequences(oldItem, newItem, fullReplace) {
    var project = app.project;
    var sequences = project.sequences; // Get the list of sequences

    // Check if there are any sequences
    if (sequences.length === 0) {
        return;
    }

    // Iterate through each sequence
    for (var i = 0; i < sequences.length; i++) {
        var sequence = sequences[i];

        // You can add more actions here, e.g., accessing clips in the sequence
        var videoTracks = sequence.videoTracks; // Get video tracks

        for (var j = 0; j < videoTracks.numTracks; j++) {
            var track = videoTracks[j];

            // Loop through clips in the track
            for (var k = 0; k < track.clips.numItems; k++) {
                var clip = track.clips[k];
                if (clip.projectItem
                    && clip.projectItem.nodeId === oldItem.nodeId) {
                    if (fullReplace){
                        // Replace the project item with the new item
                        clip.projectItem = newItem;
                    }

                    clip.name = newItem.name;
                }
            }
        }
    }
}

function _replaceMovieContent(targetBinInfo, path, itemName){
    /** Possibly temporary function to replace movies
     *
     * Original update of image sequences and comps cannot
     * keep trims, this one should.
     * (Original update cannot do changeMediaPath)
     *
     * Args:
     *     targetBinInfo (dict): target bin info (parent etc)
     *     path (str): absolute path to new movie
     *     itemName (str): name of updated Bin
     *
     * Returns:
     *     {"item": foundItem, "parent": parentOfItem}
     */
    var targetBin = targetBinInfo["item"];

    try {
        for (var i = 0; i < targetBin.children.length; i++) {
            var item = targetBin.children[i];

            if (!item.canChangeMediaPath()) {
                continue;
            }

            path = path.replace(/\//g, "\\");
            item.changeMediaPath(path, true);

            var file = new File(path);
            item.name = file.name;

            var fullReplace = false;  //rename only
            repointMediaInSequences(item, item, fullReplace);

            // expects only single movie in a bin
            break;
        }
        targetBin.name = itemName;

        return JSON.stringify({
            name: itemName,
            id: targetBin.nodeId
        });

    } catch (error) {
        return _prepareError(error.toString() + paths[0]);
    }
}

function getBinAndParentById(nodeId) {
    /** Looks for Bin by its nodeId
     *
     * Args:
     *     nodeId (string): item id
     *
     * Returns:
     *     {"item": foundItem, "parent": parentOfItem}
     */
    var project = app.project;
    var rootItem = project.rootItem;

    // Helper function to search recursively in bins
    function findInBin(bin, nodeId) {
        /** Looks for item (bin|footage) by its nodeId
         *
         * Args:
         *     bin (ProjectItem): of type Bin
         *     nodeId (string): item id
         *
         * Returns:
         *     {"item": foundItem, "parent": parentOfItem}
         */
        for (var j = 0; j < bin.children.numItems; j++) {
            var childItem = bin.children[j];

            if (childItem.nodeId === nodeId) {
                return { "item": childItem, "parent": bin };
            }

            // Recursively search in sub-bins
            if (childItem.type === ProjectItemType.BIN) {
                var foundChild = findInBin(childItem, nodeId);
                if (foundChild) {
                    return foundChild;
                }
            }
        }
        return null; // Return null if not found
    }


    // Loop through all items in the project
    for (var i = 0; i < rootItem.children.numItems; i++) {
        var item = rootItem.children[i];

        // Check if the item's nodeId matches the provided nodeId
        if (item.nodeId === nodeId) {
            // Return the matching ProjectItem
            return { "item": item, "parent": rootItem };
        }

        // If the item is a bin, check its children recursively
        if (item.type === ProjectItemType.BIN) {
            var foundItem = findInBin(item, nodeId);
            if (foundItem) {
                return foundItem; // Return if found in sub-bins
            }
        }
    }
    return null; // Return null if no item is found
}

function renameItem(item_id, new_name){
    /**
     * Renames item with 'item_id' to 'new_name'
     *
     * Args:
     *    item_id (int): id to search item
     *    new_name (str)
     */
    var item = app.project.itemByID(item_id);
    if (item){
        item.name = new_name;
    }else{
        return _prepareError("There is no composition with "+ comp_id);
    }
}

function deleteItem(item_id){
    /**
     *  Delete loaded bin
     *
     *  Not restricted only to comp, it could delete
     *  any item with 'id'
     */
    var itemAndParent = getBinAndParentById(item_id);
    var item = itemAndParent["item"];
    if (item && item.type === ProjectItemType.BIN){
        item.deleteBin();
    }else{
        return _prepareError("There is no item with "+ item_id);
    }
}

function setLabelColor(item_id, color_idx){
    /**
     * Set item_id label to 'color_idx' color
     * Args:
     *     item_id (string): item id
     *     color_idx (int): 0-16 index from Label
     */
    var item = app.project.itemByID(item_id);
    if (item){
        item.label = color_idx;
    }else{
        return _prepareError("There is no bin with "+ item_id);
    }
}

function save(){
    /**
     * Saves current project
     */
    try{
        app.project.save();
    } catch (error) {
        return _prepareError("Cannot save current workfile");
    }
}

function saveAs(path){
    /**
     *   Saves current project as 'path'
     * */
    try{
        app.project.saveAs(path);
    } catch (error) {
        return _prepareError("Cannot save file at " + path);
    }
}

function close(){
    app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    app.quit();
}

function getAppVersion(){
    return _prepareSingleValue(app.version);
}

function printMsg(msg){
    alert(msg);
}

function getMetadataSeq(){
    /**
     * Returns dummy sequence used to store AYON metadata
     */
    var sequences = app.project.sequences;
    if (sequences){
        for (var i = 0; i < sequences.length; i++) {
            var sequence = sequences[i];
            if (sequence.name == sequenceName){
                return sequence;
            }
        }
    }
}

function createMetadataSeq(sequenceName){
    /**
     * Creates dummy sequence for storing AYON metadata
     *
     * It is not possible to store metadata directly on project itself
     *
     * This approach limits triggering sequence dialog for artist!
     */
    var project = app.project;

    // random preset, just to not show dialog
    var presetPath = app.path + "Settings/SequencePresets/HD 1080p/HD 1080p 29.97 fps.sqpreset";

    if ($.os.indexOf("Windows") !== -1) {
        presetPath = presetPath.replace(/\//g, "\\");
    }

    var newSequence = project.newSequence(sequenceName, presetPath);
    return newSequence
}

function _prepareSingleValue(value){
    return JSON.stringify({"result": value})
}
function _prepareError(error_msg){
    return JSON.stringify({"error": error_msg})
}

function logToFile(message) {
    // Specify the path to the log file
    var logFilePath = new File("C:/projects/logfile.txt"); // Change this path as needed

    // Open the file in append mode
    if (logFilePath.open("a")) { // "a" for append mode
        // Create a timestamp
        var timestamp = new Date().toLocaleString(); // Get current date and time
        // Write the message with a timestamp
        logFilePath.writeln("[" + timestamp + "] " + message);
        // Close the file
        logFilePath.close();
    } else {
        $.writeln("Error opening log file: " + logFilePath.error);
    }
}

// var items = replaceItem('000f427a',
//     ["C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1001.exr"
//         ,"C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1002.exr"
//         , "C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1003.exr"
//         , "C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1004.exr"
//         , "C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1005.exr"
//         , "C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1006.exr"
//         , "C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1007.exr"
//         , "C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1008.exr"
//         , "C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1009.exr"
//         , "C:/projects/ayon_dev/shot02/publish/render/renderAe_animationMain3/v157/ad_shot02_renderAe_animationMain3_v157.1010.exr"],
//     'new name2', true);

// var items = replaceItem(
//     '000f4280',
//     ['C:/projects/cg_pigeon_lookMain_v001_Dry.png'],
//     '▼sh01_imageReference_001', false
// )

// $.writeln(items);

// deleteItem('000f424c');