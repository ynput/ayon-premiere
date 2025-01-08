/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true,
indent: 4, maxerr: 50 */
/*global $, Folder*/
//@include "../js/libs/json.js"

/* All public API function should return JSON! */

//app.preferences.savePrefAsBool("General Section", "Show Welcome Screen", false) ;  // ntwrk in PPRO

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


function addItem(name, item_type){
    /**
     * Adds comp or folder to project items.
     *
     * Could be called when creating publishable instance to prepare
     * composition (and render queue).
     *
     * Args:
     *      name (str): composition name
     *      item_type (str): COMP|FOLDER
     * Returns:
     *      SingleItemValue: eg {"result": VALUE}
     */
    if (item_type == "COMP"){
        // dummy values, will be rewritten later
        item = app.project.items.addComp(name, 1920, 1060, 1, 10, 25);
    }else if (item_type == "FOLDER"){
        item = app.project.items.addFolder(name);
    }else{
        return _prepareError("Only 'COMP' or 'FOLDER' can be created");
    }
    return _prepareSingleValue(item.id);

}

function getItems(bins, sequences, footages){
    /**
     * Returns JSON representation of compositions and
     * if 'collectLayers' then layers in comps too.
     *
     * Args:
     *     bins (bool): return selected compositions
     *     sequences (bool): return folders
     *     footages (bool): return FootageItem
     * Returns:
     *     (list) of JSON items
     */
    var projectItems = [];

    var rootFolder = app.project.rootItem;
    // walk through root folder of project to differentiate between bins, sequences and clips
    for (var i = 0; i < rootFolder.children.numItems; i++) {
      // $.pype.log('\nroot item at ' + i + " is of type " + rootFolder.children[i].type);
      var item = rootFolder.children[i];

      if (item.type === 2) { // bin
        walkBins(item, bins, sequences, footages);
      } else if (item.type === 1 && footages && item.getMediaPath()) {
        projectItems.push(prepareItemMetadata(item));
      }
    }

    function prepareItemMetadata(item){
        var item_type = '';
        var path = '';
        if (item.type == 1){
            item_type = "footage";
            path = item.getMediaPath();
        }else if (item.type == 2){
            item_type = "bin";
        }
        var item = {
            "name": item.name,
            "id": item.nodeId,
            "type": item_type,
            "path": path,
            // "containing_comps": containing_comps
        };
        return JSON.stringify(item);
    }

    // walk through bins recursively
    function walkBins (bin, bins, sequences, footages) { // eslint-disable-line no-unused-vars

      if (bins){
        projectItems.push(prepareItemMetadata(bin));
      }
      for (var i = 0; i < bin.children.numItems; i++) {
        var object = bin.children[i];
        // $.writeln(bin.name + ' has ' + object + ' ' + object.name  + ' of type ' +  object.type + ' and has mediapath ' + object.getMediaPath() );
        if (object.type === 2) { // bin
          // $.writeln(object.name  + ' has ' +  object.children.numItems  );
          for (var j = 0; j < object.children.numItems; j++) {
            var obj = object.children[j];
            if (obj.type === 1 && obj.getMediaPath()) { // clip  in sub bin
              // $.writeln(object.name  + ' has ' + obj + ' ' +  obj.name  );
              projectItems.push(obj);
            } else if (obj.type === 2) { // bin
              walkBins(obj);
            }
          }
        } else if (object.type === 1 && footages && object.getMediaPath()) { // clip in bin in root
          // $.pype.log(bin.name + ' has ' + object + ' ' + object.name );
          projectItems.push(prepareItemMetadata(object));
        }
      }
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


function importFiles(paths, item_name, is_image_sequence){
    /**
     * Imports file(s) into bin.
     *
     * Args:
     *    paths (list[str]): json list with absolute paths to source files
     *    item_name (string): label for bin
     *    is_image_sequence (bool): files loaded are numbered
     *       file sequence
     * Returns:
     *    JSON {name, id}
     */
    //paths = JSON.parse(paths);
    var ret = {};
    var suppressUI = true;
    var importAsNumberedStills = is_image_sequence;

    var targetBin = app.project.rootItem.createBin(item_name);

    fp = new File(paths[0]);
    if (fp.exists){
        try {
            ret = app.project.importFiles(paths, suppressUI, targetBin, importAsNumberedStills);
        } catch (error) {
            return _prepareError(error.toString() + path);
        } finally {
            fp.close();
        }
    }else{
	    return _prepareError("File " + path + " not found.");
    }

    ret = {"name": item_name, "id": targetBin.nodeId}

    return JSON.stringify(ret);
}

function replaceItem(bin_id, paths, item_name, is_image_sequence){
    /**
     * Replaces loaded file with new file and updates name
     *
     * Args:
     *    bin_id (int): nodeId of Bin, not a index!
     *    paths (list[string]): absolute paths to new files
     *    item_name (string): new composition name
     *    is_image_sequence (bool): files loaded are numbered
     *       file sequence
     */

    fp = new File(paths[0]);
    if (!fp.exists){
        return _prepareError("File " + path + " not found.");
    }
    var targetBin = getProjectItemById(bin_id);
    if (targetBin){
        var suppressUI = true;
        var importAsNumberedStills = is_image_sequence;
        try{
            var child = targetBin.children[0];
            if (child.canChangeMediaPath()){
                var res = child.changeMediaPath(paths[0]);
                child.refreshMedia();
            }
            targetBin.name = item_name;
        } catch (error) {
            return _prepareError(error.toString() + paths[0]);
        } finally {
            fp.close();
        }
    }else{
        return _prepareError("There is no item with "+ bin_id);
    }
}

function getProjectItemById(nodeId) {
    var project = app.project;
    var rootItem = project.rootItem;

    // Helper function to search recursively in bins
    function findInBin(bin, nodeId) {
        for (var j = 0; j < bin.children.numItems; j++) {
            var childItem = bin.children[j];

            if (childItem.nodeId === nodeId) {
                return childItem; // Found the item
            }

            // Recursively search in sub-bins
            if (childItem.type === ProjectItemType.BIN) {
                var foundChild = findInBin(childItem, nodeId);
                if (foundChild) {
                    return foundChild; // Return if found in sub-bins
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
            return item; // Return the matching ProjectItem
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

function setLabelColor(comp_id, color_idx){
    /**
     * Set item_id label to 'color_idx' color
     * Args:
     *     item_id (int): item id
     *     color_idx (int): 0-16 index from Label
     */
    var item = app.project.itemByID(comp_id);
    if (item){
        item.label = color_idx;
    }else{
        return _prepareError("There is no composition with "+ comp_id);
    }
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
     *  Delete any 'item_id'
     *
     *  Not restricted only to comp, it could delete
     *  any item with 'id'
     */
    var item = getProjectItemById(item_id);
    if (item && item.type === ProjectItemType.BIN){
        item.deleteBin();
    }else{
        return _prepareError("There is no item with "+ item_id);
    }
}

function getCompProperties(comp_id){
    /**
     * Returns information about composition - are that will be
     * rendered.
     *
     * Returns
     *     (dict)
     */
    var comp = app.project.itemByID(comp_id);
    if (!comp){
        return _prepareError("There is no composition with "+ comp_id);
    }

    return JSON.stringify({
        "id": comp.id,
        "name": comp.name,
        "frameStart": comp.displayStartFrame,
        "framesDuration": comp.duration * comp.frameRate,
        "frameRate": comp.frameRate,
        "width": comp.width,
        "height": comp.height});
}

function setCompProperties(comp_id, frameStart, framesCount, frameRate,
                           width, height){
    /**
     * Sets work area info from outside (from Ftrack via OpenPype)
     */
    var comp = app.project.itemByID(comp_id);
    if (!comp){
        return _prepareError("There is no composition with "+ comp_id);
    }

    app.beginUndoGroup('change comp properties');
        if (frameStart && framesCount && frameRate){
            comp.displayStartFrame = frameStart;
            comp.duration = framesCount / frameRate;
            comp.frameRate = frameRate;
        }
        if (width && height){
            var widthOld = comp.width;
            var widthNew = width;
            var widthDelta = widthNew - widthOld;

            var heightOld = comp.height;
            var heightNew = height;
            var heightDelta = heightNew - heightOld;

            var offset = [widthDelta / 2, heightDelta / 2];

            comp.width = widthNew;
            comp.height = heightNew;

            for (var i = 1, il = comp.numLayers; i <= il; i++) {
                var layer = comp.layer(i);
                var positionProperty = layer.property('ADBE Transform Group').property('ADBE Position');

                if (positionProperty.numKeys > 0) {
                    for (var j = 1, jl = positionProperty.numKeys; j <= jl; j++) {
                        var keyValue = positionProperty.keyValue(j);
                        positionProperty.setValueAtKey(j, keyValue + offset);
                    }
                } else {
                    var positionValue = positionProperty.value;
                    positionProperty.setValue(positionValue + offset);
                }
            }
        }

    app.endUndoGroup();
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

function getRenderInfo(comp_id){
    /***
        Get info from render queue.
        Currently pulls only file name to parse extension and
        if it is sequence in Python
    Args:
        comp_id (int): id of composition
     Return:
        (list) [{file_name:"xx.png", width:00, height:00}]
    **/
    var item = app.project.itemByID(comp_id);
    if (!item){
        return _prepareError("Composition with '" + comp_id + "' wasn't found! Recreate publishable instance(s)")
    }

    var comp_name = item.name;
    var output_metadata = [];
    var original_file_names = [];
    try{
        // render_item.duplicate() should create new item on renderQueue
        // BUT it works only sometimes, there are some weird synchronization issue
        // this method will be called always before render, so prepare items here
        // for render to spare the hassle
        for (i = 1; i <= app.project.renderQueue.numItems; ++i){
            var render_item = app.project.renderQueue.item(i);
            if (render_item.comp.id != comp_id){
                continue;
            }

            if (render_item.status == RQItemStatus.DONE){
                for (j = 1; j<= render_item.numOutputModules; ++j){
                    var item = render_item.outputModule(j);
                    original_file_names.push(item.file);
                }
                render_item.duplicate();  // create new, cannot change status if DONE
                render_item.remove();  // remove existing to limit duplications
                continue;
            }
        }

        // properly validate as `numItems` won't change magically
        var comp_id_count = 0;
        for (i = 1; i <= app.project.renderQueue.numItems; ++i){
            var render_item = app.project.renderQueue.item(i);
            if (render_item.comp.id != comp_id){
                continue;
            }
            comp_id_count += 1;

            for (j = 1; j<= render_item.numOutputModules; ++j){
                var item = render_item.outputModule(j);
                if(original_file_names.length > j-1){
                    item.file = original_file_names[j-1];
                }

                var file_url = item.file.toString();
                output_metadata.push(
                    JSON.stringify({
                        "file_name": file_url,
                        "width": render_item.comp.width,
                        "height": render_item.comp.height
                    })
                );
            }
        }
    } catch (error) {
        return _prepareError("There is no render queue, create one");
    }

    if (comp_id_count > 1){
        return _prepareError("There cannot be more items in Render Queue for '" + comp_name + "'!")
    }

    if (comp_id_count == 0){
        return _prepareError("There is no item in Render Queue for '" + comp_name + "'! Add composition to Render Queue.")
    }

    return '[' + output_metadata.join() + ']';
}

function getAudioUrlForComp(comp_id){
    /**
     * Searches composition for audio layer
     *
     * Only single AVLayer is expected!
     * Used for collecting Audio
     *
     * Args:
     *    comp_id (int): id of composition
     * Return:
     *    (str) with url to audio content
     */
    var item = app.project.itemByID(comp_id);
    if (item){
        for (i = 1; i <= item.numLayers; ++i){
            var layer = item.layers[i];
            if (layer instanceof AVLayer){
                if (layer.hasAudio){
                    source_url = layer.source.file.fsName.toString()
                    return _prepareSingleValue(source_url);
                }
            }

        }
    }else{
        return _prepareError("There is no composition with "+ comp_id);
    }

}

function addItemAsLayerToComp(comp_id, item_id, found_comp){
    /**
     * Adds already imported FootageItem ('item_id') as a new
     * layer to composition ('comp_id').
     *
     * Args:
     *  comp_id (int): id of target composition
     *  item_id (int): FootageItem.id
     *  found_comp (CompItem, optional): to limit quering if
     *      comp already found previously
     */
    var comp = found_comp || app.project.itemByID(comp_id);
    if (comp){
        item = app.project.itemByID(item_id);
        if (item){
            comp.layers.add(item);
        }else{
            return _prepareError("There is no item with " + item_id);
        }
    }else{
        return _prepareError("There is no composition with "+ comp_id);
    }
}

function importBackground(comp_id, composition_name, files_to_import){
    /**
     * Imports backgrounds images to existing or new composition.
     *
     * If comp_id is not provided, new composition is created, basic
     * values (width, heights, frameRatio) takes from first imported
     * image.
     *
     * Args:
     *   comp_id (int): id of existing composition (null if new)
     *   composition_name (str): used when new composition
     *   files_to_import (list): list of absolute paths to import and
     *      add as layers
     *
     * Returns:
     *  (str): json representation (id, name, members)
     */
    var comp;
    var folder;
    var imported_ids = [];
    if (comp_id){
        comp = app.project.itemByID(comp_id);
        folder = comp.parentFolder;
    }else{
        if (app.project.selection.length > 1){
            return _prepareError(
                "Too many items selected, select only target composition!");
        }else{
            selected_item = app.project.activeItem;
            if (selected_item instanceof Folder){
                comp = selected_item;
                folder = selected_item;
            }
        }
    }

    if (files_to_import){
        for (i = 0; i < files_to_import.length; ++i){
            item = _importItem(files_to_import[i]);
            if (!item){
                return _prepareError(
                    "No item for " + item_json["id"] +
                    ". Import background failed.")
            }
            if (!comp){
                folder = app.project.items.addFolder(composition_name);
                imported_ids.push(folder.id);
                comp = app.project.items.addComp(composition_name, item.width,
                    item.height, item.pixelAspect,
                    1, 26.7);  // hardcode defaults
                imported_ids.push(comp.id);
                comp.parentFolder = folder;
            }
            imported_ids.push(item.id)
            item.parentFolder = folder;

            addItemAsLayerToComp(comp.id, item.id, comp);
        }
    }
    var item = {"name": comp.name,
                "id": folder.id,
                "members": imported_ids};
    return JSON.stringify(item);
}

function reloadBackground(comp_id, composition_name, files_to_import){
    /**
     * Reloads existing composition.
     *
     * It deletes complete composition with encompassing folder, recreates
     * from scratch via 'importBackground' functionality.
     *
     * Args:
     *   comp_id (int): id of existing composition (null if new)
     *   composition_name (str): used when new composition
     *   files_to_import (list): list of absolute paths to import and
     *      add as layers
     *
     * Returns:
     *  (str): json representation (id, name, members)
     *
     */
    var imported_ids = []; // keep track of members of composition
    comp = app.project.itemByID(comp_id);
    folder = comp.parentFolder;
    if (folder){
        renameItem(folder.id, composition_name);
        imported_ids.push(folder.id);
    }
    if (comp){
        renameItem(comp.id, composition_name);
        imported_ids.push(comp.id);
    }

    var existing_layer_names = [];
    var existing_layer_ids = []; // because ExtendedScript doesnt have keys()
    for (i = 1; i <= folder.items.length; ++i){
        layer = folder.items[i];
        //because comp.layers[i] doesnt have 'id' accessible
        if (layer instanceof CompItem){
            continue;
        }
        existing_layer_names.push(layer.name);
        existing_layer_ids.push(layer.id);
    }

    var new_filenames = [];
    if (files_to_import){
        for (i = 0; i < files_to_import.length; ++i){
            file_name = _get_file_name(files_to_import[i]);
            new_filenames.push(file_name);

            idx = existing_layer_names.indexOf(file_name);
            if (idx >= 0){  // update
                var layer_id = existing_layer_ids[idx];
                replaceItem(layer_id, files_to_import[i], file_name);
                imported_ids.push(layer_id);
            }else{ // new layer
                item = _importItem(files_to_import[i]);
                if (!item){
                    return _prepareError(
                        "No item for " + files_to_import[i] +
                        ". Reload background failed.");
                }
                imported_ids.push(item.id);
                item.parentFolder = folder;
                addItemAsLayerToComp(comp.id, item.id, comp);
            }
        }
    }

    _delete_obsolete_items(folder, new_filenames);

    var item = {"name": comp.name,
                "id": folder.id,
                "members": imported_ids};

    return JSON.stringify(item);
}

function _get_file_name(file_url){
    /**
     * Returns file name without extension from 'file_url'
     *
     * Args:
     *    file_url (str): full absolute url
     * Returns:
     *    (str)
     */
    fp = new File(file_url);
    file_name = fp.name.substring(0, fp.name.lastIndexOf("."));
    return file_name;
}

function _delete_obsolete_items(folder, new_filenames){
    /***
     * Goes through 'folder' and removes layers not in new
     * background
     *
     * Args:
     *   folder (FolderItem)
     *   new_filenames (array): list of layer names in new bg
     */
    // remove items in old, but not in new
    delete_ids = []
    for (i = 1; i <= folder.items.length; ++i){
        layer = folder.items[i];
        //because comp.layers[i] doesnt have 'id' accessible
        if (layer instanceof CompItem){
            continue;
        }
        if (new_filenames.indexOf(layer.name) < 0){
            delete_ids.push(layer.id);
        }
    }
    for (i = 0; i < delete_ids.length; ++i){
        deleteItem(delete_ids[i]);
    }
}

function _importItem(file_url){
    /**
     * Imports 'file_url' as new FootageItem
     *
     * Args:
     *    file_url (str): file url with content
     * Returns:
     *    (FootageItem)
     */
    file_name = _get_file_name(file_url);

    //importFile prepared previously to return json
    item_json = importFile(file_url, file_name, JSON.stringify({"ImportAsType":"FOOTAGE"}));
    item_json = JSON.parse(item_json);
    item = app.project.itemByID(item_json["id"]);

    return item;
}

function isFileSequence (item){
    /**
     * Check that item is a recognizable sequence
     */
    if (item instanceof FootageItem && item.mainSource instanceof FileSource && !(item.mainSource.isStill) && item.hasVideo){
        var extname = item.mainSource.file.fsName.split('.').pop();

        return extname.match(new RegExp("(ai|bmp|bw|cin|cr2|crw|dcr|dng|dib|dpx|eps|erf|exr|gif|hdr|ico|icb|iff|jpe|jpeg|jpg|mos|mrw|nef|orf|pbm|pef|pct|pcx|pdf|pic|pict|png|ps|psd|pxr|raf|raw|rgb|rgbe|rla|rle|rpf|sgi|srf|tdi|tga|tif|tiff|vda|vst|x3f|xyze)", "i")) !== null;
    }

    return false;
}

function render(target_folder, comp_id){
    var out_dir = new Folder(target_folder);
    var out_dir = out_dir.fsName;
    for (i = 1; i <= app.project.renderQueue.numItems; ++i){
        var render_item = app.project.renderQueue.item(i);
        var composition = render_item.comp;
        if (composition.id == comp_id){
            if (render_item.status == RQItemStatus.DONE){
                var new_item = render_item.duplicate();
                render_item.remove();
                render_item = new_item;
            }

            render_item.render = true;

            var om1 = app.project.renderQueue.item(i).outputModule(1);
            var file_name = File.decode( om1.file.name ).replace('℗', ''); // Name contains special character, space?

            var omItem1_settable_str = app.project.renderQueue.item(i).outputModule(1).getSettings( GetSettingsFormat.STRING_SETTABLE );

            var targetFolder = new Folder(target_folder);
            if (!targetFolder.exists) {
                targetFolder.create();
            }

            om1.file = new File(targetFolder.fsName + '/' + file_name);
        }else{
            if (render_item.status != RQItemStatus.DONE){
                render_item.render = false;
            }
        }

    }
    app.beginSuppressDialogs();
    app.project.renderQueue.render();
    app.endSuppressDialogs(false);
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

function addPlaceholder(name, width, height, fps, duration){
    /** Add AE PlaceholderItem to Project list.
     *
     * PlaceholderItem chosen as it doesn't require existing file and
     * might potentially allow nice functionality in the future.
     *
     */
    app.beginUndoGroup('change comp properties');
    try{
        item = app.project.importPlaceholder(name, width, height,
                                             fps, duration);

        return _prepareSingleValue(item.id);
    }catch (error) {
        $.writeln(_prepareError("Cannot add placeholder " + error.toString()));
    }
    app.endUndoGroup();
}

function addItemInstead(placeholder_item_id, item_id){
    /** Add new loaded item in place of load placeholder.
     *
     * Each placeholder could be placed multiple times into multiple
     * composition. This loops through all compositions and
     * places loaded item under placeholder.
     * Placeholder item gets deleted later separately according
     * to configuration in Settings.
     *
     * Args:
     *      placeholder_item_id (int)
     *      item_id (int)
    */
    var item = app.project.itemByID(item_id);
    if (!item){
        return _prepareError("There is no item with "+ item_id);
    }

    app.beginUndoGroup('Add loaded items');
    for (i = 1; i <= app.project.items.length; ++i){
        var comp = app.project.items[i];
        if (!(comp instanceof CompItem)){
            continue
        }

        var i = 1;
        while (i <= comp.numLayers) {
            var layer = comp.layer(i);
            var layer_source = layer.source;
            if (layer_source && layer_source.id == placeholder_item_id){
                var new_layer = comp.layers.add(item);
                new_layer.moveAfter(layer);
                // copy all(?) properties to new layer
                layer.property("ADBE Transform Group").copyToComp(new_layer);
                i = i + 1;
            }
            i = i + 1;
        }
    }
    app.endUndoGroup();
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

//var items = replaceItem('000f4259', ['C:\\projects\\ayon_dev\\shot02\\publish\\render\\renderAe_animationMain\\v019\\ad_shot02_renderAe_animationMain_v019.1001.png', 'C:\\projects\\ayon_dev\\shot02\\publish\\render\\renderAe_animationMain\\v019\\ad_shot02_renderAe_animationMain_v019.1002.png', 'C:\\projects\\ayon_dev\\shot02\\publish\\render\\renderAe_animationMain\\v019\\ad_shot02_renderAe_animationMain_v019.1003.png'], 'new name1', false);

// $.writeln(items);

// deleteItem('000f424c');